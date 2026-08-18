import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { extractUserId } from '@/lib/auth-utils';

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/invites/[token] — Accept invite
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Find invite
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 });
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Запрошення прострочено' }, { status: 400 });
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json({ error: 'Запрошення вже прийнято' }, { status: 400 });
    }

    // Check email matches
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invite.email) {
      return NextResponse.json(
        { error: 'Запрошення призначене для іншого email' },
        { status: 403 }
      );
    }

    // Check if already member
    const existingMember = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId, tenantId: invite.tenantId } },
    });

    if (existingMember) {
      // Mark invite as accepted
      await prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return NextResponse.json({ success: true, tenant: invite.tenant });
    }

    // Create membership and mark invite
    await prisma.$transaction([
      prisma.tenantMember.create({
        data: {
          userId,
          tenantId: invite.tenantId,
          role: invite.role,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, tenant: invite.tenant });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Помилка прийняття запрошення' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invites/[token] — Get invite info (before accepting)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      select: {
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        tenant: { select: { name: true, slug: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Запрошення прострочено' }, { status: 400 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ error: 'Запрошення вже прийнято' }, { status: 400 });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Get invite error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання запрошення' },
      { status: 500 }
    );
  }
}
