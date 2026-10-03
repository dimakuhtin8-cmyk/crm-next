/**
 * Omnichannel Chat (Повідомлення) — єдиний вхідний шар.
 *
 * - persistInboundMessage(): Contact upsert + Chat upsert + ChatMessage (dedup ретраїв)
 * - sendMessageToChannel(): маршрутизація відправки за chat.channel
 *
 * Канал-специфічна логіка ізольована в ./telegram та ./whatsapp.
 */

import { prisma } from '@crm-next/database';

import { sendTelegramMessage } from './telegram';
import { sendWhatsAppMessage } from './whatsapp';

import type { ChannelKind, ChannelSendResult, InboundChannelMessage } from './types';

import { encrypt } from '@/lib/encryption';

export type { ChannelKind, ChannelSendResult, InboundChannelMessage } from './types';
export { normalizeTelegramMessage, sendTelegramMessage } from './telegram';
export { normalizeWhatsAppMessage, sendWhatsAppMessage } from './whatsapp';

/**
 * Зберігає вхідне повідомлення в Chat/ChatMessage, upsert'ить Contact і Chat.
 *
 * - Contact: phone-match (WhatsApp wa_id) → створення за відсутності.
 *   Для Telegram phone в оновленнях немає — контакт створюється один раз на чат.
 * - Chat: upsert за (tenantId, channel, externalChatId), lastMessageAt оновлюється.
 * - ChatMessage: вставка з дедуплікацією за (chatId, externalMessageId) —
 *   ретрай вебхука від провайдера не створює дублікат.
 * - unreadCount: інкремент лише для реально створених повідомлень.
 *
 * Повертає id чату та прив'язаний contactId.
 */
export async function persistInboundMessage(
  tenantId: string,
  channel: ChannelKind,
  msg: InboundChannelMessage,
): Promise<{ chatId: string; contactId: string | null }> {
  // 1. Наявний Chat — може вже мати прив'язаний Contact
  const existing = await prisma.chat.findUnique({
    where: {
      tenantId_channel_externalChatId: { tenantId, channel, externalChatId: msg.externalChatId },
    },
    select: { id: true, contactId: true },
  });

  // 2. Contact: прив'язаний → phone-match (plaintext; шифровані значення
  //    неможливо зіставити за рівністю — див. ENCRYPTED_FIELDS/open risk у encryption.ts)
  //    → створення
  let contactId = existing?.contactId ?? null;

  if (!contactId && msg.phone) {
    const byPhone = await prisma.contact.findFirst({
      where: { tenantId, phone: msg.phone },
      select: { id: true },
    });
    contactId = byPhone?.id ?? null;
  }

  if (!contactId) {
    const created = await prisma.contact.create({
      data: {
        tenantId,
        firstName: msg.firstName || msg.displayName || msg.phone || 'Контакт',
        lastName: msg.lastName,
        // contact.phone — зашифроване поле (ENCRYPTED_FIELDS), як у POST /api/contacts
        phone: msg.phone ? encrypt(msg.phone) : null,
        source: channel === 'EMAIL' ? 'email' : channel.toLowerCase(),
      },
      select: { id: true },
    });
    contactId = created.id;
  }

  // 3. Upsert Chat (unreadCount піднімаємо нижче — тільки якщо повідомлення нове)
  const chat = await prisma.chat.upsert({
    where: {
      tenantId_channel_externalChatId: { tenantId, channel, externalChatId: msg.externalChatId },
    },
    create: {
      tenantId,
      channel,
      externalChatId: msg.externalChatId,
      contactId,
      unreadCount: 0,
    },
    update: {
      ...(contactId ? { contactId } : {}),
      lastMessageAt: new Date(),
    },
    select: { id: true },
  });

  // 4. Message з дедуплікацією (уникальний індекс chatId+externalMessageId)
  let created = false;
  try {
    await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderType: 'CUSTOMER',
        content: msg.content,
        externalMessageId: msg.externalMessageId,
        status: 'DELIVERED',
      },
    });
    created = true;
  } catch (err) {
    // P2002 — ретрай вебхука від провайдера, ігноруємо
    if ((err as { code?: string }).code !== 'P2002') throw err;
  }

  if (created) {
    await prisma.chat.update({
      where: { id: chat.id },
      data: { unreadCount: { increment: 1 } },
    });
  }

  return { chatId: chat.id, contactId };
}

/**
 * Єдина точка відправки повідомлення менеджера в канал.
 * Маршрутизує за chat.channel, завантажуючи токени з Tenant.
 *
 * Зберігання ChatMessage (senderType: USER) — відповідальність викликачів (REST API).
 */
export async function sendMessageToChannel(
  chatId: string,
  content: string,
): Promise<ChannelSendResult> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { tenant: true },
  });

  if (!chat) return { ok: false, error: 'Чат не знайдено' };

  switch (chat.channel) {
    case 'TELEGRAM': {
      if (!chat.tenant.telegramBotToken) {
        return { ok: false, error: 'Telegram-бот не підключено' };
      }
      return sendTelegramMessage(chat.tenant.telegramBotToken, chat.externalChatId, content);
    }
    case 'WHATSAPP': {
      if (!chat.tenant.whatsappApiKey || !chat.tenant.whatsappPhoneNumberId) {
        return { ok: false, error: 'WhatsApp не підключено' };
      }
      return sendWhatsAppMessage(
        chat.tenant.whatsappPhoneNumberId,
        chat.tenant.whatsappApiKey,
        chat.externalChatId,
        content,
      );
    }
    default:
      return { ok: false, error: `Канал ${chat.channel} ще не підтримується` };
  }
}
