import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { decrypt } from '@/lib/encryption';
import { extractUserId } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return '[повреждён]';
  }
}

/**
 * GET /api/contacts — List contacts (tenant-scoped, with search/filters)
 */
async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const company = searchParams.get('company') || undefined;
    const status = searchParams.get('status') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    // OR-условия (search, dataFilter) собираются в AND, чтобы не затирать
    // друг друга одним ключом where.OR (см. баг search+member).
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { company: { contains: search } },
        ],
      });
    }

    if (company) {
      where.company = { contains: company };
    }

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { some: { tag: { name: tag } } };
    }

    // Apply RBAC data filter (injected by withAuth, field: ownerId)
    const dataFilterParam = searchParams.get('_dataFilter');
    if (dataFilterParam) {
      try {
        andConditions.push(JSON.parse(dataFilterParam));
      } catch {}
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [contacts, total] = await Promise.all([
      tq.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { owner: { select: { id: true, name: true, email: true, image: true } } },
      }),
      tq.contact.count({ where }),
    ]);

    // Decrypt sensitive fields
    const decryptedContacts = contacts.map((contact: Record<string, unknown>) => ({
      ...contact,
      phone: contact.phone ? safeDecrypt(contact.phone as string) : contact.phone,
      notes: contact.notes ? safeDecrypt(contact.notes as string) : contact.notes,
    }));

    return NextResponse.json({ contacts: decryptedContacts, total, page, limit });
  } catch (error) {
    console.error('List contacts error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку контактів' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts — Create contact (tenant-scoped)
 */
const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'lead', 'client']).default('active'),
  ownerId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
});

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tagIds, ownerId: requestedOwnerId, ...contactData } = parsed.data;

    // Owner resolution: explicit ownerId allowed only for admin+ (backend-validated,
    // never trust the frontend picker). member assigning to someone else → 403.
    // Default: the creator becomes the owner.
    const creatorId = await extractUserId(request);
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    let ownerId: string | null = creatorId;
    if (requestedOwnerId !== undefined && requestedOwnerId !== null) {
      const role = creatorId ? await getUserRole(creatorId, tenantId) : null;
      if (role !== 'owner' && role !== 'admin') {
        return NextResponse.json({ error: 'Призначати власника може лише admin' }, { status: 403 });
      }
      ownerId = requestedOwnerId;
    }

    // Encrypt sensitive fields before saving
    const { encrypt } = await import('@/lib/encryption');
    const encryptedData = {
      ...contactData,
      phone: contactData.phone ? encrypt(contactData.phone) : contactData.phone,
      notes: contactData.notes ? encrypt(contactData.notes) : contactData.notes,
    };

    const contact = await (tq.contact as unknown as {
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
    }).create({
      data: {
        ...encryptedData,
        ownerId,
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    // Audit log
    const { logAuditEvent, extractRequestMeta } = await import('@/lib/audit');
    const meta = extractRequestMeta(request);
    const userId = (tq as unknown as { userId: string }).userId;
    await logAuditEvent({
      tenantId: (tq as unknown as { tenantId: string }).tenantId,
      userId,
      action: 'create',
      entity: 'contact',
      entityId: (contact as { id: string }).id,
      newValues: { firstName: contactData.firstName, email: contactData.email, company: contactData.company },
      ...meta,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'Помилка створення контакту' },
      { status: 500 }
    );
  }
}

export const GET = withAuth({ dataFilter: true, dataField: 'ownerId' })(GETHandler);
export const POST = withAuth({ permission: 'contact:create' })(POSTHandler);
