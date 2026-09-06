import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import { auth } from '@/auth/config';

/**
 * POST /api/onboarding — Complete onboarding
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { companyName, industry, pipelineStages } = await request.json();

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });

    // Get or create tenant
    let tenantId = (session as { tenantId?: string })?.tenantId;
    if (!tenantId) {
      const membership = await prisma.tenantMember.findFirst({ where: { userId } });
      if (membership) {
        tenantId = membership.tenantId;
      } else {
        const tenant = await prisma.tenant.create({
          data: {
            name: companyName || `${dbUser.name || dbUser.email || 'CRM'}`,
            slug: `tenant-${dbUser.id.slice(0, 8)}`,
          },
        });
        await prisma.tenantMember.create({
          data: { userId, tenantId: tenant.id, role: 'owner' },
        });
        tenantId = tenant.id;
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { hasOnboarded: true } });

    if (companyName && tenantId) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { name: companyName } });
    }

    if (pipelineStages?.length && tenantId) {
      const existing = await prisma.pipeline.findFirst({ where: { tenantId } });
      if (!existing) {
        const pipeline = await prisma.pipeline.create({
          data: { tenantId, name: 'Основна воронка', isDefault: true },
        });
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        for (let i = 0; i < pipelineStages.length; i++) {
          await prisma.pipelineStage.create({
            data: { pipelineId: pipeline.id, name: pipelineStages[i], order: i, color: colors[i % 5] },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}

/**
 * GET /api/onboarding — Check onboarding status
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ hasOnboarded: false });

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { hasOnboarded: true },
    });

    return NextResponse.json({ hasOnboarded: dbUser?.hasOnboarded || false });
  } catch {
    return NextResponse.json({ hasOnboarded: false });
  }
}
