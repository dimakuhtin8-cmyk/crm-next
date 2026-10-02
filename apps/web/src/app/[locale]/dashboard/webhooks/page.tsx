/**
 * Webhooks Management — управление вебхуками
 *
 * Показывает:
 * - Список зарегистрированных вебхуков
 * - Создание нового вебхука
 * - Доступные события
 */

'use client';

import { Webhook, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { QuickCreatePopover, QuickWebhookForm } from '@/components/quick-create';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
  Switch,
  Table,
} from '@/components/ui';

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
};

interface WebhookEvent {
  event: string;
  description: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-create popover
  const [quickOpen, setQuickOpen] = useState(false);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  const handleQuickCreated = () => {
    setQuickOpen(false);
    fetchWebhooks();
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/v1/webhooks');
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.data.webhooks || []);
        setEvents(data.data.availableEvents || []);
      }
    } catch {
      // список просто останется пустым
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Вебхуки</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const visibleWebhooks = searchQuery.trim()
    ? webhooks.filter((w) => w.url.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : webhooks;

  const webhookColumns = [
    {
      key: 'method',
      header: 'Метод',
      className: 'p-2 w-[90px]',
      render: () => (
        <Badge variant="success" className="font-mono">
          POST
        </Badge>
      ),
    },
    {
      key: 'url',
      header: 'Endpoint URL',
      className: 'p-2',
      render: (webhook: WebhookRow) => (
        <span className="block truncate font-mono text-xs" title={webhook.url}>
          {webhook.url}
        </span>
      ),
    },
    {
      key: 'events',
      header: 'Події',
      className: 'p-2 w-[110px] font-mono text-xs text-foreground-muted',
      render: (webhook: WebhookRow) => (
        <span title={webhook.events.join(', ')}>{webhook.events.length} подій</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Створено',
      className: 'p-2 w-[120px] text-xs text-foreground-muted',
      render: (webhook: WebhookRow) =>
        new Date(webhook.createdAt).toLocaleDateString('uk-UA', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'active',
      header: 'Статус',
      className: 'p-2 w-[90px]',
      render: (webhook: WebhookRow) => (
        <Switch
          checked={webhook.active}
          disabled
          aria-label="Статус вебхука"
          title="Перемикання недоступне: API не має endpoint для зміни статусу"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Вебхуки</h1>
          <p className="text-foreground-muted text-sm mt-1">Інтеграції з зовнішніми сервісами</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Пошук за URL…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-56 text-xs"
          />
          <Button ref={quickBtnRef} size="sm" onClick={() => setQuickOpen(true)}>
            <Plus className="h-4 w-4" />
            Створити вебхук
          </Button>
        </div>
        <QuickCreatePopover
          anchorEl={quickBtnRef.current}
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          title="Новий вебхук"
        >
          <QuickWebhookForm onCreated={handleQuickCreated} />
        </QuickCreatePopover>
      </div>

      {/* Список вебхуків */}
      {webhooks.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <EmptyState
              icon={<Webhook className="h-12 w-12" />}
              title="Вебхуків поки немає"
              description="Створіть вебхук для інтеграції з зовнішніми сервісами"
              action={
                <Button size="sm" onClick={() => setQuickOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Створити вебхук
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Table
          columns={webhookColumns}
          data={visibleWebhooks}
          pageSize={20}
          emptyMessage="Вебхуків за цим запитом не знайдено"
        />
      )}

      {/* Доступні події */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Доступні події</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {events.map((evt) => (
              <div
                key={evt.event}
                className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2"
              >
                <code className="truncate text-xs font-mono text-primary">{evt.event}</code>
                <span className="text-sm text-foreground-muted">—</span>
                <span className="truncate text-sm">{evt.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
