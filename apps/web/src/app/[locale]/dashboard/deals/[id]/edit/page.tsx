'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DataError } from '@/components/data-error';
import { DealForm } from '@/components/deals/deal-form';
import { Button } from '@/components/ui';

interface DealData {
  title: string;
  pipelineId: string;
  stageId: string;
  value: string;
  currency: string;
  probability: string;
  contactId: string;
  company: string;
  expectedCloseDate: string;
  notes: string;
  products: Array<{ id?: string; name: string; quantity: number; price: number }>;
}

export default function EditDealPage() {
  const params = useParams();
  const dealId = params.id as string;
  const [data, setData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDeal = () => {
    setLoadError(null);
    setLoading(true);
    fetch(`/api/deals/${dealId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const deal = d.deal;
        setData({
          title: deal.title || '',
          pipelineId: deal.pipelineId || '',
          stageId: deal.stageId || '',
          value: deal.value?.toString() || '',
          currency: deal.currency || 'UAH',
          probability: deal.probability?.toString() || '50',
          contactId: deal.contactId || '',
          company: deal.company || '',
          expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
          notes: deal.notes || '',
          products: deal.products || [],
        });
      })
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeal();
  }, [dealId]);

  if (loading)
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
      </div>
    );
  if (!data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        {loadError ? (
          <DataError message={loadError} onRetry={loadDeal} />
        ) : (
          <>
            <p>Угоду не знайдено</p>
            <Button onClick={() => window.history.back()}>Назад</Button>
          </>
        )}
      </div>
    );
  }
  return <DealForm dealId={dealId} initialData={data} />;
}
