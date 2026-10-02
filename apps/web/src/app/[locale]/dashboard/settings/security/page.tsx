'use client';

import { MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
} from '@/components/ui';

// Демонстраційний список сесій (API сесій відсутнє)
type SessionRow = {
  id: string;
  device: string;
  ip: string;
  current: boolean;
  lastActive: string;
};

const INITIAL_SESSIONS: SessionRow[] = [
  {
    id: '1',
    device: 'Chrome · Windows 11',
    ip: '192.168.1.42',
    current: true,
    lastActive: 'Зараз',
  },
  { id: '2', device: 'Safari · iPhone', ip: '10.0.0.17', current: false, lastActive: '2 год тому' },
  { id: '3', device: 'Firefox · Ubuntu', ip: '172.16.8.4', current: false, lastActive: 'Вчора' },
];

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<SessionRow[]>(INITIAL_SESSIONS);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('Пароль оновлено');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Безпека</h1>
      </div>

      {success && (
        <div className="p-3 bg-success/10 text-success rounded-lg text-sm">{success}</div>
      )}
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Зміна пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-xs text-foreground-muted">
                Поточний пароль
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs text-foreground-muted">
                Новий пароль
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs text-foreground-muted">
                Підтвердження пароля
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Збереження...' : 'Змінити пароль'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Активні сесії</CardTitle>
          <CardDescription>Пристрої, з яких виконано вхід у ваш акаунт</CardDescription>
        </CardHeader>
        <CardContent>
          <Table<SessionRow>
            data={sessions}
            columns={[
              {
                key: 'device',
                header: 'Пристрій',
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4 text-foreground-muted" />
                    <span className="text-sm">{row.device}</span>
                  </div>
                ),
              },
              {
                key: 'ip',
                header: 'IP-адреса',
                render: (row) => (
                  <span className="font-mono text-xs text-foreground-muted">{row.ip}</span>
                ),
              },
              {
                key: 'lastActive',
                header: 'Активність',
                render: (row) => (
                  <span className="text-xs text-foreground-muted">{row.lastActive}</span>
                ),
              },
              {
                key: 'action',
                header: '',
                render: (row) =>
                  row.current ? (
                    <Badge variant="info">Поточна</Badge>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={() => revokeSession(row.id)}>
                      Завершити
                    </Button>
                  ),
              },
            ]}
            emptyMessage="Немає активних сесій"
          />
        </CardContent>
      </Card>
    </div>
  );
}
