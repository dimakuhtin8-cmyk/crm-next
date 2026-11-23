/**
 * Exchange API (обмін з 1С) — інтеграційний тест
 * (реальний route handler + реальна БД crm_test, без cookie-сесій — X-Api-Key).
 * Паттерн скопійовано з contacts/__tests__/datafilter.test.ts.
 */

import { prisma } from '@crm-next/database';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { GET, POST } from '@/app/api/v1/exchange/[entity]/route';
import { generateExchangeToken } from '@/lib/exchange-token';

interface ExchangeItem {
  id: string;
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  updatedAt: string;
  [key: string]: unknown;
}

interface ExchangeResponse {
  items: ExchangeItem[];
  nextSince: string;
  count: number;
}

interface Report {
  created: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

function entityParams(entity: string) {
  return { params: Promise.resolve({ entity }) };
}

function makeRequest(
  url: string,
  options: { token?: string; method?: string; body?: unknown; bearer?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (options.token) {
    if (options.bearer) {
      headers.authorization = `Bearer ${options.token}`;
    } else {
      headers['x-api-key'] = options.token;
    }
  }
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function exchangeGet(
  entity: string,
  token: string | undefined,
  query = '',
  bearer = false,
): Promise<ExchangeResponse> {
  const response = await GET(
    makeRequest(`http://localhost:3000/api/v1/exchange/${entity}${query}`, { token, bearer }),
    entityParams(entity),
  );
  expect(response.status).toBe(200);
  return response.json();
}

async function exchangePost(
  entity: string,
  token: string | undefined,
  items: unknown[],
): Promise<Report> {
  const response = await POST(
    makeRequest(`http://localhost:3000/api/v1/exchange/${entity}`, {
      token,
      method: 'POST',
      body: { items },
    }),
    entityParams(entity),
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  return data.report;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let tenantAId: string;
let tenantBId: string;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  // Cleanup in reverse FK order
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenantA = await prisma.tenant.create({
    data: { name: 'Exchange Tenant A', slug: 'exchange-a', plan: 'professional' },
  });
  tenantAId = tenantA.id;

  const tenantB = await prisma.tenant.create({
    data: { name: 'Exchange Tenant B', slug: 'exchange-b', plan: 'professional' },
  });
  tenantBId = tenantB.id;

  tokenA = await generateExchangeToken(tenantAId);
  tokenB = await generateExchangeToken(tenantBId);
});

afterAll(async () => {
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('Exchange API — автентифікація за токеном', () => {
  it('повертає 401 без токена', async () => {
    const response = await GET(
      makeRequest('http://localhost:3000/api/v1/exchange/contacts'),
      entityParams('contacts'),
    );
    expect(response.status).toBe(401);
  });

  it('повертає 401 для невірного токена', async () => {
    const response = await GET(
      makeRequest('http://localhost:3000/api/v1/exchange/contacts', {
        token: '0000000000000000000000000000dead',
      }),
      entityParams('contacts'),
    );
    expect(response.status).toBe(401);

    const postResponse = await POST(
      makeRequest('http://localhost:3000/api/v1/exchange/contacts', {
        token: '0000000000000000000000000000dead',
        method: 'POST',
        body: { items: [] },
      }),
      entityParams('contacts'),
    );
    expect(postResponse.status).toBe(401);
  });

  it('GET працює з згенерованим токеном (X-Api-Key та Bearer)', async () => {
    const viaApiKey = await exchangeGet('contacts', tokenA);
    expect(Array.isArray(viaApiKey.items)).toBe(true);
    expect(typeof viaApiKey.nextSince).toBe('string');
    expect(viaApiKey.count).toBe(viaApiKey.items.length);

    const viaBearer = await exchangeGet('contacts', tokenB, '', true);
    expect(Array.isArray(viaBearer.items)).toBe(true);
  });
});

describe('Exchange API — POST upsert', () => {
  it('upsert за externalId: створення, потім оновлення без дублікатів', async () => {
    const createdReport = await exchangePost('contacts', tokenA, [
      { externalId: 'EXT-1', firstName: 'Іван', email: 'ivan@test.com' },
    ]);
    expect(createdReport.created).toBe(1);
    expect(createdReport.updated).toBe(0);
    expect(createdReport.errors).toHaveLength(0);

    const updatedReport = await exchangePost('contacts', tokenA, [
      { externalId: 'EXT-1', firstName: 'Іван Петрович' },
    ]);
    expect(updatedReport.updated).toBe(1);
    expect(updatedReport.created).toBe(0);
    expect(updatedReport.errors).toHaveLength(0);

    // Дублікатів немає, дані оновлено
    const data = await exchangeGet('contacts', tokenA);
    const matches = data.items.filter((item) => item.externalId === 'EXT-1');
    expect(matches).toHaveLength(1);
    expect(matches[0].firstName).toBe('Іван Петрович');
  });

  it('контакт зіставляється за email (без урахування регістру), якщо немає externalId', async () => {
    const createdReport = await exchangePost('contacts', tokenA, [
      { firstName: 'Марія', email: 'maria@test.com', phone: '+380501112233' },
    ]);
    expect(createdReport.created).toBe(1);

    // Той самий email в іншому регістрі — оновлення, не створення
    const updatedReport = await exchangePost('contacts', tokenA, [
      { firstName: 'Марія О.', email: 'MARIA@test.com' },
    ]);
    expect(updatedReport.updated).toBe(1);
    expect(updatedReport.created).toBe(0);

    const count = await prisma.contact.count({
      where: { tenantId: tenantAId, email: { contains: 'maria@test.com', mode: 'insensitive' } },
    });
    expect(count).toBe(1);
  });
});

describe('Exchange API — GET фільтр since', () => {
  it('повертає лише записи, оновлені після since', async () => {
    const before = new Date();

    await exchangePost('contacts', tokenA, [{ externalId: 'EXT-S1', firstName: 'Синхро Один' }]);
    await sleep(30);
    await exchangePost('contacts', tokenA, [{ externalId: 'EXT-S2', firstName: 'Синхро Два' }]);
    await sleep(30);

    // Усі записи, новіші за before — має бути рівно два нових
    const all = await exchangeGet('contacts', tokenA, `?since=${before.toISOString()}`);
    const syncItems = all.items.filter((item) => (item.externalId || '').startsWith('EXT-S'));
    expect(syncItems).toHaveLength(2);

    // nextSince — час останнього запису; зсуваємо на 1 мс, щоб не повторити межові
    const since = new Date(new Date(all.nextSince).getTime() + 1).toISOString();

    await sleep(30);
    const updateReport = await exchangePost('contacts', tokenA, [
      { externalId: 'EXT-S1', notes: 'оновлено' },
    ]);
    expect(updateReport.updated).toBe(1);

    const changed = await exchangeGet('contacts', tokenA, `?since=${since}`);
    const changedIds = changed.items.map((item) => item.externalId);
    expect(changedIds).toContain('EXT-S1');
    expect(changedIds).not.toContain('EXT-S2');
  });
});

describe('Exchange API — ізоляція тенантів', () => {
  it('чужий тенант не бачить і не змінює дані іншого тенанта', async () => {
    // Запис із тим самим externalId у тенанті B — створюється окремо,
    // запис тенанта A не змінюється
    const reportB = await exchangePost('contacts', tokenB, [
      { externalId: 'EXT-1', firstName: 'Хтось Інший' },
    ]);
    expect(reportB.created).toBe(1);
    expect(reportB.updated).toBe(0);

    const contactA = await prisma.contact.findFirst({
      where: { tenantId: tenantAId, externalId: 'EXT-1' },
    });
    expect(contactA?.firstName).toBe('Іван Петрович');

    // GET з токеном B повертає лише дані тенанта B
    const dataB = await exchangeGet('contacts', tokenB);
    expect(dataB.items).toHaveLength(1);
    expect(dataB.items[0].firstName).toBe('Хтось Інший');
    expect(dataB.items.map((item) => item.externalId)).not.toContain('EXT-S1');

    // GET з токеном A не містить записів тенанта B
    const dataA = await exchangeGet('contacts', tokenA);
    expect(dataA.items.map((item) => item.firstName)).not.toContain('Хтось Інший');
    expect(dataA.items.some((item) => item.externalId === 'EXT-1')).toBe(true);
  });
});
