/**
 * П3: read-only function-calling tools for the AI copilot.
 *
 * Isolation discipline (unchanged from grounding):
 * - tenantId is injected by the `tq` delegate on every query;
 * - role scope (ownerScope / taskScope) is applied on top of it;
 * - ids supplied by the model are re-checked through `tq` with the same
 *   scope (IDOR class: foreign tenant / other member's records return a
 *   generic "not found", never the data itself).
 *
 * Limits: MAX_TOOL_ROWS rows per call, MAX_FIELD_CHARS per field,
 * TOOL_CONTEXT_BUDGET_CHARS total tool-content budget per request.
 * There are NO write tools — mutations are a separate stage.
 */

import {
  describeContact,
  describeDeal,
  fmtSums,
  funnelLines,
  ownerScope,
  sumByCurrency,
  taskScope,
} from './grounding';

import type { GroundSource } from './grounding';
import type { TenantRole } from '@/lib/rbac';
import type { createTenantQuery } from '@/lib/tenant-query';

type TenantQuery = ReturnType<typeof createTenantQuery>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

export const MAX_TOOL_ROWS = 20;
export const MAX_FIELD_CHARS = 300;
export const MAX_TOOL_CONTENT_CHARS = 6000;
export const TOOL_CONTEXT_BUDGET_CHARS = 24000;

export const CRM_TOOLS: ToolSpec[] = [
  {
    name: 'search_contacts',
    description: 'Пошук контактів за частиною імені, компанії або email. Повертає до 20 рядків.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Що шукати: імʼя, прізвище, компанія або email' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_contact',
    description:
      'Деталі одного контакта за id: реквізити, нотатки, останні активності, повʼязані угоди та задачі.',
    parameters: {
      type: 'object',
      properties: { contactId: { type: 'string', description: 'ID контакта' } },
      required: ['contactId'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_deals',
    description: 'Пошук угод за назвою/компанією з фільтрами за статусом та стадією. До 20 рядків.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Частина назви угоди або компанії' },
        status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'Статус угоди' },
        stage: { type: 'string', description: 'Частина назви стадії воронки' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_deal',
    description:
      'Деталі однієї угоди за id: стадія, сума, контакт, повʼязані задачі та активності.',
    parameters: {
      type: 'object',
      properties: { dealId: { type: 'string', description: 'ID угоди' } },
      required: ['dealId'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    description: 'Список задач у фільтрі: відкриті (default), прострочені, на сьогодні або всі.',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['open', 'overdue', 'today', 'all'],
          description: 'Які задачі показати',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'pipeline_summary',
    description: 'Зведення по воронках: кількість і сума відкритих угод по кожній стадії.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'revenue_stats',
    description:
      'Виграні угоди за період (надходження): кількість, сума, середній чек, топ-3 угоди.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Період аналізу',
        },
      },
      required: ['period'],
      additionalProperties: false,
    },
  },
  {
    name: 'recent_activities',
    description:
      'Останні активності (дзвінки, зустрічі, листи). Можна відфільтрувати за контактом або угодою.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Скільки активностей повернути (1-20, за замовчуванням 10)',
        },
        contactId: { type: 'string', description: 'Фільтр за ID контакта' },
        dealId: { type: 'string', description: 'Фільтр за ID угоди (через її контакт)' },
      },
      additionalProperties: false,
    },
  },
];

