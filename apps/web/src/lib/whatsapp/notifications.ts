import { prisma } from '@crm-next/database';

import { sendTextMessage , taskNotificationText, dealNotificationText } from './client';


/**
 * Send WhatsApp notification to all active chats linked to a tenant
 */
export async function notifyTaskEvent(
  tenantId: string,
  taskId: string,
  event: 'created' | 'assigned' | 'due_soon' | 'overdue' | 'status_changed',
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappApiKey: true, whatsappPhoneNumberId: true },
  });
  if (!tenant?.whatsappApiKey || !tenant.whatsappPhoneNumberId) return;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const text = taskNotificationText({
    title: task.title,
    type: task.type,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() || null,
  }, event);

  // Send to all chats in this tenant
  const chats = await prisma.whatsAppChat.findMany({ where: { tenantId } });
  for (const chat of chats) {
    try {
      await sendTextMessage(tenant.whatsappPhoneNumberId, tenant.whatsappApiKey, chat.phoneNumber, text);
    } catch (error) {
      console.error(`Failed to send WhatsApp notification to ${chat.phoneNumber}:`, error);
    }
  }
}

/**
 * Send WhatsApp notification when deal stage/status changes
 */
export async function notifyDealEvent(
  tenantId: string,
  dealId: string,
  event: 'created' | 'stage_changed' | 'won' | 'lost',
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappApiKey: true, whatsappPhoneNumberId: true },
  });
  if (!tenant?.whatsappApiKey || !tenant.whatsappPhoneNumberId) return;

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;

  const text = dealNotificationText({
    title: deal.title,
    value: deal.value || 0,
    currency: deal.currency,
  }, event);

  // Send to all chats in this tenant
  const chats = await prisma.whatsAppChat.findMany({ where: { tenantId } });
  for (const chat of chats) {
    try {
      await sendTextMessage(tenant.whatsappPhoneNumberId, tenant.whatsappApiKey, chat.phoneNumber, text);
    } catch (error) {
      console.error(`Failed to send WhatsApp notification to ${chat.phoneNumber}:`, error);
    }
  }
}

/**
 * Send a custom message to a specific phone number
 */
export async function sendCustomMessage(tenantId: string, phoneNumber: string, text: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappApiKey: true, whatsappPhoneNumberId: true },
  });
  if (!tenant?.whatsappApiKey || !tenant.whatsappPhoneNumberId) {
    throw new Error('WhatsApp not configured');
  }

  return sendTextMessage(tenant.whatsappPhoneNumberId, tenant.whatsappApiKey, phoneNumber, text);
}
