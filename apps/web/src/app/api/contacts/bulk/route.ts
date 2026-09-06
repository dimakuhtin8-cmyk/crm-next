/**
 * Bulk Contacts API — массовые операции с контактами
 * 
 * POST /api/contacts/bulk — массовые действия
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';
import { z } from 'zod';

const bulkActionSchema = z.object({
  action: z.enum(['delete', 'updateStatus', 'addTag', 'removeTag']),
  ids: z.array(z.string()).min(1, 'Оберіть хоча б один контакт'),
  data: z.record(z.unknown()).optional(),
});

async function POSTHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { action, ids, data } = parsed.data;

    // Verify all contacts belong to this tenant
    const contacts = await tq.contact.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    } as never);

    if ((contacts as unknown[]).length !== ids.length) {
      return NextResponse.json({ error: 'Деякі контакти не знайдено' }, { status: 403 });
    }

    const contactIds = (contacts as Array<{ id: string }>).map(c => c.id);
    let affected = 0;

    switch (action) {
      case 'delete':
        for (const id of contactIds) {
          await tq.contact.delete({ where: { id } });
          affected++;
        }
        break;

      case 'updateStatus':
        if (!data?.status || typeof data.status !== 'string') {
          return NextResponse.json({ error: 'Вкажіть статус' }, { status: 400 });
        }
        for (const id of contactIds) {
          await tq.contact.update({ where: { id }, data: { status: data.status as string } });
          affected++;
        }
        break;

      case 'addTag': {
        const tagId = data?.tagId as string | undefined;
        if (!tagId) {
          return NextResponse.json({ error: 'Вкажіть tagId' }, { status: 400 });
        }
        // Verify tag belongs to this tenant
        const tag = await tq.tag.findUnique({ where: { id: tagId }, select: { id: true } });
        if (!tag) {
          return NextResponse.json({ error: 'Тег не знайдено' }, { status: 404 });
        }
        for (const id of contactIds) {
          // Skip if already has tag
          const existing = await prisma.contactTag.findUnique({
            where: { contactId_tagId: { contactId: id, tagId } },
          }).catch(() => null);
          if (!existing) {
            await prisma.contactTag.create({
              data: { contactId: id, tagId },
            }).catch(() => {});
          }
          affected++;
        }
        break;
      }

      case 'removeTag': {
        const tagId = data?.tagId as string | undefined;
        if (!tagId) {
          return NextResponse.json({ error: 'Вкажіть tagId' }, { status: 400 });
        }
        for (const id of contactIds) {
          await prisma.contactTag.deleteMany({
            where: { contactId: id, tagId },
          }).catch(() => {});
          affected++;
        }
        break;
      }
    }

    return NextResponse.json({ affected, action });
  } catch (error) {
    console.error('Bulk contacts error:', error);
    return NextResponse.json({ error: 'Помилка масових операцій' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'contact:update' })(POSTHandler);
