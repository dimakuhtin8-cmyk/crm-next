import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { handlers } from '@/auth/config';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

const { GET } = handlers;

// Rate-limit только на попытки входа паролем (защита от перебора).
// Остальные NextAuth-эндпоинты (csrf, session, oauth-редиректы) — без лимита.
export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith('/callback/credentials')) {
    const ip =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Забагато спроб входу. Спробуйте пізніше.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
      );
    }
  }

  return handlers.POST(request);
}

export { GET };
