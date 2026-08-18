'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

interface ChartProps {
  data: Array<{ name: string; count?: number; value?: number; revenue?: number }>;
  height?: number;
}

export function BarChartWidget({ data, height = 300 }: ChartProps) {
  if (!data.length) return <div className="h-[300px] flex items-center justify-center text-foreground-muted text-sm">Немає даних</div>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--foreground)',
          }}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data, height = 300 }: ChartProps) {
  if (!data.length) return <div className="h-[300px] flex items-center justify-center text-foreground-muted text-sm">Немає даних</div>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--foreground)',
          }}
          formatter={(value: number) => [`${value.toLocaleString('uk')} ₴`, 'Виручка']}
        />
        <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartWidget({ data, height = 300 }: ChartProps) {
  if (!data.length) return <div className="h-[300px] flex items-center justify-center text-foreground-muted text-sm">Немає даних</div>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--foreground)',
          }}
        />
        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

export function PieChartWidget({ data, height = 300 }: PieChartProps) {
  if (!data.length) return <div className="h-[300px] flex items-center justify-center text-foreground-muted text-sm">Немає даних</div>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--foreground)',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ data, height = 300 }: ChartProps) {
  if (!data.length) return <div className="h-[300px] flex items-center justify-center text-foreground-muted text-sm">Немає даних</div>;

  const maxCount = Math.max(...data.map((d) => d.count || 0));

  return (
    <div className="space-y-2" style={{ height }}>
      {data.map((item, i) => {
        const pct = maxCount > 0 ? ((item.count || 0) / maxCount) * 100 : 0;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs text-foreground-muted w-24 text-right truncate">{item.name}</span>
            <div className="flex-1 h-8 bg-secondary rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500 flex items-center px-3"
                style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
              >
                <span className="text-xs font-medium text-white">{item.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