/**
 * П3.4: які провайдери/моделі ПІДТВЕРДЖЕНО підтримують tools (формати
 * перевіряено за офіційною документацією; статус по кожному — у коментарях):
 *
 *  - gemini    — ПЕРЕВІРЕНО: ai.google.dev/api/generate-content —
 *                tools[].functionDeclarations + functionResponse part.
 *  - anthropic — ПЕРЕВІРЕНО: platform.claude.com/docs tool-use —
 *                tools[].input_schema, content[].tool_use, tool_result.
 *  - mistral   — ПЕРЕВІРЕНО: docs.mistral.ai/capabilities/function_calling —
 *                OpenAI-стиль tools; FC-моделі: large/small/ministral/codestral.
 *                open-mistral-nemo у FC-списку немає → вимкнено.
 *  - openai    — ПЕРЕВІРЕНО: канонічний формат chat completions (tools →
 *                tool_calls → role:'tool'); ідентичність підтверджено
 *                сумісністю DeepSeek/Mistral/Groq/Together з OpenAI.
 *                Живий виклик — НЕ ПЕРЕВІРЕНО: немає API-ключа в середовищі.
 *  - groq      — ПЕРЕВІРЕНО: docs.groq.com/docs/tool-use, OpenAI-сумісний
 *                base URL; gpt-oss* — tool-native моделі.
 *                qwen/qwen3.6-27b — НЕ ПЕРЕВІРЕНО → вимкнено.
 *  - deepseek  — НЕ ПЕРЕВІРЕНО: спеціалізований FC-гайд api-docs.deepseek.com
 *                недоступний (redirect/400), підтримка tools конкретних
 *                моделей не підтверджена → тихий відкат на П1.
 *  - together  — формат ПЕРЕВІРЕНО (OpenAI-стиль tools → tool_calls,
 *                docs.together.ai/docs/function-calling), але підтримка
 *                наших моделей у каталозі — НЕ ПЕРЕВІРЕНО → тихий відкат на П1.
 *  - custom/невідомі моделі — НЕ ПЕРЕВІРЕНО → тихий відкат на П1.
 */
const TOOL_CAPABLE: Record<string, (model: string) => boolean> = {
  gemini: (m) => m.startsWith('gemini-'),
  openai: (m) => m.startsWith('gpt-'),
  anthropic: (m) => m.startsWith('claude'),
  mistral: (m) =>
    [
      'mistral-large-latest',
      'mistral-small-latest',
      'ministral-8b-latest',
      'codestral-latest',
    ].includes(m),
  groq: (m) => m.startsWith('openai/gpt-oss-'),
};

/** Read-only tools are offered only for provider/model pairs verified above. */
export function supportsTools(providerId: string, modelId: string | null | undefined): boolean {
  const model = (modelId || '').trim();
  if (!model) return false;
  return TOOL_CAPABLE[providerId]?.(model) ?? false;
}

export interface ToolExecContext {
  tq: TenantQuery;
  role: TenantRole;
  userId: string;
  sources: GroundSource[];
  /** Shared per-request content budget across all tool calls. */
  budget: { used: number; limit: number };
}

export interface ToolExecResult {
  content: string;
  rows: number;
  truncated: boolean;
}

type ToolBody = { text: string; rows: number; truncated: boolean };

const err = (text: string): ToolBody => ({ text, rows: 0, truncated: false });

function field(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return s.length > MAX_FIELD_CHARS ? `${s.slice(0, MAX_FIELD_CHARS)}…` : s;
}

function personName(c: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
}): string {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.company || '—';
}

function pushSource(sources: GroundSource[], s: GroundSource): void {
  if (!sources.some((x) => x.id === s.id && x.type === s.type)) sources.push(s);
}

