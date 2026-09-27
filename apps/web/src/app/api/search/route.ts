/**
 * GET /api/search?q=... — глобальный поиск по тенанту (Cmd+K).
 * Ищет по контактам, сделкам, задачам через tq (tenant-scoped).
 * Member-visibility: per-model dataFilter (ownerId для контактов/сделок,
 * assigneeId для задач) — тот же механизм, что в contacts/deals/tasks роутах.
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { getUserRole, buildDataFilter } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';

const TAKE = 5;

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ contacts: [], deals: [], tasks: [] });
    }

    const userId = await extractUserId(request);
    const role = userId ? await getUserRole(userId, tq.tenantId) : null;
    const ownerScope = role && userId ? buildDataFilter(role, userId, 'ownerId') : undefined;
    const taskScope = role && userId ? buildDataFilter(role, userId, 'assigneeId') : undefined;

    const and = (searchOr: Record<string, unknown>, scope?: Record<string, unknown>) => ({
      AND: scope ? [searchOr, scope] : [searchOr],
    });

    const [contacts, deals, tasks] = await Promise.all([
      tq.contact.findMany({
        where: and(
          {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { company: { contains: q } },
            ],
          },
          ownerScope,
        ),
        orderBy: { createdAt: 'desc' },
        take: TAKE,
      }),
      tq.deal.findMany({
        where: and({ title: { contains: q } }, ownerScope),
        orderBy: { createdAt: 'desc' },
        take: TAKE,
      }),
      tq.task.findMany({
        where: and({ title: { contains: q } }, taskScope),
        orderBy: { createdAt: 'desc' },
        take: TAKE,
      }),
    ]);

    return NextResponse.json({
      contacts: (contacts as Record<string, unknown>[]).map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'Без імені',
        subtitle: (c.company as string) || (c.email as string) || '',
      })),
      deals: (deals as Record<string, unknown>[]).map((d) => ({
        id: d.id,
        name: d.title,
        subtitle: d.value != null ? `${d.value} грн` : '',
      })),
      tasks: (tasks as Record<string, unknown>[]).map((t) => ({
        id: t.id,
        name: t.title,
        subtitle: (t.status as string) || '',
      })),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Помилка пошуку' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
