'use client';

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
  Plus,
  Bot,
  Settings,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickDealForm, QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '@/components/ui';
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

interface DealDetail {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  status: string;
  company: string | null;
  expectedCloseDate: string | null;
  stageId: string;
  contactId: string | null;
  contact?: { id: string; firstName: string; lastName: string | null } | null;
  owner?: { name: string } | null;
}

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  date: string;
}

const stageColors = [
  'from-primary to-primary-hover',
  'from-info to-info-hover',
  'from-success to-success-hover',
  'from-warning to-warning-hover',
  'from-danger to-danger-hover',
];

function getScoreTextClass(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-danger';
}

const statusBadge: Record<
  string,
  { label: string; variant: 'info' | 'success' | 'danger' | 'secondary' }
> = {
  open: { label: 'Відкрита', variant: 'info' },
  won: { label: 'Виграна', variant: 'success' },
  lost: { label: 'Програна', variant: 'danger' },
};

const activityTypeLabels: Record<string, string> = {
  call: 'Дзвінок',
  email: 'Лист',
  meeting: 'Зустріч',
  task: 'Задача',
  note: 'Нотатка',
  sms: 'SMS',
};

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
        'kanban-card group cursor-grab active:cursor-grabbing p-3 rounded-xl transition-colors',
        isDragging && 'opacity-40 ring-2 ring-primary shadow-lg z-50',
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-foreground-muted/40 group-hover:text-foreground-muted mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {deal.title}
          </p>

          {deal.value != null && (
            <p className="text-sm font-semibold text-primary">
              {currencySymbols[deal.currency] || deal.currency}
              {deal.value.toLocaleString('uk')}
            </p>
          )}

          {deal.aiScore != null && (
            <Badge
              variant="outline"
              className={cn('gap-1 text-xs font-semibold', getScoreTextClass(deal.aiScore))}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              AI {deal.aiScore}%
            </Badge>
          )}

          {deal.contact ? (
            <div className="flex items-center gap-2">
              <Avatar
                name={`${deal.contact.firstName} ${deal.contact.lastName || ''}`.trim()}
                size="sm"
                className="h-6 w-6 text-2xs"
              />
              <span className="truncate text-xs text-foreground-muted">
                {deal.contact.firstName}
              </span>
            </div>
          ) : deal.company ? (
            <span className="truncate text-xs text-foreground-muted">{deal.company}</span>
          ) : null}

          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            {deal.probability > 0 && (
              <span className="text-xs text-foreground-muted bg-secondary px-1.5 py-0.5 rounded">
                {deal.probability}%
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
        'flex-shrink-0 w-80 flex flex-col rounded-xl border transition-all duration-200',
        isOver
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01]'
          : 'border-border bg-background-secondary/50',
      )}
    >
      {children}
    </div>
  );
}

