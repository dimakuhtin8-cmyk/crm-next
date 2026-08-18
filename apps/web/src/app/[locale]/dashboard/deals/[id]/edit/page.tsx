'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DealForm } from '@/components/deals/deal-form';
import { Button } from '@/components/ui';

interface DealData {
  title: string; pipelineId: string; stageId: string; value: string; currency: string;
  probability: string; contactId: string; company: string; expectedCloseDate: string;
  notes: string; products: Array<{ id?: string; name: string; quantity: number; price: number }>;
}

export default function EditDealPage() {
  const params = useParams();
  const dealId = params.id as string;
  const [data, setData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/deals/${dealId}`).then((r) => r.json()).then((d) => {
      const deal = d.deal;
      setData({
        title: deal.title || '', pipelineId: deal.pipelineId || '', stageId: deal.stageId || '',
        value: deal.value?.toString() || '', currency: deal.currency || 'UAH',
        probability: deal.probability?.toString() || '50', contactId: deal.contactId || '',
        company: deal.company || '', expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
        notes: deal.notes || '', products: deal.products || [],
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div className="max-w-3xl mx-auto"><div className="h-8 bg-muted rounded w-1/3 animate-pulse" /></div>;
  if (!data) return <div className="max-w-3xl mx-auto text-center py-12"><p>Угоду не знайдено</p><Button onClick={() => window.history.back()}>Назад</Button></div>;
  return <DealForm dealId={dealId} initialData={data} />;
}
