/**
 * Import + actualization engine (Phase A of integrations).
 *
 * Writes records from Excel/CSV/Google Sheets rows (already parsed to
 * `Array<Record<string, string>>`) into Contact/Deal/Task with two modes:
 *
 * - `create`  — only new records are created; rows matching an existing
 *               record are skipped (no duplicates on re-import).
 * - `upsert`  — matching rows are UPDATED (actualization), non-matching
 *               rows are created.
 *
 * Matching (within the tenant, never across tenants):
 *   1. `externalId` (exact) — the stable key of the external system;
 *   2. Contact: `email` (case-insensitive) then `phone` (digits only,
 *      phones may be stored AES-encrypted so they are matched in memory);
 *   3. Deal/Task: exact `title`.
 *
 * `mapping` translates source column names to entity fields, e.g.
 *   { firstName: "Ім'я", email: "Email", externalId: "Код" }
 * When the mapping is omitted/empty the row keys are used as field names.
 *
 * Report messages are English machine-oriented diagnostics (row/field
 * names included), NOT UI strings — the UI renders its own localized text.
 */

import { decrypt, encrypt, isEncrypted } from '@/lib/encryption';
import { createTenantQuery } from '@/lib/tenant-query';

export type ImportMode = 'create' | 'upsert';

/** One source row: keys are source column names, values are cell strings. */
export type ImportRow = Record<string, string>;

/** entityField → source column name. */
export type ImportMapping = Record<string, string>;

/**
 * `rows` accepts either the plain row array (+ optional `mapping` argument)
 * or a `{ rows, mapping }` bundle.
 */
export type ImportRowsInput = ImportRow[] | { rows: ImportRow[]; mapping?: ImportMapping };

export interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
  /** row = 1-based row number in the source */
  errors: Array<{ row: number; message: string }>;
}

function normalizeInput(
  rows: ImportRowsInput,
  mapping: ImportMapping,
): { rows: ImportRow[]; mapping: ImportMapping } {
  if (Array.isArray(rows)) {
    return { rows, mapping };
  }
  return {
    rows: rows.rows ?? [],
    mapping: { ...(rows.mapping ?? {}), ...mapping },
  };
}

/**
 * Read a mapped cell. Empty/missing cell means "field not provided":
 * on create it becomes null (or the field default), on update it is
 * left untouched — an empty source cell never wipes an existing value.
 */
function cell(row: ImportRow, mapping: ImportMapping, field: string): string {
  return (row[mapping[field] ?? field] ?? '').trim();
}

/** Digits-only form for phone matching: "+38 (067) 12-34-567" → "380671234567". */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Parse a number cell: "1 234,56", "1,234.56", "1234.56".
 * Returns null when the value is not a finite number.
 */
export function parseImportNumber(raw: string): number | null {
  let value = raw.trim().replace(/[\s\u00A0]/g, '');
  if (!value) return null;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators present: the right-most one is the decimal separator.
    if (lastComma > lastDot) {
      value = value.replace(/\./g, '').replace(',', '.');
    } else {
      value = value.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Single comma → decimal comma ("1,5" = 1.5).
    value = value.replace(',', '.');
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a date cell: ISO ("2026-03-01", "2026-03-01T10:00:00Z") or
 * dd.mm.yyyy with optional hh:mm(:ss). Returns null when unparseable.
 */
export function parseImportDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const eu = /^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (eu) {
    const [, d, m, y, hh = '0', mi = '0', ss = '0'] = eu;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mi), Number(ss));
    // Round-trip check rejects impossible dates like 31.02.2026.
    if (date.getDate() !== Number(d) || date.getMonth() !== Number(m) - 1) return null;
    return date;
  }

  const iso = /^\d{4}-\d{2}-\d{2}([T ].*)?$/.exec(value);
  if (iso) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function safeDecrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Import/actualize contacts.
 *
 * `upsertContacts(tenantId, userId, rows, mode)` — row keys are field names,
 * or pass `mapping` as the 5th argument / inside `rows`.
 */
