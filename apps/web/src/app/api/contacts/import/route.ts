import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * POST /api/contacts/import — Import contacts from CSV
 * Accepts JSON array of rows with column mapping
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const { rows, mapping } = body as {
      rows: Array<Record<string, string>>;
      mapping: {
        firstName: string;
        lastName?: string;
        email?: string;
        phone?: string;
        company?: string;
        position?: string;
      };
    };

    if (!rows?.length) {
      return NextResponse.json({ error: 'Немає даних для імпорту' }, { status: 400 });
    }

    if (!mapping?.firstName) {
      return NextResponse.json({ error: 'Не вказано стовпчик для імені' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstName = row[mapping.firstName]?.trim();

      if (!firstName) {
        skipped++;
        continue;
      }

      try {
        await tq.contact.create({
          data: {
            firstName,
            lastName: mapping.lastName ? row[mapping.lastName]?.trim() || null : null,
            email: mapping.email ? row[mapping.email]?.trim() || null : null,
            phone: mapping.phone ? row[mapping.phone]?.trim() || null : null,
            company: mapping.company ? row[mapping.company]?.trim() || null : null,
            position: mapping.position ? row[mapping.position]?.trim() || null : null,
            source: 'csv_import',
            status: 'active',
          },
        } as never);
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
      total: rows.length,
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    return NextResponse.json(
      { error: 'Помилка імпорту контактів' },
      { status: 500 }
    );
  }
}
