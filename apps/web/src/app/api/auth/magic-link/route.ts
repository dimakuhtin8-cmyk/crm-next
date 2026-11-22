import { NextResponse } from 'next/server';
import { z } from 'zod';

import { sendMagicLink } from '@/auth/config';
import { csrfProtection } from '@/lib/csrf';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  // Rate limiting (per IP)
  const ip =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = checkRateLimit(`magic-link:${ip}`, RATE_LIMITS.magicLink);
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
      .object({ email: z.string().email(), locale: z.string().default('uk') })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
    }

    const { email, locale } = parsed.data;
    const result = await sendMagicLink(email, locale);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Помилка надсилання посилання' }, { status: 500 });
  }
}
