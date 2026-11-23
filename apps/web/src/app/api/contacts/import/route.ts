import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { upsertContacts } from '@/lib/import/upsert';
import { getTenantQuery } from '@/lib/tenant-query';

import type { NextRequest } from 'next/server';

/**
 * POST /api/contacts/import — Import contacts from CSV
 * Accepts JSON array of rows with column mapping
 *
 * Write phase is delegated to the import engine (src/lib/import/upsert):
 * `mode: 'create'` (default) skips rows matching an existing contact,
 * `mode: 'upsert'` updates them (actualization) — matching by `externalId`
 * (mapping.externalId), then email, then phone.
 *
 * The response keeps the legacy fields ({ imported, skipped, errors, total })
 * and adds the engine `report` ({ created, updated, skipped, errors }).
 */
async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = (await request.json()) as {
      rows: Array<Record<string, string>>;
      mode?: 'create' | 'upsert';
      mapping: {
        firstName: string;
        lastName?: string;
        email?: string;
        phone?: string;
        company?: string;
        position?: string;
        externalId?: string;
      };
    };
    const { rows, mapping, mode } = body;

    if (!rows?.length) {
      return NextResponse.json({ error: 'Немає даних для імпорту' }, { status: 400 });
    }

    if (!mapping?.firstName) {
      return NextResponse.json({ error: 'Не вказано стовпчик для імені' }, { status: 400 });
    }

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const userId = await extractUserId(request);

    const report = await upsertContacts(
      tenantId,
      userId,
      rows,
      mode === 'upsert' ? 'upsert' : 'create',
      mapping,
    );

    return NextResponse.json({
      imported: report.created + report.updated,
      skipped: report.skipped,
      errors: report.errors.map((error) => ({ row: error.row, error: error.message })),
      total: rows.length,
      report,
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    return NextResponse.json({ error: 'Помилка імпорту контактів' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'contact:create' })(POSTHandler);
