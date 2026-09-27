/**
 * Per-provider AI keys.
 *
 * AiProviderKey (one row per tenant+provider) is the source of truth.
 * Legacy tenant.aiApiKey / tenant.geminiApiKey are kept as fallback
 * for rows written before multi-key support (see backfill).
 */

import { prisma } from '@crm-next/database';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

export interface ProviderKeyInfo {
  provider: string;
  hasKey: boolean;
  maskedKey: string;
  updatedAt: Date | null;
}

function maskKey(encrypted: string): string {
  try {
    const raw = decrypt(encrypted);
    if (!raw || raw.length < 8) return '••••••••';
    return raw.slice(0, 4) + '••••••••' + raw.slice(-4);
  } catch {
    return '••••••••';
  }
}

/** Raw encrypted key for a provider, or null. New table first, legacy second. */
export async function getProviderKeyRaw(tenantId: string, provider: string): Promise<string | null> {
  const row = await prisma.aiProviderKey.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
    select: { apiKey: true },
  });
  if (row?.apiKey) return row.apiKey;

  // Legacy fallback (pre-multi-key rows)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiApiKey: true, geminiApiKey: true, aiProvider: true },
  });
  if (!tenant) return null;
  if ((tenant.aiProvider || 'gemini') === provider) return tenant.aiApiKey;
  if (provider === 'gemini') return tenant.geminiApiKey || tenant.aiApiKey;
  return null;
}

/** Decrypted key for a provider, or null. */
export async function getProviderKey(tenantId: string, provider: string): Promise<string | null> {
  const raw = await getProviderKeyRaw(tenantId, provider);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch {
    return null;
  }
}

/** Save (upsert) an encrypted key for a provider. Keeps legacy tenant fields in sync. */
export async function setProviderKey(
  tenantId: string,
  provider: string,
  rawApiKey: string
): Promise<void> {
  const encrypted = encrypt(rawApiKey);
  await prisma.aiProviderKey.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: { tenantId, provider, apiKey: encrypted },
    update: { apiKey: encrypted },
  });

  // Keep legacy single-key fields in sync for the ACTIVE provider path.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true },
  });
  if ((tenant?.aiProvider || 'gemini') === provider) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        aiApiKey: encrypted,
        ...(provider === 'gemini' ? { geminiApiKey: encrypted } : {}),
      },
    });
  }
  if (provider === 'gemini') {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { geminiApiKey: encrypted },
    });
  }
}

/** Delete a provider key (both new table and legacy field if it matches). */
export async function deleteProviderKey(tenantId: string, provider: string): Promise<void> {
  await prisma.aiProviderKey.deleteMany({ where: { tenantId, provider } });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiApiKey: true, geminiApiKey: true },
  });
  if (!tenant) return;
  const data: Record<string, null> = {};
  if ((tenant.aiProvider || 'gemini') === provider && tenant.aiApiKey) data.aiApiKey = null;
  if (provider === 'gemini' && tenant.geminiApiKey) data.geminiApiKey = null;
  if (Object.keys(data).length > 0) {
    await prisma.tenant.update({ where: { id: tenantId }, data });
  }
}

/** List providers with key presence (masked, never raw). */
export async function listProviderKeys(tenantId: string): Promise<ProviderKeyInfo[]> {
  const rows = await prisma.aiProviderKey.findMany({
    where: { tenantId },
    select: { provider: true, apiKey: true, updatedAt: true },
  });
  const seen = new Set(rows.map((r) => r.provider));
  const out: ProviderKeyInfo[] = rows.map((r) => ({
    provider: r.provider,
    hasKey: true,
    maskedKey: maskKey(r.apiKey),
    updatedAt: r.updatedAt,
  }));

  // Legacy rows not yet migrated to the new table still count.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiApiKey: true, geminiApiKey: true, aiProvider: true },
  });
  if (tenant) {
    const legacyProvider = tenant.aiProvider || 'gemini';
    if (tenant.aiApiKey && !seen.has(legacyProvider) && isEncrypted(tenant.aiApiKey)) {
      out.push({ provider: legacyProvider, hasKey: true, maskedKey: maskKey(tenant.aiApiKey), updatedAt: null });
    }
    if (tenant.geminiApiKey && !seen.has('gemini') && isEncrypted(tenant.geminiApiKey)) {
      out.push({ provider: 'gemini', hasKey: true, maskedKey: maskKey(tenant.geminiApiKey), updatedAt: null });
    }
  }
  return out;
}
