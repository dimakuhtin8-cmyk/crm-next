'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Deal {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  status: string;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  winReason: string | null;
  lossReason: string | null;
  notes: string | null;
  company: string | null;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string; color: string | null };
  pipeline: { id: string; name: string };
  contact: { id: string; firstName: string; lastName: string | null; email: string | null } | null;
  products: Array<{ id: string; name: string; quantity: number; price: number }>;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }> = {
  open: { label: 'Відкрита', variant: 'default' },
  won: { label: 'Виграна', variant: 'success' },
  lost: { label: 'Програна', variant: 'secondary' },
};

const currencySymbols: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDeal(); }, [dealId]);

  const fetchDeal = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      const data = await res.json();
      setDeal(data.deal);
    } catch {} finally { setLoading(false); }
  };

  const handleWinLoss = async (status: 'won' | 'lost') => {
    const reason = status === 'won'
      ? prompt('Причина виграшу:')
      : prompt('Причина програшу:');
    if (reason === null) return;

    await fetch(`/api/deals/${dealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(status === 'won' ? { winReason: reason } : { lossReason: reason }),
      }),
    });
    fetchDeal();
  };

  const handleDelete = async () => {
    if (!confirm('Видалити угоду?')) return;
    await fetch(`/api/deals/${dealId}`, { method: 'DELETE' });
    router.push('/dashboard/deals');
  };

  if (loading) return <div className="max-w-4xl mx-auto"><div className="h-8 bg-muted rounded w-1/3 animate-pulse" /></div>;
  if (!deal) return <div className="max-w-4xl mx-auto text-center py-12"><p>Угоду не знайдено</p></div>;

  const totalProducts = deal.products.reduce((sum, p) => sum + p.quantity * p.price, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-foreground-muted mb-1">
            <Link href="/dashboard/deals" className="hover:text-foreground">Угоди</Link>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span>{deal.pipeline.name}</span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span>{deal.stage.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{deal.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/deals/${dealId}/edit`}><Button variant="outline">Редагувати</Button></Link>
          {deal.status === 'open' && (
            <>
              <Button variant="outline" className="text-success border-success hover:bg-success/10" onClick={() => handleWinLoss('won')}>Виграно</Button>
              <Button variant="destructive" onClick={() => handleWinLoss('lost')}>Програно</Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.back()}>Назад</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Деталі угоди</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-foreground-muted">Назва</p><p className="font-medium">{deal.title}</p></div>
                <div><p className="text-sm text-foreground-muted">Статус</p><Badge variant={statusConfig[deal.status]?.variant}>{statusConfig[deal.status]?.label}</Badge></div>
                <div><p className="text-sm text-foreground-muted">Сума</p><p className="font-bold text-lg">{currencySymbols[deal.currency]}{deal.value?.toLocaleString('uk') || '—'}</p></div>
                <div><p className="text-sm text-foreground-muted">Ймовірність</p><p className="font-medium">{deal.probability}%</p></div>
                <div><p className="text-sm text-foreground-muted">Воронка</p><p className="font-medium">{deal.pipeline.name} → {deal.stage.name}</p></div>
                <div><p className="text-sm text-foreground-muted">Компанія</p><p className="font-medium">{deal.company || '—'}</p></div>
                <div><p className="text-sm text-foreground-muted">Очікуване закриття</p><p className="font-medium">{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('uk') : '—'}</p></div>
                <div><p className="text-sm text-foreground-muted">Фактичне закриття</p><p className="font-medium">{deal.actualCloseDate ? new Date(deal.actualCloseDate).toLocaleDateString('uk') : '—'}</p></div>
              </div>
              {deal.contact && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">Контакт</p>
                  <Link href={`/dashboard/contacts/${deal.contact.id}`} className="text-primary hover:underline">
                    {deal.contact.firstName} {deal.contact.lastName || ''}
                  </Link>
                  {deal.contact.email && <span className="text-sm text-foreground-muted ml-2">({deal.contact.email})</span>}
                </div>
              )}
              {deal.notes && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">Нотатки</p>
                  <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                </div>
              )}
              {(deal.winReason || deal.lossReason) && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">{deal.status === 'won' ? 'Причина виграшу' : 'Причина програшу'}</p>
                  <p className="text-sm">{deal.status === 'won' ? deal.winReason : deal.lossReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          {deal.products.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Продукти ({deal.products.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-foreground-muted">
                    <div className="col-span-5">Назва</div>
                    <div className="col-span-2 text-right">Кількість</div>
                    <div className="col-span-2 text-right">Ціна</div>
                    <div className="col-span-3 text-right">Сума</div>
                  </div>
                  {deal.products.map((p) => (
                    <div key={p.id} className="grid grid-cols-12 gap-2 py-2 border-t border-border/50 text-sm">
                      <div className="col-span-5 font-medium">{p.name}</div>
                      <div className="col-span-2 text-right">{p.quantity}</div>
                      <div className="col-span-2 text-right">{currencySymbols[deal.currency]}{p.price.toLocaleString('uk')}</div>
                      <div className="col-span-3 text-right font-medium">{currencySymbols[deal.currency]}{(p.quantity * p.price).toLocaleString('uk')}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 gap-2 pt-2 border-t border-border font-bold text-sm">
                    <div className="col-span-9 text-right">Разом:</div>
                    <div className="col-span-3 text-right">{currencySymbols[deal.currency]}{totalProducts.toLocaleString('uk')}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-center p-4 bg-primary-light rounded-lg">
                <p className="text-sm text-foreground-muted">Сума угоди</p>
                <p className="text-3xl font-bold text-primary">{currencySymbols[deal.currency]}{deal.value?.toLocaleString('uk') || '0'}</p>
                <p className="text-xs text-foreground-muted mt-1">Ймовірність: {deal.probability}%</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="p-2 bg-secondary/50 rounded">
                  <p className="text-foreground-muted">Створено</p>
                  <p className="font-medium">{new Date(deal.createdAt).toLocaleDateString('uk')}</p>
                </div>
                <div className="p-2 bg-secondary/50 rounded">
                  <p className="text-foreground-muted">Оновлено</p>
                  <p className="font-medium">{new Date(deal.updatedAt).toLocaleDateString('uk')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <Button variant="destructive" className="w-full" onClick={handleDelete}>Видалити угоду</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
