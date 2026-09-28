'use client';

/**
 * Quick-create: короткие формы создания возле кнопки (popover, а не отдельная страница).
 * Панель позиционируется якорем у кнопки: scale + fade, лёгкий blur-backdrop,
 * закрытие по Esc / клику мимо / скроллу с пересчётом позиции.
 */

import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button, Input } from '@/components/ui';

// ================= Popover =================

interface QuickCreatePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function QuickCreatePopover({
  anchorEl,
  open,
  onClose,
  title,
  children,
  width = 360,
}: QuickCreatePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top right' });
  const [shown, setShown] = useState(false);

  const updatePos = () => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const h = panelRef.current?.offsetHeight || 320;
    const w = Math.min(width, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    let origin = 'top right';
    if (top + h > window.innerHeight - 8 && r.top - 8 - h > 8) {
      top = r.top - 8 - h;
      origin = 'bottom right';
    }
    setPos({ top: Math.max(8, top), left, origin });
  };

  useLayoutEffect(() => {
    if (open) {
      updatePos();
      const t = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(t);
    }
    setShown(false);
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, anchorEl, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-opacity duration-150 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{
          top: pos.top,
          left: pos.left,
          width: Math.min(width, window.innerWidth - 16),
          transformOrigin: pos.origin,
        }}
        className={`absolute rounded-2xl border border-border bg-card shadow-2xl transition-all duration-150 ${
          shown ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground-muted hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Закрити"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ================= Shared bits =================

const selectCls =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-2.5 bg-destructive/10 text-destructive rounded-lg text-sm">{message}</div>
  );
}

interface QuickFormProps {
  onCreated: () => void;
}

function useQuickSubmit(
  url: string,
  buildBody: () => Record<string, unknown>,
  onCreated: () => void,
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Помилка створення');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка створення');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, submit };
}

// ================= Contact =================

export function QuickContactForm({ onCreated }: QuickFormProps) {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/contacts',
    () => ({ firstName, phone: phone || null, company: company || null }),
    onCreated,
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
        placeholder="Ім'я *"
        autoFocus
      />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
      <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Компанія" />
      <Button type="submit" disabled={saving || !firstName.trim()} className="w-full">
        {saving ? 'Створення...' : 'Додати контакт'}
      </Button>
    </form>
  );
}

// ================= Deal =================

interface PipelineOpt {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

export function QuickDealForm({ onCreated }: QuickFormProps) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [stagesError, setStagesError] = useState(false);
  const { saving, error, submit } = useQuickSubmit(
    '/api/deals',
    () => ({
      title,
      value: value ? parseFloat(value) : undefined,
      pipelineId,
      stageId,
    }),
    onCreated,
  );

  const loadPipelines = () => {
    setStagesError(false);
    fetch('/api/pipelines')
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const list: PipelineOpt[] = d.pipelines || [];
        setPipelines(list);
        if (list.length > 0) {
          setPipelineId(list[0].id);
          setStageId(list[0].stages?.[0]?.id || '');
        } else {
          setStagesError(true);
        }
      })
      .catch(() => {
        // П3.3: без етапів кнопка мовчки неактивна — показуємо причину + повтор.
        setStagesError(true);
      });
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  const selected = pipelines.find((p) => p.id === pipelineId);

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Назва угоди *"
        autoFocus
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Сума, грн"
        inputMode="decimal"
      />
      {stagesError ? (
        <div className="p-2.5 bg-destructive/10 rounded-lg text-sm space-y-2">
          <p className="text-destructive">Не вдалося завантажити етапи воронки</p>
          <button
            type="button"
            onClick={loadPipelines}
            className="font-medium text-primary hover:underline"
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          {pipelines.length > 1 && (
            <select
              value={pipelineId}
              onChange={(e) => {
                const p = pipelines.find((x) => x.id === e.target.value);
                setPipelineId(e.target.value);
                setStageId(p?.stages?.[0]?.id || '');
              }}
              className={selectCls}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {selected && selected.stages?.length > 0 && (
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className={selectCls}
            >
              {selected.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      {selected && selected.stages?.length > 0 && (
        <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={selectCls}>
          {selected.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <Button type="submit" disabled={saving || !title.trim() || !stageId} className="w-full">
        {saving ? 'Створення...' : 'Створити угоду'}
      </Button>
    </form>
  );
}

// ================= Task =================

const taskPriorities = [
  { id: 'low', name: 'Низький' },
  { id: 'medium', name: 'Середній' },
  { id: 'high', name: 'Високий' },
  { id: 'urgent', name: 'Терміново' },
];

export function QuickTaskForm({ onCreated }: QuickFormProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const { saving, error, submit } = useQuickSubmit(
    '/api/tasks',
    () => ({ title, priority }),
    onCreated,
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Назва задачі *"
        autoFocus
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
        {taskPriorities.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={saving || !title.trim()} className="w-full">
        {saving ? 'Створення...' : 'Створити задачу'}
      </Button>
    </form>
  );
}

// ================= Tenant =================

export function QuickTenantForm({ onCreated }: QuickFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const { saving, error, submit } = useQuickSubmit(
    '/api/tenants',
    () => ({ name, slug, domain: null }),
    onCreated,
  );
  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9а-яіїєґ]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={name}
        onChange={(e) => onName(e.target.value)}
        required
        minLength={2}
        maxLength={100}
        placeholder="Назва компанії *"
        autoFocus
      />
      <Input
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSlugTouched(true);
        }}
        required
        minLength={2}
        maxLength={50}
        pattern="^[a-z0-9-]+$"
        placeholder="slug-компанії *"
      />
      <Button type="submit" disabled={saving || !name.trim() || !slug.trim()} className="w-full">
        {saving ? 'Створення...' : 'Створити компанію'}
      </Button>
    </form>
  );
}

// ================= Automation rule =================

const ruleTriggers = [
  { id: 'stage_change', name: 'Зміна етапу' },
  { id: 'deal_created', name: 'Створення угоди' },
  { id: 'deal_won', name: 'Угода виграна' },
  { id: 'deal_lost', name: 'Угода втрачена' },
  { id: 'timer', name: 'Таймер' },
];

const ruleActions = [
  { id: 'set_field', name: 'Встановити поле' },
  { id: 'create_task', name: 'Створити задачу' },
  { id: 'send_notification', name: 'Надіслати сповіщення' },
  { id: 'move_deal', name: 'Перемістити угоду' },
  { id: 'send_message', name: 'Надіслати повідомлення' },
];

export function QuickRuleForm({
  onCreated,
  initial,
}: QuickFormProps & {
  initial?: { name: string; triggerType: string; actionType: string };
}) {
  const [name, setName] = useState(initial?.name || '');
  const [triggerType, setTriggerType] = useState(initial?.triggerType || 'stage_change');
  const [actionType, setActionType] = useState(initial?.actionType || 'send_notification');
  const { saving, error, submit } = useQuickSubmit(
    '/api/automation/rules',
    () => ({ name, triggerType, actionType, actionConfig: {} }),
    onCreated,
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Назва правила *"
        autoFocus
      />
      <select
        value={triggerType}
        onChange={(e) => setTriggerType(e.target.value)}
        className={selectCls}
      >
        {ruleTriggers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        className={selectCls}
      >
        {ruleActions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? 'Створення...' : 'Створити правило'}
      </Button>
    </form>
  );
}

// ================= Webhook =================

export function QuickWebhookForm({ onCreated }: QuickFormProps) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Array<{ event: string; description: string }>>([]);
  const [eventsError, setEventsError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/webhooks')
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then((d) => setEvents(d.data?.availableEvents || []))
      .catch(() => {
        // Без списку подій обрати нічого — показуємо причину.
        setEventsError(true);
      });
  }, []);

  const toggle = (ev: string) =>
    setSelected((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка створення');
      if (data.data?.secret) {
        setSecret(data.data.secret);
      } else {
        onCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка створення');
    } finally {
      setSaving(false);
    }
  };

  if (secret) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground-muted">
          Збережіть секрет — він показується лише один раз:
        </p>
        <code className="block p-2.5 bg-secondary rounded-lg text-xs font-mono break-all">
          {secret}
        </code>
        <Button
          className="w-full"
          onClick={() => {
            navigator.clipboard?.writeText(secret).catch(() => {});
            onCreated();
          }}
        >
          Скопіювати та закрити
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        placeholder="https://... *"
        autoFocus
      />
      {eventsError && (
        <p className="text-xs text-destructive">
          Не вдалося завантажити список подій — вебхук не створити
        </p>
      )}
      {events.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {events.map((ev) => (
            <label key={ev.event} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(ev.event)}
                onChange={() => toggle(ev.event)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="font-mono text-xs">{ev.event}</span>
            </label>
          ))}
        </div>
      )}
      <Button
        type="submit"
        disabled={saving || !url.trim() || selected.length === 0}
        className="w-full"
      >
        {saving ? 'Створення...' : 'Створити вебхук'}
      </Button>
    </form>
  );
}

// ================= Pipeline =================

export function QuickPipelineForm({ onCreated }: QuickFormProps) {
  const [name, setName] = useState('');
  const [firstStage, setFirstStage] = useState('Новий');
  const { saving, error, submit } = useQuickSubmit(
    '/api/pipelines',
    () => ({ name, stages: [{ name: firstStage || 'Новий' }] }),
    onCreated,
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Назва воронки *"
        autoFocus
      />
      <Input
        value={firstStage}
        onChange={(e) => setFirstStage(e.target.value)}
        placeholder="Перший етап"
      />
      <p className="text-xs text-foreground-muted">Інші етапи можна додати на сторінці воронки.</p>
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? 'Створення...' : 'Створити воронку'}
      </Button>
    </form>
  );
}
