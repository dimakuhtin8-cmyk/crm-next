import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth/config';
import { getTrialEndsAt } from '@/lib/billing/plans';
import { surveyIds } from '@/lib/onboarding/survey';

const surveySchema = z.object({
  industry: z.enum(surveyIds.industry as [string, ...string[]]),
  industryCustom: z.string().max(100).nullable().optional(),
  role: z.enum(surveyIds.role as [string, ...string[]]),
  roleCustom: z.string().max(100).nullable().optional(),
  experience: z.enum(surveyIds.experience as [string, ...string[]]),
  experienceText: z.string().max(200).nullable().optional(),
  priorityTask: z.enum(surveyIds.priorityTask as [string, ...string[]]),
  priorityCustom: z.string().max(200).nullable().optional(),
});

/**
 * POST /api/onboarding — Complete onboarding
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { companyName, pipelineStages, survey: rawSurvey } = await request.json();

    const parsedSurvey = rawSurvey == null ? null : surveySchema.safeParse(rawSurvey);
    if (rawSurvey != null && !parsedSurvey?.success) {
      return NextResponse.json({ error: 'Невірні дані опитування' }, { status: 400 });
    }
    const survey = parsedSurvey?.success ? parsedSurvey.data : null;

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });

    // Get or create tenant
    let tenantId = (session as { tenantId?: string })?.tenantId;
    let tenantJustCreated = false;
    if (!tenantId) {
      const membership = await prisma.tenantMember.findFirst({ where: { userId } });
      if (membership) {
        tenantId = membership.tenantId;
      } else {
        const tenant = await prisma.tenant.create({
          data: {
            name: companyName || `${dbUser.name || dbUser.email || 'CRM'}`,
            slug: `tenant-${dbUser.id.slice(0, 8)}`,
            subscriptionStatus: 'trialing',
            trialEndsAt: getTrialEndsAt(),
          },
        });
        await prisma.tenantMember.create({
          data: { userId, tenantId: tenant.id, role: 'owner' },
        });
        tenantId = tenant.id;
        tenantJustCreated = true;
      }
    }

    // Опитування пишемо лише для щойно створеного тенанта (пряма реєстрація),
    // щоб не затирати налаштування чужої команди запрошеному учаснику.
    // Налаштування мержимо, а не перезаписуємо (там же toast-преференси).
    if (survey && tenantJustCreated) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      let settings: Record<string, unknown> = {};
      try {
        settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
      } catch {
        settings = {};
      }
      settings.onboarding = { ...survey, completedAt: new Date().toISOString() };
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: JSON.stringify(settings) },
      });
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
        const colors = ['#2563EB', '#929789', '#C6A27F', '#7B5337', '#30304A'];
        for (let i = 0; i < pipelineStages.length; i++) {
          await prisma.pipelineStage.create({
            data: {
              pipelineId: pipeline.id,
              name: pipelineStages[i],
              order: i,
              color: colors[i % 5],
            },
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
