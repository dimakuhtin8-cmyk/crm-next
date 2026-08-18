import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contacts/[id]/activities — List activities for contact
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { id } = await params;
    const activities = await tq.activity.findMany({
      where: { contactId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('List activities error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання активностей' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts/[id]/activities — Create activity for contact
 */
const createActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task', 'note', 'sms']),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  date: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const activity = await tq.activity.create({
      data: {
        contactId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        body: parsed.data.body,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error('Create activity error:', error);
    return NextResponse.json(
      { error: 'Помилка створення активності' },
      { status: 500 }
    );
  }
}
