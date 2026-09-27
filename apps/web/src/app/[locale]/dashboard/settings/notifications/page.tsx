'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-right';

export default function NotificationsSettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [telegramNotifications, setTelegramNotifications] = useState(false);
  const [taskReminders, setTaskReminders] = useState(true);
  const [dealUpdates, setDealUpdates] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [toastPosition, setToastPosition] = useState<ToastPosition>('bottom-left');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/notifications/preferences', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.toast?.enabled === 'boolean') setToastEnabled(d.toast.enabled);
        if (typeof d?.toast?.position === 'string') setToastPosition(d.toast.position);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotifications, telegramNotifications, taskReminders, dealUpdates }),
      });
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: toastEnabled, position: toastPosition }),
      });
      if (!res.ok) throw new Error('toast prefs failed');
      window.dispatchEvent(new Event('notif-prefs-changed'));
      setSuccess('Налаштування збережено');
    } catch {
      setSuccess('');
    }
    setSaving(false);
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Сповіщення</h1>
      </div>

      {success && <div className="p-3 bg-green-500/10 text-green-600 rounded-lg text-sm">{success}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Канали сповіщень</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Toggle checked={emailNotifications} onChange={setEmailNotifications} label="Email-сповіщення" />
          <Toggle checked={telegramNotifications} onChange={setTelegramNotifications} label="Telegram-сповіщення" />
          <Toggle checked={taskReminders} onChange={setTaskReminders} label="Нагадування про завдання" />
          <Toggle checked={dealUpdates} onChange={setDealUpdates} label="Оновлення угод" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Спливаючі сповіщення</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            checked={toastEnabled}
            onChange={setToastEnabled}
            label="Показувати сповіщення поверх вікон"
          />
          <div>
            <p className="text-sm mb-1.5">Позиція на екрані</p>
            <select
              value={toastPosition}
              onChange={(e) => setToastPosition(e.target.value as ToastPosition)}
              disabled={!toastEnabled}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="bottom-left">Зліва знизу</option>
              <option value="bottom-right">Справа знизу</option>
              <option value="top-right">Справа зверху</option>
            </select>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview(true);
                setTimeout(() => setShowPreview(false), 4000);
              }}
            >
              Показати приклад
            </Button>
            <p className="mt-2 text-xs text-foreground-muted">
              Приклад з'явиться там, де приходитимуть справжні сповіщення.
            </p>
          </div>
          <p className="text-xs text-foreground-muted">
            Вимкнення прибирає спливаючі вікна, але лічильник на дзвонику та сторінка сповіщень працюють як раніше.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Збереження...' : 'Зберегти'}
      </Button>

      {showPreview && (
        <div
          className={cn(
            'fixed z-[100] w-[320px] max-w-[calc(100vw-2rem)]',
            toastPosition === 'bottom-left' && 'left-4 bottom-4',
            toastPosition === 'bottom-right' && 'right-4 bottom-4',
            toastPosition === 'top-right' && 'right-4 top-4'
          )}
          aria-live="polite"
        >
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xl">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111214]">
                <Bell className="h-4 w-4 text-[#FFC700]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Автоматизація</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Так виглядатиме сповіщення. Натисни — відкриється пов'язана сторінка.
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-foreground-muted hover:text-foreground"
                aria-label="Закрити"
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
