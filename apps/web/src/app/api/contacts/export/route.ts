/**
 * Export Contacts API — экспорт контактов в CSV
 * 
 * GET /api/contacts/export — скачать все контакты в CSV
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

    const contacts = await tq.contact.findMany({
      orderBy: { createdAt: 'desc' },
    } as never);

    if (format === 'csv') {
      const headers = ['ID', 'Ім\'я', 'Email', 'Телефон', 'Компанія', 'Посада', 'Статус', 'Джерело', 'Створено'];

      const rows = (contacts as Array<Record<string, unknown>>).map(contact => [
        (contact.id as string) || '',
        (contact.firstName as string) || '',
        (contact.email as string) || '',
        (contact.phone as string) || '',
        (contact.company as string) || '',
        (contact.position as string) || '',
        (contact.status as string) || '',
        (contact.source as string) || '',
        contact.createdAt ? new Date(contact.createdAt as string).toISOString() : '',
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
          'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    const json = (contacts as Array<Record<string, unknown>>).map(contact => ({
      id: contact.id,
      firstName: contact.firstName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      position: contact.position,
      status: contact.status,
      source: contact.source,
      createdAt: contact.createdAt,
    }));

    return new Response(JSON.stringify(json, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export contacts error:', error);
    return NextResponse.json({ error: 'Помилка експорту' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
