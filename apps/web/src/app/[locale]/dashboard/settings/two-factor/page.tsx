/**
 * 2FA Settings — настройка двухфакторной аутентификации
 */

'use client';

import { Shield, ShieldCheck, ShieldOff, Copy, Check, Loader2, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Button, Card, CardContent, Input, Modal, Skeleton } from '@/components/ui';

/** Демонстраційні коди відновлення: серверний API кодів не зберігає */
function generateRecoveryCodes(): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => {
    const block = () =>
      Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
        '',
      );
    return `${block()}-${block()}`;
  });
}

export default function TwoFactorSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

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
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa?action=setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSecret(data.secret);
        setVerifyCode('');
        setModalStep(1);
        setShowSetup(true);
        // Реальний QR-код з otpauth-посилання (генерується на клієнті)
        try {
          const url = await QRCode.toDataURL(data.otpauthUrl, {
            width: 220,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
          setQrDataUrl(url);
        } catch {
          setQrDataUrl(''); // QR не згенерувався — залишається ручний ввід ключа
        }
      } else {
        setError(data.error);
        toast.error('Не вдалося розпочати налаштування', { description: data.error });
      }
    } catch {
      setError('Помилка сервера');
      toast.error('Помилка сервера');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Код має бути 6 цифр');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnabled(true);
        setVerifyCode('');
        setRecoveryCodes(generateRecoveryCodes());
        setModalStep(3);
        toast.success('2FA успішно увімкнено');
      } else {
        setError(data.error);
        toast.error('Невірний код', { description: data.error });
      }
    } catch {
      setError('Помилка сервера');
      toast.error('Помилка сервера');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setError('');
    if (!disableCode || disableCode.length !== 6) {
      setError('Введіть код для підтвердження');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa?action=disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnabled(false);
        setDisableCode('');
        setShowDisable(false);
        toast.success('2FA вимкнено');
      } else {
        setError(data.error);
        toast.error('Не вдалося вимкнути 2FA', { description: data.error });
      }
    } catch {
      setError('Помилка сервера');
      toast.error('Помилка сервера');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadRecoveryCodes = () => {
    const content = [
      'Коди відновлення 2FA (CRM-Next)',
      '================================',
      '',
      ...recoveryCodes,
      '',
      'Кожен код можна використати один раз.',
      'Демонстраційні коди: сервер не зберігає коди відновлення.',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Коди відновлення завантажено');
  };

  const closeSetup = () => {
    setShowSetup(false);
    setModalStep(1);
    setSecret('');
    setQrDataUrl('');
    setVerifyCode('');
    setError('');
    setRecoveryCodes([]);
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

      {error && !showSetup && (
        <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>
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
            {!enabled && (
              <Button onClick={handleSetup} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Увімкнути 2FA
              </Button>
            )}
            {enabled && (
              <Button
                variant="outline"
                onClick={() => setShowDisable((v) => !v)}
                aria-expanded={showDisable}
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Вимкнути
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup wizard: Modal крок 1 → 2 → 3 */}
      <Modal
        isOpen={showSetup}
        onClose={closeSetup}
        title={
          modalStep === 1
            ? 'Крок 1: Додайте секретний ключ'
            : modalStep === 2
              ? 'Крок 2: Підтвердіть кодом'
              : 'Крок 3: Коди відновлення'
        }
        size="md"
      >
        <div className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

          {/* Крок 1: QR + ключ */}
          {modalStep === 1 && (
            <>
              <p className="text-sm text-foreground-muted">
                Відскануйте QR-код додатком автентифікації (Google Authenticator, Authy, Microsoft
                Authenticator) або скопіюйте секретний ключ вручну
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-[236px] w-[236px] shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR-код для налаштування 2FA"
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-secondary text-foreground-muted">
                      <span className="text-xs">QR недоступний</span>
                      <span className="text-[10px]">Введіть ключ вручну</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-foreground-muted">Секретний ключ</p>
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
                  <p className="text-xs text-foreground-muted">
                    Коди оновлюються кожні 30 секунд. Зберігайте ключ у безпечному місці.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeSetup}>
                  Скасувати
                </Button>
                <Button onClick={() => setModalStep(2)}>Далі</Button>
              </div>
            </>
          )}

          {/* Крок 2: OTP */}
          {modalStep === 2 && (
            <>
              <p className="text-sm text-foreground-muted">
                Введіть 6-значний код з додатку автентифікації
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-32 font-mono text-lg text-center"
                  maxLength={6}
                />
                <Button onClick={handleVerify} disabled={busy || verifyCode.length !== 6}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Підтвердити
                </Button>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setModalStep(1)}>
                  Назад
                </Button>
                <Button variant="outline" onClick={closeSetup}>
                  Скасувати
                </Button>
              </div>
            </>
          )}

          {/* Крок 3: коди відновлення */}
          {modalStep === 3 && (
            <>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm font-medium text-warning">Демонстраційні коди</p>
                <p className="text-xs text-warning mt-1">
                  Серверний API кодів відновлення поки що не підтримує — ці коди генеруються
                  локально і не діють для відновлення доступу.
                </p>
              </div>
              <p className="text-sm text-foreground-muted">
                Зберігайте коди в безпечному місці — кожен код можна використати один раз для входу,
                якщо втратите доступ до додатка.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-4">
                {recoveryCodes.map((code) => (
                  <code key={code} className="text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={downloadRecoveryCodes}>
                  <Download className="h-4 w-4 mr-2" />
                  Завантажити коди
                </Button>
                <Button onClick={closeSetup}>Готово</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Disable flow */}
      {enabled && showDisable && (
        <Card className="border-danger bg-card shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-danger">Вимкнути 2FA</h3>
            <p className="text-sm text-foreground-muted">
              Введіть код з додатку автентифікації для підтвердження вимкнення
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="000000"
                inputMode="numeric"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-32 font-mono text-lg text-center"
                maxLength={6}
              />
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={busy || disableCode.length !== 6}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
