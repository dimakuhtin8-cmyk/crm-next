import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockPrisma = {
  tenant: { findUnique: vi.fn() },
  aiUsageCounter: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  aiUsageLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@crm-next/database', () => ({
  prisma: mockPrisma,
}));

// Mock cache
const cacheStore = new Map<string, unknown>();
vi.mock('@/lib/cache', () => ({
  cache: {
    get: vi.fn((key: string) => cacheStore.get(key) ?? null),
    set: vi.fn((key: string, value: unknown) => cacheStore.set(key, value)),
    delete: vi.fn((key: string) => cacheStore.delete(key)),
  },
}));

// Импортируем ПОСЛЕ моков
const { checkUsageLimit, incrementUsage } = await import('@/lib/ai/usage');

describe('AI Usage - checkUsageLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
  });

  it('should allow when under limit', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: 100 });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ requests: 50 });

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.allowed).toBe(true);
    expect(status.current).toBe(50);
    expect(status.limit).toBe(100);
    expect(status.percentage).toBe(50);
    expect(status.isWarning).toBe(false);
    expect(status.isExceeded).toBe(false);
  });

  it('should block when at limit', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: 100 });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ requests: 100 });

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.allowed).toBe(false);
    expect(status.isExceeded).toBe(true);
    expect(status.percentage).toBe(100);
  });

  it('should block when over limit', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: 100 });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ requests: 150 });

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.allowed).toBe(false);
    expect(status.isExceeded).toBe(true);
    expect(status.percentage).toBe(150); // 150/100 * 100
  });

  it('should warn at 90%', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: 100 });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ requests: 90 });

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.isWarning).toBe(true);
    expect(status.allowed).toBe(true);
    expect(status.percentage).toBe(90);
  });

  it('should use default limit of 1500 when tenant has no custom limit', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: null });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ requests: 0 });

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.limit).toBe(1500);
  });

  it('should handle zero counter (no usage today)', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ aiDailyLimit: 1500 });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue(null);

    const status = await checkUsageLimit('tenant-1', 'gemini');

    expect(status.current).toBe(0);
    expect(status.allowed).toBe(true);
    expect(status.percentage).toBe(0);
  });
});

describe('AI Usage - incrementUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
  });

  it('should upsert counter with increment', async () => {
    mockPrisma.aiUsageCounter.upsert.mockResolvedValue({});

    await incrementUsage('tenant-1', 'gemini', 100, 50);

    expect(mockPrisma.aiUsageCounter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_provider_date: expect.objectContaining({
            tenantId: 'tenant-1',
            provider: 'gemini',
          }),
        }),
        create: expect.objectContaining({ requests: 1, tokensIn: 100, tokensOut: 50 }),
        update: expect.objectContaining({
          requests: { increment: 1 },
          tokensIn: { increment: 100 },
          tokensOut: { increment: 50 },
        }),
      })
    );
  });

  it('should handle zero tokens', async () => {
    mockPrisma.aiUsageCounter.upsert.mockResolvedValue({});

    await incrementUsage('tenant-1', 'openai');

    expect(mockPrisma.aiUsageCounter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ requests: 1, tokensIn: 0, tokensOut: 0 }),
      })
    );
  });
});
