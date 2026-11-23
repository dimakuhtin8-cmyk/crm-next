/**
 * Exchange API (обмін з 1С / Excel) — upsert-логіка для contacts | deals | tasks.
 *
 * Правила зіставлення існуючих записів:
 *   1. externalId (точне значення);
 *   2. контакт: email (у нижньому регістрі) або телефон (лише цифри);
 *   3. угода / задача: точний збіг title.
 *
 * Оновлюються ЛИШЕ поля, передані в елементі (відсутні поля не змінюються).
 * Пошкоджений елемент (невірні дані) потрапляє в errors із індексом,
 * решта елементів опрацьовуються далі.
 *
 * Примітка щодо дублювання: планувався спільний движок у src/lib/import/upsert.ts
 * (інший агент); на момент реалізації цього файлу він відсутній, тому движок
 * реалізовано тут. При появі import/upsert.ts логіку варто уніфікувати.
 */

import { prisma } from '@crm-next/database';
import { z } from 'zod';

import { decrypt, encrypt, isEncrypted } from '@/lib/encryption';

export interface ExchangeUpsertError {
  index: number;
  message: string;
}

export interface ExchangeUpsertReport {
  created: number;
  updated: number;
  skipped: number;
  errors: ExchangeUpsertError[];
}

function emptyReport(): ExchangeUpsertReport {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Невірні дані';
  const path = issue.path.join('.');
  return path ? `Невірні дані: ${path} — ${issue.message}` : `Невірні дані: ${issue.message}`;
}

/** Дешифрує поле, якщо воно зашифроване; повертає відкрите значення або null. */
function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/** Лише цифри телефону (для зіставлення). */
function digitsOnly(value: string | null): string {
  return value ? value.replace(/\D/g, '') : '';
}

function mapBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function datesEqual(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (a ? a.getTime() : null) === (b ? b.getTime() : null);
}

/**
 * Парсить dueDate задачі: ISO (2026-03-15T10:00:00Z) або dd.mm.yyyy (15.03.2026).
 * { ok: false } — невірний формат.
 */
function parseDueDate(value: string | null | undefined): { ok: boolean; date: Date | null } {
  if (value === undefined || value === null || value.trim() === '') {
    return { ok: true, date: null };
  }
  const trimmed = value.trim();
  const dmy = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    return valid ? { ok: true, date } : { ok: false, date: null };
  }
  const iso = new Date(trimmed);
  if (Number.isNaN(iso.getTime())) return { ok: false, date: null };
  return { ok: true, date: iso };
}

/* ────────────────────────────── Контакти ────────────────────────────── */

const contactItemSchema = z.object({
  externalId: z.string().max(100).optional().nullable(),
  // Обов'язкове лише при створенні: для оновлення достатньо ключа зіставлення
  // (externalId/email/phone) + полів, які змінюються
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'lead', 'client']).optional(),
});

type ContactItem = z.infer<typeof contactItemSchema>;

// Поля, які синхронізуються (тільки вони; phone/notes шифруються при збереженні).
const CONTACT_SYNC_FIELDS = [
  'externalId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'position',
  'notes',
  'source',
  'status',
] as const;

type ContactRow = Awaited<ReturnType<typeof prisma.contact.findMany>>[number];

function contactChanged(current: ContactRow, data: ContactItem): boolean {
  for (const field of CONTACT_SYNC_FIELDS) {
    if (!(field in data)) continue;
    const next = data[field] ?? null;
    if (field === 'phone' || field === 'notes') {
      if (safeDecrypt(current[field]) !== next) return true;
    } else if ((current[field] ?? null) !== next) {
      return true;
    }
  }
  return false;
}

function contactWriteData(data: ContactItem): Record<string, unknown> {
  const write: Record<string, unknown> = {};
  for (const field of CONTACT_SYNC_FIELDS) {
    if (!(field in data)) continue;
    const value = data[field] ?? null;
    write[field] =
      (field === 'phone' || field === 'notes') && value !== null ? encrypt(value) : value;
  }
  return write;
}

