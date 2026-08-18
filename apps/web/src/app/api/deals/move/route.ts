import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { executeAutomations } from '@/lib/automation/engine';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * POST /api/deals/move — Move deal to another stage (Kanban drag-drop)
 */
const moveDealSchema = z.object({
  dealId: z.string(),
  stageId: z.string(),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = moveDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { dealId, stageId } = parsed.data;
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    // Get current deal state before update
    const { prisma } = await import('@crm-next/database');
    const currentDeal = await prisma.deal.findUnique({
      where: { id: dealId },
    });

    const previousStageId = currentDeal?.stageId || null;

    const deal = await (tq.deal as unknown as {
      update: (args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
    }).update({
      where: { id: dealId },
      data: { stageId },
      include: { stage: true },
    });

    // Trigger automations asynchronously
    if (currentDeal) {
      executeAutomations(tenantId, 'stage_change', {
        dealId,
        tenantId,
        title: currentDeal.title,
        value: currentDeal.value,
        stageId,
        previousStageId,
        contactId: currentDeal.contactId,
        status: currentDeal.status,
      }).catch((err) => console.error('Automation error:', err));
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error('Move deal error:', error);
    return NextResponse.json({ error: 'Помилка переміщення угоди' }, { status: 500 });
  }
}
