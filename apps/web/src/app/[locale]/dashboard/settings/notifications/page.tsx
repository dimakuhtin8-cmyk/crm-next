'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export default function NotificationsSettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [telegramNotifications, setTelegramNotifications] = useState(false);
  const [taskReminders, setTaskReminders] = useState(true);
  const [dealUpdates, setDealUpdates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotifications, telegramNotifications, taskReminders, dealUpdates }),
      });
      setSuccess('Налаштування збережено');
    } catch { /* */ }
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

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Збереження...' : 'Зберегти'}
      </Button>
    </div>
  );
}
