import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { sendMessageToChannel } from '@/lib/channels';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ chatId: string }>;
}

/**
 * GET /api/chats/[chatId]/messages — Історія повідомлень (tenant-scoped, paginated)
 *
 * page 1 = найновіші (orderBy createdAt desc); UI рендерить у зворотному порядку.
 * Query: page, limit (max 100)
 */
async function GETHandler(request: NextRequest, { params }: Params) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      tq.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tq.chatMessage.count({ where: { chatId } }),
    ]);

    return NextResponse.json({ messages, total, page, limit });
  } catch (error) {
    console.error('List chat messages error:', error);
    return NextResponse.json({ error: 'Помилка отримання повідомлень' }, { status: 500 });
  }
}

const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(4096),
});

/**
 * POST /api/chats/[chatId]/messages — Надіслати повідомлення менеджера в канал
 *
 * Викликає sendMessageToChannel(chatId, content), зберігає ChatMessage
 * з senderType: USER. Помилка відправки → повідомлення зберігається
 * зі статусом FAILED, відповідь 502 з текстом помилки провайдера.
 */
async function POSTHandler(request: NextRequest, { params }: Params) {
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

    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const content = parsed.data.content;
    const sendResult = await sendMessageToChannel(chatId, content);

    const message = await tq.chatMessage.create({
      data: {
        chatId,
        senderType: 'USER',
        content,
        externalMessageId: sendResult.externalMessageId ?? null,
        status: sendResult.ok ? 'DELIVERED' : 'FAILED',
      },
    });

    await tq.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() },
    });

    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error || 'Не вдалося надіслати повідомлення', message },
        { status: 502 },
      );
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Send chat message error:', error);
    return NextResponse.json({ error: 'Помилка надсилання повідомлення' }, { status: 500 });
  }
}

export const GET = withAuth({})(GETHandler);
export const POST = withAuth({})(POSTHandler);
