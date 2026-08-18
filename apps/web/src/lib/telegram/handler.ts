import { sendMessage, answerCallbackQuery, editMessageText } from './bot';

import type { TelegramMessage, TelegramCallbackQuery } from './bot';

import { getTenantQuery } from '@/lib/tenant-query';

export async function handleTelegramUpdate(tenantId: string, update: { message?: TelegramMessage; callback_query?: TelegramCallbackQuery }) {
  if (update.callback_query) {
    return handleCallbackQuery(tenantId, update.callback_query);
  }
  if (update.message) {
    return handleMessage(tenantId, update.message);
  }
}

async function handleMessage(tenantId: string, msg: TelegramMessage) {
  const text = msg.text || '';
  const tgUser = msg.from;
  const chatId = msg.chat.id;

  if (!tgUser) return;

  const { prisma } = await import('@crm-next/database');
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.telegramBotToken) return;

  // Upsert TelegramChat
  const chat = await prisma.telegramChat.upsert({
    where: { tenantId_telegramId: { tenantId, telegramId: tgUser.id } },
    create: {
      tenantId,
      telegramId: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
    },
    update: {
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
      lastMessageAt: new Date(),
    },
  });

  // Handle commands
  if (text.startsWith('/')) {
    return handleCommand(tenantId, tenant.telegramBotToken, chatId, chat, text);
  }

  // Plain text → create activity on linked contact
  if (chat.contactId) {
    await prisma.activity.create({
      data: {
        tenantId,
        contactId: chat.contactId,
        type: 'sms',
        title: `Повідомлення від ${tgUser.first_name}`,
        body: text,
      },
    });
  }

  await sendMessage(tenant.telegramBotToken, chatId,
    `✅ Повідомлення отримано${chat.contactId ? '' : '\n\nЩоб прив\'язати контакт, надішліть /start'}`,
  );
}

async function handleCommand(
  tenantId: string,
  token: string,
  chatId: number,
  chat: { contactId: string | null },
  text: string,
) {
  const cmd = text.split(' ')[0].toLowerCase();
  const { prisma } = await import('@crm-next/database');

  switch (cmd) {
    case '/start':
      return handleStart(token, chatId, chat);
    case '/help':
      return handleHelp(token, chatId);
    case '/deals':
      return handleDeals(token, chatId, tenantId, prisma);
    case '/tasks':
      return handleTasks(token, chatId, tenantId, prisma);
    case '/status':
      return handleStatus(token, chatId, tenantId, prisma);
    default:
      await sendMessage(token, chatId, '❓ Невідома команда. Надішліть /help для списку команд.');
  }
}

async function handleStart(token: string, chatId: number, chat: { contactId: string | null }) {
  const text = `👋 <b>Вітаю у CRM-бот!</b>

Я допоможу вам керувати задачами та угодами просто з Telegram.

<b>Команди:</b>
/deals — список угод
/tasks — мої задачі
/status — статус бота
/help — допомога

${chat.contactId ? '✅ Ваш акаунт прив\'язано до контакті' : '💡 Щоб прив\'язати акаунт, надішліть свій email або телефон'}`;

  await sendMessage(token, chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💼 Мої угоди', callback_data: 'deals' }, { text: '📋 Мої задачі', callback_data: 'tasks' }],
        [{ text: '❓ Допомога', callback_data: 'help' }],
      ],
    },
  });
}

