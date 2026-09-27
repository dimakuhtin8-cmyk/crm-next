/**
 * Job Queue — фоновая обработка поверх Postgres (Neon).
 *
 * Почему не in-memory: на Vercel serverless функция замораживается между
 * запросами — Map/setInterval не переживают заморозку. Задания живут в
 * таблице QueueJob, обрабатываются через POST /api/queue/process,
 * который дёргает внешний планировщик (см. DEPLOYMENT.md).
 *
 * Сохранённые концепции из прошлой in-memory реализации:
 * - приоритеты high/normal/low, FIFO при равном приоритете
 * - retry с exponential backoff (2^attempts * 1000мс)
 * - таймаут выполнения через Promise.race
 * - maxAttempts (по умолчанию 3)
 */

import { prisma } from '@crm-next/database';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'queue' });

// ============ Types ============

export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface Job<T = any> {
  id: string;
  tenantId: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
  timeout?: number; // ms
}

export interface JobHandler<T = any> {
  (job: Job<T>): Promise<any>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// ============ Job Type Definitions (payloads) ============

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface AIJobData {
  action: 'score' | 'analyze' | 'recommend' | 'summarize';
  entityType: 'deal' | 'contact';
  entityId: string;
  prompt?: string;
  model?: string;
}

export interface ExportJobData {
  entityType: 'contacts' | 'deals' | 'tasks';
  format: 'csv' | 'xlsx' | 'json';
  filters?: Record<string, any>;
  userId: string;
  tenantId: string;
}

export interface NotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

export interface SendMessageJobData {
  tenantId: string;
  text: string;
  chatId?: string | number;
}

// ============ Handler Registry (code-level, safe for serverless) ============

const handlers = new Map<string, JobHandler>();

export function registerHandler<T>(type: string, handler: JobHandler<T>): void {
  handlers.set(type, handler as JobHandler);
  log.info({ type }, 'Зареєстровано обробник черги');
}

// ============ DB mapping ============

function toJob(row: {
  id: string;
  tenantId: string;
  type: string;
  payload: string;
  status: string;
  priority: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  result: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): Job {
  let data: any = {};
  let result: any = undefined;
  try {
    data = JSON.parse(row.payload);
  } catch {}
  try {
    result = row.result ? JSON.parse(row.result) : undefined;
  } catch {}
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    data,
    status: row.status as JobStatus,
    priority: row.priority as JobPriority,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError || undefined,
    result,
    createdAt: row.createdAt,
    startedAt: row.startedAt || undefined,
    completedAt: row.completedAt || undefined,
    nextRetryAt: row.nextRetryAt || undefined,
  };
}

// ============ Enqueue ============

export async function enqueueJob<T>(
  tenantId: string,
  type: string,
  data: T,
  options: {
    priority?: JobPriority;
    timeout?: number;
    maxAttempts?: number;
    delayMs?: number;
  } = {}
): Promise<Job<T>> {
  const row = await prisma.queueJob.create({
    data: {
      tenantId,
      type,
      payload: JSON.stringify(data ?? {}),
      status: 'pending',
      priority: options.priority || 'normal',
      maxAttempts: options.maxAttempts || 3,
      nextRetryAt: options.delayMs ? new Date(Date.now() + options.delayMs) : null,
    },
  });

  log.info({ jobId: row.id, type, priority: row.priority }, 'Задачу додано в чергу');

  return { ...toJob(row), timeout: options.timeout || 30000 } as Job<T>;
}

// ============ Stats & Cleanup ============

export async function getQueueStats(tenantId?: string): Promise<QueueStats> {
  const where = tenantId ? { tenantId } : {};
  const [pending, processing, completed, failed, total] = await Promise.all([
    prisma.queueJob.count({ where: { ...where, status: 'pending' } }),
    prisma.queueJob.count({ where: { ...where, status: 'processing' } }),
    prisma.queueJob.count({ where: { ...where, status: 'completed' } }),
    prisma.queueJob.count({ where: { ...where, status: 'failed' } }),
    prisma.queueJob.count({ where }),
  ]);
  return { pending, processing, completed, failed, total };
}

export async function cleanupQueue(tenantId?: string, maxAgeMs: number = 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const res = await prisma.queueJob.deleteMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ['completed', 'failed'] },
      createdAt: { lt: cutoff },
    },
  });
  return res.count;
}

// ============ Claim & Process ============

const PRIORITY_ORDER: Record<JobPriority, number> = { high: 0, normal: 1, low: 2 };
const STUCK_PROCESSING_MS = 10 * 60 * 1000; // зависшие processing старше 10 мин — вернуть в pending

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ jobId: string; error: string }>;
}

/**
 * Reset stuck 'processing' jobs (crashed workers) back to pending.
 */
async function resetStuckJobs(tenantId?: string): Promise<number> {
  const res = await prisma.queueJob.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: 'processing',
      startedAt: { lt: new Date(Date.now() - STUCK_PROCESSING_MS) },
    },
    data: { status: 'pending', startedAt: null },
  });
  return res.count;
}

async function claimJob(tenantId: string | undefined, row: { id: string }): Promise<boolean> {
  // Conditional claim: only wins if still pending (lost races skip).
  const res = await prisma.queueJob.updateMany({
    where: { id: row.id, status: 'pending' },
    data: { status: 'processing', startedAt: new Date() },
  });
  return res.count === 1;
}

