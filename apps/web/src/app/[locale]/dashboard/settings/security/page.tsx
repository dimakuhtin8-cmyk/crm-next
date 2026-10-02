'use client';

import { Loader2, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  SecretInput,
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

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

/** Оцінка міцності пароля: 0–4 бали за довжину, регістр, цифри, символи */
function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const label =
    score <= 1 ? 'Слабкий' : score === 2 ? 'Середній' : score === 3 ? 'Міцний' : 'Надійний';
  return { score, label };
}

const STRENGTH_COLORS: Record<number, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-info',
  4: 'bg-success',
};

const STRENGTH_TEXT: Record<number, string> = {
  0: 'text-danger',
  1: 'text-danger',
  2: 'text-warning',
  3: 'text-info',
  4: 'text-success',
};

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sessions, setSessions] = useState<SessionRow[]>(INITIAL_SESSIONS);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const strength = passwordStrength(newPassword);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!currentPassword) next.currentPassword = 'Введіть поточний пароль';
    if (newPassword.length < 8) next.newPassword = 'Новий пароль — щонайменше 8 символів';
    else if (newPassword === currentPassword) {
      next.newPassword = 'Новий пароль має відрізнятися від поточного';
    }
    if (confirmPassword !== newPassword) next.confirmPassword = 'Паролі не збігаються';
    return next;
  };

  const setField = <K extends keyof FieldErrors>(key: K, value: string | undefined) => {
    setErrors((prev) => ({ ...prev, [key]: value }));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Перевірте форму', { description: 'Деякі поля заповнено неправильно' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Пароль оновлено');
    } catch (err) {
      toast.error('Не вдалося змінити пароль', {
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const revokeSession = async (id: string) => {
    // API сесій відсутнє — завершення локальне (демонстраційне)
    setRevokingId(id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Сесію завершено');
    } catch {
      toast.error('Не вдалося завершити сесію');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Безпека</h1>
      </div>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Зміна пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-xs text-foreground-muted">
                Поточний пароль
              </Label>
              <SecretInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errors.currentPassword) setField('currentPassword', undefined);
                }}
                error={errors.currentPassword}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs text-foreground-muted">
                Новий пароль
              </Label>
              <SecretInput
                id="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) setField('newPassword', undefined);
                }}
                error={errors.newPassword}
                autoComplete="new-password"
              />
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((seg) => (
                      <span
                        key={seg}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          strength.score >= seg ? STRENGTH_COLORS[strength.score] : 'bg-secondary'
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-xs ${STRENGTH_TEXT[strength.score] || 'text-foreground-muted'}`}
                  >
                    Міцність: {strength.label}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs text-foreground-muted">
                Підтвердження пароля
              </Label>
              <SecretInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setField('confirmPassword', undefined);
                }}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isSubmitting ? 'Збереження...' : 'Змінити пароль'}
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
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokingId !== null}
                      onClick={() => revokeSession(row.id)}
                    >
                      {revokingId === row.id && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
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
