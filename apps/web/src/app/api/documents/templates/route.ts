/**
 * Document Templates API — шаблоны документов в Postgres (per-tenant).
 *
 * GET /api/documents/templates — список шаблонов
 * POST /api/documents/templates — создать шаблон
 * DELETE /api/documents/templates?id= — удалить шаблон
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { getTenantQuery } from '@/lib/tenant-query';

const TEMPLATE_TYPES = ['kp', 'contract', 'invoice'] as const;

export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const templates = await prisma.documentTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Помилка отримання шаблонів' }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const body = await request.json();

    const { name, type, content } = body;
    if (!name || !type) {
      return NextResponse.json({ error: 'Вкажіть назву та тип' }, { status: 400 });
    }
    if (!TEMPLATE_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Невідомий тип шаблону. Дозволено: ${TEMPLATE_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const template = await prisma.documentTemplate.create({
      data: {
        tenantId,
        name,
        type,
        content: content && typeof content === 'object' ? content : {},
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Помилка створення шаблону' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'settings:update' })(POSTHandler);

async function DELETEHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Вкажіть id шаблону' }, { status: 400 });
    }

    // Tenant-scoped delete: чужой шаблон удалить нельзя (deleteMany вернёт 0).
    const res = await prisma.documentTemplate.deleteMany({
      where: { id, tenantId },
    });
    if (res.count === 0) {
      return NextResponse.json({ error: 'Шаблон не знайдено' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Delete templates error:', error);
    return NextResponse.json({ error: 'Помилка видалення шаблону' }, { status: 500 });
  }
}

export const DELETE = withAuth({ permission: 'settings:update' })(DELETEHandler);
