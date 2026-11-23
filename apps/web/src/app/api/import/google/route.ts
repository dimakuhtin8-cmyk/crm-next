import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth-guard';
import { csrfProtection } from '@/lib/csrf';
import { parseCsvToRows } from '@/lib/import/parse-csv';

import type { NextRequest } from 'next/server';

/**
 * POST /api/import/google — fetch a public Google Sheet and return its rows.
 *
 * Contract: { url } → { columns: string[], rows: Array<Record<string, string>> }
 *
 * SSRF GUARD: the user-supplied URL is only ever *parsed* — it is never fetched.
 * Only https + the exact hosts docs.google.com / docs.googleusercontent.com are
 * accepted, and the actual request always goes to a freshly constructed
 * https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid> URL.
 * Redirects are never followed (redirect: 'manual', 3xx → error), so a redirect
 * to an internal host cannot be leveraged. The response is capped at 5 MB.
 */

const ALLOWED_HOSTS = new Set(['docs.google.com', 'docs.googleusercontent.com']);
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

const googleSheetSchema = z.object({
  url: z.string().min(1).max(2048),
});

interface GoogleSheetRef {
  spreadsheetId: string;
  gid: string;
}

/** Extract spreadsheet id + gid from a Google Sheets URL. Returns null for anything else. */
function parseGoogleSheetUrl(raw: string): GoogleSheetRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // Reject anything that is not exactly https + an allowed Google host BEFORE any fetch.
  if (url.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  // Supports /spreadsheets/d/<id>/, /spreadsheets/d/<id>/edit... and /d/<id>/ forms.
  const idMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;

  // gid from ?gid= (or #gid= in the hash); default to the first sheet.
  const rawGid = url.searchParams.get('gid') || url.hash.match(/gid=(\d+)/)?.[1] || '';
  const gid = /^\d+$/.test(rawGid) ? rawGid : '0';

  return { spreadsheetId: idMatch[1], gid };
}

type FetchResult = { ok: true; text: string } | { ok: false; reason: 'too-large' | 'unreachable' };

/** Fetch a URL without following redirects, capping the body at maxBytes. */
async function fetchCapped(url: string, maxBytes: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'CRM-Next-Import/1.0' },
    });

    // 3xx would lead to another host — never follow, treat as an error.
    if (res.status >= 300 && res.status < 400) return { ok: false, reason: 'unreachable' };
    if (!res.ok) return { ok: false, reason: 'unreachable' };

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      if (text.length > maxBytes) return { ok: false, reason: 'too-large' };
      return { ok: true, text };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: 'too-large' };
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, text: new TextDecoder('utf-8').decode(merged) };
  } finally {
    clearTimeout(timer);
  }
}

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const parsed = googleSheetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Вкажіть посилання на Google Таблицю' }, { status: 400 });
    }

    const ref = parseGoogleSheetUrl(parsed.data.url);
    if (!ref) {
      return NextResponse.json(
        {
          error:
            'Невірне посилання на Google Таблицю. Очікується https://docs.google.com/spreadsheets/d/...',
        },
        { status: 400 },
      );
    }

    // The fetch target is constructed from validated parts only — never user-controlled.
    const exportUrl = `https://docs.google.com/spreadsheets/d/${ref.spreadsheetId}/export?format=csv&gid=${ref.gid}`;

    let fetched: FetchResult;
    try {
      fetched = await fetchCapped(exportUrl, MAX_RESPONSE_BYTES);
    } catch {
      fetched = { ok: false, reason: 'unreachable' };
    }

    if (!fetched.ok) {
      const error =
        fetched.reason === 'too-large'
          ? 'Таблиця завелика (ліміт 5 МБ)'
          : 'Не вдалося отримати таблицю з Google. Переконайтеся, що вона відкрита за посиланням («Усі, хто мають посилання»).';
      return NextResponse.json({ error }, { status: 502 });
    }

    const { columns, rows } = parseCsvToRows(fetched.text);
    if (columns.length === 0) {
      return NextResponse.json(
        { error: 'Таблиця порожня або має нерозпізнаний формат' },
        { status: 400 },
      );
    }

    return NextResponse.json({ columns, rows });
  } catch (error) {
    console.error('Google Sheets import error:', error);
    return NextResponse.json({ error: 'Помилка завантаження Google Таблиці' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'contact:create' })(POSTHandler);
