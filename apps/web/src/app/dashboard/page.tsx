import Link from 'next/link';

const stats = [
  { name: 'Контакти', value: '127', change: '+12%', changeType: 'positive' },
  { name: 'Активні угоди', value: '23', change: '+3', changeType: 'positive' },
  { name: 'Завершені угоди', value: '8', change: '+2', changeType: 'positive' },
  { name: 'Прогноз виручки', value: '₴2.4M', change: '+18%', changeType: 'positive' },
];

const recentDeals = [
  {
    id: 1,
    title: 'Ремонт офісу 500м²',
    company: 'ТОВ "Будівельник"',
    value: '₴450,000',
    stage: 'КП',
  },
  {
    id: 2,
    title: 'Веб-сайт для компанії',
    company: 'IT Компанія',
    value: '₴120,000',
    stage: 'Переговори',
  },
  { id: 3, title: 'CRM інтеграція', company: 'ФОП Коваленко', value: '₴80,000', stage: 'Лід' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Огляд</h1>
        <p className="text-muted-foreground">Ласкаво просимо до CRM-Next</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{stat.name}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            <p
              className={`mt-1 text-sm ${stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'}`}
            >
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Deals */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-lg font-semibold">Останні угоди</h2>
          <Link href="/dashboard/deals" className="text-sm text-indigo-500 hover:text-indigo-400">
            Переглянути всі
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentDeals.map((deal) => (
            <div key={deal.id} className="flex items-center justify-between p-6">
              <div>
                <p className="font-medium">{deal.title}</p>
                <p className="text-sm text-muted-foreground">{deal.company}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{deal.value}</p>
                <span className="inline-flex rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-500">
                  {deal.stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
