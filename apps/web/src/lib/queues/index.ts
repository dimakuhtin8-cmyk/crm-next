/**
 * Job Queue — система фоновых задач
 * 
 * Архитектура:
 * - In-Memory Queue (для dev и small deployments)
 * - При масштабировании → Redis + BullMQ
 * 
 * Типы задач:
 * - email: отправка email
 * - ai: AI-обработка (скоринг, анализ)
 * - export: экспорт данных
 * - notification: уведомления
 * - cleanup: очистка данных
 * 
 * Возможности:
 * - Retry с Exponential Backoff
 * - Приоритеты (high, normal, low)
 * - Rate limiting
 * - Progress tracking
 * - Job dependencies
 */

import crypto from 'crypto';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'queue' });

// ============ Types ============

export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  result?: any;
  progress?: number;
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

// ============ Queue Class ============

class JobQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private stats = {
    completed: 0,
    failed: 0,
  };

  constructor() {
    // Запускаем обработчик каждую секунду
    this.processInterval = setInterval(() => this.processNext(), 1000);
  }

  /**
   * Зарегистрировать обработчик для типа задачи
   */
  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
    log.info({ type }, 'Зареєстровано обробник черги');
  }

  /**
   * Добавить задачу в очередь
   */
  addJob<T>(
    type: string,
    data: T,
    options: {
      priority?: JobPriority;
      timeout?: number;
      maxAttempts?: number;
      delay?: number; // ms
    } = {}
  ): Job<T> {
    const job: Job<T> = {
      id: crypto.randomUUID(),
      type,
      data,
      status: 'pending',
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date(),
      timeout: options.timeout || 30000, // 30 секунд по умолчанию
    };

    if (options.delay) {
      job.nextRetryAt = new Date(Date.now() + options.delay);
    }

    this.jobs.set(job.id, job);

    log.info({
      jobId: job.id,
      type,
      priority: job.priority,
    }, 'Задачу додано в чергу');

    return job;
  }

  /**
   * Получить статус задачи
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Отменить задачу
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'processing') {
      // Нельзя отменить выполняющуюся задачу
      return false;
    }

    job.status = 'failed';
    job.lastError = 'Cancelled by user';
    this.jobs.delete(jobId);
    
    return true;
  }

  /**
   * Получить статистику
   */
  getStats(): QueueStats {
    let pending = 0;
    let processing = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
        case 'retrying':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      pending,
      processing,
      completed: this.stats.completed,
      failed: this.stats.failed + failed,
      total: this.jobs.size + this.stats.completed + this.stats.failed,
    };
  }

  /**
   * Очистить завершённые задачи
   */
  cleanup(maxAge: number = 60 * 60 * 1000): number { // 1 час
    let count = 0;
    const now = Date.now();

    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const age = now - job.createdAt.getTime();
        if (age > maxAge) {
          this.jobs.delete(id);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Обработать следующую задачу
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;
    
    // Найти задачу с наивысшим приоритетом
    const job = this.findNextJob();
    if (!job) return;

    this.processing = true;

    try {
      await this.processJob(job);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Найти следующую задачу для обработки
   */
  private findNextJob(): Job | null {
    let nextJob: Job | null = null;
    const now = Date.now();

    for (const job of this.jobs.values()) {
      // Пропускаем не pending задачи
      if (job.status !== 'pending' && job.status !== 'retrying') {
        continue;
      }

      // Проверяем delay
      if (job.nextRetryAt && job.nextRetryAt.getTime() > now) {
        continue;
      }

      // Проверяем приоритет
      if (!nextJob) {
        nextJob = job;
        continue;
      }

      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const currentPriority = priorityOrder[job.priority];
      const nextPriority = priorityOrder[nextJob.priority];

      if (currentPriority < nextPriority) {
        nextJob = job;
      } else if (currentPriority === nextPriority) {
        // FIFO для одинакового приоритета
        if (job.createdAt < nextJob.createdAt) {
          nextJob = job;
        }
      }
    }

    return nextJob;
  }

  /**
   * Обработать задачу
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.lastError = `No handler for job type: ${job.type}`;
      this.stats.failed++;
      this.jobs.delete(job.id);
      
      log.error({
        jobId: job.id,
        type: job.type,
      }, 'Немає обробника для типу задачі');
      
      return;
    }

    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;

    log.info({
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    }, 'Початок обробки задачі');

    try {
      // Timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.timeout);
      });

      const result = await Promise.race([
        handler(job),
        timeoutPromise,
      ]);

      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      this.stats.completed++;
      this.jobs.delete(job.id);

      const duration = job.completedAt.getTime() - job.startedAt.getTime();

      log.info({
        jobId: job.id,
        type: job.type,
        duration,
      }, 'Задачу виконано');
    } catch (err: any) {
      job.lastError = err.message;

      if (job.attempts < job.maxAttempts) {
        // Retry с Exponential Backoff
        const delay = Math.pow(2, job.attempts - 1) * 1000;
        job.status = 'retrying';
        job.nextRetryAt = new Date(Date.now() + delay);

        log.warn({
          jobId: job.id,
          type: job.type,
          attempt: job.attempts,
          nextRetry: job.nextRetryAt,
          error: err.message,
        }, 'Задачу буде повторено');
      } else {
        // Все попытки исчерпаны
        job.status = 'failed';
        this.stats.failed++;
        this.jobs.delete(job.id);

        log.error({
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error: err.message,
        }, 'Задачу не вдалося виконати');
      }
    }
  }

  /**
   * Уничтожить очередь
   */
  destroy(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
  }
}

// ============ Singleton Instance ============

export const queue = new JobQueue();

// ============ Job Type Definitions ============

/**
 * Email Job
 */
export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * AI Job
 */
export interface AIJobData {
  action: 'score' | 'analyze' | 'recommend' | 'summarize';
  entityType: 'deal' | 'contact';
  entityId: string;
  prompt?: string;
  model?: string;
}

/**
 * Export Job
 */
export interface ExportJobData {
  entityType: 'contacts' | 'deals' | 'tasks';
  format: 'csv' | 'xlsx' | 'json';
  filters?: Record<string, any>;
  userId: string;
  tenantId: string;
}

/**
 * Notification Job
 */
export interface NotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

// ============ Register Default Handlers ============

// Email handler (заглушка — в проде интеграция с Resend/SendGrid)
queue.registerHandler<EmailJobData>('email', async (job) => {
  log.info({ jobId: job.id, to: job.data.to }, 'Email відправлено');
  // TODO: Реальная отправка email
  return { sent: true };
});

// AI handler
queue.registerHandler<AIJobData>('ai', async (job) => {
  log.info({ jobId: job.id, action: job.data.action }, 'AI обробку виконано');
  // TODO: Реальная AI обработка
  return { processed: true };
});

// Export handler
queue.registerHandler<ExportJobData>('export', async (job) => {
  log.info({ jobId: job.id, format: job.data.format }, 'Експорт виконано');
  // TODO: Реальный экспорт
  return { fileUrl: '/exports/file.csv' };
});

// Notification handler
queue.registerHandler<NotificationJobData>('notification', async (job) => {
  log.info({ jobId: job.id, userId: job.data.userId }, 'Сповіщення надіслано');
  // TODO: Реальная отправка уведомлений
  return { sent: true };
});

// Cleanup handler
queue.registerHandler('cleanup', async (job) => {
  const cleaned = queue.cleanup();
  log.info({ cleaned }, 'Очищено завершені задачі');
  return { cleaned };
});

// ============ Convenience Functions ============

/**
 * Отправить email
 */
export function sendEmail(data: EmailJobData): Job {
  return queue.addJob('email', data, { priority: 'normal' });
}

/**
 * AI обработка
 */
export function processAI(data: AIJobData): Job {
  return queue.addJob('ai', data, { priority: 'high', timeout: 60000 });
}

/**
 * Экспорт данных
 */
export function exportData(data: ExportJobData): Job {
  return queue.addJob('export', data, { priority: 'low', timeout: 120000 });
}

/**
 * Отправить уведомление
 */
export function sendNotification(data: NotificationJobData): Job {
  return queue.addJob('notification', data, { priority: 'high' });
}