/**
 * Process up to `limit` pending jobs. Safe to call concurrently —
 * claims are conditional, losers skip.
 */
export async function processQueueJobs(
  options: { limit?: number; tenantId?: string; timeoutMs?: number } = {}
): Promise<ProcessResult> {
  const { limit = 10, tenantId, timeoutMs = 30000 } = options;
  const result: ProcessResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  await resetStuckJobs(tenantId);

  const now = new Date();
  const candidates = await prisma.queueJob.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: 'pending',
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: [{ createdAt: 'asc' }],
    take: Math.max(limit * 2, limit),
  });

  // Priority first, FIFO within priority (same as old findNextJob).
  candidates.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority as JobPriority] ?? 1) - (PRIORITY_ORDER[b.priority as JobPriority] ?? 1)
  );
  const batch = candidates.slice(0, limit);

  for (const row of batch) {
    if (!(await claimJob(tenantId, row))) continue;
    result.processed++;

    const job = toJob(row);
    const outcome = await runJob(job, timeoutMs);

    if (outcome.ok) {
      result.succeeded++;
    } else {
      result.failed++;
      result.errors.push({ jobId: job.id, error: outcome.error });
    }
  }

  return result;
}

async function runJob(job: Job, timeoutMs: number): Promise<{ ok: boolean; error: string }> {
  const handler = handlers.get(job.type);
  if (!handler) {
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: `No handler for job type: ${job.type}`, completedAt: new Date() },
    });
    log.error({ jobId: job.id, type: job.type }, 'Немає обробника для типу задачі');
    await notifyAdmins(job.tenantId, job, `No handler for job type: ${job.type}`);
    return { ok: false, error: `No handler for job type: ${job.type}` };
  }

  const attempts = job.attempts + 1;
  await prisma.queueJob.update({
    where: { id: job.id },
    data: { attempts },
  });

  log.info({ jobId: job.id, type: job.type, attempt: attempts }, 'Початок обробки задачі');

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), timeoutMs);
    });

    const handlerResult = await Promise.race([handler(job), timeoutPromise]);

    await prisma.queueJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        result: JSON.stringify(handlerResult ?? { ok: true }).slice(0, 500_000),
        completedAt: new Date(),
        lastError: null,
      },
    });

    log.info({ jobId: job.id, type: job.type }, 'Задачу виконано');
    return { ok: true, error: '' };
  } catch (err: any) {
    const message = err?.message || String(err);

    // Re-read maxAttempts (row may have changed) — use job's copy.
    if (attempts < job.maxAttempts) {
      // Retry с Exponential Backoff: 2^attempts * 1000мс
      const delay = Math.pow(2, attempts) * 1000;
      await prisma.queueJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          lastError: message,
          nextRetryAt: new Date(Date.now() + delay),
        },
      });
      log.warn({ jobId: job.id, type: job.type, attempt: attempts, error: message }, 'Задачу буде повторено');
      return { ok: false, error: message };
    }

    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: message, completedAt: new Date() },
    });
    log.error({ jobId: job.id, type: job.type, attempts, error: message }, 'Задачу не вдалося виконати');
    await notifyAdmins(job.tenantId, job, message);
    return { ok: false, error: message };
  }
}

/**
 * П6: уведомление админам тенанта о окончательно упавшей задаче.
 */
async function notifyAdmins(tenantId: string, job: Job, error: string): Promise<void> {
  try {
    const admins = await prisma.tenantMember.findMany({
      where: { tenantId, role: { in: ['owner', 'admin'] } },
      select: { userId: true },
    });
    if (admins.length === 0) return;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        tenantId,
        userId: a.userId,
        title: 'Інтеграція не працює',
        message: `Задача "${job.type}" провалилась після ${job.maxAttempts} спроб. Помилка: ${error.slice(0, 300)}`,
        type: 'error',
        link: '/dashboard/queues',
      })),
    });
  } catch (e) {
    log.error({ tenantId, jobId: job.id }, 'Не вдалося створити сповіщення адміну');
  }
}

// ============ Legacy-compatible singleton shape ============
// (v1/queue/stats + dashboard use these; now tenant-aware via optional arg)

export const queue = {
  getStats: (tenantId?: string) => getQueueStats(tenantId),
  cleanup: (tenantId?: string, maxAgeMs?: number) => cleanupQueue(tenantId, maxAgeMs),
  registerHandler,
};

// ============ Convenience Functions (async — DB write) ============

export async function sendEmail(data: EmailJobData & { tenantId: string }): Promise<Job> {
  return enqueueJob(data.tenantId, 'email', data, { priority: 'normal' });
}

export async function processAI(data: AIJobData & { tenantId: string }): Promise<Job> {
  return enqueueJob(data.tenantId, 'ai', data, { priority: 'high', timeout: 60000 });
}

export async function exportData(data: ExportJobData): Promise<Job> {
  return enqueueJob(data.tenantId, 'export', data, { priority: 'low', timeout: 120000 });
}

export async function sendNotification(data: NotificationJobData & { tenantId: string }): Promise<Job> {
  return enqueueJob(data.tenantId, 'notification', data, { priority: 'high' });
}
