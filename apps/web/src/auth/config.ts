import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@crm-next/database';
import { compare } from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';

import type { NextAuthConfig } from 'next-auth';

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    Credentials({
      name: 'email',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'your@email.com' },
        password: { label: 'Пароль', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const valid = await compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email ?? '', name: user.name ?? null, image: user.image ?? null };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;

        // Fetch user's default tenant (first tenant they're a member of)
        try {
          const membership = await prisma.tenantMember.findFirst({
            where: { userId: user.id },
            include: { tenant: { select: { id: true, slug: true } } },
          });
          if (membership) {
            token.tenantId = membership.tenant.id;
            token.tenantSlug = membership.tenant.slug;
          }
        } catch {
          // Tenant not found - user may not have a tenant yet
        }
      }
      if (account) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        (session.user as { id: string }).id = token.id as string;
      }
      if (token.tenantId) {
        (session as { tenantId?: string }).tenantId = token.tenantId as string;
      }
      if (token.tenantSlug) {
        (session as { tenantSlug?: string }).tenantSlug = token.tenantSlug as string;
      }
      return session;
    },
  },
};

const _nextAuth = NextAuth(config);

export const { handlers, auth, signOut } = _nextAuth;

export async function signIn(provider: string, options?: Record<string, unknown>, redirectTo?: string) {
  return _nextAuth.signIn(provider as never, options as never, redirectTo);
}

export async function sendMagicLink(email: string, locale = 'uk') {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
  
  console.log(`[Magic Link] Email: ${email}\nLink: ${link}\nExpires: ${expires}`);
  
  return { success: true as const, link };
}

export async function verifyMagicLink(token: string, email: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    return { success: false as const, error: 'Неверная или просроченная ссылка' };
  }

  await prisma.verificationToken.delete({ where: { token } });

  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
  } else if (!user.emailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }

  return { success: true as const, user };
}

export function generateTelegramLoginUrl(returnTo = '/dashboard') {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) return null;

  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const params = new URLSearchParams({
    origin: origin ?? '',
    return_to: returnTo,
  });

  return `https://t.me/${botUsername}/login?${params.toString()}`;
}

export async function handleTelegramCallback(data: Record<string, string>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const { hash: _, ...userData } = data;
  
  const telegramId = userData.id;
  const email = userData.email;
  const firstName = userData.first_name;
  const lastName = userData.last_name || '';
  const username = userData.username;

  if (!telegramId) throw new Error('No telegram id');

  return { telegramId, email, firstName, lastName, username };
}