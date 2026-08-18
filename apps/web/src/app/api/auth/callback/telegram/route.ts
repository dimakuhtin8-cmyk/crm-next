import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyTelegramData(data: Record<string, string>): boolean {
  if (!BOT_TOKEN) return false;

  const { hash, ...userData } = data;
  if (!hash) return false;

  // Sort data check_string
  const dataCheckArr = Object.keys(userData)
    .sort()
    .map((key) => `${key}=${userData[key]}`);

  const dataCheckString = dataCheckArr.join('\n');

  // HMAC-SHA256
  const crypto = require('crypto');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return hmac === hash;
}

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = body;

    if (!id || !first_name || !hash) {
      return NextResponse.json({ error: 'Відсутні обов\'язкові дані' }, { status: 400 });
    }

    // Verify Telegram data
    const isValid = verifyTelegramData(body);
    if (!isValid) {
      return NextResponse.json({ error: 'Невірні дані Telegram' }, { status: 401 });
    }

    // Check auth_date (5 min tolerance)
    const authTimestamp = parseInt(auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - authTimestamp) > 300) {
      return NextResponse.json({ error: 'Час авторизації вичерпано' }, { status: 401 });
    }

    const telegramId = String(id);

    // Find existing user by telegramId or create new one
    let user = await prisma.user.findFirst({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          name: [first_name, last_name].filter(Boolean).join(' '),
          image: photo_url || null,
          emailVerified: new Date(),
        },
      });
    } else {
      // Update user info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: [first_name, last_name].filter(Boolean).join(' ') || user.name,
          image: photo_url || user.image,
        },
      });
    }

    // Create JWT session token
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const token = await new SignJWT({ sub: user.id, name: user.name, email: user.email, image: user.image })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('authjs.session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, image: user.image },
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json(
      { error: 'Помилка авторизації' },
      { status: 500 }
    );
  }
}
