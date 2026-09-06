/**
 * Document Templates API — управление шаблонами документов
 * 
 * GET /api/documents/templates — список шаблонов
 * POST /api/documents/templates — создать шаблон
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

// In-memory store for templates (can be moved to DB later)
const templatesByTenant = new Map<string, Array<{
  id: string;
  name: string;
  type: 'kp' | 'contract' | 'invoice';
  content: Record<string, unknown>;
  createdAt: string;
}>>();

export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const templates = templatesByTenant.get(tenantId) || [];

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

    const template = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: type as 'kp' | 'contract' | 'invoice',
      content: content || {},
      createdAt: new Date().toISOString(),
    };

    const templates = templatesByTenant.get(tenantId) || [];
    templates.push(template);
    templatesByTenant.set(tenantId, templates);

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

    const templates = templatesByTenant.get(tenantId) || [];
    const filtered = templates.filter(t => t.id !== id);
    templatesByTenant.set(tenantId, filtered);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Помилка видалення шаблону' }, { status: 500 });
  }
}

export const DELETE = withAuth({ permission: 'settings:update' })(DELETEHandler);