export default function DealsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [scoringDeals, setScoringDeals] = useState(false);

  // Шухляда деталей угоди
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [dealDetail, setDealDetail] = useState<DealDetail | null>(null);
  const [dealLoading, setDealLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  // Quick-create popover
  const [quickOpen, setQuickOpen] = useState(false);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  useTourAutoStart('deals');

  const handleQuickCreated = () => {
    setQuickOpen(false);
    fetchDeals();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
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
    } catch {
      // воронки просто не покажем
    } finally {
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
      // GET /api/deals відповідає через apiSuccess: { success, data: { deals } }
      setDeals(data.data?.deals || data.deals || []);
    } catch {
      // угоди просто не оновляться
    }
  };

  // Завантаження деталей угоди для шухляди
  useEffect(() => {
    if (!openDealId) {
      setDealDetail(null);
      setTimeline([]);
      setDealLoading(false);
      return;
    }
    let cancelled = false;
    setDealLoading(true);
    setDealDetail(null);
    setTimeline([]);
    fetch(`/api/deals/${openDealId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.deal) setDealDetail(data.deal);
      })
      .catch(() => {
        // деталі просто не завантажаться
      })
      .finally(() => {
        if (!cancelled) setDealLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openDealId]);

  // Таймлайн активності контакту
  useEffect(() => {
    const contactId = dealDetail?.contactId;
    if (!contactId) {
      setTimeline([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/activity?contactId=${contactId}&limit=8`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTimeline(Array.isArray(data.activities) ? data.activities : []);
      })
      .catch(() => {
        // таймлайн просто не покажемо
      });
    return () => {
      cancelled = true;
    };
  }, [dealDetail?.contactId]);

  // Зміна стадії зі шухляди: оптімістичне оновлення + збереження
  const handleStageChange = async (stageId: string) => {
    if (!stageId || !openDealId || stageId === dealDetail?.stageId) return;
    setDealDetail((prev) => (prev ? { ...prev, stageId } : prev));
    try {
      await fetch('/api/deals/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: openDealId, stageId }),
      });
      fetchDeals();
      fetch(`/api/deals/${openDealId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.deal) setDealDetail(data.deal);
        })
        .catch(() => {
          // оновлення деталей просто не відбудеться
        });
    } catch {
      fetchDeals();
    }
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
    [fetchDeals],
  );

  const getStageDeals = (stageId: string) => deals.filter((d) => d.stageId === stageId);

  const getStageTotal = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0), 0);

  const getTotalPipelineValue = () => deals.reduce((sum, d) => sum + (d.value || 0), 0);

  const getWeightedValue = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0);

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
      // оцінка просто не виконається
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
            {deals.length} угод на суму {currencySymbols.UAH}
            {getTotalPipelineValue().toLocaleString('uk')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScoreAll}
            disabled={scoringDeals}
            data-tour="deal-score"
          >
            <Bot className="h-4 w-4 mr-1.5" />
            {scoringDeals ? 'Оцінка...' : 'AI Оцінити все'}
          </Button>
          <Link href="/dashboard/deals/pipelines">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            ref={quickBtnRef}
            size="sm"
            onClick={() => setQuickOpen(true)}
            data-tour="deal-add"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Нова угода
          </Button>
          <QuickCreatePopover
            anchorEl={quickBtnRef.current}
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            title="Нова угода"
          >
            <QuickDealForm onCreated={handleQuickCreated} />
          </QuickCreatePopover>
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
                  : 'text-foreground-muted hover:text-foreground',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Kanban Board */}
      {selectedPipeline && deals.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Угод поки немає"
              description="Створіть першу угоду, щоб воронка ожила"
              action={<Button onClick={() => setQuickOpen(true)}>Створити угоду</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        selectedPipeline && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4" data-tour="deal-kanban">
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
                              `bg-gradient-to-br ${stageColors[stageIdx % stageColors.length]}`,
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
                                  : 'text-danger',
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
                          onClick={() => setOpenDealId(deal.id)}
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
                <div className="kanban-card p-3 rounded-xl ring-2 ring-primary shadow-2xl rotate-3 opacity-90 max-w-[320px]">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-foreground-muted/40 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {activeDeal.title}
                      </p>
                      {activeDeal.value != null && (
                        <p className="text-sm font-semibold text-primary">
                          {currencySymbols[activeDeal.currency] || activeDeal.currency}
                          {activeDeal.value.toLocaleString('uk')}
                        </p>
                      )}
                      {activeDeal.aiScore != null && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'gap-1 text-xs font-semibold',
                            getScoreTextClass(activeDeal.aiScore),
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          AI {activeDeal.aiScore}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )
      )}

      {/* Шухляда деталей угоди */}
      <Sheet
        open={!!openDealId}
        onOpenChange={(o) => {
          if (!o) setOpenDealId(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="truncate pr-8">{dealDetail?.title || 'Угода'}</SheetTitle>
            <SheetDescription className="sr-only">
              Деталі угоди, стадія та таймлайн
            </SheetDescription>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {dealDetail?.probability ?? 0}%
              </Badge>
              <Badge
                variant={statusBadge[dealDetail?.status || '']?.variant || 'secondary'}
                className="text-xs"
              >
                {statusBadge[dealDetail?.status || '']?.label || dealDetail?.status || '—'}
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {dealLoading && <Skeleton className="h-32" />}

            {dealDetail && (
              <>
                {/* Дані */}
                <div>
                  <p className="text-xs font-medium text-foreground-muted">Дані</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-foreground-muted">Сума</p>
                      <p className="text-sm font-medium">
                        {dealDetail.value != null
                          ? `${currencySymbols[dealDetail.currency] || dealDetail.currency}${dealDetail.value.toLocaleString('uk')}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-muted">Контакт</p>
                      <p className="text-sm font-medium">
                        {dealDetail.contact
                          ? `${dealDetail.contact.firstName} ${dealDetail.contact.lastName || ''}`.trim()
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-muted">Компанія</p>
                      <p className="text-sm font-medium">{dealDetail.company || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-muted">Очікуване закриття</p>
                      <p className="text-sm font-medium">
                        {dealDetail.expectedCloseDate
                          ? new Date(dealDetail.expectedCloseDate).toLocaleDateString('uk', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-muted">Власник</p>
                      <p className="text-sm font-medium">{dealDetail.owner?.name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Стадія */}
                <div>
                  <p className="text-xs font-medium text-foreground-muted">Стадія</p>
                  <div className="mt-2 w-56">
                    <QuickSelect
                      value={dealDetail.stageId}
                      onChange={handleStageChange}
                      options={
                        selectedPipeline?.stages.map((s) => ({ id: s.id, name: s.name })) || []
                      }
                      placeholder="Оберіть стадію"
                    />
                  </div>
                </div>

                {/* Таймлайн */}
                <div>
                  <p className="text-xs font-medium text-foreground-muted">Таймлайн</p>
                  <div className="mt-1">
                    {timeline.length === 0 ? (
                      <p className="text-sm text-foreground-muted">Таймлайн порожній</p>
                    ) : (
                      timeline.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 border-b border-border py-2 last:border-0"
                        >
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {activityTypeLabels[item.type] || item.type}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.title || item.body || '—'}</p>
                            <p className="text-xs text-foreground-muted">
                              {new Date(item.date).toLocaleString('uk', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <SheetFooter>
            <Link
              href={`/dashboard/deals/${openDealId}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Відкрити сторінку угоди
            </Link>
            <SheetClose className="h-9 rounded-md px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-secondary">
              Закрити
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
