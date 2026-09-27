/**
 * Chat grounding — retrieval-then-generate for the free-form AI chat.
 *
 * Level 1: entity of the current page (contactId/dealId passed by frontend).
 * Level 2: entities whose names are mentioned in the message (contains-search).
 *
 * ALL retrieval goes through tenant-scoped `tq` helpers (Phase-1 IDOR
 * discipline) plus the member's owner-visibility scope — no direct
 * prisma.contact/deal reads without tenantId anywhere in this file.
 */

import type { TenantRole } from '@/lib/rbac';
import type { createTenantQuery } from '@/lib/tenant-query';

import { decrypt } from '@/lib/encryption';

type TenantQuery = ReturnType<typeof createTenantQuery>;

export interface GroundSource {
  id: string;
  type: 'contact' | 'deal';
  name: string;
}

export interface GroundingResult {
  system: string;
  sources: GroundSource[];
}

const BASE_INSTRUCTION = `Ти — AI-асистент CRM. Відповідай ТІЛЬКИ на основі даних нижче. Якщо потрібної інформації немає — прямо скажи, що не маєш цих даних, не вигадуй.`;

const NO_DATA_INSTRUCTION = `Даних по цьому запиту в CRM немає. Повідом користувачу, що не маєш цих даних, і не вигадуй деталі.`;

/** Owner-visibility scope for member role (same rule as buildDataFilter, ownerId field). */
function ownerScope(role: TenantRole, userId: string): Record<string, unknown> {
  if (role === 'member') {
    return { OR: [{ ownerId: userId }, { ownerId: null }] };
  }
  return {};
}

/** Visibility scope for tasks (assigneeId field, same rule). */
function taskScope(role: TenantRole, userId: string): Record<string, unknown> {
  if (role === 'member') {
    return { OR: [{ assigneeId: userId }, { assigneeId: null }] };
  }
  return {};
}