function shortDate(d: Date | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('uk', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

async function searchContacts(
  args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolBody> {
  const q = field(args.query).trim();
  if (!q) return err('Вкажіть query для пошуку контактів.');
  const or = ['firstName', 'lastName', 'company', 'email'].map((f) => ({
    [f]: { contains: q, mode: 'insensitive' },
  }));
  const found = await ctx.tq.contact.findMany({
    where: { AND: [ownerScope(ctx.role, ctx.userId), { OR: or }] },
    orderBy: { createdAt: 'desc' },
    take: MAX_TOOL_ROWS + 1,
  });
  const truncated = found.length > MAX_TOOL_ROWS;
  const rows = found.slice(0, MAX_TOOL_ROWS);
  if (rows.length === 0) return err(`Контактів за «${q}» не знайдено.`);
  for (const c of rows.slice(0, 3)) {
    pushSource(ctx.sources, { id: c.id, type: 'contact', name: personName(c) });
  }
  const lines = rows.map(
    (c) =>
      `${c.id} | ${field(personName(c))} | ${field(c.company || '')} | ${field(c.email || '')}`,
  );
  if (truncated) lines.push(`[…показано перші ${MAX_TOOL_ROWS} рядків]`);
  return { text: lines.join('\n'), rows: rows.length, truncated };
}

async function getContact(args: Record<string, unknown>, ctx: ToolExecContext): Promise<ToolBody> {
  const id = field(args.contactId).trim();
  if (!id) return err('Вкажіть contactId.');
  const contact = await ctx.tq.contact.findFirst({
    where: { id, ...ownerScope(ctx.role, ctx.userId) },
  });
  if (!contact) return err('Контакт не знайдено (або він недоступний вам у CRM).');
  return { text: await describeContact(ctx.tq, contact, ctx.sources), rows: 1, truncated: false };
}

async function searchDeals(args: Record<string, unknown>, ctx: ToolExecContext): Promise<ToolBody> {
  const conditions: Record<string, unknown>[] = [];
  const q = field(args.query).trim();
  if (q) {
    conditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  const status = field(args.status).trim();
  if (status) conditions.push({ status });
  const stage = field(args.stage).trim();
  if (stage) conditions.push({ stage: { name: { contains: stage, mode: 'insensitive' } } });

  const found = await ctx.tq.deal.findMany({
    // AND-array: role scope never gets overwritten by search conditions.
    where: { AND: [ownerScope(ctx.role, ctx.userId), ...conditions] },
    include: {
      stage: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_TOOL_ROWS + 1,
  });
  const truncated = found.length > MAX_TOOL_ROWS;
  const rows = found.slice(0, MAX_TOOL_ROWS);
  if (rows.length === 0) return err('Угод за цим запитом не знайдено.');
  for (const d of rows.slice(0, 3)) {
    pushSource(ctx.sources, { id: d.id, type: 'deal', name: d.title || d.id });
  }
  // as any[]: tq delegate types drop `include`, but stage/contact ARE loaded.
  const lines = (rows as any[]).map(
    (d) =>
      `"${field(d.title)}" | етап «${field(d.stage?.name || '—')}»` +
      (d.value != null ? ` | ${d.value} ${d.currency || 'UAH'}` : '') +
      ` | ${field(d.status)}` +
      (d.contact ? ` | контакт ${field(personName(d.contact))}` : ''),
  );
  if (truncated) lines.push(`[…показано перші ${MAX_TOOL_ROWS} рядків]`);
  return { text: lines.join('\n'), rows: rows.length, truncated };
}

async function getDeal(args: Record<string, unknown>, ctx: ToolExecContext): Promise<ToolBody> {
  const id = field(args.dealId).trim();
  if (!id) return err('Вкажіть dealId.');
  const deal = await ctx.tq.deal.findFirst({
    where: { id, ...ownerScope(ctx.role, ctx.userId) },
    include: {
      stage: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  if (!deal) return err('Угоду не знайдено (або вона недоступна вам у CRM).');
  return { text: await describeDeal(ctx.tq, deal, ctx.sources), rows: 1, truncated: false };
}

async function listTasks(args: Record<string, unknown>, ctx: ToolExecContext): Promise<ToolBody> {
  const filter = (field(args.filter) || 'open').trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const active = { status: { in: ['todo', 'in_progress'] } };
  let extra: Record<string, unknown> = active;
  if (filter === 'overdue') extra = { ...active, dueDate: { lt: today } };
  else if (filter === 'today') extra = { ...active, dueDate: { gte: today, lt: tomorrow } };
  else if (filter === 'all') extra = {};

  const found = await ctx.tq.task.findMany({
    where: { ...taskScope(ctx.role, ctx.userId), ...extra },
    orderBy: { dueDate: 'asc' },
    take: MAX_TOOL_ROWS + 1,
  });
  const truncated = found.length > MAX_TOOL_ROWS;
  const rows = found.slice(0, MAX_TOOL_ROWS);
  if (rows.length === 0) return err('Задач за цим фільтром немає.');

  const contactIds = [...new Set(rows.map((t) => t.contactId).filter(Boolean))] as string[];
  const contacts = contactIds.length
    ? await ctx.tq.contact.findMany({ where: { id: { in: contactIds } } })
    : [];
  const names = new Map(contacts.map((c) => [c.id, personName(c)]));

  const lines = rows.map(
    (t) =>
      `"${field(t.title)}" | ${field(t.status)} | пріоритет ${field(t.priority)}` +
      (t.dueDate ? ` | до ${shortDate(t.dueDate)}` : '') +
      (t.contactId ? ` | контакт ${field(names.get(t.contactId) || '—')}` : ''),
  );
  if (truncated) lines.push(`[…показано перші ${MAX_TOOL_ROWS} рядків]`);
  return { text: lines.join('\n'), rows: rows.length, truncated };
}

async function pipelineSummary(
  _args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolBody> {
  const scope = ownerScope(ctx.role, ctx.userId);
  const [pipelines, openDeals, wonCount, lostCount] = await Promise.all([
    ctx.tq.pipeline.findMany({ include: { stages: { orderBy: { order: 'asc' } } } }),
    ctx.tq.deal.findMany({ where: { ...scope, status: 'open' } }),
    ctx.tq.deal.count({ where: { ...scope, status: 'won' } }),
    ctx.tq.deal.count({ where: { ...scope, status: 'lost' } }),
  ]);
  const lines = funnelLines(pipelines as never, openDeals as never);
  lines.unshift(
    `Всього: відкритих — ${openDeals.length} (${fmtSums(sumByCurrency(openDeals))}); ` +
      `виграних — ${wonCount}; програлих — ${lostCount}.`,
  );
  if (pipelines.length === 0) {
    lines.push('Воронки ще не налаштовані — створіть їх у розділі «Продажі».');
  }
  return { text: lines.join('\n'), rows: lines.length, truncated: false };
}

async function revenueStats(
  args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolBody> {
  const period = (field(args.period) || 'month').trim();
  const days: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 };
  const labels: Record<string, string> = {
    week: 'за 7 днів',
    month: 'за 30 днів',
    quarter: 'за 90 днів',
    year: 'за 365 днів',
  };
  const span = days[period] || 30;
  const start = new Date(Date.now() - span * 86_400_000);
  // Same basis as analytics revenue (status won, updatedAt window).
  const won = await ctx.tq.deal.findMany({
    where: { ...ownerScope(ctx.role, ctx.userId), status: 'won', updatedAt: { gte: start } },
    orderBy: { updatedAt: 'desc' },
    take: MAX_TOOL_ROWS + 1,
  });
  const truncated = won.length > MAX_TOOL_ROWS;
  const rows = won.slice(0, MAX_TOOL_ROWS);
  const sums = sumByCurrency(rows);
  const avg = new Map<string, number>();
  for (const [cur, total] of sums) avg.set(cur, rows.length ? total / rows.length : 0);

  const lines = [
    `Виграних угод ${labels[period] || labels.month}: ${rows.length}` +
      (truncated ? `+ (більше 20, показано перші 20)` : '') +
      `. Сума: ${fmtSums(sums)}. Середній чек: ${fmtSums(avg)}.`,
  ];
  for (const d of rows.slice(0, 3)) {
    lines.push(
      `- «${field(d.title).slice(0, 80)}»${d.value != null ? `, ${d.value} ${d.currency || 'UAH'}` : ''}, ${shortDate(d.updatedAt)}`,
    );
  }
  return { text: lines.join('\n'), rows: rows.length, truncated };
}

async function recentActivities(
  args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolBody> {
  const scope = ownerScope(ctx.role, ctx.userId);
  let contactId = field(args.contactId).trim() || undefined;

  if (args.dealId) {
    const dealId = field(args.dealId).trim();
    const deal = await ctx.tq.deal.findFirst({ where: { id: dealId, ...scope } });
    if (!deal) return err('Угоду не знайдено (або вона недоступна вам у CRM).');
    if (!deal.contactId) return err('Угода не повʼязана з контактом — активностей за нею немає.');
    contactId = deal.contactId;
  } else if (contactId) {
    const contact = await ctx.tq.contact.findFirst({ where: { id: contactId, ...scope } });
    if (!contact) return err('Контакт не знайдено (або він недоступний вам у CRM).');
  }

  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), MAX_TOOL_ROWS);
  const where: Record<string, unknown> = {};
  if (contactId) where.contactId = contactId;
  // Member sees only activities of visible contacts (Activity has no ownerId).
  if (ctx.role === 'member') where.contact = ownerScope(ctx.role, ctx.userId);

  const found = await ctx.tq.activity.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit + 1,
  });
  const truncated = found.length > limit;
  const rows = found.slice(0, limit);
  if (rows.length === 0) return err('Активностей не знайдено.');

  const contactIds = [...new Set(rows.map((a) => a.contactId))];
  const contacts = await ctx.tq.contact.findMany({ where: { id: { in: contactIds } } });
  const names = new Map(contacts.map((c) => [c.id, personName(c)]));

  const lines = rows.map(
    (a) =>
      `${shortDate(a.date)} | ${field(a.type)} | «${field(a.title).slice(0, 80)}» | контакт ${field(names.get(a.contactId) || '—')}`,
  );
  if (truncated) lines.push(`[…показано перші ${limit} рядків]`);
  return { text: lines.join('\n'), rows: rows.length, truncated };
}

async function applyBudget(ctx: ToolExecContext, body: ToolBody): Promise<ToolExecResult> {
  const { rows } = body;
  let { text, truncated } = body;
  if (ctx.budget.used + text.length > ctx.budget.limit) {
    ctx.budget.used = ctx.budget.limit;
    return {
      content:
        'Бюджет контексту вичерпано: відповідай за знімком CRM і вже отриманими даними, нові виклики інструментів не роби.',
      rows: 0,
      truncated: true,
    };
  }
  ctx.budget.used += text.length;
  if (text.length > MAX_TOOL_CONTENT_CHARS) {
    text = `${text.slice(0, MAX_TOOL_CONTENT_CHARS)}\n[…відповідь усічено]`;
    truncated = true;
  }
  return { content: text, rows, truncated };
}

/** Execute one read-only tool. All ids are re-checked via `tq` (IDOR class). */
export async function executeCrmTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  let body: ToolBody;
  switch (name) {
    case 'search_contacts':
      body = await searchContacts(args, ctx);
      break;
    case 'get_contact':
      body = await getContact(args, ctx);
      break;
    case 'search_deals':
      body = await searchDeals(args, ctx);
      break;
    case 'get_deal':
      body = await getDeal(args, ctx);
      break;
    case 'list_tasks':
      body = await listTasks(args, ctx);
      break;
    case 'pipeline_summary':
      body = await pipelineSummary(args, ctx);
      break;
    case 'revenue_stats':
      body = await revenueStats(args, ctx);
      break;
    case 'recent_activities':
      body = await recentActivities(args, ctx);
      break;
    default:
      body = err(
        `Невідомий інструмент «${field(name)}». Доступні: ${CRM_TOOLS.map((t) => t.name).join(', ')}.`,
      );
  }
  return applyBudget(ctx, body);
}
