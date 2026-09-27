import { prisma } from '@crm-next/database';
import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';

async function POSTHandler(request: NextRequest) {
  try {
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false });
    }

    // Get user's tenant
    const member = await prisma.tenantMember.findFirst({
      where: { userId },
      select: { tenantId: true },
    });

    if (!member) {
      return NextResponse.json({ success: false });
    }

    // Mark all chats as read via the dedicated flag.
    // lastMessageAt is intentionally untouched: it means "client wrote last",
    // not "manager has read it".
    await Promise.all([
      prisma.telegramChat.updateMany({
        where: { tenantId: member.tenantId },
        data: { unread: false },
      }),
      prisma.whatsAppChat.updateMany({
        where: { tenantId: member.tenantId },
        data: { unread: false },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}

export const POST = withAuth()(POSTHandler);
