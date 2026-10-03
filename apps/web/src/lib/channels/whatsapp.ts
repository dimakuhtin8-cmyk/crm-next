/**
 * WhatsApp channel adapter — нормалізація вхідних webhook-payload'ів та відправка.
 * Уся WhatsApp-специфічна логіка ізольована тут (правило модульної ізоляції).
 */

import type { ChannelSendResult, InboundChannelMessage } from './types';
import type { WhatsAppMessage } from '@/lib/whatsapp/client';

import { sendTextMessage } from '@/lib/whatsapp/client';

/** Формат відповіді Graph API messages (360dialog) */
interface WhatsAppSendResponse {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number };
}

/**
 * Витягує текст із вхідного WhatsApp-повідомлення та нормалізує його.
 * Підтримує text, interactive (відповіді кнопок) та caption медіа-повідомлень.
 * Повертає null, якщо контенту немає.
 */
export function normalizeWhatsAppMessage(
  msg: WhatsAppMessage,
  contacts?: Array<{ profile: { name: string }; wa_id: string }>,
): InboundChannelMessage | null {
  let content: string | null = null;

  if (msg.type === 'text') {
    content = msg.text?.body ?? null;
  } else if (msg.type === 'interactive') {
    content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null;
  } else if (msg.type === 'image') {
    content = msg.image?.caption ?? null;
  } else if (msg.type === 'document') {
    content = msg.document?.caption ?? null;
  }

  content = content?.trim() || null;
  if (!content) return null;

  const profileName = contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

  return {
    externalChatId: msg.from,
    externalMessageId: msg.id,
    content,
    firstName: profileName || undefined,
    displayName: profileName,
    phone: msg.from,
  };
}

/** Надсилає текстове повідомлення через WhatsApp Business API (360dialog) */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  content: string,
): Promise<ChannelSendResult> {
  try {
    const result = (await sendTextMessage(
      phoneNumberId,
      accessToken,
      to,
      content,
    )) as WhatsAppSendResponse;

    const externalMessageId = result?.messages?.[0]?.id;
    if (!externalMessageId) {
      return { ok: false, error: result?.error?.message || 'WhatsApp API error' };
    }

    return { ok: true, externalMessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'WhatsApp send failed' };
  }
}
