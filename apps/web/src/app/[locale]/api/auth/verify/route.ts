import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, signIn } from '@/auth/config';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const parsed = z
      .object({ token: z.string().min(1), email: z.string().email() })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Неверные данные' },
        { status: 400 }
      );
    }

    const { token, email } = parsed.data;
    const result = await verifyMagicLink(token, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Авторизуем пользователя через NextAuth
    await signIn('credentials', {
      email,
      password: 'magic-link', // специальный пароль для magic link
      redirect: false,
    });

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Verify magic link error:', error);
    return NextResponse.json(
      { error: 'Ошибка верификации' },
      { status: 500 }
    );
  }
}