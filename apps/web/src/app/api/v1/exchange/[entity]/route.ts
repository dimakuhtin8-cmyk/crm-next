/**
 * Exchange API (обмін з 1С / Excel) — токен-автентифікований API без cookie-сесій.
 *
 * GET  /api/v1/exchange/{contacts|deals|tasks}?since=<ISO>&limit=<1..500>&offset=
 *      → { items: [...], nextSince: <ISO max updatedAt>, count }
 * POST /api/v1/exchange/{contacts|deals|tasks}
 *      → { report: { created, updated, skipped, errors: [{ index, message }] } }
 *
 * Автентифікація: заголовок X-Api-Key: <token> або Authorization: Bearer <token>.
 * Тенант визначається за токеном (див. src/lib/exchange-token.ts);
 * опційний заголовок X-Tenant-Id — підказка для прискореного пошуку (перевіряється).
 * CSRF-захист не застосовується: це machine-to-machine API (нема cookie-сесії).
 * Дані ізольовані за тенантом: запити виконуються лише в межах тенанта токена.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import { decrypt, isEncrypted } from '@/lib/encryption';
import { upsertContacts, upsertDeals, upsertTasks } from '@/lib/exchange/upsert';
import { findTenantByExchangeToken } from '@/lib/exchange-token';

import type { NextRequest } from 'next/server';

interface Params {
  params: Promise<{ entity: string }>;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

function extractToken(request: NextRequest): string | null {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && apiKey.trim()) return apiKey.trim();
  const authorization = request.headers.get('authorization');
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice('bearer '.length).trim();
    return token || null;
  }
  return null;
}

/** Повертає tenantId токена або null (→ 401). */
async function authenticate(request: NextRequest): Promise<string | null> {
  const token = extractToken(request);
  if (!token) return null;
  return findTenantByExchangeToken(token, request.headers.get('x-tenant-id'));
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
}

/** Дешифрує поле контакту, якщо воно збережене в зашифрованому вигляді. */
function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * GET /api/v1/exchange/[entity] — вивантаження змінених записів тенанта.
 *
 * Параметри:
 *   since  — ISO-дата (рівні та новіші за неї; за замовчуванням 1970-01-01)
 *   limit  — 1..500 (за замовчуванням 100, значення поза діапазоном стискаються)
 *   offset — зсув (за замовчуванням 0)
 */
async function GETHandler(request: NextRequest, { params }: Params) {
  const { entity } = await params;
  if (entity !== 'contacts' && entity !== 'deals' && entity !== 'tasks') {
    return NextResponse.json({ error: 'Невідома сутність' }, { status: 404 });
  }

  try {
    const tenantId = await authenticate(request);
    if (!tenantId) return unauthorized();

    const { searchParams } = new URL(request.url);

    const sinceRaw = searchParams.get('since');
    let sinceDate = new Date(0);
    if (sinceRaw) {
      sinceDate = new Date(sinceRaw);
      if (Number.isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { error: 'Невірний параметр since (очікується ISO-дата)' },
          { status: 400 },
        );
      }
    }

    const limitRaw = parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isNaN(limitRaw)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

    const offsetRaw = parseInt(searchParams.get('offset') || '', 10);
    const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0);

    const common = {
      where: { tenantId, updatedAt: { gte: sinceDate } },
      orderBy: { updatedAt: 'asc' as const },
      skip: offset,
      take: limit,
    };

    let items: unknown[];
    if (entity === 'contacts') {
      const contacts = await prisma.contact.findMany({
        ...common,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
          externalId: true,
          updatedAt: true,
        },
      });
      items = contacts.map((contact) => ({
        ...contact,
        phone: safeDecrypt(contact.phone),
      }));
    } else if (entity === 'deals') {
      items = await prisma.deal.findMany({
        ...common,
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          company: true,
          status: true,
          externalId: true,
          updatedAt: true,
        },
      });
    } else {
      items = await prisma.task.findMany({
        ...common,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          externalId: true,
          updatedAt: true,
        },
      });
    }

    // nextSince — максимальний updatedAt цієї сторінки (ISO), або echo вхідного
    // since для порожньої сторінки. Фільтр працює як >=, тому для наступного
    // запиту варто додати 1 мс або дедуплікувати за id/externalId
    // (див. docs/1c-integration.md).
    let nextSince = sinceDate.toISOString();
    if (items.length > 0) {
      const timestamps = items.map((item) => (item as { updatedAt: Date }).updatedAt.getTime());
      nextSince = new Date(Math.max(...timestamps)).toISOString();
    }

    return NextResponse.json({ items, nextSince, count: items.length });
  } catch (error) {
    console.error('Exchange GET error:', error);
    return NextResponse.json({ error: 'Помилка вивантаження даних' }, { status: 500 });
  }
}

/**
 * POST /api/v1/exchange/[entity] — завантаження даних (upsert) у тенант токена.
 *
 * Тіло: { items: [{ externalId?, ...поля }] } (максимум 500 елементів).
 * Зіставлення: externalId → email/телефон (контакти) або title (угоди/задачі).
 * Пошкоджений елемент не блокує решту — потрапляє в report.errors.
 */
async function POSTHandler(request: NextRequest, { params }: Params) {
  const { entity } = await params;
  if (entity !== 'contacts' && entity !== 'deals' && entity !== 'tasks') {
    return NextResponse.json({ error: 'Невідома сутність' }, { status: 404 });
  }

  try {
    const tenantId = await authenticate(request);
    if (!tenantId) return unauthorized();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Невірне тіло запиту' }, { status: 400 });
    }

    const items = (body as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Невірне тіло запиту: очікується { items: [...] }' },
        { status: 400 },
      );
    }
    if (items.length > MAX_LIMIT) {
      return NextResponse.json(
        { error: `Забагато елементів (максимум ${MAX_LIMIT})` },
        { status: 400 },
      );
    }

    const report =
      entity === 'contacts'
        ? await upsertContacts(tenantId, items)
        : entity === 'deals'
          ? await upsertDeals(tenantId, items)
          : await upsertTasks(tenantId, items);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Exchange POST error:', error);
    return NextResponse.json({ error: 'Помилка завантаження даних' }, { status: 500 });
  }
}

export const GET = GETHandler;
export const POST = POSTHandler;
