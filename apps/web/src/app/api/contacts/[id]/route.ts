import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contacts/[id] — Get contact details
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
    const contact = await tq.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Контакт не знайдено' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Get contact error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання контакту' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contacts/[id] — Update contact
 */
const updateContactSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'lead', 'client']).optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tagIds, ...contactData } = parsed.data;

    // If tagIds provided, update tags
    if (tagIds !== undefined) {
      const existingTags = await tq.contactTag.findMany({
        where: { contactId: id },
      });

      if (existingTags.length > 0) {
        await Promise.all(
          existingTags.map((et) => tq.contactTag.delete({ where: { id: et.id } }))
        );
      }

      if (tagIds.length > 0) {
        await Promise.all(
          tagIds.map((tagId) =>
            tq.contactTag.create({
              data: { contactId: id, tagId },
            })
          )
        );
      }
    }

    const contact = await (tq.contact as unknown as {
      update: (args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
    }).update({
      where: { id },
      data: contactData as Record<string, unknown>,
      include: { tags: { include: { tag: true } } },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Update contact error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення контакту' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[id] — Delete contact
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { id } = await params;
    await tq.contact.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json(
      { error: 'Помилка видалення контакту' },
      { status: 500 }
    );
  }
}
