import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { hasMinRole, getUserRole } from '@/lib/rbac';

interface Params {
  params: Promise<{ id: string; inviteId: string }>;
}

/**
 * DELETE /api/tenants/[id]/invites/[inviteId] — Revoke invite
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id: tenantId, inviteId } = await params;
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Only owner/admin can revoke invites
    if (!(await hasMinRole(userId, tenantId, 'admin'))) {
      return NextResponse.json(
        { error: 'Недостатньо прав для відкликання запрошення' },
        { status: 403 }
      );
    }

    // Find invite
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Запрошення не знайдено' },
        { status: 404 }
      );
    }

    // Delete invite
    await prisma.invite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke invite error:', error);
    return NextResponse.json(
      { error: 'Помилка відкликання запрошення' },
      { status: 500 }
    );
  }
}
