/**
 * Webhooks Management — управление вебхуками
 *
 * Показывает:
 * - Список зарегистрированных вебхуков
 * - Создание нового вебхука
 * - Доступные события
 */

'use client';

import { Webhook, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { QuickCreatePopover, QuickWebhookForm } from '@/components/quick-create';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface WebhookEvent {
  event: string;
  description: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Вебхуки</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Вебхуки</h1>
          <p className="text-foreground-muted text-sm mt-1">Інтеграції з зовнішніми сервісами</p>
        </div>
        <Button ref={quickBtnRef} onClick={() => setQuickOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Створити вебхук
        </Button>
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
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="h-12 w-12 mx-auto text-foreground-muted mb-4" />
            <h3 className="text-lg font-semibold mb-1">Вебхуків поки немає</h3>
            <p className="text-sm text-foreground-muted mb-4">
              Створіть вебхук для інтеграції з зовнішніми сервісами
            </p>
            <Button onClick={() => setQuickOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Створити вебхук
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-xl',
                        webhook.active ? 'bg-success/10' : 'bg-secondary',
                      )}
                    >
                      <Webhook
                        className={cn(
                          'h-5 w-5',
                          webhook.active ? 'text-success' : 'text-foreground-muted',
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm truncate max-w-md">{webhook.url}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={webhook.active ? 'success' : 'secondary'}>
                          {webhook.active ? 'Активний' : 'Неактивний'}
                        </Badge>
                        <span className="text-xs text-foreground-muted">
                          {webhook.events.length} подій
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Доступні події */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Доступні події</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {events.map((evt) => (
              <div
                key={evt.event}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50"
              >
                <code className="text-xs font-mono text-primary">{evt.event}</code>
                <span className="text-sm text-foreground-muted">—</span>
                <span className="text-sm">{evt.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
