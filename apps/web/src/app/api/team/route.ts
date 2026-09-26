import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantQuery } from '@/lib/tenant-query';
import { extractUserId } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';
import { withAuth } from '@/lib/auth-guard';

/**
 * GET /api/team — List team members for the current tenant
 */
async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const { prisma } = await import('@crm-next/database');

    const memberships = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const members = memberships.map((m: { user: { id: string; name: string | null; email: string | null; image: string | null }; role: string }) => ({
      ...m.user,
      role: m.role,
    }));

    // Current user's role — UI uses it to hide owner-reassign controls from members.
    const userId = await extractUserId(request);
    const currentRole = userId ? await getUserRole(userId, tenantId) : null;

    return NextResponse.json({ members, currentRole });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ error: 'Помилка отримання команди' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
