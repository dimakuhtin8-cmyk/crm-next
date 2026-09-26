/**
 * Recent Activities API — последние активности для дашборда
 * 
 * GET /api/activity/recent — последние активности
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    const activities = await tq.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        contactId: true,
        createdAt: true,
      },
    } as never);

    // Enrich with contact names
    const contactIds = [...new Set((activities as Array<Record<string, unknown>>).map(a => a.contactId).filter(Boolean))] as string[];
    
    let contactMap = new Map<string, string>();
    if (contactIds.length > 0) {
      const contacts = await tq.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true },
      } as never);
      contactMap = new Map((contacts as Array<Record<string, unknown>>).map(c => [
        c.id as string,
        `${c.firstName as string} ${c.lastName ? (c.lastName as string) : ''}`.trim(),
      ]));
    }

    const enrichedActivities = (activities as Array<Record<string, unknown>>).map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.title,
      contactId: activity.contactId,
      contactName: activity.contactId ? contactMap.get(activity.contactId as string) || null : null,
      createdAt: activity.createdAt,
    }));

    return NextResponse.json({
      activities: enrichedActivities,
      total: enrichedActivities.length,
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    return NextResponse.json({ error: 'Помилка отримання активностей' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
