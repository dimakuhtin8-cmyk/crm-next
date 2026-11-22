'use client';

import { Loader2, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
    lastActive: 'sessionLastActiveNow',
  },
  {
    id: '2',
    device: 'Safari · iPhone',
    ip: '10.0.0.17',
    current: false,
    lastActive: 'sessionLastActiveHours',
  },
  {
    id: '3',
    device: 'Firefox · Ubuntu',
    ip: '172.16.8.4',
    current: false,
    lastActive: 'sessionLastActiveYesterday',
  },
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
    score <= 1
      ? 'strengthWeak'
      : score === 2
        ? 'strengthMedium'
        : score === 3
          ? 'strengthStrong'
          : 'strengthVeryStrong';
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
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
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
    if (!currentPassword) next.currentPassword = t('errors.currentPasswordRequired');
    if (newPassword.length < 8) next.newPassword = t('errors.newPasswordMin');
    else if (newPassword === currentPassword) {
      next.newPassword = t('errors.newPasswordSame');
    }
    if (confirmPassword !== newPassword) next.confirmPassword = t('errors.passwordMismatch');
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
      toast.error(t('checkForm'), { description: t('checkFormDescription') });
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
      toast.success(t('passwordUpdated'));
    } catch (err) {
      toast.error(t('passwordChangeError'), {
        description: err instanceof Error ? err.message : t('tryAgain'),
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
      toast.success(t('sessionRevoked'));
    } catch {
      toast.error(t('sessionRevokeError'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{t('security')}</h1>
      </div>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-xs text-foreground-muted">
                {t('currentPasswordLabel')}
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
                {t('newPasswordLabel')}
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
                    {t('strengthLabel', { label: t(strength.label) })}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs text-foreground-muted">
                {t('confirmPasswordLabel')}
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
              {isSubmitting ? t('saving') : t('changePasswordAction')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('activeSessions')}</CardTitle>
          <CardDescription>{t('activeSessionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table<SessionRow>
            data={sessions}
            columns={[
              {
                key: 'device',
                header: t('deviceColumn'),
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4 text-foreground-muted" />
                    <span className="text-sm">{row.device}</span>
                  </div>
                ),
              },
              {
                key: 'ip',
                header: t('ipColumn'),
                render: (row) => (
                  <span className="font-mono text-xs text-foreground-muted">{row.ip}</span>
                ),
              },
              {
                key: 'lastActive',
                header: t('activityColumn'),
                render: (row) => (
                  <span className="text-xs text-foreground-muted">{t(row.lastActive)}</span>
                ),
              },
              {
                key: 'action',
                header: '',
                render: (row) =>
                  row.current ? (
                    <Badge variant="info">{t('currentSessionBadge')}</Badge>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokingId !== null}
                      onClick={() => revokeSession(row.id)}
                    >
                      {revokingId === row.id && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                      {t('endSession')}
                    </Button>
                  ),
              },
            ]}
            emptyMessage={t('noActiveSessions')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
