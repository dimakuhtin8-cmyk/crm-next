/**
 * 2FA Settings — настройка двухфакторной аутентификации
 */

'use client';

import { Shield, ShieldCheck, ShieldOff, Copy, Check, QrCode } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button, Card, CardContent, Input, Separator, Skeleton } from '@/components/ui';

export default function TwoFactorSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/2fa?action=status', { method: 'POST' });
      const data = await res.json();
      setEnabled(data.enabled);
    } catch {
      // недоступний сервер — статус лишається 'вимкнено'
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/2fa?action=setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSecret(data.secret);
        setStep('setup');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Помилка сервера');
    }
  };

  const handleVerify = async () => {
    setError('');
    setSuccess('');
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Код має бути 6 цифр');
      return;
    }
    try {
      const res = await fetch('/api/auth/2fa?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('2FA успішно увімкнено!');
        setEnabled(true);
        setStep('idle');
        setVerifyCode('');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Помилка сервера');
    }
  };

  const handleDisable = async () => {
    setError('');
    setSuccess('');
    if (!disableCode || disableCode.length !== 6) {
      setError('Введіть код для підтвердження');
      return;
    }
    try {
      const res = await fetch('/api/auth/2fa?action=disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('2FA вимкнено');
        setEnabled(false);
        setDisableCode('');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Помилка сервера');
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3 rounded" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Двофакторна автентифікація (2FA)</h1>
        <p className="text-foreground-muted mt-1">
          Додатковий захист акаунту за допомогою TOTP-кодів
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}
      {success && (
        <div className="p-3 rounded-lg bg-success/10 text-success text-sm">{success}</div>
      )}

      {/* Status */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${enabled ? 'bg-success/10' : 'bg-secondary'}`}>
              {enabled ? (
                <ShieldCheck className="h-8 w-8 text-success" />
              ) : (
                <Shield className="h-8 w-8 text-foreground-muted" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{enabled ? '2FA увімкнено' : '2FA вимкнено'}</h2>
              <p className="text-sm text-foreground-muted">
                {enabled
                  ? 'Ваш акаунт захищений додатковим кодом'
                  : 'Увімкніть 2FA для додаткового захисту'}
              </p>
            </div>
            {!enabled && step === 'idle' && <Button onClick={handleSetup}>Увімкнути 2FA</Button>}
            {enabled && (
              <Button
                variant="outline"
                onClick={() => setStep(step === 'idle' ? 'disable' : 'idle')}
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Вимкнути
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup flow */}
      {step === 'setup' && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold">Крок 1: Додайте секретний ключ</h3>
            <p className="text-sm text-foreground-muted">
              Скопіюйте цей ключ та додайте його в додаток автентифікації (Google Authenticator,
              Authy, тощо)
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background">
                <QrCode className="h-10 w-10 text-foreground-muted" />
                <span className="text-[10px] text-foreground-muted">QR-код</span>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-foreground-muted">
                  QR-код генерується на сервері — поки що введіть ключ вручну
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-secondary rounded-lg text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySecret}
                    aria-label="Скопіювати секретний ключ"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Separator />
              <h3 className="font-semibold">Крок 2: Підтвердіть кодом</h3>
              <p className="text-sm text-foreground-muted mb-3">
                Введіть 6-значний код з додатку автентифікації
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-32 font-mono text-lg text-center"
                  maxLength={6}
                />
                <Button onClick={handleVerify} disabled={verifyCode.length !== 6}>
                  Підтвердити
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disable flow */}
      {step === 'disable' && enabled && (
        <Card className="border-danger bg-card shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-danger">Вимкнути 2FA</h3>
            <p className="text-sm text-foreground-muted">
              Введіть код з додатку автентифікації для підтвердження вимкнення
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-32 font-mono text-lg text-center"
                maxLength={6}
              />
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={disableCode.length !== 6}
              >
                Вимкнути 2FA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Як це працює</h3>
          <ul className="space-y-2 text-sm text-foreground-muted">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span>
                Встановіть додаток автентифікації (Google Authenticator, Authy, Microsoft
                Authenticator)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span>
                Додайте новий обліковий запис у додатку, відсканувавши QR-код або ввівши секретний
                ключ
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span>
                Під час входу додаток генерує 6-значний код, який потрібно ввести додатково
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">4.</span>
              <span>Код оновлюється кожні 30 секунд</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
