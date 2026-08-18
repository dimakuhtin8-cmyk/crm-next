import { prisma } from '@crm-next/database';
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  // Rate limiting (per IP)
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Забагато спроб входу. Спробуйте пізніше.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await request.json();

    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(6) })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Неверные данные' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    const valid = await compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Credentials callback error:', error);
    return NextResponse.json(
      { error: 'Помилка авторизації' },
      { status: 500 }
    );
  }
}
