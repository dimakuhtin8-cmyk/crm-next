import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { csrfProtection } from '@/lib/csrf';
import { decrypt } from '@/lib/encryption';
import { getTenantQuery } from '@/lib/tenant-query';

const CHANNELS = ['TELEGRAM', 'WHATSAPP', 'EMAIL', 'SMS'];

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return '[пошкоджено]';
  }
}

/**
 * GET /api/chats — Список активних чатів (tenant-scoped)
 *
 * Останнє повідомлення (preview), unreadCount, деталі контакту.
 * Query: channel (TELEGRAM|WHATSAPP|EMAIL|SMS), search (ім'я контакту), page, limit
 */
async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (channel && CHANNELS.includes(channel)) {
      where.channel = channel;
    }
    if (search) {
      where.contact = {
        OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }],
      };
    }

    const [chats, total] = await Promise.all([
      tq.chat.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
            },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      tq.chat.count({ where }),
    ]);

    const items = chats.map(
      (chat: {
        messages?: Array<{
          id: string;
          content: string;
          senderType: string;
          status: string;
          createdAt: Date;
        }>;
        contact?: ({ phone: string | null } & Record<string, unknown>) | null;
        [key: string]: unknown;
      }) => {
        const { messages, contact, ...rest } = chat;
        return {
          ...rest,
          contact: contact
            ? { ...contact, phone: contact.phone ? safeDecrypt(contact.phone) : contact.phone }
            : null,
          lastMessage: messages?.[0] ?? null,
        };
      },
    );

    return NextResponse.json({ chats: items, total, page, limit });
  } catch (error) {
    console.error('List chats error:', error);
    return NextResponse.json({ error: 'Помилка отримання списку чатів' }, { status: 500 });
  }
}

export const GET = withAuth({})(GETHandler);
