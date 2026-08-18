import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { getAutomationRules, createAutomationRule, deleteAutomationRule, toggleAutomationRule } from '@/lib/automation/engine';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/automation/rules — List automation rules
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const rules = await getAutomationRules(tenantId);

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('List automation rules error:', error);
    return NextResponse.json({ error: 'Помилка отримання правил' }, { status: 500 });
  }
}

/**
 * POST /api/automation/rules — Create automation rule
 */
const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerType: z.enum(['stage_change', 'deal_created', 'deal_won', 'deal_lost', 'timer']),
  fromStageId: z.string().optional(),
  toStageId: z.string().optional(),
  actionType: z.enum(['set_field', 'create_task', 'send_notification', 'move_deal', 'send_message']),
  actionConfig: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const rule = await createAutomationRule(tenantId, parsed.data);

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Create automation rule error:', error);
    return NextResponse.json({ error: 'Помилка створення правила' }, { status: 500 });
  }
}

/**
 * PATCH /api/automation/rules — Toggle rule enabled/disabled
 */
const toggleRuleSchema = z.object({
  ruleId: z.string(),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = toggleRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    await toggleAutomationRule(tenantId, parsed.data.ruleId, parsed.data.enabled);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle automation rule error:', error);
    return NextResponse.json({ error: 'Помилка оновлення правила' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation/rules — Delete automation rule
 */
const deleteRuleSchema = z.object({
  ruleId: z.string(),
});

export async function DELETE(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');
    if (!ruleId) return NextResponse.json({ error: 'ruleId required' }, { status: 400 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    await deleteAutomationRule(tenantId, ruleId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete automation rule error:', error);
    return NextResponse.json({ error: 'Помилка видалення правила' }, { status: 500 });
  }
}
