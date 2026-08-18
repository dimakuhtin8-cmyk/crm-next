import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { canManageRole, getUserRole, type TenantRole } from '@/lib/rbac';

interface Params {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * PUT /api/tenants/[id]/members/[memberId] — Change member role
 */
const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id: tenantId, memberId } = await params;
    const body = await request.json();

    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { role } = parsed.data;

    // Get requester from token
    const token = request.cookies.get('authjs.session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const requesterId = payload.id as string;

    // Check requester has permission
    const requesterRole = await getUserRole(requesterId, tenantId);
    if (!requesterRole) {
      return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
    }

    // Get target member
    const targetMember = await prisma.tenantMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Учасника не знайдено' }, { status: 404 });
    }

    // Cannot change own role
    if (targetMember.userId === requesterId) {
      return NextResponse.json(
        { error: 'Не можна змінювати власну роль' },
        { status: 400 }
      );
    }

    // Cannot change owner role
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Не можна змінювати роль власника' },
        { status: 400 }
      );
    }

    // Check hierarchy
    if (!canManageRole(requesterRole, targetMember.role as TenantRole)) {
      return NextResponse.json(
        { error: 'Недостатньо прав для зміни ролі' },
        { status: 403 }
      );
    }

    // Update role
    const updated = await prisma.tenantMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error('Update member role error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення ролі' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants/[id]/members/[memberId] — Remove member
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id: tenantId, memberId } = await params;

    // Get requester from token
    const token = request.cookies.get('authjs.session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const requesterId = payload.id as string;

    // Check requester has permission
    const requesterRole = await getUserRole(requesterId, tenantId);
    if (!requesterRole) {
      return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
    }

    // Get target member
    const targetMember = await prisma.tenantMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Учасника не знайдено' }, { status: 404 });
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Не можна видаляти власника' },
        { status: 400 }
      );
    }

    // Cannot remove self (use leave instead)
    if (targetMember.userId === requesterId) {
      return NextResponse.json(
        { error: 'Для виходу з компанії використовуйте "Покинути компанію"' },
        { status: 400 }
      );
    }

    // Check hierarchy
    if (!canManageRole(requesterRole, targetMember.role as TenantRole)) {
      return NextResponse.json(
        { error: 'Недостатньо прав для видалення учасника' },
        { status: 403 }
      );
    }

    // Remove member
    await prisma.tenantMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: 'Помилка видалення учасника' },
      { status: 500 }
    );
  }
}
