import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-guard';

/**
 * GET /api/activity — Activity timeline (all activities across contacts)
 */
async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;

    const [activities, total] = await Promise.all([
      (tq as unknown as { activity: { findMany: (args: { where: Record<string, unknown>; orderBy: Record<string, string>; skip: number; take: number }) => Promise<unknown[]> } }).activity.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (tq as unknown as { activity: { count: (args: { where: Record<string, unknown> }) => Promise<number> } }).activity.count({ where }),
    ]);

    return NextResponse.json({ activities, total, page, limit });
  } catch (error) {
    console.error('Activity timeline error:', error);
    return NextResponse.json({ error: 'Помилка отримання активностей' }, { status: 500 });
  }
}

/**
 * POST /api/activity — Create a global activity
 */
const createActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task', 'note', 'sms']),
  title: z.string().min(1, 'Вкажіть заголовок').max(255),
  body: z.string().max(5000).optional(),
  contactId: z.string().optional(),
  date: z.string().optional(),
});

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { type, title, body: activityBody, contactId, date } = parsed.data;

    const activity = await (tq as unknown as { activity: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } }).activity.create({
      data: {
        type,
        title,
        body: activityBody || null,
        contactId: contactId || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error('Create activity error:', error);
    return NextResponse.json({ error: 'Помилка створення активності' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
export const POST = withAuth({ permission: 'activity:create' })(POSTHandler);