export async function upsertContacts(
  tenantId: string,
  items: unknown[],
): Promise<ExchangeUpsertReport> {
  const report = emptyReport();

  const parsed: { index: number; data: ContactItem }[] = [];
  items.forEach((item, index) => {
    const result = contactItemSchema.safeParse(item);
    if (!result.success) {
      report.errors.push({ index, message: formatZodError(result.error) });
      return;
    }
    parsed.push({ index, data: result.data });
  });

  // Попереднє завантаження контактів тенанта: email зберігається відкритим,
  // телефон — шифрується, тому матчинг по телефону виконується в JS
  // після дешифрування.
  const existing = await prisma.contact.findMany({ where: { tenantId } });
  const byExternalId = mapBy(existing, (row) => row.externalId);
  const byEmail = mapBy(existing, (row) => row.email?.toLowerCase());
  const byPhone = mapBy(existing, (row) => {
    const digits = digitsOnly(safeDecrypt(row.phone));
    return digits || null;
  });

  for (const { index, data } of parsed) {
    try {
      let match: ContactRow | undefined;
      if (data.externalId) {
        match = byExternalId.get(data.externalId);
      }
      if (!match && data.email) {
        match = byEmail.get(data.email.toLowerCase());
      }
      if (!match && data.phone) {
        match = byPhone.get(digitsOnly(data.phone));
      }

      if (!match) {
        if (!data.firstName) {
          report.errors.push({ index, message: "Відсутнє обов'язкове поле: firstName" });
          continue;
        }
        const created = await prisma.contact.create({
          data: {
            tenantId,
            firstName: data.firstName,
            lastName: data.lastName ?? null,
            email: data.email ?? null,
            phone: data.phone ? encrypt(data.phone) : null,
            company: data.company ?? null,
            position: data.position ?? null,
            notes: data.notes ? encrypt(data.notes) : null,
            source: data.source ?? null,
            status: data.status ?? 'active',
            externalId: data.externalId ?? null,
          },
        });
        report.created += 1;
        if (created.externalId && !byExternalId.has(created.externalId)) {
          byExternalId.set(created.externalId, created);
        }
        if (created.email && !byEmail.has(created.email.toLowerCase())) {
          byEmail.set(created.email.toLowerCase(), created);
        }
        const digits = digitsOnly(safeDecrypt(created.phone));
        if (digits && !byPhone.has(digits)) byPhone.set(digits, created);
        continue;
      }

      if (!contactChanged(match, data)) {
        report.skipped += 1;
        continue;
      }

      const updated = await prisma.contact.update({
        where: { id: match.id },
        data: contactWriteData(data),
      });
      report.updated += 1;
      // Оновлюємо індекси, щоб наступні елементи батчу не створили дублікат
      byExternalId.delete(match.externalId ?? '');
      if (updated.externalId) byExternalId.set(updated.externalId, updated);
      if (updated.email) byEmail.set(updated.email.toLowerCase(), updated);
      const digits = digitsOnly(safeDecrypt(updated.phone));
      if (digits) byPhone.set(digits, updated);
    } catch (error) {
      report.errors.push({
        index,
        message: error instanceof Error ? error.message : 'Помилка збереження контакту',
      });
    }
  }

  return report;
}

/* ─────────────────────────────── Угоди ──────────────────────────────── */

const dealItemSchema = z.object({
  externalId: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(200),
  value: z.number().min(0).optional().nullable(),
  currency: z.string().max(3).optional(),
  company: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  pipelineId: z.string().max(100).optional().nullable(),
  stageId: z.string().max(100).optional().nullable(),
});

type DealItem = z.infer<typeof dealItemSchema>;

const DEAL_SYNC_FIELDS = [
  'externalId',
  'title',
  'value',
  'currency',
  'company',
  'notes',
  'status',
] as const;

type DealRow = Awaited<ReturnType<typeof prisma.deal.findMany>>[number];

function dealChanged(current: DealRow, data: DealItem): boolean {
  for (const field of DEAL_SYNC_FIELDS) {
    if (!(field in data)) continue;
    if ((current[field] ?? null) !== (data[field] ?? null)) return true;
  }
  return false;
}

