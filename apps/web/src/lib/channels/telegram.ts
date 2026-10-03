/**
 * Telegram channel adapter — нормалізація вхідних оновлень та відправка.
 * Уся Telegram-специфічна логіка ізольована тут (правило модульної ізоляції).
 */

import type { ChannelSendResult, InboundChannelMessage } from './types';
import type { TelegramMessage } from '@/lib/telegram/bot';

import { sendMessage } from '@/lib/telegram/bot';

/** Формат відповіді Telegram Bot API sendMessage */
interface TelegramSendResponse {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
}

/**
 * Витягує текст із вхідного Telegram-повідомлення та нормалізує його.
 * Повертає null для не-текстових повідомлень (фото, стікери тощо).
 */
export function normalizeTelegramMessage(msg: TelegramMessage): InboundChannelMessage | null {
  const content = msg.text?.trim();
  if (!content) return null;

  const firstName = msg.from?.first_name;
  const lastName = msg.from?.last_name;
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

  return {
    externalChatId: String(msg.chat.id),
    externalMessageId: String(msg.message_id),
    content,
    firstName,
    lastName,
    displayName,
    username: msg.from?.username,
  };
}

/** Надсилає текстове повідомлення в Telegram-чат */
export async function sendTelegramMessage(
  botToken: string,
  externalChatId: string,
  content: string,
): Promise<ChannelSendResult> {
  try {
    const result = (await sendMessage(
      botToken,
      Number(externalChatId),
      content,
    )) as TelegramSendResponse;

    if (!result?.ok || result.result?.message_id == null) {
      return { ok: false, error: result?.description || 'Telegram API error' };
    }

    return { ok: true, externalMessageId: String(result.result.message_id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Telegram send failed' };
  }
}
