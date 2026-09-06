/**
 * Webhooks Management — управление вебхуками
 * 
 * Показывает:
 * - Список зарегистрированных вебхуков
 * - Создание нового вебхука
 * - Доступные события
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge, Input } from '@/components/ui';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
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
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);

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
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newUrl || selectedEvents.length === 0) return;
    
    setCreating(true);
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, events: selectedEvents }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setShowSecret(data.data.secret);
        setNewUrl('');
        setSelectedEvents([]);
        setShowCreate(false);
        fetchWebhooks();
      }
    } catch {} finally {
      setCreating(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
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
          <p className="text-foreground-muted text-sm mt-1">
            Інтеграції з зовнішніми сервісами
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Створити вебхук
        </Button>
      </div>

      {/* Створення нового вебхука */}
      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Новий вебхук</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <Input
                  placeholder="https://example.com/webhook"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Події</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {events.map((evt) => (
                    <button
                      key={evt.event}
                      onClick={() => toggleEvent(evt.event)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-all',
                        selectedEvents.includes(evt.event)
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-border-hover'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center',
                        selectedEvents.includes(evt.event) ? 'border-primary bg-primary' : 'border-border'
                      )}>
                        {selectedEvents.includes(evt.event) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="truncate">{evt.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating || !newUrl || selectedEvents.length === 0}>
                  {creating ? 'Створення...' : 'Створити'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Скасувати
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Секрет показано */}
      {showSecret && (
        <Card className="border-success">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-success mb-1">Вебхук створено!</h3>
                <p className="text-sm text-foreground-muted mb-2">
                  Збережіть секрет — він більше не буде показаний:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-secondary rounded text-sm font-mono break-all">
                    {showSecret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(showSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <button onClick={() => setShowSecret(null)}>
                <XCircle className="h-5 w-5 text-foreground-muted" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Список вебхуків */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="h-12 w-12 mx-auto text-foreground-muted mb-4" />
            <h3 className="text-lg font-semibold mb-1">Вебхуків поки немає</h3>
            <p className="text-sm text-foreground-muted mb-4">
              Створіть вебхук для інтеграції з зовнішніми сервісами
            </p>
            <Button onClick={() => setShowCreate(true)}>
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
                    <div className={cn(
                      'p-2 rounded-xl',
                      webhook.active ? 'bg-success/10' : 'bg-secondary'
                    )}>
                      <Webhook className={cn(
                        'h-5 w-5',
                        webhook.active ? 'text-success' : 'text-foreground-muted'
                      )} />
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
              <div key={evt.event} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
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
