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
 * GET /api/tenants/[id]/members — List members
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

    // Check membership
    const role = await getUserRole(userId, id);
    if (!role) {
      return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
    }

    const members = await prisma.tenantMember.findMany({
      where: { tenantId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('List members error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку учасників' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants/[id]/members — Add member (owner/admin only)
 */
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member'),
});

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = addMemberSchema.safeParse(body);
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

    // Only owner/admin can add members
    if (!(await hasMinRole(userId, id, 'admin'))) {
      return NextResponse.json(
        { error: 'Недостатньо прав для додавання учасників' },
        { status: 403 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: 'Користувача з таким email не знайдено' },
        { status: 404 }
      );
    }

    // Check if already member
    const existingMember = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: id } },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Користувач вже є учасником цієї компанії' },
        { status: 400 }
      );
    }

    const member = await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId: id,
        role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json(
      { error: 'Помилка додавання учасника', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
