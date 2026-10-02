'use client';

import { Ellipsis, Plus, Power, Search, Trash2, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickRuleForm } from '@/components/quick-create';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Skeleton,
  Switch,
} from '@/components/ui';

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
  // Клієнтський пошук за ТЗ (виключно UI: фільтрує вже завантажений список,
  // жодних змін API/хуків/пагінації)
  const [search, setSearch] = useState('');

  // Quick-create popover
  const [quickOpen, setQuickOpen] = useState(false);
  const [rulePreset, setRulePreset] = useState<{
    name: string;
    triggerType: string;
    actionType: string;
  } | null>(null);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  const handleQuickCreated = () => {
    setQuickOpen(false);
    setRulePreset(null);
    fetchRules();
  };

  const openPreset = (preset: { name: string; trigger: string; action: string }) => {
    setRulePreset({ name: preset.name, triggerType: preset.trigger, actionType: preset.action });
    setQuickOpen(true);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automation/rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      // список просто останется пустым
    } finally {
      setLoading(false);
    }
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

  const query = search.trim().toLowerCase();
  const visibleRules = query
    ? rules.filter((rule) =>
        [
          rule.name,
          rule.description || '',
          triggerLabels[rule.triggerType] || rule.triggerType,
          actionLabels[rule.actionType] || rule.actionType,
        ].some((value) => value.toLowerCase().includes(query)),
      )
    : rules;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Автоматизація</h1>
          <p className="text-foreground-muted">Правила автоматичних дій при зміні етапів угод</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук правил..."
              aria-label="Пошук правил"
              className="pl-9"
            />
          </div>
          <Button
            ref={quickBtnRef}
            onClick={() => {
              setRulePreset(null);
              setQuickOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Нове правило
          </Button>
        </div>
        <QuickCreatePopover
          anchorEl={quickBtnRef.current}
          open={quickOpen}
          onClose={() => {
            setQuickOpen(false);
            setRulePreset(null);
          }}
          title="Нове правило"
        >
          <QuickRuleForm
            key={rulePreset ? rulePreset.name : 'blank'}
            initial={rulePreset || undefined}
            onCreated={handleQuickCreated}
          />
        </QuickCreatePopover>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={<Workflow className="h-12 w-12" strokeWidth={1.5} />}
              title="Немає правил автоматизації"
              description="Створіть перше правило для автоматичних дій"
            />
          </CardContent>
        </Card>
      ) : visibleRules.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={<Search className="h-12 w-12" strokeWidth={1.5} />}
              title="Нічого не знайдено"
              description={`За запитом «${search.trim()}» правил немає`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleRules.map((rule) => (
            <Card key={rule.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                    aria-label={rule.enabled ? 'Вимкнути правило' : 'Увімкнути правило'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{rule.name}</p>
                    {rule.description && (
                      <p className="text-xs text-foreground-muted mt-0.5">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary">
                        {triggerLabels[rule.triggerType] || rule.triggerType}
                      </Badge>
                      <span className="text-xs text-foreground-muted">→</span>
                      <Badge
                        variant="outline"
                        className="border-transparent bg-primary-light text-primary hover:bg-primary-light"
                      >
                        {actionLabels[rule.actionType] || rule.actionType}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-foreground-muted"
                        aria-label="Дії з правилом"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleRule(rule.id, rule.enabled)}>
                        <Power className="h-4 w-4" />
                        {rule.enabled ? 'Вимкнути' : 'Увімкнути'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteRule(rule.id)}
                        className="text-danger focus:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Видалити
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preset rules */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>Шаблони правил</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                name: 'Сповіщення при зміні етапу',
                trigger: 'stage_change',
                action: 'send_notification',
                desc: 'Надіслати Telegram/WhatsApp при переміщенні угоди',
              },
              {
                name: 'Задача після виграної угоди',
                trigger: 'deal_won',
                action: 'create_task',
                desc: 'Створити задачу "Підготувати договір" при виграній угоді',
              },
              {
                name: 'Автоматичне встановлення пріоритету',
                trigger: 'deal_created',
                action: 'set_field',
                desc: 'Встановити пріоритет "високий" для великих угод',
              },
              {
                name: 'Сповіщення при втраченій угоді',
                trigger: 'deal_lost',
                action: 'send_notification',
                desc: 'Повідомити команду про втрачену угоду',
              },
            ].map((preset) => (
              <Card
                key={preset.name}
                interactive
                onClick={() => openPreset(preset)}
                className="p-3"
              >
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-foreground-muted mt-1">{preset.desc}</p>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
