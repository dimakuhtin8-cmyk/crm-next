'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Check, X, Clock, ExternalLink, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';

interface Payment {
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
}

interface PaymentsResponse {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
}

export default function PaymentHistoryPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatAmount = (cents: number, currency: string): string => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'refunded':
        return <X className="w-4 h-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'succeeded': return 'Успішно';
      case 'failed': return 'Помилка';
      case 'pending': return 'Очікує';
      case 'refunded': return 'Повернення';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings/billing" className="text-muted-foreground hover:text-foreground">← Назад</Link>
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
        <Link href="/dashboard/settings/billing" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Історія платежів</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {data && data.payments.length > 0 ? (
            <div className="divide-y divide-border">
              {data.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent/50">
                      <Receipt className="w-5 h-5 text-foreground-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {payment.description || 'Оплата підписки'}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {new Date(payment.createdAt).toLocaleDateString('uk', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(payment.status)}
                      <span className="text-xs text-foreground-muted">{statusLabel(payment.status)}</span>
                    </div>

                    <p className="text-sm font-semibold w-24 text-right">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>

                    {payment.invoiceUrl && (
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                        title="Завантажити рахунок"
                      >
                        <Download className="w-4 h-4 text-foreground-muted" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Receipt className="w-10 h-10 mx-auto text-foreground-muted/40 mb-3" />
              <p className="text-sm text-foreground-muted">Немає платежів</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
