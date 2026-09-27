/**
 * Guard for machine-to-machine worker routes (queue/process, automation/tick).
 *
 * These are called ONLY by the external scheduler, never by users —
 * so they use a shared CRON_SECRET header instead of user sessions.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export function verifyWorkerSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET не налаштовано на сервері' },
      { status: 500 }
    );
  }

  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!provided) {
    return NextResponse.json({ error: 'Missing worker secret' }, { status: 401 });
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid worker secret' }, { status: 403 });
  }

  return null;
}
