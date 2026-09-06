'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  TrendingUp,
  Plus,
  Bot,
  Settings,
  Calendar,
  Building2,
  User,
  ArrowRight,
  MoreHorizontal,
  GripVertical,
  DollarSign,
  Target,
  BarChart3,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
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
  aiScore: number | null;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string | null } | null;
}

const currencySymbols: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

const stageColors = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-amber-500 to-amber-600',
  'from-emerald-500 to-emerald-600',
  'from-rose-500 to-rose-600',
];

function getScoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
}

function getScoreRing(score: number) {
  if (score >= 80) return 'border-emerald-500';
  if (score >= 50) return 'border-amber-500';
  return 'border-rose-500';
}

function DraggableDeal({
  deal,
  isDragging,
  onClick,
}: {
  deal: Deal;
  isDragging: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={cn(
        'kanban-card group cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 ring-2 ring-primary shadow-lg z-50'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-foreground-muted/40 group-hover:text-foreground-muted mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
            {deal.title}
          </p>

          {deal.value != null && (
            <p className="text-base font-bold text-primary mb-2">
              {currencySymbols[deal.currency] || deal.currency}
              {deal.value.toLocaleString('uk')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {deal.aiScore != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg',
                  getScoreColor(deal.aiScore)
                )}
              >
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    deal.aiScore >= 80
                      ? 'bg-emerald-500'
                      : deal.aiScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  )}
                />
                AI {deal.aiScore}%
              </span>
            )}
            {deal.probability > 0 && (
              <span className="text-xs text-foreground-muted bg-secondary px-1.5 py-0.5 rounded">
                {deal.probability}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2.5 text-xs text-foreground-muted">
            {deal.company && (
              <span className="flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{deal.company}</span>
              </span>
            )}
            {deal.contact && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {deal.contact.firstName}
              </span>
            )}
            {deal.expectedCloseDate && (
              <span className="flex items-center gap-1 ml-auto">
                <Calendar className="h-3 w-3" />
                {new Date(deal.expectedCloseDate).toLocaleDateString('uk', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableStage({
  stage,
  isOver,
  children,
}: {
  stage: Stage;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-80 flex flex-col rounded-2xl border transition-all duration-200',
        isOver
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01]'
          : 'border-border bg-background-secondary/50'
      )}
    >
      {children}
    </div>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [scoringDeals, setScoringDeals] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

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
    } catch {} finally {
      setLoading(false);
    }
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as Deal | undefined;
    if (deal) setActiveDeal(deal);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverStageId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDeal(null);
      setOverStageId(null);

      if (!over) return;

      const deal = active.data.current?.deal as Deal | undefined;
      const stageId = over.id as string;
      if (!deal || deal.stageId === stageId) return;

      setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stageId } : d)));
      try {
        await fetch('/api/deals/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, stageId }),
        });
      } catch {
        fetchDeals();
      }
    },
    [fetchDeals]
  );

  const getStageDeals = (stageId: string) =>
    deals.filter((d) => d.stageId === stageId);

  const getStageTotal = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0), 0);

  const getTotalPipelineValue = () =>
    deals.reduce((sum, d) => sum + (d.value || 0), 0);

  const getWeightedValue = (stageId: string) =>
    getStageDeals(stageId).reduce(
      (sum, d) => sum + (d.value || 0) * (d.probability / 100),
      0
    );

  const getConversionRate = (fromStageIdx: number) => {
    if (fromStageIdx === 0) return 100;
    const fromStage = selectedPipeline?.stages[fromStageIdx - 1];
    const toStage = selectedPipeline?.stages[fromStageIdx];
    if (!fromStage || !toStage) return 0;
    const fromCount = getStageDeals(fromStage.id).length;
    const toCount = getStageDeals(toStage.id).length;
    if (fromCount === 0) return 0;
    return Math.round((toCount / fromCount) * 100);
  };

  const handleScoreAll = async () => {
    setScoringDeals(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score-batch', data: {} }),
      });
      if (res.ok) fetchDeals();
    } catch {
    } finally {
      setScoringDeals(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-80 h-96 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Воронка продажів</h1>
          <p className="text-foreground-muted mt-1">
            {deals.length} угод на суму{' '}
            {currencySymbols.UAH}
            {getTotalPipelineValue().toLocaleString('uk')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScoreAll}
            disabled={scoringDeals}
          >
            <Bot className="h-4 w-4 mr-1.5" />
            {scoringDeals ? 'Оцінка...' : 'AI Оцінити все'}
          </Button>
          <Link href="/dashboard/deals/pipelines">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Нова угода
          </Button>
        </div>
      </div>

      {/* Pipeline tabs */}
      {pipelines.length > 1 && (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPipeline(p)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                selectedPipeline?.id === p.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Kanban Board */}
      {selectedPipeline && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {selectedPipeline.stages.map((stage, stageIdx) => {
              const stageDeals = getStageDeals(stage.id);
              const total = getStageTotal(stage.id);
              const weighted = getWeightedValue(stage.id);
              const isOver = overStageId === stage.id;
              const conversion = getConversionRate(stageIdx);

              return (
                <DroppableStage key={stage.id} stage={stage} isOver={isOver}>
                  {/* Stage header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'h-3 w-3 rounded-full shadow-sm',
                            `bg-gradient-to-br ${stageColors[stageIdx % stageColors.length]}`
                          )}
                        />
                        <h3 className="font-semibold text-sm">{stage.name}</h3>
                        <span className="flex items-center justify-center h-5 min-w-5 rounded-full bg-secondary px-1.5 text-xs font-bold text-foreground-muted">
                          {stageDeals.length}
                        </span>
                      </div>
                      <button className="p-1 rounded-lg hover:bg-secondary text-foreground-muted hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-foreground-muted">Сума</p>
                        <p className="text-sm font-bold text-foreground">
                          {total > 0
                            ? `${currencySymbols.UAH}${total.toLocaleString('uk')}`
                            : '—'}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div>
                        <p className="text-xs text-foreground-muted">Зважена</p>
                        <p className="text-sm font-bold text-foreground">
                          {weighted > 0
                            ? `${currencySymbols.UAH}${Math.round(weighted).toLocaleString('uk')}`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {stageIdx > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <ArrowRight className="h-3 w-3 text-foreground-muted" />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            conversion >= 50
                              ? 'text-success'
                              : conversion >= 25
                              ? 'text-warning'
                              : 'text-danger'
                          )}
                        >
                          {conversion}% конверсія
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Deals list */}
                  <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-340px)]">
                    {stageDeals.map((deal) => (
                      <DraggableDeal
                        key={deal.id}
                        deal={deal}
                        isDragging={activeDeal?.id === deal.id}
                        onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                      />
                    ))}

                    {stageDeals.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-xs text-foreground-muted/60">Перетягніть угоду сюди</p>
                      </div>
                    )}
                  </div>
                </DroppableStage>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <div className="kanban-card ring-2 ring-primary shadow-2xl rotate-3 opacity-90 max-w-[320px]">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-foreground-muted/40 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1.5 line-clamp-2">{activeDeal.title}</p>
                    {activeDeal.value != null && (
                      <p className="text-base font-bold text-primary mb-2">
                        {currencySymbols[activeDeal.currency] || activeDeal.currency}
                        {activeDeal.value.toLocaleString('uk')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeDeal.aiScore != null && (
                        <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg', getScoreColor(activeDeal.aiScore))}>
                          AI {activeDeal.aiScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
