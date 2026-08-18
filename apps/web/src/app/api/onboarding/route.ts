import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { extractUser } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';


/**
 * POST /api/onboarding — Complete onboarding
 * Body: { companyName: string, industry?: string, pipelineStages?: string[] }
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const user = await extractUser(request);
    if (!user?.id) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { companyName, industry, pipelineStages } = await request.json();

    // Mark user as onboarded
    await prisma.user.update({
      where: { id: user.id },
      data: { hasOnboarded: true },
    });

    // Update tenant name if provided
    if (companyName && user.tenantId) {
      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: { name: companyName },
      });
    }

    // Create default pipeline stages if provided
    if (pipelineStages && Array.isArray(pipelineStages) && pipelineStages.length > 0 && user.tenantId) {
      const existingPipeline = await prisma.pipeline.findFirst({
        where: { tenantId: user.tenantId },
      });

      if (!existingPipeline) {
        const pipeline = await prisma.pipeline.create({
          data: {
            tenantId: user.tenantId,
            name: 'Основна воронка',
            isDefault: true,
          },
        });

        for (let i = 0; i < pipelineStages.length; i++) {
          await prisma.pipelineStage.create({
            data: {
              pipelineId: pipeline.id,
              name: pipelineStages[i],
              order: i,
              color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5],
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Помилка' }, { status: 500 });
  }
}

/**
 * GET /api/onboarding — Check onboarding status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await extractUser(request);
    if (!user?.id) return NextResponse.json({ hasOnboarded: false });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hasOnboarded: true },
    });

    return NextResponse.json({ hasOnboarded: dbUser?.hasOnboarded || false });
  } catch {
    return NextResponse.json({ hasOnboarded: false });
  }
}
