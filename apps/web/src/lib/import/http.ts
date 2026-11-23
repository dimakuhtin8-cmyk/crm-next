/**
 * Shared HTTP handler for the import/actualization endpoints
 * (/api/import, /api/deals/import, /api/tasks/import).
 *
 * Request body: { entity?, mode?, mapping?, rows } where
 *   - `entity`  — 'contact' | 'deal' | 'task' (optional when the endpoint
 *                 fixes the entity, e.g. /api/deals/import);
 *   - `mode`    — 'create' (default) | 'upsert';
 *   - `mapping` — entityField → source column name;
 *   - `rows`    — Array<Record<string, string>>, max 5000 rows.
 *
 * Response: { report: { created, updated, skipped, errors: [{ row, message }] } }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractUser } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { upsertContacts, upsertDeals, upsertTasks } from '@/lib/import/upsert';
import { hasPermission } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';

import type { ImportReport } from '@/lib/import/upsert';
import type { NextRequest } from 'next/server';

export type ImportEntity = 'contact' | 'deal' | 'task';

const ENTITY_PERMISSIONS: Record<ImportEntity, string> = {
  contact: 'contact:create',
  deal: 'deal:create',
  task: 'task:create',
};

// Cells may arrive as numbers/booleans/null from spreadsheet parsers —
// coerce them to strings so rows stay Record<string, string>.
const cellSchema = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .transform((value) => (value === null ? '' : String(value)));

const importBodySchema = z.object({
  entity: z.enum(['contact', 'deal', 'task']),
  mode: z.enum(['create', 'upsert']).default('create'),
  mapping: z.record(z.string(), z.string()).default({}),
  rows: z.array(z.record(z.string(), cellSchema)).max(5000),
});

export async function handleImportRequest(
  request: NextRequest,
  options: { entity?: ImportEntity } = {},
): Promise<NextResponse> {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = importBodySchema.safeParse({
      ...body,
      entity: options.entity ?? body.entity,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { entity, mode, mapping, rows } = parsed.data;

    // Permission depends on the entity being imported (the request body),
    // so it is checked here — withAuth() takes a fixed permission per route.
    const permission = ENTITY_PERMISSIONS[entity];
    const user = await extractUser(request);
    const userId = user?.id ?? null;
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const allowed = userId ? await hasPermission(userId, tenantId, permission) : false;
    if (!userId || !allowed) {
      return NextResponse.json(
        { error: 'Недостатньо прав', required: permission },
        { status: 403 },
      );
    }

    const run =
      entity === 'contact' ? upsertContacts : entity === 'deal' ? upsertDeals : upsertTasks;
    const report: ImportReport = await run(tenantId, userId, rows, mode, mapping);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Помилка імпорту даних' }, { status: 500 });
  }
}
