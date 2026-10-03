/**
 * Спільні типи omnichannel-шару чатів (Повідомлення).
 * Кожен канал нормалізує свій payload до цього формату.
 */

/** Канали чату — відповідає enum `ChatChannel` у schema.prisma */
export type ChannelKind = 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | 'SMS';

/** Нормалізований вхідне повідомлення — канал-агностичний payload */
export interface InboundChannelMessage {
  /** ID чату в зовнішній системі (telegram chat id, WhatsApp wa_id тощо) */
  externalChatId: string;
  /** ID повідомлення в зовнішній системі — для дедуплікації ретраїв вебхуків */
  externalMessageId: string;
  /** Текст повідомлення */
  content: string;
  /** Ім'я з профілю провайдера */
  firstName?: string;
  /** Прізвище (Telegram) */
  lastName?: string;
  /** Повне ім'я / profile name провайдера */
  displayName?: string;
  /** Telegram @username */
  username?: string;
  /** Телефон E.164 (WhatsApp wa_id); Telegram не надає phone в оновленнях */
  phone?: string;
}

/** Результат відправки повідомлення в канал */
export interface ChannelSendResult {
  ok: boolean;
  /** ID повідомлення, повернутий провайдером (для статусів доставки) */
  externalMessageId?: string;
  /** Причина помилки, якщо ok=false */
  error?: string;
}