async function handleHelp(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `📖 <b>Довідка</b>

<b>Команди:</b>
/start — головне меню
/help — ця довідка
/deals — список активних угод
/tasks — мої задачі на сьогодні
/status — статус підключення

<b>Inline кнопки:</b>
Використовуйте кнопки під повідомленнями для швидких дій.

<b>Повідомлення:</b>
Надішліть текстове повідомлення, і воно збереться як активність прив\'язаного контакту.`,
    { parse_mode: 'HTML' },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDeals(token: string, chatId: number, tenantId: string, prisma: any) {
  const deals = await prisma.deal.findMany({
    where: { tenantId, status: 'open' },
    include: { stage: true },
    orderBy: { createdAt: 'desc' },
  });

  if (deals.length === 0) {
    await sendMessage(token, chatId, '💼 Немає активних угод.', {
      reply_markup: {
        inline_keyboard: [[{ text: '➕ Створити угоду', callback_data: 'new_deal' }]],
      },
    });
    return;
  }

  let text = `💼 <b>Активні угоди (${deals.length})</b>\n\n`;
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  deals.slice(0, 5).forEach((deal: { id: string; title: string; value: number | null; currency: string; stage?: { name: string } | null }, i: number) => {
    text += `${i + 1}. <b>${deal.title}</b>\n   Сума: ${(deal.value || 0).toLocaleString('uk')} ${deal.currency}\n   Етап: ${deal.stage?.name || '—'}\n\n`;
    keyboard.push([{ text: `${deal.title}`, callback_data: `deal:${deal.id}` }]);
  });

  keyboard.push([{ text: '🔄 Оновити', callback_data: 'deals' }]);

  await sendMessage(token, chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTasks(token: string, chatId: number, tenantId: string, prisma: any) {
  const tasks = await prisma.task.findMany({
    where: { tenantId, status: { notIn: ['done', 'cancelled'] } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  });

  if (tasks.length === 0) {
    await sendMessage(token, chatId, '📋 Немає активних задач.', {
      reply_markup: {
        inline_keyboard: [[{ text: '➕ Створити задачу', callback_data: 'new_task' }]],
      },
    });
    return;
  }

  const typeIcons: Record<string, string> = { task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄' };
  const priorityEmoji: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  let text = `📋 <b>Мої задачі (${tasks.length})</b>\n\n`;
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  tasks.slice(0, 5).forEach((task: { id: string; title: string; type: string; priority: string; dueDate: Date | null }, i: number) => {
    const icon = typeIcons[task.type] || '📋';
    const p = priorityEmoji[task.priority] || '🟡';
    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk') : '';
    text += `${i + 1}. ${icon} ${p} <b>${task.title}</b>`;
    if (due) text += ` (${due})`;
    text += '\n';
    keyboard.push([{ text: `✅ ${task.title}`, callback_data: `task_done:${task.id}` }]);
  });

  keyboard.push([{ text: '🔄 Оновити', callback_data: 'tasks' }]);

  await sendMessage(token, chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStatus(token: string, chatId: number, tenantId: string, prisma: any) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramBotUsername: true },
  });

  const [tasks, deals, contacts] = await Promise.all([
    prisma.task.count({ where: { tenantId, status: { notIn: ['done', 'cancelled'] } } }),
    prisma.deal.count({ where: { tenantId, status: 'open' } }),
    prisma.contact.count({ where: { tenantId } }),
  ]);

  await sendMessage(token, chatId,
    `📊 <b>Статус CRM-бота</b>

Бот: @${tenant?.telegramBotUsername || 'невідомо'}
Статус: ✅ Активний

📊 <b>Статистика:</b>
📋 Задачі: ${tasks}
💼 Угоди: ${deals}
👤 Контакти: ${contacts}`,
    { parse_mode: 'HTML' },
  );
}

 
async function handleCallbackQuery(tenantId: string, query: TelegramCallbackQuery) {
  const { prisma } = await import('@crm-next/database');
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.telegramBotToken) return;

  const data = query.data || '';
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  await answerCallbackQuery(tenant.telegramBotToken, query.id);

  if (data === 'deals') {
    return handleDeals(tenant.telegramBotToken, chatId, tenantId, prisma);
  }
  if (data === 'tasks') {
    return handleTasks(tenant.telegramBotToken, chatId, tenantId, prisma);
  }
  if (data === 'help') {
    return handleHelp(tenant.telegramBotToken, chatId);
  }
  if (data === 'new_deal') {
    await editMessageText(tenant.telegramBotToken, chatId, query.message!.message_id,
      '💡 Створення угоди доступне в веб-додатку:\nhttps://crm-next.example.com/dashboard/deals/new',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'deals' }]] } },
    );
    return;
  }
  if (data === 'new_task') {
    await editMessageText(tenant.telegramBotToken, chatId, query.message!.message_id,
      '💡 Створення задачі доступне в веб-додатку:\nhttps://crm-next.example.com/dashboard/tasks/new',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'tasks' }]] } },
    );
    return;
  }

  if (data.startsWith('task_done:')) {
    const taskId = data.replace('task_done:', '');
    await prisma.task.update({ where: { id: taskId }, data: { status: 'done' } });
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    await editMessageText(tenant.telegramBotToken, chatId, query.message!.message_id,
      `✅ <b>${task?.title || 'Задачу'}</b> позначено як виконану!`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (data.startsWith('deal:')) {
    const dealId = data.replace('deal:', '');
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { stage: true },
    });

    if (!deal) return;

    const typedDeal = deal as { title: string; value: number | null; currency: string; status: string; stage?: { name: string } | null };
    let text = `💼 <b>${typedDeal.title}</b>\n\n`;
    text += `Сума: ${(typedDeal.value || 0).toLocaleString('uk')} ${typedDeal.currency}\n`;
    text += `Етап: ${typedDeal.stage?.name || '—'}\n`;
    text += `Статус: ${typedDeal.status}\n`;

    await editMessageText(tenant.telegramBotToken, chatId, query.message!.message_id, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'deals' }]],
      },
    });
  }
}
