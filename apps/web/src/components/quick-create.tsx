'use client';

/**
 * Quick-create: короткие формы создания по центру экрана (модалка, не отдельная страница).
 * Появление плавное: fade + scale. Закрытие по Esc / клику мимо.
 * В каждой форме — только нужное + раскрывашка «Доповнення» для деталей.
 */

import { Check, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button, Input } from '@/components/ui';

// ================= Centered modal =================

interface QuickCreatePopoverProps {
  /** Оставлен для совместимости вызовов, позиционирование больше не якорное. */
  anchorEl?: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function QuickCreatePopover({
  open,
  onClose,
  title,
  children,
  width = 400,
}: QuickCreatePopoverProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(t);
    }
    setShown(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={title}
        style={{ maxWidth: width }}
        className="relative w-full rounded-3xl border border-border bg-card shadow-2xl transition-all duration-200 ease-out data-[shown=true]:opacity-100 data-[shown=true]:scale-100 data-[shown=true]:translate-y-0 data-[shown=false]:opacity-0 data-[shown=false]:scale-95 data-[shown=false]:translate-y-3"
        data-shown={shown}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
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
        <div className="thin-scroll max-h-[70vh] overflow-y-auto overflow-x-clip rounded-b-3xl p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ================= Pill select =================

export interface QuickOption {
  id: string;
  name: string;
}

interface QuickSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: QuickOption[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

/** Кастомный селект-пилюля: плавное появление, форма кнопки, без нативного прямоугольника.
 * Список рендерится в портал (поверх скрола модалки, не обрезается). */
export function QuickSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  label,
}: QuickSelectProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    up: boolean;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const estH = Math.min(options.length * 40 + 12, 224);
    const up = window.innerHeight - r.bottom < estH + 16 && r.top > estH + 16;
    setCoords({
      top: up ? r.top - 8 - estH : r.bottom + 8,
      left: r.left,
      width: r.width,
      up,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Клик по кнопке обрабатывает toggle, остальное вне списка — закрыть
      const el = document.querySelector('[data-qc-list]');
      if (el && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const current = options.find((o) => o.id === value);

  return (
    <div>
      {label && (
        <span className="mb-1 block text-xs font-medium text-foreground-muted">{label}</span>
      )}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-4 text-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={current ? 'truncate' : 'truncate text-foreground-muted'}>
          {current?.name || placeholder || 'Обрати'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-qc-list
            role="listbox"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className={`fixed z-[60] animate-fade-in-scale overflow-hidden rounded-2xl border border-border bg-card shadow-xl ${
              coords.up ? 'origin-bottom' : 'origin-top'
            }`}
          >
            <div className="thin-scroll max-h-56 overflow-y-auto p-1.5">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => {
                    onChange(o.id);
                    close();
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    o.id === value ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-secondary'
                  }`}
                >
                  <span className="truncate">{o.name}</span>
                  {o.id === value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ================= Extras ("Доповнення") =================

/** Раскрывашка деталей внизу формы: плавное расширение, без прыжков. */
export function Extras({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
      >
        Доповнення
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ================= Shared bits =================

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

const textareaCls =
  'w-full min-h-[72px] rounded-2xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring resize-y';

// ================= Contact =================

const contactStatuses = [
  { id: 'lead', name: 'Лід' },
  { id: 'active', name: 'Активний' },
  { id: 'client', name: 'Клієнт' },
  { id: 'inactive', name: 'Неактивний' },
];

export function QuickContactForm({ onCreated }: QuickFormProps) {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState('lead');
  const [notes, setNotes] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/contacts',
    () => ({
      firstName,
      phone: phone || null,
      company: company || null,
      email: email || null,
      position: position || null,
      status,
      notes: notes || null,
    }),
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
      <Extras>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <Input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Посада"
        />
        <QuickSelect value={status} onChange={setStatus} options={contactStatuses} label="Статус" />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Нотатки"
          className={textareaCls}
        />
      </Extras>
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
  const [company, setCompany] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/deals',
    () => ({
      title,
      value: value ? parseFloat(value) : undefined,
      pipelineId,
      stageId,
      company: company || null,
      expectedCloseDate: closeDate || null,
      notes: notes || null,
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
        // Без етапів кнопка мовчки неактивна — показуємо причину + повтор.
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
            <QuickSelect
              value={pipelineId}
              onChange={(id) => {
                const p = pipelines.find((x) => x.id === id);
                setPipelineId(id);
                setStageId(p?.stages?.[0]?.id || '');
              }}
              options={pipelines.map((p) => ({ id: p.id, name: p.name }))}
              label="Воронка"
            />
          )}
          {selected && selected.stages?.length > 0 && (
            <QuickSelect
              value={stageId}
              onChange={setStageId}
              options={selected.stages.map((s) => ({ id: s.id, name: s.name }))}
              label="Етап"
            />
          )}
        </>
      )}
      <Extras>
        <Input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Компанія клієнта"
        />
        <Input
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          aria-label="Очікувана дата закриття"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Нотатки"
          className={textareaCls}
        />
      </Extras>
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

const taskTypes = [
  { id: 'task', name: 'Задача' },
  { id: 'call', name: 'Дзвінок' },
  { id: 'email', name: 'Лист' },
  { id: 'meeting', name: 'Зустріч' },
  { id: 'follow_up', name: 'Нагадування' },
];

export function QuickTaskForm({ onCreated }: QuickFormProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [type, setType] = useState('task');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/tasks',
    () => ({
      title,
      priority,
      type,
      dueDate: dueDate || null,
      description: description || null,
    }),
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
      <QuickSelect
        value={priority}
        onChange={setPriority}
        options={taskPriorities}
        label="Пріоритет"
      />
      <Extras>
        <QuickSelect value={type} onChange={setType} options={taskTypes} label="Тип" />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Дедлайн"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Опис"
          className={textareaCls}
        />
      </Extras>
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
  const [domain, setDomain] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/tenants',
    () => ({ name, slug, domain: domain || null }),
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
      <Extras>
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Домен (необовʼязково)"
          inputMode="url"
        />
      </Extras>
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
  const [description, setDescription] = useState('');
  const { saving, error, submit } = useQuickSubmit(
    '/api/automation/rules',
    () => ({
      name,
      triggerType,
      actionType,
      actionConfig: {},
      description: description || undefined,
    }),
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
      <QuickSelect
        value={triggerType}
        onChange={setTriggerType}
        options={ruleTriggers}
        label="Тригер"
      />
      <QuickSelect value={actionType} onChange={setActionType} options={ruleActions} label="Дія" />
      <Extras>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Опис правила (необовʼязково)"
          className={textareaCls}
        />
      </Extras>
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
  const [stages, setStages] = useState<string[]>(['Новий']);
  const { saving, error, submit } = useQuickSubmit(
    '/api/pipelines',
    () => ({ name, stages: stages.filter((s) => s.trim()).map((s) => ({ name: s.trim() })) }),
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
        value={stages[0] || ''}
        onChange={(e) =>
          setStages((prev) => {
            const next = [...prev];
            next[0] = e.target.value;
            return next;
          })
        }
        placeholder="Перший етап"
      />
      <Extras>
        {stages.slice(1).map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={s}
              onChange={(e) =>
                setStages((prev) => {
                  const next = [...prev];
                  next[i + 1] = e.target.value;
                  return next;
                })
              }
              placeholder={`Етап ${i + 2}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setStages((prev) => prev.filter((_, idx) => idx !== i + 1))}
              aria-label="Видалити етап"
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setStages((prev) => [...prev, ''])}>
          + Додати етап
        </Button>
      </Extras>
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? 'Створення...' : 'Створити воронку'}
      </Button>
    </form>
  );
}
