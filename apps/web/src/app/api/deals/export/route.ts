/**
 * Export Deals API — экспорт сделок в CSV
 * 
 * GET /api/deals/export — скачать все сделки в CSV
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
    const format = searchParams.get('format') || 'csv';

    const deals = await tq.deal.findMany({
      orderBy: { createdAt: 'desc' },
    } as never);

    if (format === 'csv') {
      const headers = ['ID', 'Назва', 'Сума', 'Валюта', 'Ймовірність', 'Статус', 'Компанія', 'Створено'];

      const rows = (deals as Array<Record<string, unknown>>).map(deal => [
        (deal.id as string) || '',
        (deal.title as string) || '',
        (deal.value as number)?.toString() || '0',
        (deal.currency as string) || 'UAH',
        (deal.probability as number)?.toString() || '0',
        (deal.status as string) || '',
        (deal.company as string) || '',
        deal.createdAt ? new Date(deal.createdAt as string).toISOString() : '',
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="deals-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    const json = (deals as Array<Record<string, unknown>>).map(deal => ({
      id: deal.id,
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      probability: deal.probability,
      status: deal.status,
      company: deal.company,
      createdAt: deal.createdAt,
    }));

    return new Response(JSON.stringify(json, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="deals-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export deals error:', error);
    return NextResponse.json({ error: 'Помилка експорту' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
