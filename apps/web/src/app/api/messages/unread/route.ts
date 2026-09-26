import { NextResponse, type NextRequest } from 'next/server';
import { extractUserId } from '@/lib/auth-utils';
import { prisma } from '@crm-next/database';

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

    // Count unread chats (Telegram + WhatsApp)
    // For now, count chats where lastMessageAt is recent (last 24h) as "unread"
    // In the future, this should use a proper unread flag
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [telegramCount, whatsappCount] = await Promise.all([
      prisma.telegramChat.count({
        where: {
          tenantId: member.tenantId,
          lastMessageAt: { gte: yesterday },
        },
      }),
      prisma.whatsAppChat.count({
        where: {
          tenantId: member.tenantId,
          lastMessageAt: { gte: yesterday },
        },
      }),
    ]);

    return NextResponse.json({ count: telegramCount + whatsappCount });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
