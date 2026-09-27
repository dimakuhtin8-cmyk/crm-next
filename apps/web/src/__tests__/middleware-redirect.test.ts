/**
 * П1: legacy-пути без локали — редирект, а не пустой дашборд.
 * Деревья app/dashboard/* и app/auth/* удалены; middleware 301-редиректит
 * /dashboard/* → /uk/dashboard/* и /auth/* → /uk/auth/*.
 * Тестируется напрямую функция middleware (unit test: без сети, без БД).
 */

import { NextRequest } from 'next/server';
import { describe, it, expect } from 'vitest';

import { middleware } from '@/middleware';

function req(path: string, cookie?: string) {
  const r = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (cookie) r.cookies.set('authjs.session-token', cookie);
  return r;
}

describe('П1: legacy-редиректы middleware', () => {
  it('/dashboard/contacts без сессии → 301 на /uk/dashboard/contacts', () => {
    const res = middleware(req('/dashboard/contacts'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/uk/dashboard/contacts');
  });

  it('/auth/login без сессии → 301 на /uk/auth/login', () => {
    const res = middleware(req('/auth/login'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/uk/auth/login');
  });

  it('/uk/dashboard/contacts без сессии → редирект на логин с callbackUrl', () => {
    const res = middleware(req('/uk/dashboard/contacts'));
    expect([307, 308]).toContain(res.status);
    const loc = res.headers.get('location') || '';
    expect(loc).toContain('/uk/auth/login');
    expect(loc).toContain(encodeURIComponent('/uk/dashboard/contacts'));
  });

  it('/uk/dashboard/contacts с сессией → пропуск (не редирект)', () => {
    const res = middleware(req('/uk/dashboard/contacts', 'fake-session'));
    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
  });
});
