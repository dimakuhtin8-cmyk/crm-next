import { describe, it, expect } from 'vitest';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { extractUser, extractUserId } from '@/lib/auth-utils';

const SECRET = '4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=';

describe('JWE session (NextAuth-issued cookie)', () => {
  it('extractUser resolves id+tenantId from encrypted session cookie', async () => {
    const jwe = await encode({
      token: { sub: 'user-1', id: 'user-1', tenantId: 'tenant-1' },
      secret: SECRET,
      salt: '__Secure-authjs.session-token',
    });
    const req = new NextRequest(new URL('https://crm-next-5mij-six.vercel.app/api/ai/usage'), {
      headers: {
        cookie: `__Secure-authjs.session-token=${jwe}`,
        'x-forwarded-proto': 'https',
        host: 'crm-next-5mij-six.vercel.app',
      },
    });
    const user = await extractUser(req);
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-1');
    expect(user?.tenantId).toBe('tenant-1');
    expect(await extractUserId(req)).toBe('user-1');
  });

  it('garbage cookie returns null, not throw', async () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/ai/usage'), {
      headers: { cookie: '__Secure-authjs.session-token=garbage' },
    });
    expect(await extractUser(req)).toBeNull();
  });
});
