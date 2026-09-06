import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import {
  generateKP, generateFollowUp, analyzeContact, generate,
  scoreDeal, generateRecommendations, smartSearch, checkAi,
} from '@/lib/ai/gemini';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { prisma } from '@crm-next/database';
import { checkUsageLimit, logAiRequest, incrementUsage } from '@/lib/ai/usage';
import { withAuth } from '@/lib/auth-guard';

async function getTenantAiSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { geminiApiKey: true, aiApiKey: true, aiProvider: true, aiModel: true },
  });
  return {
    apiKey: tenant?.aiApiKey || tenant?.geminiApiKey || null,
    provider: tenant?.aiProvider || 'gemini',
    model: tenant?.aiModel || null,
  };
}

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const aiSettings = await getTenantAiSettings(tq.tenantId);
    if (!aiSettings.apiKey && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI не налаштовано. Додайте GEMINI_API_KEY у налаштуваннях тенанта або в змінних оточення.' },
        { status: 503 },
      );
    }

    // Check usage limit before making AI request
    const usageCheck = await checkUsageLimit(tq.tenantId, aiSettings.provider);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Денний ліміт AI-запитів вичерпано.',
          limit: usageCheck.limit,
          current: usageCheck.current,
          resetAt: usageCheck.resetAt,
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { action, data } = body;
    let result: string | object;
    const startTime = Date.now();

    try {
      switch (action) {
      case 'kp': {
        result = await generateKP(data, aiSettings.apiKey, aiSettings.provider, aiSettings.model);
        break;
      }
      case 'followup': {
        result = await generateFollowUp(data, aiSettings.apiKey, aiSettings.provider, aiSettings.model);
        break;
      }
      case 'analyze': {
        const tenantId = tq.tenantId;
        const activities = await prisma.activity.findMany({
          where: { contactId: data.contactId, tenantId },
          orderBy: { date: 'desc' },
          take: 10,
        });
        const deals = await prisma.deal.findMany({
          where: { contactId: data.contactId, tenantId },
          include: { stage: { select: { name: true } } },
          take: 5,
        });
        const contact = await tq.contact.findFirst({ where: { id: data.contactId } });
        if (!contact) return NextResponse.json({ error: 'Контакт не знайдено' }, { status: 404 });

        result = await analyzeContact({
          firstName: contact.firstName,
          lastName: contact.lastName,
          company: contact.company,
          email: contact.email,
          activities: activities.map((a) => ({ type: a.type, title: a.title, date: a.date.toISOString() })),
          deals: deals.map((d) => ({ title: d.title, stage: d.stage.name, value: d.value })),
        }, aiSettings.apiKey, aiSettings.provider, aiSettings.model);

        await tq.contact.update({
          where: { id: data.contactId },
          data: { aiSummary: result as string, aiAnalyzedAt: new Date() },
        });
        break;
      }
      case 'score': {
        const tenantId = tq.tenantId;
        const deal = await tq.deal.findFirst({
          where: { id: data.dealId },
          include: { stage: { select: { name: true } } },
        }) as unknown as {
          id: string; title: string; value: number | null; contactId: string | null;
          updatedAt: Date; stage: { name: string };
        } | null;
        if (!deal) return NextResponse.json({ error: 'Угоду не знайдено' }, { status: 404 });

        const activities = deal.contactId
          ? await prisma.activity.findMany({
              where: { contactId: deal.contactId, tenantId },
              orderBy: { date: 'desc' },
            })
          : [];
        const lastActivity = activities[0];
        const daysSinceLast = lastActivity
          ? Math.floor((Date.now() - lastActivity.date.getTime()) / 86400000)
          : 999;
        const daysInStage = Math.floor((Date.now() - deal.updatedAt.getTime()) / 86400000);

        const score = await scoreDeal({
          title: deal.title,
          value: deal.value,
          stage: deal.stage.name,
          daysInStage,
          totalActivities: activities.length,
          daysSinceLastActivity: daysSinceLast,
          hasContact: !!deal.contactId,
        }, aiSettings.apiKey, aiSettings.provider, aiSettings.model);

        await tq.deal.update({
          where: { id: data.dealId },
          data: { aiScore: score, aiScoredAt: new Date() },
        });
        result = String(score);
        break;
      }
      case 'score-batch': {
        const deals = await prisma.deal.findMany({
          where: { tenantId: tq.tenantId, status: 'open' },
          include: { stage: { select: { name: true } } },
          take: 50,
        });

        const scored: Array<{ id: string; score: number }> = [];
        for (const deal of deals) {
          const activities = deal.contactId
            ? await prisma.activity.findMany({
                where: { contactId: deal.contactId, tenantId: tq.tenantId },
                orderBy: { date: 'desc' },
              })
            : [];
          const lastActivity = activities[0];
          const daysSinceLast = lastActivity
            ? Math.floor((Date.now() - lastActivity.date.getTime()) / 86400000)
            : 999;
          const daysInStage = Math.floor((Date.now() - deal.updatedAt.getTime()) / 86400000);

          const score = await scoreDeal({
            title: deal.title,
            value: deal.value,
            stage: deal.stage.name,
            daysInStage,
            totalActivities: activities.length,
            daysSinceLastActivity: daysSinceLast,
            hasContact: !!deal.contactId,
        }, aiSettings.apiKey, aiSettings.provider, aiSettings.model);

          await tq.deal.update({
            where: { id: deal.id },
            data: { aiScore: score, aiScoredAt: new Date() },
          });
          scored.push({ id: deal.id, score });
        }
        result = JSON.stringify(scored);
        break;
      }
      case 'recommendations': {
        const userId = (tq as { userId?: string }).userId || '';
        const overdueTasks = await prisma.task.findMany({
          where: {
            tenantId: tq.tenantId,
            assigneeId: userId,
            status: { notIn: ['done', 'cancelled'] },
            dueDate: { lt: new Date() },
          },
          take: 10,
        });
        const staleDeals = await prisma.deal.findMany({
          where: { tenantId: tq.tenantId, status: 'open' },
          include: { stage: { select: { name: true } } },
          orderBy: { updatedAt: 'asc' },
          take: 10,
        });

        const staleWithDays = staleDeals.map((d) => ({
          title: d.title,
          stage: d.stage.name,
          daysSince: Math.floor((Date.now() - d.updatedAt.getTime()) / 86400000),
        }));

        result = await generateRecommendations({
          overdueTasks: overdueTasks.map((t) => ({
            title: t.title,
            dueDate: t.dueDate?.toISOString() || 'Невідомо',
          })),
          staleDeals: staleWithDays,
          expiringContracts: [],
        }, aiSettings.apiKey, aiSettings.provider, aiSettings.model);
        break;
      }
      case 'search': {
        const parsed = await smartSearch(data.query, aiSettings.apiKey, aiSettings.provider, aiSettings.model);
        result = JSON.stringify(parsed);
        break;
      }
      case 'custom': {
        const genResult = await generate({
          prompt: data.prompt,
          system: data.system,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          tenantApiKey: aiSettings.apiKey,
          tenantAiProvider: aiSettings.provider,
          tenantAiModel: aiSettings.model,
        });
        result = genResult.response;
        break;
      }
      default:
        return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
      }

      // Log successful AI request
      const durationMs = Date.now() - startTime;
      await logAiRequest({
        tenantId: tq.tenantId,
        provider: aiSettings.provider,
        model: aiSettings.model || 'unknown',
        status: 'success',
        durationMs,
        promptPreview: data?.prompt || data?.query || undefined,
      });
      await incrementUsage(tq.tenantId, aiSettings.provider);

      return NextResponse.json({ result });
    } catch (aiError) {
      // Log failed AI request
      const durationMs = Date.now() - startTime;
      const isRateLimit = aiError instanceof Error &&
        (aiError.message.includes('429') || aiError.message.includes('rate limit'));
      await logAiRequest({
        tenantId: tq.tenantId,
        provider: aiSettings.provider,
        model: aiSettings.model || 'unknown',
        status: isRateLimit ? 'rate_limited' : 'error',
        durationMs,
        promptPreview: data?.prompt || data?.query || undefined,
        errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error',
      });
      throw aiError;
    }
  } catch (error) {
    console.error('AI error:', error);
    const message = error instanceof Error ? error.message : 'Помилка AI';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function GETHandler(request: NextRequest) {
  const hasEnvKey = !!process.env.GEMINI_API_KEY;
  if (hasEnvKey) {
    const isAvailable = await checkAi();
    return NextResponse.json({ available: isAvailable, provider: 'gemini' });
  }
  try {
    const tq = await getTenantQuery(request);
    if (tq) {
      const aiSettings = await getTenantAiSettings(tq.tenantId);
      if (aiSettings.apiKey) {
        return NextResponse.json({ available: true, provider: aiSettings.provider });
      }
    }
  } catch {}
  return NextResponse.json({ available: false, reason: 'AI не налаштовано' });
}

export const POST = withAuth({ permission: 'ai:use' })(POSTHandler);
export const GET = withAuth({ permission: 'ai:use' })(GETHandler);
