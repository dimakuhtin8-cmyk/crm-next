import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/contacts/dedup — Find potential duplicates
 * Checks for contacts with matching email, phone, or name+company
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Get all contacts for this tenant
    const contacts = await tq.contact.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Find duplicates by email, phone, or name+company
    const duplicates: Array<{ reason: string; contacts: typeof contacts }> = [];

    // Group by email
    const byEmail = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      if (contact.email) {
        const key = contact.email.toLowerCase().trim();
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(contact);
      }
    }
    for (const [email, group] of byEmail) {
      if (group.length > 1) {
        duplicates.push({ reason: `Однаковий email: ${email}`, contacts: group });
      }
    }

    // Group by phone
    const byPhone = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      if (contact.phone) {
        const key = contact.phone.replace(/\D/g, '');
        if (key.length >= 7) {
          if (!byPhone.has(key)) byPhone.set(key, []);
          byPhone.get(key)!.push(contact);
        }
      }
    }
    for (const [phone, group] of byPhone) {
      if (group.length > 1) {
        duplicates.push({ reason: `Однаковий телефон: ${phone}`, contacts: group });
      }
    }

    // Group by name + company
    const byNameCompany = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      const nameKey = `${contact.firstName} ${contact.lastName || ''}`.toLowerCase().trim();
      const companyKey = (contact.company || '').toLowerCase().trim();
      if (nameKey && companyKey) {
        const key = `${nameKey}|${companyKey}`;
        if (!byNameCompany.has(key)) byNameCompany.set(key, []);
        byNameCompany.get(key)!.push(contact);
      }
    }
    for (const [, group] of byNameCompany) {
      if (group.length > 1) {
        duplicates.push({ reason: `Однакове ім'я та компанія`, contacts: group });
      }
    }

    return NextResponse.json({ duplicates, total: duplicates.length });
  } catch (error) {
    console.error('Dedup error:', error);
    return NextResponse.json(
      { error: 'Помилка пошуку дублікатів' },
      { status: 500 }
    );
  }
}
