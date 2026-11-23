'use client';

import { Ellipsis, Plus, Power, Search, Trash2, Workflow } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

export default function AutomationPage() {
  const t = useTranslations('automation');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
  const triggerLabels: Record<string, string> = {
    stage_change: tRoot('quickCreate.triggers.stage_change'),
    deal_created: tRoot('quickCreate.triggers.deal_created'),
    deal_won: tRoot('quickCreate.triggers.deal_won'),
    deal_lost: tRoot('quickCreate.triggers.deal_lost'),
    timer: tRoot('quickCreate.triggers.timer'),
  };

  const actionLabels: Record<string, string> = {
    set_field: tRoot('quickCreate.ruleActions.set_field'),
    create_task: tRoot('quickCreate.ruleActions.create_task'),
    send_notification: tRoot('quickCreate.ruleActions.send_notification'),
    move_deal: tRoot('quickCreate.ruleActions.move_deal'),
    send_message: tRoot('quickCreate.ruleActions.send_message'),
  };

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
    if (!confirm(t('confirmDelete'))) return;
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
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-foreground-muted">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchLabel')}
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
            {t('newRule')}
          </Button>
        </div>
        <QuickCreatePopover
          anchorEl={quickBtnRef.current}
          open={quickOpen}
          onClose={() => {
            setQuickOpen(false);
            setRulePreset(null);
          }}
          title={t('newRule')}
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
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          </CardContent>
        </Card>
      ) : visibleRules.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={<Search className="h-12 w-12" strokeWidth={1.5} />}
              title={t('notFoundTitle')}
              description={t('notFoundDescription', { query: search.trim() })}
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
                    aria-label={rule.enabled ? t('disableRule') : t('enableRule')}
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
                        aria-label={t('ruleActionsLabel')}
                      >
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleRule(rule.id, rule.enabled)}>
                        <Power className="h-4 w-4" />
                        {rule.enabled ? tRoot('settings.disableButton') : t('enable')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteRule(rule.id)}
                        className="text-danger focus:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        {tCommon('delete')}
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
          <CardTitle>{t('presets')}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                name: t('examples.stageChangeNotify.name'),
                trigger: 'stage_change',
                action: 'send_notification',
                desc: t('examples.stageChangeNotify.desc'),
              },
              {
                name: t('examples.wonDealTask.name'),
                trigger: 'deal_won',
                action: 'create_task',
                desc: t('examples.wonDealTask.desc'),
              },
              {
                name: t('examples.autoPriority.name'),
                trigger: 'deal_created',
                action: 'set_field',
                desc: t('examples.autoPriority.desc'),
              },
              {
                name: t('examples.lostDealNotify.name'),
                trigger: 'deal_lost',
                action: 'send_notification',
                desc: t('examples.lostDealNotify.desc'),
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
