'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

const stats = [
  { name: 'Контакти', value: '127', change: '+12%', positive: true },
  { name: 'Активні угоди', value: '23', change: '+3', positive: true },
  { name: 'Завершені угоди', value: '8', change: '+2', positive: true },
  { name: 'Прогноз виручки', value: '₴2.4M', change: '+18%', positive: true },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Аналітика</h1>
        <p className="text-muted-foreground">Звіти та статистика</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{stat.name}</p>
              <p className="mt-2 text-3xl font-bold">{stat.value}</p>
              <p className={`mt-1 text-sm ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Воронка продажів</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { stage: 'Лід', count: 45, percent: 100 },
                { stage: 'Кваліфікація', count: 32, percent: 71 },
                { stage: 'КП', count: 18, percent: 40 },
                { stage: 'Переговори', count: 10, percent: 22 },
                { stage: 'Виграно', count: 8, percent: 18 },
              ].map((item) => (
                <div key={item.stage} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-muted-foreground">{item.stage}</span>
                  <div className="flex-1 h-6 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${item.percent}%` }}
                    >
                      <span className="text-xs text-white font-medium">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Топ менеджери</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'Олена К.', deals: 12, value: '₴850K' },
                { name: 'Андрій М.', deals: 8, value: '₴620K' },
                { name: 'Ірина П.', deals: 6, value: '₴450K' },
                { name: 'Максим В.', deals: 5, value: '₴380K' },
              ].map((manager, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {i + 1}
                    </div>
                    <span className="font-medium">{manager.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{manager.deals} угод</p>
                    <p className="text-xs text-muted-foreground">{manager.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
