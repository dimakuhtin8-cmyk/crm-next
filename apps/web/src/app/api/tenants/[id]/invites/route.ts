import crypto from 'crypto';

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { hasMinRole, getUserRole } from '@/lib/rbac';


interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenants/[id]/invites — List pending invites
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const role = await getUserRole(userId, id);
    if (!role) {
      return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
    }

    const invites = await prisma.invite.findMany({
      where: {
        tenantId: id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('List invites error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку запрошень' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants/[id]/invites — Send invite
 */
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member'),
});

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Only owner/admin can invite
    if (!(await hasMinRole(userId, id, 'admin'))) {
      return NextResponse.json(
        { error: 'Недостатньо прав для запрошення' },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.tenantMember.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId: id } },
      });
      if (existingMember) {
        return NextResponse.json(
          { error: 'Користувач вже є учасником цієї компанії' },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        tenantId: id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Запрошення вже надіслано' },
        { status: 400 }
      );
    }

    // Create invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.invite.create({
      data: {
        email,
        tenantId: id,
        role,
        token,
        expiresAt,
        invitedById: userId,
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        tenant: {
          select: { name: true, slug: true },
        },
      },
    });

    // TODO: Send email with invite link
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invites/${token}`;
    console.log(`[Invite] Email: ${email}\nLink: ${inviteUrl}\nExpires: ${expiresAt}`);

    return NextResponse.json({ invite, inviteUrl }, { status: 201 });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Помилка надсилання запрошення' },
      { status: 500 }
    );
  }
}
