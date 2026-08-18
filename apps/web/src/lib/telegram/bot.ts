const TELEGRAM_API = 'https://api.telegram.org';

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Bot API wrapper
export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: Record<string, unknown>;
  },
) {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    text,
    ...(options?.parse_mode && { parse_mode: options.parse_mode }),
    ...(options?.reply_markup && { reply_markup: options.reply_markup }),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  return res.json();
}

export async function sendDocument(
  token: string,
  chatId: number,
  document: string, // URL or file_id
  caption?: string,
) {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    document,
    ...(caption && { caption }),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  return res.json();
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...(text && { text }),
    }),
  });

  return res.json();
}

export async function editMessageText(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: Record<string, unknown>;
  },
) {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(options?.parse_mode && { parse_mode: options.parse_mode }),
    ...(options?.reply_markup && { reply_markup: options.reply_markup }),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  return res.json();
}

export async function setWebhook(token: string, url: string, secret: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }),
  });

  return res.json();
}

export async function deleteWebhook(token: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  return res.json();
}

export async function getBotInfo(token: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
  return res.json();
}

// Notification helpers
export function taskNotificationText(task: { title: string; type: string; priority: string; dueDate: string | null }, event: 'created' | 'assigned' | 'due_soon' | 'overdue' | 'status_changed') {
  const typeIcons: Record<string, string> = { task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄' };
  const priorityLabels: Record<string, string> = { urgent: '🔴 Терміново', high: '🟠 Високий', medium: '🟡 Середній', low: '🟢 Низький' };
  const icon = typeIcons[task.type] || '📋';
  const priority = priorityLabels[task.priority] || task.priority;

  let header: string;
  switch (event) {
    case 'created': header = `${icon} Нова задача створена`; break;
    case 'assigned': header = `${icon} Вам призначено задачу`; break;
    case 'due_soon': header = `${icon} Задача наближається до дедлайну`; break;
    case 'overdue': header = `${icon} ⚠️ Задача протермінована!`; break;
    case 'status_changed': header = `${icon} Статус задачі змінено`; break;
    default: header = `${icon} Оновлення задачі`;
  }

  let text = `<b>${header}</b>\n\n<b>${task.title}</b>\nПриоритет: ${priority}`;
  if (task.dueDate) {
    text += `\nДедлайн: ${new Date(task.dueDate).toLocaleString('uk')}`;
  }
  return text;
}

export function dealNotificationText(deal: { title: string; value: number; currency: string }, event: 'created' | 'stage_changed' | 'won' | 'lost') {
  let header: string;
  switch (event) {
    case 'created': header = '💼 Нова угода створена'; break;
    case 'stage_changed': header = '🔄 Етап угоди змінено'; break;
    case 'won': header = '🎉 Угода виграна!'; break;
    case 'lost': header = '❌ Угода втрачена'; break;
    default: header = '💼 Оновлення угоди';
  }

  const text = `<b>${header}</b>\n\n<b>${deal.title}</b>\nСума: ${deal.value.toLocaleString('uk')} ${deal.currency}`;
  return text;
}
