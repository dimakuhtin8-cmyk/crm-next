import { prisma } from '@crm-next/database';
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = z
      // Вход: только форма (непустой пароль). Старые 6-символьные пароли
      // блокировать нельзя — правило 8 символов действует лишь при создании/смене.
      .object({ email: z.string().email(), password: z.string().min(1) })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Невірний email або пароль' }, { status: 401 });
    }

    const valid = await compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Невірний email або пароль' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Credentials callback error:', error);
    return NextResponse.json({ error: 'Помилка авторизації' }, { status: 500 });
  }
}
