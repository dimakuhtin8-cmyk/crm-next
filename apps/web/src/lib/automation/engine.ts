import { prisma } from '@crm-next/database';

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  fromStageId: string | null;
  toStageId: string | null;
  actionType: string;
  actionConfig: string;
}

export interface DealContext {
  dealId: string;
  tenantId: string;
  title: string;
  value: number | null;
  stageId: string | null;
  previousStageId: string | null;
  contactId: string | null;
  status: string;
}

/**
 * Execute automation rules for a deal event
 */
export async function executeAutomations(
  tenantId: string,
  triggerType: string,
  deal: DealContext,
) {
  // Find matching rules
  const rules = await prisma.automationRule.findMany({
    where: {
      tenantId,
      enabled: true,
      triggerType,
    },
  });

  for (const rule of rules) {
    // Check if rule matches the deal context
    if (!matchesRule(rule, deal)) continue;

    try {
      await executeAction(rule, deal);
      await logExecution(tenantId, rule.id, deal.dealId, triggerType, rule.actionType, 'success');
    } catch (error) {
      console.error(`Automation rule ${rule.id} failed:`, error);
      await logExecution(tenantId, rule.id, deal.dealId, triggerType, rule.actionType, 'error',
        JSON.stringify({ error: String(error) }));
    }
  }
}

function matchesRule(rule: AutomationRule, deal: DealContext): boolean {
  // Check stage conditions
  if (rule.fromStageId && rule.fromStageId !== deal.previousStageId) return false;
  if (rule.toStageId && rule.toStageId !== deal.stageId) return false;
  return true;
}

async function executeAction(rule: AutomationRule, deal: DealContext) {
  const config = JSON.parse(rule.actionConfig || '{}');

  switch (rule.actionType) {
    case 'set_field':
      return executeSetField(deal, config);
    case 'create_task':
      return executeCreateTask(deal, config);
    case 'send_notification':
      return executeSendNotification(deal, config);
    case 'move_deal':
      return executeMoveDeal(deal, config);
    case 'send_message':
      return executeSendMessage(deal, config);
    default:
      console.warn(`Unknown action type: ${rule.actionType}`);
  }
}

async function executeSetField(deal: DealContext, config: Record<string, unknown>) {
  const field = config.field as string | undefined;
  const value = config.value;
  if (!field) return;

  const updateData: Record<string, unknown> = {};
  updateData[field] = value;

  await prisma.deal.update({
    where: { id: deal.dealId },
    data: updateData,
  });
}

async function executeCreateTask(deal: DealContext, config: Record<string, unknown>) {
  const { title, type, priority, daysUntilDue } = config;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (typeof daysUntilDue === 'number' ? daysUntilDue : 3));

  await prisma.task.create({
    data: {
      tenantId: deal.tenantId,
      title: (typeof title === 'string' ? title : `Задача по угоді: ${deal.title}`) as string,
      type: (typeof type === 'string' ? type : 'task') as string,
      priority: (typeof priority === 'string' ? priority : 'medium') as string,
      status: 'todo',
      dueDate,
      dealId: deal.dealId,
    } as never,
  });
}

async function executeSendNotification(deal: DealContext, config: Record<string, unknown>) {
  const { channel, message } = config;
  const text = (typeof message === 'string' ? message : `Угода "${deal.title}" оновлена`) as string;

  // Send via Telegram if configured
  if (channel === 'telegram' || channel === 'all') {
    try {
      const { notifyDealEvent } = await import('@/lib/telegram/notifications');
      await notifyDealEvent(deal.tenantId, deal.dealId, 'stage_changed');
    } catch {}
  }

  // Send via WhatsApp if configured
  if (channel === 'whatsapp' || channel === 'all') {
    try {
      const { notifyDealEvent } = await import('@/lib/whatsapp/notifications');
      await notifyDealEvent(deal.tenantId, deal.dealId, 'stage_changed');
    } catch {}
  }

  console.log(`Notification sent: ${text}`);
}

async function executeMoveDeal(deal: DealContext, config: Record<string, unknown>) {
  const { targetStageId } = config;
  if (!targetStageId || typeof targetStageId !== 'string') return;

  await prisma.deal.update({
    where: { id: deal.dealId },
    data: { stageId: targetStageId },
  });
}

async function executeSendMessage(deal: DealContext, config: Record<string, unknown>) {
  const { template, recipient } = config;
  // Placeholder for message sending logic
  console.log(`Message would be sent: template=${template}, recipient=${recipient}, deal=${deal.title}`);
}

async function logExecution(
  tenantId: string,
  ruleId: string,
  dealId: string,
  triggerType: string,
  actionType: string,
  result: string,
  details?: string,
) {
  try {
    await prisma.automationLog.create({
      data: {
        tenantId,
        ruleId,
        dealId,
        triggerType,
        actionType,
        result,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to log automation execution:', error);
  }
}

/**
 * Get automation rules for a tenant
 */
export async function getAutomationRules(tenantId: string) {
  return prisma.automationRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create an automation rule
 */
export async function createAutomationRule(tenantId: string, data: {
  name: string;
  description?: string;
  triggerType: string;
  fromStageId?: string;
  toStageId?: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
}) {
  return prisma.automationRule.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      fromStageId: data.fromStageId || null,
      toStageId: data.toStageId || null,
      actionType: data.actionType,
      actionConfig: JSON.stringify(data.actionConfig),
    },
  });
}

/**
 * Delete an automation rule
 */
export async function deleteAutomationRule(tenantId: string, ruleId: string) {
  return prisma.automationRule.deleteMany({
    where: { id: ruleId, tenantId },
  });
}

/**
 * Toggle rule enabled/disabled
 */
export async function toggleAutomationRule(tenantId: string, ruleId: string, enabled: boolean) {
  return prisma.automationRule.updateMany({
    where: { id: ruleId, tenantId },
    data: { enabled },
  });
}