function dealWriteData(data: DealItem): Record<string, unknown> {
  const write: Record<string, unknown> = {};
  for (const field of DEAL_SYNC_FIELDS) {
    if (!(field in data)) continue;
    write[field] = data[field] ?? null;
  }
  return write;
}

interface DealPlacement {
  pipelineId: string;
  stageId: string;
}

/**
 * Розміщення угоди: явні pipelineId/stageId (перевіряються належність тенанту),
 * інакше перша воронка та перша стадія тенанта.
 */
async function resolveDealPlacement(
  tenantId: string,
  data: Pick<DealItem, 'pipelineId' | 'stageId'>,
): Promise<DealPlacement | { error: string }> {
  if (data.stageId) {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: data.stageId, pipeline: { tenantId } },
      select: { id: true, pipelineId: true },
    });
    if (!stage) return { error: 'Стадію угоди не знайдено в тенанті' };
    if (data.pipelineId && data.pipelineId !== stage.pipelineId) {
      return { error: 'Стадія не належить вказаній воронці' };
    }
    return { pipelineId: stage.pipelineId, stageId: stage.id };
  }

  if (data.pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: data.pipelineId, tenantId },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!pipeline) return { error: 'Воронку продажів не знайдено в тенанті' };
    if (pipeline.stages.length === 0) return { error: 'У воронці немає стадій' };
    return { pipelineId: pipeline.id, stageId: pipeline.stages[0].id };
  }

  const defaultPipeline = await prisma.pipeline.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
  });
  if (!defaultPipeline || defaultPipeline.stages.length === 0) {
    return { error: 'Для тенанта не налаштовано воронку продажів' };
  }
  return { pipelineId: defaultPipeline.id, stageId: defaultPipeline.stages[0].id };
}

export async function upsertDeals(
  tenantId: string,
  items: unknown[],
): Promise<ExchangeUpsertReport> {
  const report = emptyReport();

  const parsed: { index: number; data: DealItem }[] = [];
  items.forEach((item, index) => {
    const result = dealItemSchema.safeParse(item);
    if (!result.success) {
      report.errors.push({ index, message: formatZodError(result.error) });
      return;
    }
    parsed.push({ index, data: result.data });
  });

  const existing = await prisma.deal.findMany({ where: { tenantId } });
  const byExternalId = mapBy(existing, (row) => row.externalId);
  const byTitle = mapBy(existing, (row) => row.title);

  for (const { index, data } of parsed) {
    try {
      let match: DealRow | undefined;
      if (data.externalId) match = byExternalId.get(data.externalId);
      if (!match) match = byTitle.get(data.title);

      // Розміщення потрібне при створенні або при явній вказівці воронки/стадії
      let placement: DealPlacement | null = null;
      if (!match || data.pipelineId || data.stageId) {
        const resolved = await resolveDealPlacement(tenantId, data);
        if ('error' in resolved) {
          // Якщо угода вже існує і розміщення не вказане — не заважаємо оновленню
          if (match && !data.pipelineId && !data.stageId) {
            placement = null;
          } else {
            report.errors.push({ index, message: resolved.error });
            continue;
          }
        } else {
          placement = resolved;
        }
      }

      if (!match) {
        if (!placement) {
          report.errors.push({ index, message: 'Не вдалося визначити воронку для угоди' });
          continue;
        }
        const created = await prisma.deal.create({
          data: {
            tenantId,
            title: data.title,
            value: data.value ?? null,
            currency: data.currency ?? 'UAH',
            company: data.company ?? null,
            notes: data.notes ?? null,
            status: data.status ?? 'open',
            externalId: data.externalId ?? null,
            pipelineId: placement.pipelineId,
            stageId: placement.stageId,
          },
        });
        report.created += 1;
        if (created.externalId && !byExternalId.has(created.externalId)) {
          byExternalId.set(created.externalId, created);
        }
        if (!byTitle.has(created.title)) byTitle.set(created.title, created);
        continue;
      }

      let changed = dealChanged(match, data);
      if (
        placement &&
        (placement.pipelineId !== match.pipelineId || placement.stageId !== match.stageId)
      ) {
        changed = true;
      }
      if (!changed) {
        report.skipped += 1;
        continue;
      }

      const updated = await prisma.deal.update({
        where: { id: match.id },
        data: {
          ...dealWriteData(data),
          ...(placement ? { pipelineId: placement.pipelineId, stageId: placement.stageId } : {}),
        },
      });
      report.updated += 1;
      if (match.externalId) byExternalId.delete(match.externalId);
      if (updated.externalId) byExternalId.set(updated.externalId, updated);
      byTitle.set(updated.title, updated);
    } catch (error) {
      report.errors.push({
        index,
        message: error instanceof Error ? error.message : 'Помилка збереження угоди',
      });
    }
  }

  return report;
}

