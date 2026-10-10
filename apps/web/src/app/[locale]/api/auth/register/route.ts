import { prisma } from '@crm-next/database';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { passwordSchema } from '@/lib/validation/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = z
      .object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email(),
        password: passwordSchema,
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    // Проверяем, существует ли пользователь
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Цей email вже зареєстрований' }, { status: 400 });
    }

    // Хэшируем пароль
    const passwordHash = await hash(password, 12);

    // Создаем пользователя + персональный тенант (owner), иначе аккаунт
    // останется без тенанта и все tenant-scoped запросы вернут 400.
    const slug = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        emailVerified: new Date(), // для email/password сразу верифицируем
        tenantMembers: {
          create: {
            tenant: {
              create: {
                name: name || email.split('@')[0],
                slug: `${slug}-${Date.now()}`,
              },
            },
            role: 'owner',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Помилка реєстрації' }, { status: 500 });
  }
}
