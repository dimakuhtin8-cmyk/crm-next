'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { DataError } from '@/components/data-error';
import { OwnerPicker, useTeam } from '@/components/owner-picker';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Owner {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Deal {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  status: string;
  ownerId: string | null;
  owner?: Owner | null;
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

const currencySymbols: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;
  const t = useTranslations('deals');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { currentRole } = useTeam();
  const canManageOwner = currentRole === 'owner' || currentRole === 'admin';

  const statusConfig: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }
  > = {
    open: { label: t('dealStatus.open'), variant: 'default' },
    won: { label: t('dealStatus.won'), variant: 'success' },
    lost: { label: t('dealStatus.lost'), variant: 'secondary' },
  };

  useEffect(() => {
    fetchDeal();
  }, [dealId]);

  const fetchDeal = async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      if (!res.ok) throw new Error(t('errors.requestFailed', { status: res.status }));
      const data = await res.json();
      setDeal(data.deal);
    } catch (err) {
      setDeal(null);
      setLoadError(err instanceof Error ? err.message : t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleWinLoss = async (status: 'won' | 'lost') => {
    const reason = status === 'won' ? prompt(t('winReasonPrompt')) : prompt(t('lossReasonPrompt'));
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
    if (!confirm(t('confirmDelete'))) return;
    await fetch(`/api/deals/${dealId}`, { method: 'DELETE' });
    router.push('/dashboard/deals');
  };

  const handleOwnerSave = async (ownerId: string | null) => {
    await fetch(`/api/deals/${dealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });
    fetchDeal();
  };

  if (loading)
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
      </div>
    );
  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        {loadError ? <DataError message={loadError} onRetry={fetchDeal} /> : <p>{t('notFound')}</p>}
      </div>
    );
  }

  const totalProducts = deal.products.reduce((sum, p) => sum + p.quantity * p.price, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-foreground-muted mb-1">
            <Link href="/dashboard/deals" className="hover:text-foreground">
              {t('title')}
            </Link>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>{deal.pipeline.name}</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>{deal.stage.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{deal.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/copilot?dealId=${dealId}`}>
            <Button variant="outline">{t('askAi')}</Button>
          </Link>
          <Link href={`/dashboard/deals/${dealId}/edit`}>
            <Button variant="outline">{tCommon('edit')}</Button>
          </Link>
          {deal.status === 'open' && (
            <>
              <Button
                variant="outline"
                className="text-success border-success hover:bg-success/10"
                onClick={() => handleWinLoss('won')}
              >
                {tRoot('stages.closed_won')}
              </Button>
              <Button variant="destructive" onClick={() => handleWinLoss('lost')}>
                {tRoot('stages.closed_lost')}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            {tCommon('back')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detailsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-foreground-muted">{tCommon('name')}</p>
                  <p className="font-medium">{deal.title}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{tCommon('status')}</p>
                  <Badge variant={statusConfig[deal.status]?.variant}>
                    {statusConfig[deal.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('amount')}</p>
                  <p className="font-bold text-lg">
                    {currencySymbols[deal.currency]}
                    {deal.value?.toLocaleString('uk') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('probability')}</p>
                  <p className="font-medium">{deal.probability}%</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('pipeline')}</p>
                  <p className="font-medium">
                    {deal.pipeline.name} → {deal.stage.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('company')}</p>
                  <p className="font-medium">{deal.company || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('expectedCloseDate')}</p>
                  <p className="font-medium">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString('uk')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t('actualCloseDate')}</p>
                  <p className="font-medium">
                    {deal.actualCloseDate
                      ? new Date(deal.actualCloseDate).toLocaleDateString('uk')
                      : '—'}
                  </p>
                </div>
              </div>
              {deal.contact && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">{t('contact')}</p>
                  <Link
                    href={`/dashboard/contacts/${deal.contact.id}`}
                    className="text-primary hover:underline"
                  >
                    {deal.contact.firstName} {deal.contact.lastName || ''}
                  </Link>
                  {deal.contact.email && (
                    <span className="text-sm text-foreground-muted ml-2">
                      ({deal.contact.email})
                    </span>
                  )}
                </div>
              )}
              {deal.notes && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">{tRoot('contacts.notes')}</p>
                  <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                </div>
              )}
              {(deal.winReason || deal.lossReason) && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">
                    {deal.status === 'won' ? t('winReasonLabel') : t('lossReasonLabel')}
                  </p>
                  <p className="text-sm">
                    {deal.status === 'won' ? deal.winReason : deal.lossReason}
                  </p>
                </div>
              )}
              <div className="pt-4 border-t border-border">
                <OwnerPicker
                  value={deal.ownerId}
                  onChange={handleOwnerSave}
                  canManage={canManageOwner}
                />
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          {deal.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('productsTitle', { count: deal.products.length })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-foreground-muted">
                    <div className="col-span-5">{tCommon('name')}</div>
                    <div className="col-span-2 text-right">{t('quantity')}</div>
                    <div className="col-span-2 text-right">{t('price')}</div>
                    <div className="col-span-3 text-right">{t('amount')}</div>
                  </div>
                  {deal.products.map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 gap-2 py-2 border-t border-border/50 text-sm"
                    >
                      <div className="col-span-5 font-medium">{p.name}</div>
                      <div className="col-span-2 text-right">{p.quantity}</div>
                      <div className="col-span-2 text-right">
                        {currencySymbols[deal.currency]}
                        {p.price.toLocaleString('uk')}
                      </div>
                      <div className="col-span-3 text-right font-medium">
                        {currencySymbols[deal.currency]}
                        {(p.quantity * p.price).toLocaleString('uk')}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 gap-2 pt-2 border-t border-border font-bold text-sm">
                    <div className="col-span-9 text-right">{t('total')}</div>
                    <div className="col-span-3 text-right">
                      {currencySymbols[deal.currency]}
                      {totalProducts.toLocaleString('uk')}
                    </div>
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
                <p className="text-sm text-foreground-muted">{t('dealAmount')}</p>
                <p className="text-3xl font-bold text-primary">
                  {currencySymbols[deal.currency]}
                  {deal.value?.toLocaleString('uk') || '0'}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  {t('probabilityValue', { value: deal.probability })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="p-2 bg-secondary/50 rounded">
                  <p className="text-foreground-muted">{t('created')}</p>
                  <p className="font-medium">{new Date(deal.createdAt).toLocaleDateString('uk')}</p>
                </div>
                <div className="p-2 bg-secondary/50 rounded">
                  <p className="text-foreground-muted">{t('updated')}</p>
                  <p className="font-medium">{new Date(deal.updatedAt).toLocaleDateString('uk')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <Button variant="destructive" className="w-full" onClick={handleDelete}>
                {t('deleteDeal')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
