import { prisma } from '@crm-next/database';
import { NextResponse, type NextRequest } from 'next/server';

import { extractUserId } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ count: 0 });
    }

    // Get user's tenant
    const member = await prisma.tenantMember.findFirst({
      where: { userId },
      select: { tenantId: true },
    });

    if (!member) {
      return NextResponse.json({ count: 0 });
    }

    // Count unread chats (Telegram + WhatsApp) by the dedicated flag.
    // lastMessageAt means "client wrote last" and must NOT drive this counter.
    const [telegramCount, whatsappCount] = await Promise.all([
      prisma.telegramChat.count({
        where: {
          tenantId: member.tenantId,
          unread: true,
        },
      }),
      prisma.whatsAppChat.count({
        where: {
          tenantId: member.tenantId,
          unread: true,
        },
      }),
    ]);

    return NextResponse.json({ count: telegramCount + whatsappCount });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