/* ─────────────────────────────── Задачі ─────────────────────────────── */

const taskItemSchema = z.object({
  externalId: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['task', 'call', 'email', 'meeting', 'follow_up']).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().max(40).optional().nullable(),
});

type TaskItem = z.infer<typeof taskItemSchema>;

const TASK_SYNC_FIELDS = [
  'externalId',
  'title',
  'description',
  'type',
  'status',
  'priority',
] as const;

type TaskRow = Awaited<ReturnType<typeof prisma.task.findMany>>[number];

function taskChanged(current: TaskRow, data: TaskItem, dueDate: Date | null): boolean {
  for (const field of TASK_SYNC_FIELDS) {
    if (!(field in data)) continue;
    if ((current[field] ?? null) !== (data[field] ?? null)) return true;
  }
  if ('dueDate' in data && !datesEqual(current.dueDate, dueDate)) return true;
  return false;
}

function taskWriteData(data: TaskItem, dueDate: Date | null): Record<string, unknown> {
  const write: Record<string, unknown> = {};
  for (const field of TASK_SYNC_FIELDS) {
    if (!(field in data)) continue;
    write[field] = data[field] ?? null;
  }
  if ('dueDate' in data) write.dueDate = dueDate;
  return write;
}

export async function upsertTasks(
  tenantId: string,
  items: unknown[],
): Promise<ExchangeUpsertReport> {
  const report = emptyReport();

  const parsed: { index: number; data: TaskItem; dueDate: Date | null }[] = [];
  items.forEach((item, index) => {
    const result = taskItemSchema.safeParse(item);
    if (!result.success) {
      report.errors.push({ index, message: formatZodError(result.error) });
      return;
    }
    const due = parseDueDate(result.data.dueDate);
    if (!due.ok) {
      report.errors.push({
        index,
        message: 'Невірний формат dueDate (очікується ISO або dd.mm.yyyy)',
      });
      return;
    }
    parsed.push({ index, data: result.data, dueDate: due.date });
  });

  const existing = await prisma.task.findMany({ where: { tenantId } });
  const byExternalId = mapBy(existing, (row) => row.externalId);
  const byTitle = mapBy(existing, (row) => row.title);

  for (const { index, data, dueDate } of parsed) {
    try {
      let match: TaskRow | undefined;
      if (data.externalId) match = byExternalId.get(data.externalId);
      if (!match) match = byTitle.get(data.title);

      if (!match) {
        const created = await prisma.task.create({
          data: {
            tenantId,
            title: data.title,
            description: data.description ?? null,
            type: data.type ?? 'task',
            status: data.status ?? 'todo',
            priority: data.priority ?? 'medium',
            dueDate,
            externalId: data.externalId ?? null,
          },
        });
        report.created += 1;
        if (created.externalId && !byExternalId.has(created.externalId)) {
          byExternalId.set(created.externalId, created);
        }
        if (!byTitle.has(created.title)) byTitle.set(created.title, created);
        continue;
      }

      if (!taskChanged(match, data, dueDate)) {
        report.skipped += 1;
        continue;
      }

      const updated = await prisma.task.update({
        where: { id: match.id },
        data: taskWriteData(data, dueDate),
      });
      report.updated += 1;
      if (match.externalId) byExternalId.delete(match.externalId);
      if (updated.externalId) byExternalId.set(updated.externalId, updated);
      byTitle.set(updated.title, updated);
    } catch (error) {
      report.errors.push({
        index,
        message: error instanceof Error ? error.message : 'Помилка збереження задачі',
      });
    }
  }

  return report;
}