function safeDecrypt(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  try {
    return new Date(value as string).toLocaleDateString('uk', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

async function describeContact(
  tq: TenantQuery,
  contact: any,
  sources: GroundSource[],
): Promise<string> {
  sources.push({
    id: contact.id,
    type: 'contact',
    name:
      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
      contact.company ||
      contact.id,
  });

  const lines: string[] = [];
  lines.push(
    `Контакт: ${contact.firstName || ''} ${contact.lastName || ''}`.trim() +
      (contact.company ? `, компанія "${contact.company}"` : '') +
      (contact.email ? `, email: ${contact.email}` : ''),
  );

  const notes = safeDecrypt(contact.notes);
  if (notes) lines.push(`Нотатки: ${notes.slice(0, 500)}`);

  const activities = await tq.activity.findMany({
    where: { contactId: contact.id },
    orderBy: { date: 'desc' },
    take: 5,
  });
  if (activities.length > 0) {
    lines.push(
      'Останні активності: ' +
        activities
          .map((a: any) => `${a.type} ${fmtDate(a.date)} (${a.title || ''})`.trim())
          .join('; '),
    );
  }

  const deals = await tq.deal.findMany({
    where: { contactId: contact.id },
    include: { stage: { select: { name: true } } },
    take: 5,
  });
  if (deals.length > 0) {
    lines.push(
      'Пов\u2019язані угоди: ' +
        deals
          .map(
            (d: any) =>
              `"${d.title}" — етап "${d.stage?.name || '—'}"` +
              (d.value ? `, сума ${d.value} ${d.currency || 'грн'}` : ''),
          )
          .join('; '),
    );
  }

  const tasks = await tq.task.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (tasks.length > 0) {
    lines.push('Задачі: ' + tasks.map((t: any) => `"${t.title}" [${t.status}]`).join('; '));
  }

  return lines.join('\n');
}

async function describeDeal(tq: TenantQuery, deal: any, sources: GroundSource[]): Promise<string> {
  sources.push({ id: deal.id, type: 'deal', name: deal.title || deal.id });

  const lines: string[] = [];
  lines.push(
    `Угода: "${deal.title}" — етап "${deal.stage?.name || '—'}"` +
      (deal.value ? `, сума ${deal.value} ${deal.currency || 'грн'}` : '') +
      `, статус: ${deal.status || '—'}`,
  );
  if (deal.company) lines.push(`Компанія: ${deal.company}`);
  if (deal.contact) {
    lines.push(`Контакт: ${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim());
  }

  if (deal.contactId) {
    const tasks = await tq.task.findMany({
      where: { dealId: deal.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    if (tasks.length > 0) {
      lines.push(
        'Задачі по угоді: ' + tasks.map((t: any) => `"${t.title}" [${t.status}]`).join('; '),
      );
    }
    const activities = await tq.activity.findMany({
      where: { contactId: deal.contactId },
      orderBy: { date: 'desc' },
      take: 5,
    });
    if (activities.length > 0) {
      lines.push(
        'Останні активності: ' +
          activities
            .map((a: any) => `${a.type} ${fmtDate(a.date)} (${a.title || ''})`.trim())
            .join('; '),
      );
    }
  }

  return lines.join('\n');
}

/** Candidate search tokens: words ≥3 chars, lowercased, deduplicated. */
function messageTokens(message: string): string[] {
  const words = message.toLowerCase().match(/[a-zа-яёіїєґ0-9]{3,}/gu) || [];
  return [...new Set(words)].slice(0, 12);
}

interface AggregateIntent {
  deals: boolean;
  contacts: boolean;
  tasks: boolean;
  overview: boolean;
}

/** Aggregate/list intent: "скільки угод", "покажи контакти", "яка є інформація". */
function detectAggregateIntent(message: string): AggregateIntent {
  const m = message.toLowerCase();
  const deals = /угод|сдел|deal|воронк|вируч|выруч|прогноз/.test(m);
  const contacts = /контакт|клієнт|клиент|contact|client|база клієнтів|база клиентов/.test(m);
  const tasks = /задач|задач|task|напомин|нагадуван|todo|доручен/.test(m);
  const wantsNumbers =
    /скільки|сколько|колько|кількість|количество|how many|count|статистик|підсумок|итог|всього|усього/.test(
      m,
    );
  const wantsList =
    /покажи|покажі|покажит|список|список|list|show|перечисл|перелік|які|какие|какие есть|які є/.test(
      m,
    );
  const overview =
    /яка.*інформац|какая.*информац|що.*(є|відомо)|что.*(есть|известно)|все (мои|мої)|всі мої|overview|что у меня|що в мене/.test(
      m,
    );
  const anyEntity = deals || contacts || tasks;
  return {
    deals: deals && (wantsNumbers || wantsList || overview),
    contacts: contacts && (wantsNumbers || wantsList || overview),
    tasks: tasks && (wantsNumbers || wantsList || overview),
    overview: overview && !anyEntity,
  };
}

async function buildAggregateBlock(
  tq: TenantQuery,
  intent: AggregateIntent,
  role: TenantRole,
  userId: string,
  sources: GroundSource[],
): Promise<string | null> {
  const scope = ownerScope(role, userId);
  const tScope = taskScope(role, userId);
  const lines: string[] = [];

  if (intent.deals) {
    const [openCount, wonCount, openDeals] = await Promise.all([
      tq.deal.count({ where: { ...scope, status: 'open' } }),
      tq.deal.count({ where: { ...scope, status: 'won' } }),
      tq.deal.findMany({
        where: { ...scope, status: 'open' },
        include: { stage: { select: { name: true } } },
        orderBy: { value: 'desc' },
        take: 5,
      }),
    ]);
    const openValue = openDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
    lines.push(`Угоди: відкритих — ${openCount} на суму ${openValue} грн, виграних — ${wonCount}.`);
    for (const d of openDeals.slice(0, 5) as any[]) {
      sources.push({ id: d.id, type: 'deal', name: d.title });
      lines.push(`- "${d.title}" — ${d.stage?.name || '—'}${d.value ? `, ${d.value} грн` : ''}`);
    }
  }

  if (intent.contacts) {
    const [total, recent] = await Promise.all([
      tq.contact.count({ where: { ...scope } }),
      tq.contact.findMany({ where: { ...scope }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    lines.push(`Контакти: всього — ${total}.`);
    for (const c of recent.slice(0, 5)) {
      const nm = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.company || c.id;
      sources.push({ id: c.id, type: 'contact', name: nm });
      lines.push(`- ${nm}${c.company ? ` (${c.company})` : ''}`);
    }
  }

  if (intent.tasks) {
    const [todoCount, upcoming] = await Promise.all([
      tq.task.count({ where: { ...tScope, status: { in: ['todo', 'in_progress'] } } }),
      tq.task.findMany({ where: { ...tScope }, orderBy: { dueDate: 'asc' }, take: 5 }),
    ]);
    lines.push(`Задачі: активних — ${todoCount}.`);
    for (const t of upcoming.slice(0, 5)) {
      lines.push(`- "${t.title}" [${t.status}]${t.dueDate ? `, до ${fmtDate(t.dueDate)}` : ''}`);
    }
  }

  if (lines.length === 0) return null;
  return `Зведені дані CRM:\n${lines.join('\n')}`;
}

export async function buildChatContext(
  tq: TenantQuery,
  opts: {
    message: string;
    contactId?: string | null;
    dealId?: string | null;
    role: TenantRole;
    userId: string;
  },
): Promise<GroundingResult> {
  const sources: GroundSource[] = [];
  const blocks: string[] = [];
  const seenContacts = new Set<string>();
  const seenDeals = new Set<string>();
  const scope = ownerScope(opts.role, opts.userId);

  // --- Level 1: current page entity (visibility-scoped, no IDOR bypass) ---
  if (opts.contactId) {
    const contact = await tq.contact.findFirst({
      where: { id: opts.contactId, ...scope },
    });
    if (contact && !seenContacts.has(contact.id)) {
      seenContacts.add(contact.id);
      blocks.push(await describeContact(tq, contact, sources));
    }
  }
  if (opts.dealId) {
    const deal = await tq.deal.findFirst({
      where: { id: opts.dealId, ...scope },
      include: {
        stage: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    });
    if (deal && !seenDeals.has(deal.id)) {
      seenDeals.add(deal.id);
      blocks.push(await describeDeal(tq, deal, sources));
    }
  }

  // --- Level 2: entities mentioned by name ---
  const tokens = messageTokens(opts.message);
  if (tokens.length > 0) {
    // NOTE: Postgres LIKE is case-sensitive — insensitive mode required
    // because tokens are lowercased while stored names are not.
    const orName = (fields: string[]) =>
      tokens.flatMap((t) => fields.map((f) => ({ [f]: { contains: t, mode: 'insensitive' } })));

    // NOTE: scope itself contains OR — combine via AND, never spread,
    // or the name search would overwrite the visibility filter (same
    // OR-overwrite bug class as search+dataFilter).
    const contacts = await tq.contact.findMany({
      where: { AND: [scope, { OR: orName(['firstName', 'lastName', 'company']) }] },
      take: 10,
    });
    for (const c of contacts) {
      if (seenContacts.has(c.id)) continue;
      const haystack = `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''}`.toLowerCase();
      if (!tokens.some((t) => haystack.includes(t))) continue;
      if (sources.filter((s) => s.type === 'contact').length >= 3) break;
      seenContacts.add(c.id);
      blocks.push(await describeContact(tq, c, sources));
    }

    const deals = await tq.deal.findMany({
      where: { AND: [scope, { OR: orName(['title', 'company']) }] },
      include: {
        stage: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
      take: 10,
    });
    for (const d of deals) {
      if (seenDeals.has(d.id)) continue;
      const haystack = `${d.title || ''} ${d.company || ''}`.toLowerCase();
      if (!tokens.some((t) => haystack.includes(t))) continue;
      if (sources.filter((s) => s.type === 'deal').length >= 3) break;
      seenDeals.add(d.id);
      blocks.push(await describeDeal(tq, d, sources));
    }
  }

  if (blocks.length === 0) {
    return { system: `${BASE_INSTRUCTION}\n\n${NO_DATA_INSTRUCTION}`, sources };
  }
  return { system: `${BASE_INSTRUCTION}\n\nДані CRM:\n${blocks.join('\n\n')}`, sources };
}

/** Entry: entity grounding (levels 1-2) + aggregate intents. */
export async function buildChatContextWithAggregates(
  tq: TenantQuery,
  opts: {
    message: string;
    contactId?: string | null;
    dealId?: string | null;
    role: TenantRole;
    userId: string;
  },
): Promise<GroundingResult> {
  const base = await buildChatContext(tq, opts);
  const intent = detectAggregateIntent(opts.message);
  // Обзор без конкретной сущности = сводка по всем трём разделам.
  if (intent.overview) {
    intent.deals = true;
    intent.contacts = true;
    intent.tasks = true;
  }
  if (!intent.deals && !intent.contacts && !intent.tasks) {
    return base;
  }
  const agg = await buildAggregateBlock(tq, intent, opts.role, opts.userId, base.sources);
  if (!agg) return base;
  if (base.sources.length === 0) {
    // No entities found — aggregates replace the "no data" instruction.
    return { system: `${BASE_INSTRUCTION}\n\nДані CRM:\n${agg}`, sources: base.sources };
  }
  return { system: `${base.system}\n\n${agg}`, sources: base.sources };
}
