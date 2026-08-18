import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function verifyCSRF(request: NextRequest): boolean {
  // Skip for same-origin requests (no Origin header = same-origin)
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // If no origin header, it's a same-origin request (allowed)
  if (!origin) return true;

  // Check if origin matches allowed origins
  try {
    const originUrl = new URL(origin);
    return ALLOWED_ORIGINS.some((allowed) => {
      const allowedUrl = new URL(allowed);
      return originUrl.hostname === allowedUrl.hostname && originUrl.port === allowedUrl.port;
    });
  } catch {
    return false;
  }
}

export function csrfProtection(request: NextRequest): NextResponse | null {
  if (!verifyCSRF(request)) {
    return NextResponse.json(
      { error: 'CSRF захист: невідомий origin' },
      { status: 403 }
    );
  }
  return null; // Allowed
}
