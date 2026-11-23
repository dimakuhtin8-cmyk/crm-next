/**
 * Exchange API token (обмін з 1С / Excel) — токен тенанта для machine-to-machine API.
 *
 * Зберігається у Tenant.settings (JSON blob) як {"exchangeToken": "<random hex 32>"}.
 * Read-modify-write: інші ключі settings зберігаються без змін.
 *
 * ВАЖЛИВО: токен НІКОЛИ не логується і не потрапляє в audit log —
 * лише маска (maskToken: ****abcd).
 *
 * Пошук тенанта за токеном: токен лежить усередині JSON, тому
 * - за наявності підказки `tenantIdHint` (заголовок X-Tenant-Id) перевіряється
 *   лише цей тенант (1 запит);
 * - інакше — скануються тенанти з непорожнім settings і токен зіставляється в JS
 *   (JSON.parse + timing-safe порівняння). Підхід не покладається на LIKE/JSON-оператори
 *   БД і працює однаково на Postgres/MySQL/SQLite.
 */

import { randomBytes, timingSafeEqual } from 'crypto';

import { prisma } from '@crm-next/database';

/** 16 байт → 32 hex-символи */
const TOKEN_BYTES = 16;

type Settings = Record<string, unknown>;

function parseSettings(raw: string | null): Settings {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Settings;
    }
    return {};
  } catch {
    return {};
  }
}

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Повертає exchange-токен тенанта або null, якщо токен не згенеровано.
 */
export async function getExchangeToken(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) return null;
  const token = parseSettings(tenant.settings).exchangeToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * Генерує новий exchange-токен (crypto random, 32 hex) і зберігає його
 * у Tenant.settings (read-modify-write, інші ключі зберігаються).
 * Повертає токен (єдиний випадок, коли токен покидає межі модуля —
 * для показу адміністратору один раз).
 */
export async function generateExchangeToken(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const settings = parseSettings(tenant.settings);
  settings.exchangeToken = token;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: JSON.stringify(settings) },
  });
  return token;
}

/**
 * Відкликає exchange-токен тенанта (прибирає ключ exchangeToken,
 * інші ключі settings зберігаються). Без помилки, якщо токена не було.
 */
export async function revokeExchangeToken(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) return;

  const settings = parseSettings(tenant.settings);
  delete settings.exchangeToken;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: JSON.stringify(settings) },
  });
}

/**
 * Маска токена для відображення: ****abcd (останні 4 символи).
 */
export function maskToken(token: string): string {
  return `****${token.slice(-4)}`;
}

/**
 * Знаходить id тенанта за exchange-токеном.
 * Повертає null, якщо токен невірний або відкликаний.
 */
export async function findTenantByExchangeToken(
  token: string,
  tenantIdHint?: string | null,
): Promise<string | null> {
  if (!token) return null;

  if (tenantIdHint) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantIdHint },
      select: { id: true, settings: true },
    });
    if (!tenant) return null;
    const stored = parseSettings(tenant.settings).exchangeToken;
    return typeof stored === 'string' && stored.length > 0 && tokensMatch(stored, token)
      ? tenant.id
      : null;
  }

  const tenants = await prisma.tenant.findMany({
    where: { settings: { not: null } },
    select: { id: true, settings: true },
  });
  for (const tenant of tenants) {
    const stored = parseSettings(tenant.settings).exchangeToken;
    if (typeof stored === 'string' && stored.length > 0 && tokensMatch(stored, token)) {
      return tenant.id;
    }
  }
  return null;
}
