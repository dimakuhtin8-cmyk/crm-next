import { prisma } from '@crm-next/database';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeName, sanitizeEmail } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  // Rate limiting (per IP)
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Забагато запитів. Спробуйте пізніше.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await request.json();

    const parsed = z
      .object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email(),
        password: z.string().min(6),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Неверные данные' },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Sanitize inputs
    const sanitizedName = name ? sanitizeName(name) : undefined;
    const sanitizedEmail = sanitizeEmail(email);

    // Проверяем, существует ли пользователь
    const existing = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'Цей email вже зареєстрований' },
        { status: 400 }
      );
    }

    // Хэшируем пароль
    const passwordHash = await hash(password, 12);

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        password: passwordHash,
        emailVerified: new Date(), // для email/password сразу верифицируем
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
      },
      { headers: getRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Помилка реєстрації' },
      { status: 500 }
    );
  }
}
