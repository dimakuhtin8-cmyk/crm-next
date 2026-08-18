'use client';

import { useState } from 'react';

import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge } from '@/components/ui';

const mockPipelines = [
  {
    id: '1',
    name: 'Стандартні продажі',
    stages: [
      { id: 'lead', name: 'Лід', order: 0, probability: 10, color: '#64748b' },
      { id: 'qualified', name: 'Кваліфікація', order: 1, probability: 25, color: '#3b82f6' },
      { id: 'proposal', name: 'КП', order: 2, probability: 50, color: '#eab308' },
      { id: 'negotiation', name: 'Переговори', order: 3, probability: 75, color: '#f97316' },
      { id: 'closed_won', name: 'Виграно', order: 4, probability: 100, color: '#22c55e' },
    ],
    dealsCount: 12,
  },
  {
    id: '2',
    name: 'B2B Продажі',
    stages: [
      { id: 'lead', name: 'Лід', order: 0, probability: 5, color: '#64748b' },
      { id: 'meeting', name: 'Зустріч', order: 1, probability: 20, color: '#8b5cf6' },
      { id: 'demo', name: 'Демо', order: 2, probability: 40, color: '#06b6d4' },
      { id: 'offer', name: 'Оферта', order: 3, probability: 60, color: '#f97316' },
      { id: 'contract', name: 'Контракт', order: 4, probability: 80, color: '#eab308' },
      { id: 'closed_won', name: 'Виграно', order: 5, probability: 100, color: '#22c55e' },
    ],
    dealsCount: 8,
  },
];

export default function PipelinesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Воронки</h1>
          <p className="text-muted-foreground">Управління воронками продажів</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
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
          Створити воронку
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Нова воронка</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <Input label="Назва воронки" placeholder="Стандартні продажі" />
              <div>
                <label className="block text-sm font-medium mb-2">Етапи</label>
                <div className="space-y-2">
                  {['Лід', 'Кваліфікація', 'КП', 'Переговори', 'Виграно'].map((stage, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-primary/20" />
                      <Input defaultValue={stage} className="flex-1" />
                      <Input placeholder="%" className="w-20" type="number" />
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-2">
                  + Додати етап
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button">Зберегти</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Скасувати
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {mockPipelines.map((pipeline) => (
          <Card key={pipeline.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{pipeline.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  <Badge variant="secondary">{pipeline.dealsCount} угод</Badge>
                </p>
              </div>
              <Button variant="ghost" size="sm">
                Редагувати
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {pipeline.stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: stage.color }}
                      >
                        {stage.probability}%
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
                        {stage.name}
                      </span>
                    </div>
                    {index < pipeline.stages.length - 1 && (
                      <div className="h-0.5 w-8 bg-border mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
