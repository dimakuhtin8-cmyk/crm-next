import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ chatId: string }>;
}

/**
 * PATCH /api/chats/[chatId]/read — Позначити чат прочитаним (unreadCount → 0)
 */
async function PATCHHandler(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { chatId } = await params;
    const chat = await tq.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return NextResponse.json({ error: 'Чат не знайдено' }, { status: 404 });
    }

    const updated = await tq.chat.update({
      where: { id: chatId },
      data: { unreadCount: 0 },
    });

    return NextResponse.json({ chat: updated });
  } catch (error) {
    console.error('Mark chat read error:', error);
    return NextResponse.json({ error: 'Помилка оновлення чату' }, { status: 500 });
  }
}

export const PATCH = withAuth({})(PATCHHandler);
