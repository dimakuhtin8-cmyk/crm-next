import { prisma } from '@crm-next/database';

import { sendMessage, taskNotificationText, dealNotificationText } from './bot';

/**
 * Send Telegram notification to all active chats linked to a tenant
 * when a task or deal event occurs
 */
export async function notifyTaskEvent(
  tenantId: string,
  taskId: string,
  event: 'created' | 'assigned' | 'due_soon' | 'overdue' | 'status_changed',
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramBotToken: true },
  });
  if (!tenant?.telegramBotToken) return;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const text = taskNotificationText({
    title: task.title,
    type: task.type,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() || null,
  }, event);

  // Send to all chats in this tenant
  const chats = await prisma.telegramChat.findMany({ where: { tenantId } });
  for (const chat of chats) {
    try {
      await sendMessage(tenant.telegramBotToken, chat.telegramId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Виконано', callback_data: `task_done:${task.id}` },
              { text: '📋 Відкрити', callback_data: `task:${task.id}` },
            ],
          ],
        },
      });
    } catch (error) {
      console.error(`Failed to send Telegram notification to chat ${chat.telegramId}:`, error);
    }
  }
}

/**
 * Send Telegram notification when deal stage/status changes
 */
export async function notifyDealEvent(
  tenantId: string,
  dealId: string,
  event: 'created' | 'stage_changed' | 'won' | 'lost',
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramBotToken: true },
  });
  if (!tenant?.telegramBotToken) return;

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;

  const text = dealNotificationText({
    title: deal.title,
    value: deal.value || 0,
    currency: deal.currency,
  }, event);

  // Send to all chats in this tenant
  const chats = await prisma.telegramChat.findMany({ where: { tenantId } });
  for (const chat of chats) {
    try {
      await sendMessage(tenant.telegramBotToken, chat.telegramId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '💼 Відкрити', callback_data: `deal:${deal.id}` },
          ]],
        },
      });
    } catch (error) {
      console.error(`Failed to send Telegram notification to chat ${chat.telegramId}:`, error);
    }
  }
}
