/**
 * POST /api/automation/tick — периодическая проверка timer-правил.
 *
 * Вызывается внешним планировщиком (см. DEPLOYMENT.md), защищён CRON_SECRET.
 * Находит все включённые правила с triggerType 'timer' и для каждого ищет
 * открытые сделки без активности дольше inactivityDays (из actionConfig,
 * по умолчанию 3 дня), вызывая executeAutomations(tenantId, 'timer', ...).
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { prisma } from '@crm-next/database';
import { executeAutomations, type DealContext } from '@/lib/automation/engine';
import { verifyWorkerSecret } from '@/lib/worker-auth';

export async function POST(request: NextRequest) {
  const denied = verifyWorkerSecret(request);
  if (denied) return denied;

  try {
    const rules = await prisma.automationRule.findMany({
      where: { triggerType: 'timer', enabled: true },
    });

    let checked = 0;
    let triggered = 0;
    const errors: Array<{ ruleId: string; error: string }> = [];

    for (const rule of rules) {
      let inactivityDays = 3;
      try {
        const cfg = JSON.parse(rule.actionConfig || '{}') as { inactivityDays?: unknown };
        if (typeof cfg.inactivityDays === 'number' && cfg.inactivityDays > 0) {
          inactivityDays = Math.min(cfg.inactivityDays, 365);
        }
      } catch {}

      const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);

      try {
        const deals = await prisma.deal.findMany({
          where: {
            tenantId: rule.tenantId,
            status: 'open',
            updatedAt: { lt: cutoff },
          },
          select: {
            id: true, title: true, value: true, stageId: true,
            contactId: true, status: true,
          },
          take: 100,
        });

        for (const deal of deals) {
          checked++;
          const ctx: DealContext = {
            dealId: deal.id,
            tenantId: rule.tenantId,
            title: deal.title,
            value: deal.value,
            stageId: deal.stageId,
            previousStageId: null,
            contactId: deal.contactId,
            status: deal.status,
          };
          await executeAutomations(rule.tenantId, 'timer', ctx);
          triggered++;
        }
      } catch (err: any) {
        errors.push({ ruleId: rule.id, error: err?.message || String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      rules: rules.length,
      checked,
      triggered,
      errors,
    });
  } catch (error) {
    console.error('Automation tick error:', error);
    return NextResponse.json({ error: 'Помилка tick автоматизації' }, { status: 500 });
  }
}
