import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import {
  generateKP,
  generateFollowUp,
  analyzeContact,
  generate,
  scoreDeal,
  generateRecommendations,
  smartSearch,
  checkAi,
  AiApiError,
} from '@/lib/ai/gemini';
import { getProviderKeyRaw } from '@/lib/ai/keys';
import { getProvider } from '@/lib/ai/providers';
import { checkUsageLimit, logAiRequest, incrementUsage } from '@/lib/ai/usage';
import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

async function getTenantAiSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiModel: true },
  });
  const provider = tenant?.aiProvider || 'gemini';
  // RAW encrypted key — resolveConfig() decrypts it downstream.
  // Per-provider store (AiProviderKey) first, legacy tenant fields as fallback.
  const apiKey = await getProviderKeyRaw(tenantId, provider);
  return {
    apiKey,
    provider,
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
        {
          error:
            'AI не налаштовано. Додайте GEMINI_API_KEY у налаштуваннях тенанта або в змінних оточення.',
        },
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
    let sources: Array<{ id: string; type: string; name: string }> = [];
    let activeSessionId: string | undefined;
    // П3: tool-call trace for the AI log (name/rows/truncated only, no PII).
    const toolCallLogs: Array<{ tool: string; rows: number; truncated: boolean }> = [];
    const startTime = Date.now();

    try {
      switch (action) {
        case 'kp': {
          result = await generateKP(data, aiSettings.apiKey, aiSettings.provider, aiSettings.model);
          break;
        }
        case 'followup': {
          result = await generateFollowUp(
            data,
            aiSettings.apiKey,
            aiSettings.provider,
            aiSettings.model,
          );
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

          result = await analyzeContact(
            {
              firstName: contact.firstName,
              lastName: contact.lastName,
              company: contact.company,
              email: contact.email,
              activities: activities.map((a) => ({
                type: a.type,
                title: a.title,
                date: a.date.toISOString(),
              })),
              deals: deals.map((d) => ({ title: d.title, stage: d.stage.name, value: d.value })),
            },
            aiSettings.apiKey,
            aiSettings.provider,
            aiSettings.model,
          );

          await tq.contact.update({
            where: { id: data.contactId },
            data: { aiSummary: result as string, aiAnalyzedAt: new Date() },
          });
          break;
        }
        case 'score': {
          const tenantId = tq.tenantId;
          const deal = (await tq.deal.findFirst({
            where: { id: data.dealId },
            include: { stage: { select: { name: true } } },
          })) as unknown as {
            id: string;
            title: string;
            value: number | null;
            contactId: string | null;
            updatedAt: Date;
            stage: { name: string };
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

          const score = await scoreDeal(
            {
              title: deal.title,
              value: deal.value,
              stage: deal.stage.name,
              daysInStage,
              totalActivities: activities.length,
              daysSinceLastActivity: daysSinceLast,
              hasContact: !!deal.contactId,
            },
            aiSettings.apiKey,
            aiSettings.provider,
            aiSettings.model,
          );

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

            const score = await scoreDeal(
              {
                title: deal.title,
                value: deal.value,
                stage: deal.stage.name,
                daysInStage,
                totalActivities: activities.length,
                daysSinceLastActivity: daysSinceLast,
                hasContact: !!deal.contactId,
              },
              aiSettings.apiKey,
              aiSettings.provider,
              aiSettings.model,
            );

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

          result = await generateRecommendations(
            {
              overdueTasks: overdueTasks.map((t) => ({
                title: t.title,
                dueDate: t.dueDate?.toISOString() || 'Невідомо',
              })),
              staleDeals: staleWithDays,
              expiringContracts: [],
            },
            aiSettings.apiKey,
            aiSettings.provider,
            aiSettings.model,
          );
          break;
        }
        case 'search': {
          const parsed = await smartSearch(
            data.query,
            aiSettings.apiKey,
            aiSettings.provider,
            aiSettings.model,
          );
          result = JSON.stringify(parsed);
          break;
        }
        case 'custom': {
          // Model picker in chat UI wins if provided; otherwise tenant default.
          const requestedModel =
            typeof data.model === 'string' && data.model ? data.model : undefined;
          // Grounding: real CRM data into system prompt (levels 1-2 + aggregates), tenant-scoped.
          const { buildChatContextWithAggregates } = await import('@/lib/ai/grounding');
          const { getUserRole } = await import('@/lib/rbac');
          const chatUserId = await extractUserId(request);
          const chatRole = chatUserId ? await getUserRole(chatUserId, tq.tenantId) : null;

          // Sessions (П3): history from DB, never trust the frontend to send it.
          const sessionId =
            typeof data.sessionId === 'string' && data.sessionId ? data.sessionId : undefined;
          let session: { id: string; title: string | null } | null = null;
          let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
          if (sessionId) {
            if (!chatUserId) {
              return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
            }
            session = await prisma.aiChatSession.findFirst({
              where: { id: sessionId, tenantId: tq.tenantId, userId: chatUserId },
              select: { id: true, title: true },
            });
            if (!session) {
              return NextResponse.json({ error: 'Сесію не знайдено' }, { status: 404 });
            }
            const prior = await prisma.aiChatMessage.findMany({
              where: { sessionId },
              orderBy: { createdAt: 'asc' },
              take: 20,
              select: { role: true, content: true },
            });
            history = prior
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            await prisma.aiChatMessage.create({
              data: { sessionId, role: 'user', content: data.prompt },
            });
          }

          const grounding = await buildChatContextWithAggregates(tq, {
            message: typeof data.prompt === 'string' ? data.prompt : '',
            contactId: typeof data.contactId === 'string' ? data.contactId : null,
            dealId: typeof data.dealId === 'string' ? data.dealId : null,
            role: chatRole || 'member',
            userId: chatUserId || '',
          });
          const groundedSystem = [
            typeof data.system === 'string' && data.system ? data.system : null,
            grounding.system,
          ]
            .filter(Boolean)
            .join('\n\n');
          const genOpts = {
            prompt: data.prompt,
            system: groundedSystem,
            temperature: data.temperature,
            maxTokens: data.maxTokens,
            history,
            tenantApiKey: aiSettings.apiKey,
            tenantAiProvider: aiSettings.provider,
            tenantAiModel: requestedModel || aiSettings.model,
          };
          // П3: tools only for provider/model pairs with verified support;
          // otherwise a silent fallback to the snapshot mode (П1), no error.
          const effectiveModel =
            requestedModel ||
            aiSettings.model ||
            getProvider(aiSettings.provider)?.models[0]?.id ||
            '';
          const { supportsTools } = await import('@/lib/ai/tools');
          if (supportsTools(aiSettings.provider, effectiveModel)) {
            const { generateWithTools, isToolFormatError } = await import('@/lib/ai/gemini');
            const { executeCrmTool, CRM_TOOLS, TOOL_CONTEXT_BUDGET_CHARS } =
              await import('@/lib/ai/tools');
            const execCtx = {
              tq,
              role: chatRole || 'member',
              userId: chatUserId || '',
              sources: grounding.sources,
              budget: { used: 0, limit: TOOL_CONTEXT_BUDGET_CHARS },
            };
            try {
              const gen = await generateWithTools({
                ...genOpts,
                tools: CRM_TOOLS,
                executeTool: async (name: string, args: Record<string, unknown>) => {
                  const r = await executeCrmTool(name, args, execCtx);
                  toolCallLogs.push({ tool: name, rows: r.rows, truncated: r.truncated });
                  return r.content;
                },
              });
              result = gen.response;
            } catch (toolErr) {
              // Tools-format 400 → тихий відкат на «знімок + пошук», без помилки.
              if (!isToolFormatError(toolErr)) throw toolErr;
              result = (await generate(genOpts)).response;
            }
          } else {
            result = (await generate(genOpts)).response;
          }
          sources = grounding.sources;
          activeSessionId = session?.id;
          if (session) {
            await prisma.aiChatMessage.create({
              data: {
                sessionId: session.id,
                role: 'assistant',
                content: result as string,
                groundedOn: JSON.stringify(sources),
              },
            });
            await prisma.aiChatSession.update({
              where: { id: session.id },
              data: {
                updatedAt: new Date(),
                ...(session.title
                  ? {}
                  : { title: String(data.prompt || '').slice(0, 50) || 'Нова розмова' }),
              },
            });
          }
          break;
        }
        default:
          return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
      }

      // Log successful AI request (with tool-call trace if any — no PII)
      const durationMs = Date.now() - startTime;
      await logAiRequest({
        tenantId: tq.tenantId,
        provider: aiSettings.provider,
        model: aiSettings.model || 'unknown',
        status: 'success',
        durationMs,
        promptPreview: data?.prompt || data?.query || undefined,
        ...(toolCallLogs.length > 0 ? { metadata: { toolCalls: toolCallLogs } } : {}),
      });
      await incrementUsage(tq.tenantId, aiSettings.provider);

      return NextResponse.json({ result, sources, sessionId: activeSessionId });
    } catch (aiError) {
      // Log failed AI request
      const durationMs = Date.now() - startTime;
      const isRateLimit =
        aiError instanceof Error &&
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
    const mapped = mapProviderError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

/**
 * П4: provider errors → distinct, human-readable messages instead of a
 * generic «Помилка генерації». Non-provider errors keep their own message.
 */
function mapProviderError(error: unknown): { message: string; status: number } {
  if (error instanceof AiApiError) {
    const s = error.httpStatus;
    if (s === 401 || s === 403) {
      return {
        message: 'Невірний API-ключ AI-провайдера — оновіть його в Налаштуваннях → AI-провайдери.',
        status: 502,
      };
    }
    if (s === 404) {
      return {
        message: 'Модель не знайдена у AI-провайдера — оберіть іншу модель у вибраній моделі чату.',
        status: 502,
      };
    }
    if (s === 429) {
      return {
        message: 'Перевищено ліміт запитів AI-провайдера — спробуйте за кілька хвилин.',
        status: 429,
      };
    }
    if (s === 400) {
      return {
        message: 'AI-провайдер відхилив запит — спробуйте змінити модель або перезапитайте.',
        status: 502,
      };
    }
    return {
      message: `AI-провайдер зараз недоступний (помилка ${s}) — спробуйте пізніше.`,
      status: 502,
    };
  }
  const message = error instanceof Error ? error.message : 'Помилка AI';
  if (/timeout|timed out|abort/i.test(message)) {
    return { message: 'AI-провайдер не відповів вчасно — спробуйте ще раз.', status: 504 };
  }
  return { message, status: 500 };
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
  } catch {
    // ошибка проверки — считаем, что AI не настроен
  }
  return NextResponse.json({ available: false, reason: 'AI не налаштовано' });
}

export const POST = withAuth({ permission: 'ai:use' })(POSTHandler);
export const GET = withAuth({ permission: 'ai:use' })(GETHandler);
