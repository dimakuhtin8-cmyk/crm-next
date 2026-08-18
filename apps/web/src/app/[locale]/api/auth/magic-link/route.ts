import { NextRequest, NextResponse } from 'next/server';
import { sendMagicLink } from '@/auth/config';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const parsed = z
      .object({ email: z.string().email(), locale: z.string().default('uk') })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Неверный email' },
        { status: 400 }
      );
    }

    const { email, locale } = parsed.data;
    const result = await sendMagicLink(email, locale);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json(
      { error: 'Ошибка отправки ссылки' },
      { status: 500 }
    );
  }
}