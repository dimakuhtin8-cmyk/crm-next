/**
 * PUT /api/user/password — зміна пароля користувача.
 *
 * Політика: щонайменше 8 символів (як при реєстрації), поточний пароль
 * перевіряється через bcrypt, новий має відрізнятися від поточного.
 */

import { prisma } from '@crm-next/database';
import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { extractUser } from '@/lib/auth-utils';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Введіть поточний пароль'),
  newPassword: z
    .string()
    .min(8, 'Пароль має бути не менше 8 символів')
    .max(128, 'Пароль завдовжки до 128 символів'),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await extractUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Невірні дані' },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    if (!record) {
      return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });
    }
    if (!record.password) {
      return NextResponse.json(
        { error: 'Акаунт входить через сторонній сервіс — пароль не встановлено' },
        { status: 400 },
      );
    }

    const valid = await compare(currentPassword, record.password);
    if (!valid) {
      return NextResponse.json({ error: 'Невірний поточний пароль' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'Новий пароль має відрізнятися від поточного' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hash(newPassword, 12) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Помилка зміни пароля' }, { status: 500 });
  }
}
