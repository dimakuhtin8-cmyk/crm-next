import { NextResponse, type NextRequest } from 'next/server';
import { extractUserId } from '@/lib/auth-utils';
import { prisma } from '@crm-next/database';
import { withAuth } from '@/lib/auth-guard';

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

    // Mark all chats as read by updating lastMessageAt to now
    // In the future, this should use a proper readAt field
    const now = new Date();
    
    await Promise.all([
      prisma.telegramChat.updateMany({
        where: { tenantId: member.tenantId },
        data: { lastMessageAt: now },
      }),
      prisma.whatsAppChat.updateMany({
        where: { tenantId: member.tenantId },
        data: { lastMessageAt: now },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}

export const POST = withAuth()(POSTHandler);
