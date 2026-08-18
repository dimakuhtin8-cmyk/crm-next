'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string | null;
}

interface Deal {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  status: string;
  expectedCloseDate: string | null;
  stageId: string;
  contactId: string | null;
  company: string | null;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string | null } | null;
}

const currencySymbols: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

export default function DealsPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPipeline) fetchDeals();
  }, [selectedPipeline]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/pipelines');
      const data = await res.json();
      const p = data.pipelines || [];
      setPipelines(p);
      if (p.length > 0) setSelectedPipeline(p[0]);
    } catch {} finally { setLoading(false); }
  };

  const fetchDeals = async () => {
    if (!selectedPipeline) return;
    try {
      const params = new URLSearchParams({ pipelineId: selectedPipeline.id });
      if (search) params.set('search', search);
      const res = await fetch(`/api/deals?${params}`);
      const data = await res.json();
      setDeals(data.deals || []);
    } catch {}
  };

  const handleDragStart = (deal: Deal) => setDraggedDeal(deal);
  const handleDragEnd = () => { setDraggedDeal(null); setDragOverStage(null); };
  const handleDragOver = (e: React.DragEvent, stageId: string) => { e.preventDefault(); setDragOverStage(stageId); };
  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (stageId: string) => {
    if (!draggedDeal || draggedDeal.stageId === stageId) { handleDragEnd(); return; }
    setDeals((prev) => prev.map((d) => d.id === draggedDeal.id ? { ...d, stageId } : d));
    try {
      await fetch('/api/deals/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: draggedDeal.id, stageId }),
      });
    } catch { fetchData(); }
    handleDragEnd();
  };

  const getStageDeals = (stageId: string) => deals.filter((d) => d.stageId === stageId);
  const getStageTotal = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-96 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Угоди</h1>
          <Link href="/dashboard/deals/pipelines">
            <Button>Створити воронку</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="h-12 w-12 mx-auto text-foreground-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <p className="text-foreground-muted mb-4">Створіть першу воронку для роботи з угодами</p>
            <Link href="/dashboard/deals/pipelines">
              <Button>Створити воронку</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Угоди</h1>
          <select
            value={selectedPipeline?.id || ''}
            onChange={(e) => {
              const p = pipelines.find((p) => p.id === e.target.value);
              setSelectedPipeline(p || null);
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/deals/pipelines">
            <Button variant="outline">Налаштування воронок</Button>
          </Link>
          <Link href="/dashboard/deals/new">
            <Button>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Нова угода
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban Board */}
      {selectedPipeline && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {selectedPipeline.stages.map((stage) => {
            const stageDeals = getStageDeals(stage.id);
            const total = getStageTotal(stage.id);
            const isDragOver = dragOverStage === stage.id;

            return (
              <div
                key={stage.id}
                className={cn(
                  'flex-shrink-0 w-72 flex flex-col rounded-xl border transition-colors',
                  isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30',
                )}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Stage header */}
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: stage.color || '#6b7280' }}
                    />
                    <h3 className="font-medium text-sm">{stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  <span className="text-xs text-foreground-muted">
                    {total > 0 ? `${currencySymbols.UAH}${total.toLocaleString('uk')}` : '—'}
                  </span>
                </div>

                {/* Deals list */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      onDragEnd={handleDragEnd}
                      onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                      className={cn(
                        'p-3 bg-card rounded-lg border border-border cursor-pointer hover:shadow-md transition-all',
                        draggedDeal?.id === deal.id && 'opacity-50',
                      )}
                    >
                      <p className="font-medium text-sm mb-1 line-clamp-2">{deal.title}</p>
                      {deal.value != null && (
                        <p className="text-sm font-bold text-primary">
                          {currencySymbols[deal.currency] || deal.currency}{deal.value.toLocaleString('uk')}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {deal.probability > 0 && (
                            <span className="text-xs text-foreground-muted">{deal.probability}%</span>
                          )}
                          {deal.company && (
                            <span className="text-xs text-foreground-muted truncate max-w-[100px]">
                              {deal.company}
                            </span>
                          )}
                        </div>
                        {deal.contact && (
                          <span className="text-xs text-foreground-muted">
                            {deal.contact.firstName}
                          </span>
                        )}
                      </div>
                      {deal.expectedCloseDate && (
                        <p className="text-xs text-foreground-muted mt-1">
                          Закриття: {new Date(deal.expectedCloseDate).toLocaleDateString('uk')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
