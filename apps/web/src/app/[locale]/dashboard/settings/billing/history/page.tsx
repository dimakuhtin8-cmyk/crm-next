'use client';

import { Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

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
                  <span className="text-foreground-muted">—</span>
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
