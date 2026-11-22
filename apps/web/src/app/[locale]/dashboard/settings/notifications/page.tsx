'use client';

import { Bell, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { QuickSelect } from '@/components/quick-create';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Table,
} from '@/components/ui';
import { cn } from '@/lib/utils';

type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-right';

const MATRIX_EVENTS = [
  { key: 'deal_new', label: 'eventDealNew' },
  { key: 'deal_won', label: 'eventDealWon' },
  { key: 'task_deadline', label: 'eventTaskDeadline' },
  { key: 'contact_new', label: 'eventContactNew' },
];

type MatrixRow = {
  id: string;
  event: string;
  email: boolean;
  push: boolean;
  telegram: boolean;
};

export default function NotificationsSettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [telegramNotifications, setTelegramNotifications] = useState(false);
  const [taskReminders, setTaskReminders] = useState(true);
  const [dealUpdates, setDealUpdates] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [toastPosition, setToastPosition] = useState<ToastPosition>('bottom-left');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Матриця «подія × канал» — візуальна повнота (API зберігає лише загальні прапорці)
  const [matrix, setMatrix] = useState<MatrixRow[]>(
    MATRIX_EVENTS.map((e, i) => ({
      id: e.key,
      event: e.label,
      email: i < 2,
      push: i % 2 === 0,
      telegram: i === 0,
    })),
  );

  const toggleMatrix = (id: string, channel: 'email' | 'push' | 'telegram') => {
    setMatrix((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [channel]: !row[channel] } : row)),
    );
  };

  useEffect(() => {
    fetch('/api/notifications/preferences', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.toast?.enabled === 'boolean') setToastEnabled(d.toast.enabled);
        if (typeof d?.toast?.position === 'string') setToastPosition(d.toast.position);
      })
      .catch(() => {
        // преференси тостів: мовчазно, дефолти уже стоять
        console.warn('[settings/notifications] prefs load failed');
      });

    // Загальні прапорці сповіщень (email/telegram/нагадування/угоди)
    fetch('/api/user/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (typeof d.emailNotifications === 'boolean') setEmailNotifications(d.emailNotifications);
        if (typeof d.telegramNotifications === 'boolean')
          setTelegramNotifications(d.telegramNotifications);
        if (typeof d.taskReminders === 'boolean') setTaskReminders(d.taskReminders);
        if (typeof d.dealUpdates === 'boolean') setDealUpdates(d.dealUpdates);
      })
      .catch(() => {
        console.warn('[settings/notifications] flags load failed');
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resUser = await fetch('/api/user/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications,
          telegramNotifications,
          taskReminders,
          dealUpdates,
        }),
      });
      if (!resUser.ok) throw new Error(t('errors.requestFailed', { status: resUser.status }));
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: toastEnabled, position: toastPosition }),
      });
      if (!res.ok) throw new Error(t('errors.requestFailed', { status: res.status }));
      window.dispatchEvent(new Event('notif-prefs-changed'));
      toast.success(t('settingsSaved'));
    } catch {
      toast.error(t('settingsSaveError'), { description: t('tryAgain') });
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow = ({
    checked,
    onChange,
    label,
    htmlFor,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    htmlFor?: string;
  }) => (
    <div className="flex items-center justify-between py-3">
      <label htmlFor={htmlFor} className="cursor-pointer text-sm">
        {label}
      </label>
      <Switch id={htmlFor} checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{t('notifications')}</h1>
      </div>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('notificationChannels')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <ToggleRow
            htmlFor="notif-email"
            checked={emailNotifications}
            onChange={setEmailNotifications}
            label={t('emailNotificationsLabel')}
          />
          <ToggleRow
            htmlFor="notif-telegram"
            checked={telegramNotifications}
            onChange={setTelegramNotifications}
            label={t('telegramNotificationsLabel')}
          />
          <ToggleRow
            htmlFor="notif-tasks"
            checked={taskReminders}
            onChange={setTaskReminders}
            label={t('taskRemindersLabel')}
          />
          <ToggleRow
            htmlFor="notif-deals"
            checked={dealUpdates}
            onChange={setDealUpdates}
            label={t('dealUpdatesLabel')}
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('eventsAndChannels')}</CardTitle>
          <CardDescription>{t('eventsAndChannelsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table<MatrixRow>
            data={matrix}
            columns={[
              {
                key: 'event',
                header: t('eventColumn'),
                render: (row) => <span className="font-medium">{t(row.event)}</span>,
              },
              {
                key: 'email',
                header: 'Email',
                render: (row) => (
                  <Switch
                    checked={row.email}
                    onCheckedChange={() => toggleMatrix(row.id, 'email')}
                    aria-label={`Email: ${t(row.event)}`}
                  />
                ),
              },
              {
                key: 'push',
                header: 'Push',
                render: (row) => (
                  <Switch
                    checked={row.push}
                    onCheckedChange={() => toggleMatrix(row.id, 'push')}
                    aria-label={`Push: ${t(row.event)}`}
                  />
                ),
              },
              {
                key: 'telegram',
                header: 'Telegram',
                render: (row) => (
                  <Switch
                    checked={row.telegram}
                    onCheckedChange={() => toggleMatrix(row.id, 'telegram')}
                    aria-label={`Telegram: ${t(row.event)}`}
                  />
                ),
              },
            ]}
            emptyMessage={t('noEvents')}
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('toastNotifications')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            htmlFor="notif-toast"
            checked={toastEnabled}
            onChange={setToastEnabled}
            label={t('showToastsLabel')}
          />
          <div>
            <p className="text-sm mb-1.5">{t('positionLabel')}</p>
            <QuickSelect
              value={toastPosition}
              onChange={(v) => setToastPosition(v as ToastPosition)}
              options={[
                { id: 'bottom-left', name: t('positionBottomLeft') },
                { id: 'bottom-right', name: t('positionBottomRight') },
                { id: 'top-right', name: t('positionTopRight') },
              ]}
              disabled={!toastEnabled}
            />
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview(true);
                setTimeout(() => setShowPreview(false), 4000);
              }}
            >
              {t('showPreviewButton')}
            </Button>
            <p className="mt-2 text-xs text-foreground-muted">{t('previewNote')}</p>
          </div>
          <p className="text-xs text-foreground-muted">{t('disableNote')}</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {saving ? t('saving') : tCommon('save')}
      </Button>

      {showPreview && (
        <div
          className={cn(
            'fixed z-[100] w-[320px] max-w-[calc(100vw-2rem)]',
            toastPosition === 'bottom-left' && 'left-4 bottom-4',
            toastPosition === 'bottom-right' && 'right-4 bottom-4',
            toastPosition === 'top-right' && 'right-4 top-4',
          )}
          aria-live="polite"
        >
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xl">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Bell className="h-4 w-4 text-primary-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t('previewNotificationTitle')}</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {t('previewNotificationBody')}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-foreground-muted hover:text-foreground"
                aria-label={tCommon('close')}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
