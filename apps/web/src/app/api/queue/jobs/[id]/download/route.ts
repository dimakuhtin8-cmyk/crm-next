/**
 * GET /api/queue/jobs/[id]/download — скачать файл export-задачи.
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { getTenantQuery } from '@/lib/tenant-query';
import { prisma } from '@crm-next/database';
import { withAuth } from '@/lib/auth-guard';

interface Params {
  params: Promise<{ id: string }>;
}

async function GETHandler(request: NextRequest, { params }: Params) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    const { id } = await params;
    const job = await prisma.queueJob.findFirst({
      where: { id, tenantId },
      select: { type: true, status: true, result: true },
    });

    if (!job || job.type !== 'export' || job.status !== 'completed' || !job.result) {
      return NextResponse.json({ error: 'Файл недоступний' }, { status: 404 });
    }

    let parsed: { fileName?: string; mime?: string; contentBase64?: string };
    try {
      parsed = JSON.parse(job.result);
    } catch {
      return NextResponse.json({ error: 'Файл пошкоджено' }, { status: 500 });
    }
    if (!parsed.contentBase64) {
      return NextResponse.json({ error: 'Файл недоступний' }, { status: 404 });
    }

    const bytes = Buffer.from(parsed.contentBase64, 'base64');
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': parsed.mime || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${parsed.fileName || 'export'}"`,
        'Content-Length': String(bytes.length),
      },
    });
  } catch (error) {
    console.error('Download export error:', error);
    return NextResponse.json({ error: 'Помилка скачування' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
