'use client';

import { useState } from 'react';

import { Button, Card, CardContent, Badge } from '@/components/ui';

const stages = [
  { id: 'lead', name: 'Лід', color: 'bg-slate-500' },
  { id: 'qualified', name: 'Кваліфікація', color: 'bg-blue-500' },
  { id: 'proposal', name: 'КП', color: 'bg-yellow-500' },
  { id: 'negotiation', name: 'Переговори', color: 'bg-orange-500' },
  { id: 'closed_won', name: 'Виграно', color: 'bg-green-500' },
];

const mockDeals = [
  {
    id: '1',
    title: 'Ремонт офісу 500м²',
    company: 'ТОВ "Будівельник"',
    value: 450000,
    stage: 'proposal',
  },
  {
    id: '2',
    title: 'Веб-сайт для компанії',
    company: 'IT Компанія',
    value: 120000,
    stage: 'negotiation',
  },
  { id: '3', title: 'CRM інтеграція', company: 'ФОП Коваленко', value: 80000, stage: 'lead' },
  { id: '4', title: 'Мобільний додаток', company: 'Стартап', value: 250000, stage: 'qualified' },
  { id: '5', title: 'Дизайн логотипу', company: 'Бренд', value: 15000, stage: 'closed_won' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealsPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Угоди</h1>
          <p className="text-muted-foreground">Управління продажами</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-1">
            <button
              onClick={() => setView('kanban')}
              className={`rounded-md px-3 py-1 text-sm ${view === 'kanban' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              Канбан
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-3 py-1 text-sm ${view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              Список
            </button>
          </div>
          <Button>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Додати угоду
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = mockDeals.filter((d) => d.stage === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stage.id}
                className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <span className="font-medium">{stage.name}</span>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                </div>
                <div className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
                  {formatCurrency(stageValue)}
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {stageDeals.length === 0 ? (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                      Перетягніть угоду
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <Card
                        key={deal.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <CardContent className="p-3">
                          <p className="font-medium">{deal.title}</p>
                          <p className="text-sm text-muted-foreground">{deal.company}</p>
                          <p className="mt-2 text-sm font-semibold text-primary">
                            {formatCurrency(deal.value)}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {mockDeals.map((deal) => {
              const stage = stages.find((s) => s.id === deal.stage);
              return (
                <div key={deal.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${stage?.color}`} />
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      <p className="text-sm text-muted-foreground">{deal.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge>{stage?.name}</Badge>
                    <span className="font-semibold">{formatCurrency(deal.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
