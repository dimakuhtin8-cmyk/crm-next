/**
 * Webhook System — обработка входящих и исходящих вебхуков
 * 
 * Архитектура:
 * 1. Inbound Webhooks — входящие от внешних сервисов (Telegram, WhatsApp, Stripe)
 * 2. Outbound Webhooks — исходящие при событиях CRM (сделка закрыта, задача создана)
 * 3. Signature Verification — HMAC подпись для безопасности
 * 4. Retry with Exponential Backoff — повторные попытки
 * 
 * Безопасность:
 * - Проверка подписи HMAC-SHA256
 * - Верификация timestamp (防止 replay attacks)
 * - Rate limiting для входящих вебхуков
 */

import crypto from 'crypto';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'webhooks' });

// ============ Types ============

export interface WebhookPayload {
  id: string;
  event: string;
  data: any;
  timestamp: string;
  source: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  active: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;
  createdAt: Date;
  deliveredAt?: Date;
}

// ============ HMAC Signature ============

/**
 * Создать HMAC подпись для вебхука.
 * Формат покрывает и timestamp (как в verify): HMAC(`${timestamp}.${payload}`).
 */
export function createWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): { timestamp: number; signature: string } {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return { timestamp, signature };
}

/**
 * Проверить HMAC подпись вебхука
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds: number = 300 // 5 минут
): { valid: boolean; error?: string } {
  try {
    // Проверяем формат подписи
    const parts = signature.split(',');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid signature format' };
    }

    const [timestampPart, signatureRaw] = parts;
    const timestamp = parseInt(timestampPart.replace('t=', ''), 10);
    // Signature arrives as `s=<hex>` — strip the prefix before comparing,
    // otherwise lengths never match and verification always fails.
    
    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    // Проверяем timestamp (anti-replay)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return { valid: false, error: 'Timestamp expired' };
    }

    // Проверяем подпись
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const signaturePart = signatureRaw.replace(/^s=/, '');
    const isValid = (() => {
      const a = Buffer.from(signaturePart);
      const b = Buffer.from(expectedSignature);
      // timingSafeEqual throws on length mismatch — compare lengths first
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    })();

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * Создать заголовки для исходящего вебхука
 */
export function createWebhookHeaders(
  payload: string,
  secret: string,
  event: string
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Signature': `t=${timestamp},s=${signature}`,
    'X-Webhook-ID': crypto.randomUUID(),
    'X-Webhook-Timestamp': String(timestamp),
  };
}

// ============ Webhook Registry ============

interface WebhookRegistration {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  headers?: Record<string, string>;
}

// In-memory store (в проде — в БД)
const webhookStore = new Map<string, WebhookRegistration[]>();

/**
 * Зарегистрировать вебхук
 */
export function registerWebhook(webhook: Omit<WebhookRegistration, 'id' | 'createdAt'>): WebhookRegistration {
  const registration: WebhookRegistration = {
    ...webhook,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };

  const tenantWebhooks = webhookStore.get(webhook.tenantId) || [];
  tenantWebhooks.push(registration);
  webhookStore.set(webhook.tenantId, tenantWebhooks);

  log.info({
    webhookId: registration.id,
    tenantId: webhook.tenantId,
    events: webhook.events,
  }, 'Webhook зареєстровано');

  return registration;
}

/**
 * Удалить вебхук
 */
export function unregisterWebhook(tenantId: string, webhookId: string): boolean {
  const tenantWebhooks = webhookStore.get(tenantId) || [];
  const index = tenantWebhooks.findIndex(w => w.id === webhookId);
  
  if (index === -1) return false;
  
  tenantWebhooks.splice(index, 1);
  webhookStore.set(tenantId, tenantWebhooks);
  
  return true;
}

/**
 * Получить вебхуки тенанта
 */
export function getWebhooks(tenantId: string): WebhookRegistration[] {
  return webhookStore.get(tenantId) || [];
}

// ============ Outbound Webhooks ============

// Очередь доставки (в проде — Redis/BullMQ)
const deliveryQueue: WebhookDelivery[] = [];

/**
 * Отправить вебхук всем подписчикам события
 */
export async function dispatchWebhook(
  tenantId: string,
  event: string,
  data: any
): Promise<WebhookDelivery[]> {
  const webhooks = getWebhooks(tenantId).filter(
    w => w.active && w.events.includes(event)
  );

  if (webhooks.length === 0) {
    return [];
  }

  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    data,
    timestamp: new Date().toISOString(),
    source: 'crm-next',
  };

  const deliveries: WebhookDelivery[] = [];

  for (const webhook of webhooks) {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      event,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      createdAt: new Date(),
    };

    deliveryQueue.push(delivery);
    deliveries.push(delivery);

    // Запускаем доставку
    deliverWebhook(delivery, webhook).catch(err => {
      log.error({ err, deliveryId: delivery.id }, 'Помилка доставки вебхука');
    });
  }

  return deliveries;
}

/**
 * Доставить вебхук (с retry)
 */