export async function upsertContacts(
  tenantId: string,
  userId: string | null,
  rows: ImportRowsInput,
  mode: ImportMode,
  mapping: ImportMapping = {},
): Promise<ImportReport> {
  const { rows: source, mapping: map } = normalizeInput(rows, mapping);
  const tq = createTenantQuery(tenantId);
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };

  // Phones may be stored AES-encrypted (ENCRYPTED_FIELDS.contact), so they
  // cannot be matched with a DB query — build a digits-only index once per
  // run and keep it up to date as rows are written.
  let phoneIndex: Map<string, string> | null = null;
  const getPhoneIndex = async (): Promise<Map<string, string>> => {
    if (phoneIndex) return phoneIndex;
    phoneIndex = new Map();
    const contacts = await tq.contact.findMany({ where: { phone: { not: null } } });
    for (const contact of contacts) {
      const digits = normalizePhoneDigits(safeDecrypt(contact.phone ?? ''));
      if (digits && !phoneIndex.has(digits)) phoneIndex.set(digits, contact.id);
    }
    return phoneIndex;
  };

  for (let i = 0; i < source.length; i++) {
    const row = source[i];
    const rowNumber = i + 1;

    try {
      const firstName = cell(row, map, 'firstName');
      if (!firstName) {
        report.errors.push({ row: rowNumber, message: 'Missing required field: firstName' });
        continue;
      }

      const emailRaw = cell(row, map, 'email');
      const phoneRaw = cell(row, map, 'phone');
      const externalId = cell(row, map, 'externalId') || null;

      // Matching: externalId → email (normalized lowercase) → phone (digits only)
      let existing: { id: string } | null = null;
      if (externalId) {
        existing = await tq.contact.findFirst({ where: { externalId } });
      }
      if (!existing && emailRaw) {
        existing = await tq.contact.findFirst({
          where: { email: { equals: emailRaw.toLowerCase(), mode: 'insensitive' } },
        });
      }
      if (!existing && phoneRaw) {
        const digits = normalizePhoneDigits(phoneRaw);
        if (digits) {
          const id = (await getPhoneIndex()).get(digits);
          if (id) existing = await tq.contact.findUnique({ where: { id } });
        }
      }

      const notesRaw = cell(row, map, 'notes');

      if (existing && mode === 'create') {
        // Row already exists — skip, never duplicate.
        report.skipped++;
        continue;
      }

      if (existing) {
        // Actualization: only non-empty mapped cells are written, so an
        // empty source cell never clears an existing value.
        const data: Record<string, unknown> = {};
        const set = (field: string, value: string | null) => {
          if (value) data[field] = value;
        };
        set('firstName', firstName);
        set('lastName', cell(row, map, 'lastName'));
        set('email', emailRaw ? emailRaw.toLowerCase() : null);
        set('phone', phoneRaw ? encrypt(phoneRaw) : null);
        set('company', cell(row, map, 'company'));
        set('position', cell(row, map, 'position'));
        set('notes', notesRaw ? encrypt(notesRaw) : null);
        set('source', cell(row, map, 'source'));
        set('status', cell(row, map, 'status'));
        set('externalId', externalId);

        await tq.contact.update({ where: { id: existing.id }, data });
        report.updated++;

        if (phoneRaw) {
          const digits = normalizePhoneDigits(phoneRaw);
          if (digits) (await getPhoneIndex()).set(digits, existing.id);
        }
      } else {
        const contact = (await tq.contact.create({
          data: {
            firstName,
            lastName: cell(row, map, 'lastName') || null,
            email: emailRaw ? emailRaw.toLowerCase() : null,
            phone: phoneRaw ? encrypt(phoneRaw) : null,
            company: cell(row, map, 'company') || null,
            position: cell(row, map, 'position') || null,
            notes: notesRaw ? encrypt(notesRaw) : null,
            source: cell(row, map, 'source') || 'import',
            status: cell(row, map, 'status') || 'active',
            externalId,
            ownerId: userId,
          },
        })) as { id: string };
        report.created++;

        if (phoneRaw) {
          const digits = normalizePhoneDigits(phoneRaw);
          if (digits) (await getPhoneIndex()).set(digits, contact.id);
        }
      }
    } catch (error) {
      report.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return report;
}

/**
 * Import/actualize deals.
 *
 * Deal rows carry: title (required), value/amount, currency, externalId,
 * company, notes, status. Pipeline/stage are set on create only: from the
 * `pipelineId`/`stageId` mapping when present, otherwise the tenant's
 * first pipeline (default one preferred) and its first stage. When the
 * tenant has no pipeline at all the row is skipped with a message.
 */
export async function upsertDeals(
  tenantId: string,
  userId: string | null,
  rows: ImportRowsInput,
  mode: ImportMode,
  mapping: ImportMapping = {},
): Promise<ImportReport> {
  const { rows: source, mapping: map } = normalizeInput(rows, mapping);
  const tq = createTenantQuery(tenantId);
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };

  // Resolved once per run: { id, stageId } of the tenant's first pipeline
  // (default pipeline preferred) and its first stage; null when none exist.
  let defaultPipeline: { id: string; stageId: string } | null | undefined;
  const getDefaultPipeline = async () => {
    if (defaultPipeline !== undefined) return defaultPipeline;
    const pipelines = await tq.pipeline.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] as unknown as Record<string, string>,
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    const pipeline = pipelines[0] as unknown as
      { id: string; stages: Array<{ id: string }> } | undefined;
    defaultPipeline =
      pipeline && pipeline.stages.length > 0
        ? { id: pipeline.id, stageId: pipeline.stages[0].id }
        : null;
    return defaultPipeline;
  };

  // Stage ids per pipeline (for validating a mapped stageId).
  const stageIdsByPipeline = new Map<string, Set<string>>();
  const getStageIds = async (pipelineId: string): Promise<Set<string>> => {
    let ids = stageIdsByPipeline.get(pipelineId);
    if (!ids) {
      const stages = await tq.pipelineStage.findMany({ where: { pipelineId } });
      ids = new Set(stages.map((stage: { id: string }) => stage.id));
      stageIdsByPipeline.set(pipelineId, ids);
    }
    return ids;
  };

  for (let i = 0; i < source.length; i++) {
    const row = source[i];
    const rowNumber = i + 1;

    try {
      const title = cell(row, map, 'title');
      if (!title) {
        report.errors.push({ row: rowNumber, message: 'Missing required field: title' });
        continue;
      }

      // value/amount are aliases for the same field.
      const rawValue = cell(row, map, 'value') || cell(row, map, 'amount');
      let value: number | null = null;
      if (rawValue) {
        value = parseImportNumber(rawValue);
        if (value === null) {
          report.errors.push({
            row: rowNumber,
            message: `Invalid number for value: "${rawValue}"`,
          });
          continue;
        }
      }

      const externalId = cell(row, map, 'externalId') || null;

      // Matching: externalId → exact title (within tenant)
      let existing: { id: string } | null = null;
      if (externalId) {
        existing = await tq.deal.findFirst({ where: { externalId } });
      }
      if (!existing) {
        existing = await tq.deal.findFirst({ where: { title } });
      }

      if (existing && mode === 'create') {
        report.skipped++;
        continue;
      }

      if (existing) {
        const data: Record<string, unknown> = {};
        const set = (field: string, val: string | number | null) => {
          if (val !== null && val !== '') data[field] = val;
        };
        set('title', title);
        if (value !== null) data.value = value;
        set('currency', cell(row, map, 'currency'));
        set('company', cell(row, map, 'company'));
        set('notes', cell(row, map, 'notes'));
        set('status', cell(row, map, 'status'));
        set('externalId', externalId);

        await tq.deal.update({ where: { id: existing.id }, data });
        report.updated++;
        continue;
      }

      // New deal → pipeline/stage must be resolved first.
      const mappedPipelineId = cell(row, map, 'pipelineId');
      let pipelineId: string | null = null;
      let stageId: string | null = null;

      if (mappedPipelineId) {
        const pipeline = await tq.pipeline.findUnique({ where: { id: mappedPipelineId } });
        if (!pipeline) {
          report.errors.push({
            row: rowNumber,
            message: `Pipeline not found: "${mappedPipelineId}"`,
          });
          continue;
        }
        pipelineId = pipeline.id;
        const mappedStageId = cell(row, map, 'stageId');
        if (mappedStageId) {
          if (!(await getStageIds(pipeline.id)).has(mappedStageId)) {
            report.errors.push({
              row: rowNumber,
              message: `Stage "${mappedStageId}" does not belong to pipeline "${pipeline.id}"`,
            });
            continue;
          }
          stageId = mappedStageId;
        }
      }

      if (!pipelineId || !stageId) {
        const fallback = await getDefaultPipeline();
        if (!fallback) {
          // No pipeline in the tenant → row cannot be written.
          report.skipped++;
          report.errors.push({
            row: rowNumber,
            message: 'No pipeline exists for tenant — deal skipped',
          });
          continue;
        }
        pipelineId = pipelineId ?? fallback.id;
        stageId = stageId ?? fallback.stageId;
      }

      await tq.deal.create({
        data: {
          title,
          value,
          currency: cell(row, map, 'currency') || 'UAH',
          company: cell(row, map, 'company') || null,
          notes: cell(row, map, 'notes') || null,
          status: cell(row, map, 'status') || 'open',
          externalId,
          pipelineId,
          stageId,
          ownerId: userId,
        },
      });
      report.created++;
    } catch (error) {
      report.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return report;
}

/**
 * Import/actualize tasks.
 *
 * Task rows carry: title (required), description, type, status, priority,
 * dueDate (ISO or dd.mm.yyyy), externalId. New tasks get assigneeId = userId.
 */
export async function upsertTasks(
  tenantId: string,
  userId: string | null,
  rows: ImportRowsInput,
  mode: ImportMode,
  mapping: ImportMapping = {},
): Promise<ImportReport> {
  const { rows: source, mapping: map } = normalizeInput(rows, mapping);
  const tq = createTenantQuery(tenantId);
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < source.length; i++) {
    const row = source[i];
    const rowNumber = i + 1;

    try {
      const title = cell(row, map, 'title');
      if (!title) {
        report.errors.push({ row: rowNumber, message: 'Missing required field: title' });
        continue;
      }

      const rawDueDate = cell(row, map, 'dueDate');
      let dueDate: Date | null = null;
      if (rawDueDate) {
        dueDate = parseImportDate(rawDueDate);
        if (!dueDate) {
          report.errors.push({
            row: rowNumber,
            message: `Invalid dueDate: "${rawDueDate}" (expected ISO or dd.mm.yyyy)`,
          });
          continue;
        }
      }

      const externalId = cell(row, map, 'externalId') || null;

      // Matching: externalId → exact title (within tenant)
      let existing: { id: string } | null = null;
      if (externalId) {
        existing = await tq.task.findFirst({ where: { externalId } });
      }
      if (!existing) {
        existing = await tq.task.findFirst({ where: { title } });
      }

      if (existing && mode === 'create') {
        report.skipped++;
        continue;
      }

      if (existing) {
        const data: Record<string, unknown> = {};
        const set = (field: string, val: string | null) => {
          if (val) data[field] = val;
        };
        set('title', title);
        set('description', cell(row, map, 'description'));
        set('type', cell(row, map, 'type'));
        set('status', cell(row, map, 'status'));
        set('priority', cell(row, map, 'priority'));
        set('externalId', externalId);
        if (dueDate) data.dueDate = dueDate;

        await tq.task.update({ where: { id: existing.id }, data });
        report.updated++;
      } else {
        await tq.task.create({
          data: {
            title,
            description: cell(row, map, 'description') || null,
            type: cell(row, map, 'type') || 'task',
            status: cell(row, map, 'status') || 'todo',
            priority: cell(row, map, 'priority') || 'medium',
            dueDate,
            externalId,
            assigneeId: userId,
          },
        });
        report.created++;
      }
    } catch (error) {
      report.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return report;
}
