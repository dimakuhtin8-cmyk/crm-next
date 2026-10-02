/**
 * PUT /api/user/profile — оновлення профілю користувача.
 *
 * У схемі User є лише name (телефон/пояс/мова — демонстраційні поля форми,
 * без колонок у БД), тому персиститься тільки ім'я.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { extractUser } from '@/lib/auth-utils';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ім’я має містити щонайменше 2 символи')
    .max(100, 'Ім’я завдовжки до 100 символів'),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await extractUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Невірні дані' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
    });

    return NextResponse.json({ success: true, name: parsed.data.name });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Помилка збереження профілю' }, { status: 500 });
  }
}
