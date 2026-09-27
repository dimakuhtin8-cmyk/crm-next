/**
 * DB-очередь + автоматизации — интеграционные тесты.
 * Мокается ТОЛЬКО исходящий HTTP (Resend/Telegram), внутренняя логика — нет.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');
const CRON = 'test-cron-secret-123';

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(SECRET);
}

function authed(url: string, token: string, init?: RequestInit): NextRequest {
  const headers: Record<string, string> = { cookie: `authjs.session-token=${token}` };
  if (init?.body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: init?.method || 'GET',
    headers,
    body: init?.body as BodyInit | null | undefined,
  });
}

function worker(url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': CRON },
    body: JSON.stringify(body || {}),
  });
}

import { POST as processPOST } from '@/app/api/queue/process/route';
import { POST as dealsPOST } from '@/app/api/deals/route';
import { POST as tickPOST } from '@/app/api/automation/tick/route';
import { enqueueJob } from '@/lib/queues';

const BASE = 'http://localhost:3000';
let tenantId = '';
let ownerId = '';
let tokenOwner = '';
let pipelineId = '';
let stageId = '';

process.env.CRON_SECRET = CRON;

beforeEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
});

beforeAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.queueJob.deleteMany();
  await prisma.automationLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({ data: { name: 'Queue', slug: 'queue-test', plan: 'professional' } });
  tenantId = t.id;
  const u = await prisma.user.create({ data: { email: 'queue-owner@test.com', name: 'Owner' } });
  ownerId = u.id;
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'owner' } });
  tokenOwner = await createToken({ id: u.id, tenantId });

  const p = await prisma.pipeline.create({ data: { tenantId, name: 'P' } });
  pipelineId = p.id;
  const s = await prisma.pipelineStage.create({ data: { pipelineId: p.id, name: 'S', order: 0 } });
  stageId = s.id;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.notification.deleteMany();
  await prisma.queueJob.deleteMany();
  await prisma.automationLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

async function pollFor(fn: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeoutMs) throw new Error('poll timeout');
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('П7.1: задача → process → completed, обработчик реально вызван', () => {
  it('notification-job выполняется и создаёт Notification', async () => {
    const job = await enqueueJob(tenantId, 'notification', {
      tenantId,
      userId: ownerId,
      title: 'Тест',
      message: 'Привіт',
      type: 'info' as const,
    });

    const r = await processPOST(worker(`${BASE}/api/queue/process`, { limit: 10 }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.succeeded).toBeGreaterThanOrEqual(1);

    const row = await prisma.queueJob.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe('completed');

    const notifs = await prisma.notification.findMany({ where: { tenantId, userId: ownerId, title: 'Тест' } });
    expect(notifs.length).toBe(1);
  });

  it('worker без секрета → 401, с неверным → 403', async () => {
    const noSecret = new NextRequest(new URL(`${BASE}/api/queue/process`), { method: 'POST' });
    expect((await processPOST(noSecret)).status).toBe(401);

    const bad = new NextRequest(new URL(`${BASE}/api/queue/process`), {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong' },
    });
    expect((await processPOST(bad)).status).toBe(403);
  });
});

describe('П7.2: три провала → failed + уведомление админу', () => {
  it('email без RESEND_API_KEY падает 3 раза → failed, attempts=3, есть уведомление', async () => {
    const job = await enqueueJob(
      tenantId,
      'email',
      { tenantId, to: 'a@b.c', subject: 't', html: '<p>t</p>' },
      { maxAttempts: 3 }
    );

    for (let i = 0; i < 3; i++) {
      // сбрасываем backoff-ожидание, чтобы не ждать 2с/4с/8с
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { nextRetryAt: null },
      });
      const r = await processPOST(worker(`${BASE}/api/queue/process`, { limit: 10 }));
      expect(r.status).toBe(200);
    }

    const row = await prisma.queueJob.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(3);
    expect(row?.lastError || '').toContain('RESEND_API_KEY');

    const notifs = await prisma.notification.findMany({
      where: { tenantId, userId: ownerId, type: 'error' },
    });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].message).toContain('email');
  });
});

describe('П7.3: создание сделки триггерит deal_created → QueueJob', () => {
  it('правило send_notification создаёт задачи в очереди', async () => {
    await prisma.automationRule.create({
      data: {
        tenantId,
        name: 'R1',
        triggerType: 'deal_created',
        actionType: 'send_notification',
        actionConfig: JSON.stringify({ channel: 'all', message: 'Новая сделка!' }),
        enabled: true,
      },
    });

    const r = await dealsPOST(
      authed(`${BASE}/api/deals?tenantId=${tenantId}`, tokenOwner, {
        method: 'POST',
        body: JSON.stringify({ title: 'Сделка-триггер', pipelineId, stageId }),
      })
    );
    expect(r.status).toBe(201);

    await pollFor(async () => {
      const n = await prisma.queueJob.count({ where: { tenantId, type: 'send_message' } });
      return n >= 1;
    });

    const notifJobs = await prisma.queueJob.count({ where: { tenantId, type: 'notification' } });
    expect(notifJobs).toBeGreaterThanOrEqual(1);
  });
});

describe('П7.4: tick срабатывает только для старой сделки', () => {
  it('timer-правило создаёт задачу старой сделке, свежую не трогает', async () => {
    await prisma.automationRule.deleteMany({ where: { tenantId } });
    await prisma.automationRule.create({
      data: {
        tenantId,
        name: 'Timer3',
        triggerType: 'timer',
        actionType: 'create_task',
        actionConfig: JSON.stringify({ inactivityDays: 3, title: 'Проверить сделку' }),
        enabled: true,
      },
    });

    const oldDeal = await prisma.deal.create({
      data: { tenantId, pipelineId, stageId, title: 'Старая сделка', status: 'open' },
    });
    await prisma.deal.update({
      where: { id: oldDeal.id },
      data: { updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    });
    const freshDeal = await prisma.deal.create({
      data: { tenantId, pipelineId, stageId, title: 'Свежая сделка', status: 'open' },
    });

    const r = await tickPOST(worker(`${BASE}/api/automation/tick`));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.triggered).toBeGreaterThanOrEqual(1);

    const oldTasks = await prisma.task.findMany({ where: { tenantId, dealId: oldDeal.id } });
    expect(oldTasks.length).toBeGreaterThanOrEqual(1);
    expect(oldTasks[0].title).toContain('Проверить сделку');

    const freshTasks = await prisma.task.findMany({ where: { tenantId, dealId: freshDeal.id } });
    expect(freshTasks.length).toBe(0);
  });

  it('tick без секрета → 401', async () => {
    const r = await tickPOST(
      new NextRequest(new URL(`${BASE}/api/automation/tick`), { method: 'POST' })
    );
    expect(r.status).toBe(401);
  });
});

describe('П7.5: email-хендлер с замоканным Resend', () => {
  it('успешный ответ Resend → completed с id', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ id: 'mail-1' }) }) as unknown as Response)
    );
    try {
      const job = await enqueueJob(tenantId, 'email', {
        tenantId,
        to: 'a@b.c',
        subject: 't',
        html: '<p>t</p>',
      });
      const r = await processPOST(worker(`${BASE}/api/queue/process`, { limit: 10 }));
      expect(r.status).toBe(200);
      const row = await prisma.queueJob.findUnique({ where: { id: job.id } });
      expect(row?.status).toBe('completed');
      expect(JSON.parse(row?.result || '{}').id).toBe('mail-1');
    } finally {
      delete process.env.RESEND_API_KEY;
    }
  });
});
