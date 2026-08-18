import { prisma } from '@crm-next/database';

import { sendTextMessage, markAsRead } from './client';

import type { WhatsAppWebhookBody, WhatsAppMessage } from './client';

export async function handleWhatsAppWebhook(body: WhatsAppWebhookBody) {
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const { metadata, contacts, messages, statuses } = change.value;
      const phoneNumberId = metadata.phone_number_id;

      // Find tenant by phone number ID
      const tenant = await prisma.tenant.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
      });
      if (!tenant) continue;

      // Handle incoming messages
      if (messages) {
        for (const msg of messages) {
          await handleIncomingMessage(tenant.id, tenant.whatsappApiKey || '', phoneNumberId, msg, contacts);
        }
      }

      // Handle status updates
      if (statuses) {
        for (const status of statuses) {
          await handleStatusUpdate(tenant.id, status);
        }
      }
    }
  }
}

async function handleIncomingMessage(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  msg: WhatsAppMessage,
  contacts?: Array<{ profile: { name: string }; wa_id: string }>,
) {
  const phoneNumber = msg.from;
  const contactProfile = contacts?.find((c) => c.wa_id === phoneNumber);
  const contactName = contactProfile?.profile.name;

  // Upsert WhatsAppChat
  const chat = await prisma.whatsAppChat.upsert({
    where: { tenantId_phoneNumber: { tenantId, phoneNumber } },
    create: {
      tenantId,
      phoneNumber,
      name: contactName || null,
    },
    update: {
      name: contactName || undefined,
      lastMessageAt: new Date(),
    },
  });

  // Mark as read
  try {
    await markAsRead(phoneNumberId, accessToken, msg.id);
  } catch {}

  // Handle text messages
  if (msg.type === 'text' && msg.text?.body) {
    const text = msg.text.body;

    // Handle commands
    if (text.startsWith('/')) {
      return handleCommand(tenantId, accessToken, phoneNumberId, chat, text);
    }

    // Save as activity on linked contact
    if (chat.contactId) {
      await prisma.activity.create({
        data: {
          tenantId,
          contactId: chat.contactId,
          type: 'sms',
          title: `WhatsApp від ${contactName || phoneNumber}`,
          body: text,
        },
      });
    }

    // Reply
    await sendTextMessage(phoneNumberId, accessToken, phoneNumber,
      `✅ Повідомлення отримано${chat.contactId ? '' : '\n\nНадішліть /start для підключення'}`,
    );
  }

  // Handle interactive messages (button/list replies)
  if (msg.type === 'interactive' && msg.interactive) {
    const replyId = msg.interactive.button_reply?.id || msg.interactive.list_reply?.id;
    if (replyId) {
      return handleCallbackData(tenantId, accessToken, phoneNumberId, chat, replyId);
    }
  }
}

async function handleCommand(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  chat: { phoneNumber: string; contactId: string | null },
  text: string,
) {
  const cmd = text.split(' ')[0].toLowerCase();

  switch (cmd) {
    case '/start':
    case '/help':
      return sendStartMenu(tenantId, accessToken, phoneNumberId, chat);
    case '/deals':
      return handleDealsCommand(tenantId, accessToken, phoneNumberId, chat);
    case '/tasks':
      return handleTasksCommand(tenantId, accessToken, phoneNumberId, chat);
    default:
      await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber,
        '❓ Невідома команда. Надішліть /help для списку.',
      );
  }
}

async function sendStartMenu(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  chat: { phoneNumber: string; contactId: string | null },
) {
  const text = `👋 *Вітаю у CRM-бот!*

Я допоможу вам керувати задачами та угодами з WhatsApp.

*Команди:*
/deals — список угод
/tasks — мої задачі
/help — допомога

${chat.contactId ? '✅ Ваш акаунт прив\'язано' : '💡 Щоб прив\'язати, надішліть свій email'}`;

  await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, text);
}

async function handleDealsCommand(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  chat: { phoneNumber: string },
) {
  const deals = await prisma.deal.findMany({
    where: { tenantId, status: 'open' },
    include: { stage: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  } as never);

  if (deals.length === 0) {
    await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, '💼 Немає активних угод.');
    return;
  }

  let text = `💼 *Активні угоди (${deals.length})*\n\n`;
  deals.forEach((deal: { title: string; value: number | null; currency: string; stage?: { name: string } | null }, i: number) => {
    text += `${i + 1}. *${deal.title}*\n   Сума: ${(deal.value || 0).toLocaleString('uk')} ${deal.currency}\n   Етап: ${deal.stage?.name || '—'}\n\n`;
  });

  await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, text);
}

async function handleTasksCommand(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  chat: { phoneNumber: string },
) {
  const tasks = await prisma.task.findMany({
    where: { tenantId, status: { notIn: ['done', 'cancelled'] } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 5,
  } as never);

  if (tasks.length === 0) {
    await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, '📋 Немає активних задач.');
    return;
  }

  const typeIcons: Record<string, string> = { task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄' };
  const priorityEmoji: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  let text = `📋 *Мої задачі (${tasks.length})*\n\n`;
  tasks.forEach((task: { title: string; type: string; priority: string; dueDate: Date | null }, i: number) => {
    const icon = typeIcons[task.type] || '📋';
    const p = priorityEmoji[task.priority] || '🟡';
    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk') : '';
    text += `${i + 1}. ${icon} ${p} *${task.title}*`;
    if (due) text += ` (${due})`;
    text += '\n';
  });

  await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, text);
}

async function handleCallbackData(
  tenantId: string,
  accessToken: string,
  phoneNumberId: string,
  chat: { phoneNumber: string },
  data: string,
) {
  if (data.startsWith('task_done:')) {
    const taskId = data.replace('task_done:', '');
    await prisma.task.update({ where: { id: taskId }, data: { status: 'done' } });
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber,
      `✅ *${task?.title || 'Задачу'}* позначено як виконану!`,
    );
    return;
  }

  await sendTextMessage(phoneNumberId, accessToken, chat.phoneNumber, '❓ Невідома дія.');
}

async function handleStatusUpdate(tenantId: string, status: { id: string; status: string; recipient_id: string }) {
  // Log delivery status for debugging
  console.log(`WhatsApp message ${status.id}: ${status.status} to ${status.recipient_id}`);
}
