/**
 * Real queue job handlers (registered by /api/queue/process, not at import).
 *
 * - email: Resend REST API (plain fetch, no SDK needed)
 * - ai: score/analyze via existing gemini.ts + tenant key
 * - export: CSV/JSON built from Prisma (same shape as export routes)
 * - notification: Notification row for in-app UI
 * - send_message: Telegram Bot API to tenant chats
 */

import { prisma } from '@crm-next/database';
import {
  registerHandler,
  type EmailJobData,
  type AIJobData,
  type ExportJobData,
  type NotificationJobData,
  type SendMessageJobData,
} from '@/lib/queues';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'queue-handlers' });

// ============ email (Resend) ============

async function handleEmail(job: { data: EmailJobData }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY не налаштовано');
  }
  const { to, subject, html, text, from, replyTo } = job.data;
  if (!to || (Array.isArray(to) && to.length === 0)) {
    throw new Error('Отримувач не вказано');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || process.env.RESEND_FROM || 'CRM <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { sent: true, id: (body as { id?: string }).id };
}

// ============ ai ============

async function handleAi(job: { data: AIJobData & { tenantId: string } }) {
  const { tenantId, action, entityType, entityId, prompt, model } = job.data;
  const { getProviderKey } = await import('@/lib/ai/keys');
  const { scoreDeal, analyzeContact } = await import('@/lib/ai/gemini');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiModel: true },
  });
  const provider = tenant?.aiProvider || 'gemini';
  const apiKey = await getProviderKey(tenantId, provider);
  if (!apiKey) {
    throw new Error(`Немає API-ключа для провайдера ${provider}`);
  }
  const useModel = model || tenant?.aiModel || undefined;

  if (action === 'score' && entityType === 'deal') {
    const deal = await prisma.deal.findFirst({
      where: { id: entityId, tenantId },
      include: { stage: { select: { name: true } } },
    });
    if (!deal) throw new Error('Угоду не знайдено');
    const score = await scoreDeal(
      {
        title: deal.title,
        value: deal.value,
        stage: deal.stage?.name || '',
        daysInStage: 0,
        totalActivities: 0,
        daysSinceLastActivity: 0,
        hasContact: !!deal.contactId,
      },
      apiKey,
      provider,
      useModel
    );
    await prisma.deal.update({ where: { id: deal.id }, data: { aiScore: score, aiScoredAt: new Date() } });
    return { scored: true, score };
  }

  if (action === 'analyze' && entityType === 'contact') {
    const contact = await prisma.contact.findFirst({ where: { id: entityId, tenantId } });
    if (!contact) throw new Error('Контакт не знайдено');
    const activities = await prisma.activity.findMany({
      where: { tenantId, contactId: entityId },
      orderBy: { date: 'desc' },
      take: 10,
    });
    const { analyzeContact: analyze } = await import('@/lib/ai/gemini');
    const result = await analyze(
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
      },
      apiKey,
      provider,
      useModel
    );
    await prisma.contact.update({
      where: { id: contact.id },
      data: { aiSummary: result as string, aiAnalyzedAt: new Date() },
    });
    return { analyzed: true };
  }

  // recommend / summarize → generic generate with tenant context
  const { generate } = await import('@/lib/ai/gemini');
  const out = await generate({
    prompt: prompt || `Summarize ${entityType} ${entityId}`,
    tenantApiKey: apiKey,
    tenantAiProvider: provider,
    tenantAiModel: useModel,
  });
  return { response: out.response };
}

// ============ export (CSV/JSON) ============

function escapeCSV(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function handleExport(job: { data: ExportJobData }) {
  const { tenantId, entityType, format, filters } = job.data;
  if (format !== 'csv' && format !== 'json') {
    throw new Error(`Формат ${format} поки не підтримується (доступні: csv, json)`);
  }

  let rows: Record<string, unknown>[] = [];
  if (entityType === 'contacts') {
    const list = await prisma.contact.findMany({ where: { tenantId, ...(filters || {}) } });
    rows = list.map((c) => ({
      id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email,
      company: c.company, position: c.position, status: c.status,
    }));
  } else if (entityType === 'deals') {
    const list = await prisma.deal.findMany({
      where: { tenantId, ...(filters || {}) },
      include: { stage: { select: { name: true } } },
    });
    rows = list.map((d) => ({
      id: d.id, title: d.title, value: d.value, currency: d.currency,
      status: d.status, stage: (d.stage as { name: string } | null)?.name || '',
      company: d.company,
    }));
  } else if (entityType === 'tasks') {
    const list = await prisma.task.findMany({ where: { tenantId, ...(filters || {}) } });
    rows = list.map((t) => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority,
      dueDate: t.dueDate?.toISOString() || '',
    }));
  } else {
    throw new Error(`Невідомий тип сутності: ${entityType}`);
  }

  let content: string;
  let mime: string;
  if (format === 'json') {
    content = JSON.stringify(rows, null, 2);
    mime = 'application/json';
  } else {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : ['id'];
    content = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(',')),
    ].join('\n');
    mime = 'text/csv';
  }

  const fileName = `${entityType}-export-${new Date().toISOString().slice(0, 10)}.${format}`;
  const size = Buffer.byteLength(content, 'utf8');
  if (size > 500_000) {
    throw new Error('Експорт занадто великий для черги (>500KB), звузьте фільтри');
  }

  return {
    fileName,
    mime,
    size,
    contentBase64: Buffer.from(content, 'utf8').toString('base64'),
    rows: rows.length,
  };
}

// ============ notification (in-app) ============

async function handleNotification(job: { data: NotificationJobData & { tenantId: string } }) {
  const { tenantId, userId, title, message, type, link } = job.data;
  const row = await prisma.notification.create({
    data: { tenantId, userId, title, message, type: type || 'info', link: link || null },
  });
  return { sent: true, id: row.id };
}

// ============ send_message (Telegram) ============

async function handleSendMessage(job: { data: SendMessageJobData }) {
  const { tenantId, text, chatId } = job.data;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramBotToken: true },
  });
  if (!tenant?.telegramBotToken) {
    throw new Error('Telegram-бот не підключено для тенанта');
  }

  const { sendMessage } = await import('@/lib/telegram/bot');

  let targets: number[] = [];
  if (chatId !== undefined) {
    const n = Number(chatId);
    if (!Number.isFinite(n)) throw new Error('Невірний chatId');
    targets = [n];
  } else {
    const chats = await prisma.telegramChat.findMany({ where: { tenantId }, select: { telegramId: true } });
    targets = chats.map((c) => c.telegramId);
  }
  if (targets.length === 0) {
    throw new Error('Немає Telegram-чатів для відправки');
  }

  let sent = 0;
  const errors: string[] = [];
  for (const id of targets) {
    try {
      const res = (await sendMessage(tenant.telegramBotToken, id, text)) as { ok?: boolean; description?: string };
      if (res && res.ok === false) throw new Error(res.description || 'Telegram API error');
      sent++;
    } catch (e: any) {
      errors.push(`${id}: ${e?.message || e}`);
    }
  }
  if (sent === 0) {
    throw new Error(`Не надіслано жодному чату: ${errors.join('; ').slice(0, 300)}`);
  }
  return { sent, total: targets.length, errors };
}

export function registerQueueHandlers(): void {
  registerHandler('email', handleEmail as never);
  registerHandler('ai', handleAi as never);
  registerHandler('export', handleExport as never);
  registerHandler('notification', handleNotification as never);
  registerHandler('send_message', handleSendMessage as never);
}
