import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { sendMagicLink } from '@/auth/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
