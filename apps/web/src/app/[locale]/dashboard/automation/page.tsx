'use client';

import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  fromStageId: string | null;
  toStageId: string | null;
  actionType: string;
  actionConfig: string;
  createdAt: string;
}

const triggerLabels: Record<string, string> = {
  stage_change: 'Зміна етапу',
  deal_created: 'Створення угоди',
  deal_won: 'Угода виграна',
  deal_lost: 'Угода втрачена',
  timer: 'Таймер',
};

const actionLabels: Record<string, string> = {
  set_field: 'Встановити поле',
  create_task: 'Створити задачу',
  send_notification: 'Надіслати сповіщення',
  move_deal: 'Перемістити угоду',
  send_message: 'Надіслати повідомлення',
};

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'stage_change',
    actionType: 'send_notification',
    actionConfig: '{}',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automation/rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch {} finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          triggerType: formData.triggerType,
          actionType: formData.actionType,
          actionConfig: JSON.parse(formData.actionConfig || '{}'),
        }),
      });
      setShowForm(false);
      setFormData({ name: '', description: '', triggerType: 'stage_change', actionType: 'send_notification', actionConfig: '{}' });
      fetchRules();
    } catch {} finally { setSaving(false); }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    await fetch('/api/automation/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, enabled: !enabled }),
    });
    fetchRules();
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Видалити правило?')) return;
    await fetch(`/api/automation/rules?ruleId=${ruleId}`, { method: 'DELETE' });
    fetchRules();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Автоматизація</h1>
          <p className="text-foreground-muted">Правила автоматичних дій при зміні етапів угод</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Скасувати' : '+ Нове правило'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">Нове правило автоматизації</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Назва</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Опис</label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Тригер</label>
                  <select value={formData.triggerType} onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="stage_change">Зміна етапу</option>
                    <option value="deal_created">Створення угоди</option>
                    <option value="deal_won">Угода виграна</option>
                    <option value="deal_lost">Угода втрачена</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дія</label>
                  <select value={formData.actionType} onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="send_notification">Надіслати сповіщення</option>
                    <option value="create_task">Створити задачу</option>
                    <option value="set_field">Встановити поле</option>
                    <option value="move_deal">Перемістити угоду</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Конфігурація дії (JSON)</label>
                <textarea value={formData.actionConfig} onChange={(e) => setFormData({ ...formData, actionConfig: e.target.value })}
                  className="h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Створення...' : 'Створити правило'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="h-12 w-12 mx-auto text-foreground-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <p className="text-foreground-muted mb-2">Немає правил автоматизації</p>
            <p className="text-sm text-foreground-muted">Створіть перше правило для автоматичних дій</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleRule(rule.id, rule.enabled)}
                    className={cn('h-5 w-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                      rule.enabled ? 'bg-success border-success' : 'border-border hover:border-primary')}>
                    {rule.enabled && <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{rule.name}</p>
                    {rule.description && <p className="text-xs text-foreground-muted mt-0.5">{rule.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">{triggerLabels[rule.triggerType] || rule.triggerType}</span>
                      <span className="text-xs text-foreground-muted">→</span>
                      <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded">{actionLabels[rule.actionType] || rule.actionType}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteRule(rule.id)}
                    className="rounded p-1.5 text-foreground-muted hover:text-danger hover:bg-danger-light transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preset rules */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-3">Шаблони правил</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'Сповіщення при зміні етапу', trigger: 'stage_change', action: 'send_notification', desc: 'Надіслати Telegram/WhatsApp при переміщенні угоди' },
              { name: 'Задача після виграної угоди', trigger: 'deal_won', action: 'create_task', desc: 'Створити задачу "Підготувати договір" при виграній угоді' },
              { name: 'Автоматичне встановлення пріоритету', trigger: 'deal_created', action: 'set_field', desc: 'Встановити пріоритет "високий" для великих угод' },
              { name: 'Сповіщення при втраченій угоді', trigger: 'deal_lost', action: 'send_notification', desc: 'Повідомити команду про втрачену угоду' },
            ].map((preset) => (
              <button key={preset.name} onClick={() => {
                setFormData({ ...formData, name: preset.name, triggerType: preset.trigger, actionType: preset.action });
                setShowForm(true);
              }} className="p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 text-left transition-colors">
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-foreground-muted mt-1">{preset.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
