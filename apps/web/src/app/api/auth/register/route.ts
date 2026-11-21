import { prisma } from '@crm-next/database';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeName, sanitizeEmail } from '@/lib/sanitize';
import { passwordSchema } from '@/lib/validation/password';

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  // Rate limiting (per IP)
  const ip =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Забагато запитів. Спробуйте пізніше.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const parsed = z
      .object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email(),
        password: passwordSchema,
        // Фіксація згоди з офертою/політикою (з чекбокса у формі) — обов'язково
        termsAccepted: z.boolean(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const { name, email, password, termsAccepted } = parsed.data;

    // Согласие обязательно: без него регистрация невозможна
    if (!termsAccepted) {
      return NextResponse.json(
        { error: 'Підтвердіть згоду з умовами використання та політикою конфіденційності' },
        { status: 400 },
      );
    }

    // Sanitize inputs
    const sanitizedName = name ? sanitizeName(name) : undefined;
    const sanitizedEmail = sanitizeEmail(email);

    // Проверяем, существует ли пользователь
    const existing = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Цей email вже зареєстрований' }, { status: 400 });
    }

    // Хэшируем пароль
    const passwordHash = await hash(password, 12);

    // Создаем пользователя + тенант автоматически
    const slug = sanitizedEmail
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        password: passwordHash,
        emailVerified: new Date(),
        // Согласие подтверждено выше — всегда фиксируем дату
        termsAcceptedAt: new Date(),
        hasOnboarded: true,
        tenantMembers: {
          create: {
            tenant: {
              create: {
                name: sanitizedName || sanitizedEmail.split('@')[0],
                slug: `${slug}-${Date.now()}`,
              },
            },
            role: 'owner',
          },
        },
      },
      include: {
        tenantMembers: {
          include: { tenant: { select: { id: true, slug: true } } },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
      },
      { headers: getRateLimitHeaders(rateLimitResult) },
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Помилка реєстрації' }, { status: 500 });
  }
}
