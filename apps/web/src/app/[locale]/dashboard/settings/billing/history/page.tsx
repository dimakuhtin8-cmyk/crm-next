'use client';

import { Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { DataError } from '@/components/data-error';
import { Badge, Button, Card, CardContent, Skeleton, Table } from '@/components/ui';

type Payment = {
  id: string;
  stripePaymentId: string | null;
  stripeInvoiceId: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  invoiceUrl: string | null;
  createdAt: string;
};

interface PaymentsResponse {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABELS: Record<string, string> = {
  succeeded: 'Сплачено',
  failed: 'Помилка',
  pending: 'Очікує',
  refunded: 'Повернення',
};

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  succeeded: 'success',
  failed: 'danger',
  pending: 'warning',
  refunded: 'info',
};

export default function PaymentHistoryPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvoices = () => {
    setLoadError(null);
    setLoading(true);
    fetch('/api/billing/invoices', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  /**
   * Мінімальний валідний PDF із текстовим вмістом — демонстраційний рахунок
   * для записів без Stripe invoiceUrl (усі байти ASCII, offsets рахуються).
   */
  function buildMockInvoicePdf(lines: string[]): Blob {
    const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '?');
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const content = `BT /F1 12 Tf 50 790 Td 14 TL\n${lines
      .map((line) => `(${esc(ascii(line))}) Tj T*`)
      .join('\n')}\nET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((off) => {
      pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  const handleDownloadMockInvoice = (row: Payment) => {
    try {
      const pdf = buildMockInvoicePdf([
        'CRM-Next - Invoice (demo)',
        `Date: ${new Date(row.createdAt).toLocaleDateString('uk')}`,
        `Invoice: ${row.stripeInvoiceId || row.id}`,
        `Description: ${row.description || 'Subscription payment'}`,
        `Amount: ${(row.amount / 100).toFixed(2)} ${row.currency.toUpperCase()}`,
        `Status: ${row.status}`,
        '',
        'Demo document generated client-side.',
      ]);
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${(row.stripeInvoiceId || row.id).slice(-12)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Рахунок завантажено', { description: 'Демонстраційний PDF' });
    } catch {
      toast.error('Не вдалося завантажити рахунок');
    }
  };

  const formatAmount = (cents: number, currency: string): string => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings/billing"
            className="text-foreground-muted hover:text-foreground"
          >
            ← Назад
          </Link>
          <h1 className="text-2xl font-bold">Історія платежів</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings/billing"
          className="text-foreground-muted hover:text-foreground"
        >
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Історія платежів</h1>
      </div>

      {loadError ? (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-4">
            <DataError message={loadError} onRetry={loadInvoices} />
          </CardContent>
        </Card>
      ) : (
        <Table<Payment>
          data={data?.payments ?? []}
          columns={[
            {
              key: 'createdAt',
              header: 'Дата',
              render: (row) => (
                <span className="whitespace-nowrap text-sm text-foreground-muted">
                  {new Date(row.createdAt).toLocaleDateString('uk', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              ),
            },
            {
              key: 'stripeInvoiceId',
              header: 'Рахунок',
              render: (row) => (
                <span className="font-mono text-xs text-foreground-muted">
                  {row.stripeInvoiceId || '—'}
                </span>
              ),
            },
            {
              key: 'description',
              header: 'Опис',
              render: (row) => (
                <span className="text-sm">{row.description || 'Оплата підписки'}</span>
              ),
            },
            {
              key: 'amount',
              header: 'Сума',
              className: 'text-right',
              render: (row) => (
                <span className="text-sm font-semibold">
                  {formatAmount(row.amount, row.currency)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Статус',
              render: (row) => (
                <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                  {STATUS_LABELS[row.status] || row.status}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              render: (row) =>
                row.invoiceUrl ? (
                  <Button variant="ghost" size="sm" asChild title="Завантажити рахунок">
                    <a
                      href={row.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Завантажити рахунок"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Завантажити рахунок (демонстраційний PDF)"
                    aria-label="Завантажити рахунок (демонстраційний PDF)"
                    onClick={() => handleDownloadMockInvoice(row)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                ),
            },
          ]}
          emptyMessage="Немає платежів"
        />
      )}

      {data && data.payments.length === 0 && !loadError && (
        <div className="text-center">
          <Receipt className="w-10 h-10 mx-auto text-foreground-muted/40 mb-3" />
          <p className="text-sm text-foreground-muted">Рахунків поки що немає</p>
        </div>
      )}
    </div>
  );
}