async function deliverWebhook(
  delivery: WebhookDelivery,
  webhook: WebhookRegistration
): Promise<void> {
  const body = JSON.stringify(delivery.payload);
  const headers = createWebhookHeaders(body, webhook.secret, delivery.event);

  while (delivery.attempts < delivery.maxAttempts) {
    delivery.attempts++;
    delivery.status = 'retrying';

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          ...headers,
          ...webhook.headers,
        },
        body,
        signal: AbortSignal.timeout(10000), // 10 секунд таймаут
      });

      if (response.ok) {
        delivery.status = 'success';
        delivery.deliveredAt = new Date();
        
        log.info({
          deliveryId: delivery.id,
          webhookId: webhook.id,
          status: response.status,
          attempts: delivery.attempts,
        }, 'Вебхук доставлено');
        
        return;
      }

      // Серверная ошибка — retry
      if (response.status >= 500) {
        delivery.lastError = `HTTP ${response.status}`;
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.pow(2, delivery.attempts - 1) * 1000;
        delivery.nextRetryAt = new Date(Date.now() + delay);
        
        await sleep(delay);
        continue;
      }

      // Клиентская ошибка — не retry
      delivery.status = 'failed';
      delivery.lastError = `HTTP ${response.status} — client error, no retry`;
      
      log.warn({
        deliveryId: delivery.id,
        status: response.status,
      }, 'Вебхук відхилено (client error)');
      
      return;
    } catch (err: any) {
      delivery.lastError = err.message;
      
      // Таймаут или сеть — retry
      const delay = Math.pow(2, delivery.attempts - 1) * 1000;
      delivery.nextRetryAt = new Date(Date.now() + delay);
      
      await sleep(delay);
    }
  }

  // Все попытки исчерпаны
  delivery.status = 'failed';
  
  log.error({
    deliveryId: delivery.id,
    attempts: delivery.attempts,
    lastError: delivery.lastError,
  }, 'Вебхук не доставлено після всіх спроб');
}

// ============ Inbound Webhooks ============

/**
 * Обработать входящий вебхук
 */
export async function handleInboundWebhook(
  source: string,
  request: Request
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-webhook-signature') || '';
    const event = request.headers.get('x-webhook-event') || 'unknown';

    // Получаем секрет для источника
    const secret = getWebhookSecret(source);
    if (!secret) {
      return { success: false, error: `Unknown source: ${source}` };
    }

    // Проверяем подпись
    const { valid, error } = verifyWebhookSignature(body, signature, secret);
    if (!valid) {
      log.warn({ source, event, error }, 'Невірна підпис вебхука');
      return { success: false, error };
    }

    const payload = JSON.parse(body);

    // Логируем входящий вебхук
    log.info({
      source,
      event,
      payloadId: payload.id,
    }, 'Отримано вхідний вебхук');

    // Маршрутизируем по источнику
    await routeInboundWebhook(source, event, payload);

    return { success: true };
  } catch (err: any) {
    log.error({ err, source }, 'Помилка обробки вхідного вебхука');
    return { success: false, error: err.message };
  }
}

/**
 * Маршрутизация входящих вебхуков
 */
async function routeInboundWebhook(
  source: string,
  event: string,
  payload: any
): Promise<void> {
  switch (source) {
    case 'telegram':
      await handleTelegramWebhook(event, payload);
      break;
    case 'whatsapp':
      await handleWhatsAppWebhook(event, payload);
      break;
    case 'stripe':
      await handleStripeWebhook(event, payload);
      break;
    default:
      log.warn({ source }, 'Невідомий джерело вебхука');
  }
}

// ============ Source Handlers ============

async function handleTelegramWebhook(event: string, payload: any): Promise<void> {
  // Обработка Telegram обновлений
  log.info({ event }, 'Telegram webhook оброблено');
  // TODO: Интеграция с Telegram ботом
}

async function handleWhatsAppWebhook(event: string, payload: any): Promise<void> {
  // Обработка WhatsApp обновлений
  log.info({ event }, 'WhatsApp webhook оброблено');
  // TODO: Интеграция с WhatsApp Business API
}

async function handleStripeWebhook(event: string, payload: any): Promise<void> {
  // Обработка Stripe платежей
  log.info({ event }, 'Stripe webhook оброблено');
  // TODO: Обработка платежей
}

// ============ Helpers ============

function getWebhookSecret(source: string): string | null {
  const secrets: Record<string, string | undefined> = {
    telegram: process.env.TELEGRAM_WEBHOOK_SECRET,
    whatsapp: process.env.WHATSAPP_WEBHOOK_SECRET,
    stripe: process.env.STRIPE_WEBHOOK_SECRET,
  };
  return secrets[source] || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Webhook Events List ============

export const WEBHOOK_EVENTS = {
  // Контакты
  'contact.created': 'Новий контакт створено',
  'contact.updated': 'Контакт оновлено',
  'contact.deleted': 'Контакт видалено',
  
  // Сделки
  'deal.created': 'Нова угода створено',
  'deal.updated': 'Угоду оновлено',
  'deal.stage_changed': 'Угоду переміщено в іншу стадію',
  'deal.won': 'Угоду виграно',
  'deal.lost': 'Угоду програно',
  
  // Задачі
  'task.created': 'Нова задача створено',
  'task.completed': 'Задачу виконано',
  'task.overdue': 'Задача протермінована',
  
  // AI
  'ai.scored': 'AI проскорив угоду',
  'ai.recommendation': 'AI надав рекомендацію',
};
