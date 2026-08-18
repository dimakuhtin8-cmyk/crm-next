import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@crm-next/database';
import { compare } from 'bcryptjs';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(6) })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Неверные данные' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    const valid = await compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Credentials callback error:', error);
    return NextResponse.json(
      { error: 'Помилка авторизації' },
      { status: 500 }
    );
  }
}