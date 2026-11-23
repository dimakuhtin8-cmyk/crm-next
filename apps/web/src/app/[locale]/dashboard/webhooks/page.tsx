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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('webhooks');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
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

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const res = await fetch(`/api/v1/webhooks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch {
      alert(t('deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
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
      header: t('method'),
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
      header: t('events'),
      className: 'p-2 w-[110px] font-mono text-xs text-foreground-muted',
      render: (webhook: WebhookRow) => (
        <span title={webhook.events.join(', ')}>
          {tRoot('timeline.eventsCount', { count: webhook.events.length })}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: tRoot('deals.created'),
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
      header: tCommon('status'),
      className: 'p-2 w-[90px]',
      render: (webhook: WebhookRow) => (
        <Switch
          checked={webhook.active}
          disabled
          aria-label={t('switchLabel')}
          title={t('switchTitle')}
        />
      ),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      className: 'p-2 w-[100px]',
      render: (webhook: WebhookRow) => (
        <Button variant="outline" size="sm" onClick={() => handleDelete(webhook.id)}>
          {tCommon('delete')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-foreground-muted text-sm mt-1">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-56 text-xs"
          />
          <Button ref={quickBtnRef} size="sm" onClick={() => setQuickOpen(true)}>
            <Plus className="h-4 w-4" />
            {tRoot('quickCreate.webhook.submit')}
          </Button>
        </div>
        <QuickCreatePopover
          anchorEl={quickBtnRef.current}
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          title={t('newWebhook')}
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
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              action={
                <Button size="sm" onClick={() => setQuickOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {tRoot('quickCreate.webhook.submit')}
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
          emptyMessage={t('searchEmpty')}
        />
      )}

      {/* Доступні події */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('availableEvents')}</CardTitle>
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
