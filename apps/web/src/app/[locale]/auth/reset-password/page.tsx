/**
 * Reset Password — установка нового пароля по токену
 */

'use client';

import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardContent, Button, Input, Label } from '@/components/ui';
import { useLocalePath } from '@/lib/use-locale-path';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '@/lib/validation/password';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const lp = useLocalePath();
  const t = useTranslations('auth');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-5 text-center">
            <h1 className="text-2xl font-bold mb-2">{t('invalidLink')}</h1>
            <p className="text-foreground-muted mb-6">{t('tokenNotFound')}</p>
            <Link href={lp('/auth/forgot-password')}>
              <Button className="w-full">{t('requestNewLink')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('errors.passwordsDiffer'));
      setLoading(false);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('errors.passwordMinLength', { min: MIN_PASSWORD_LENGTH }));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || t('errors.generic'));
      }
    } catch {
      setError(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-5 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-success/10">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('passwordChanged')}</h1>
            <p className="text-foreground-muted mb-6">{t('passwordChangedHint')}</p>
            <Link href={lp('/auth/login')}>
              <Button className="w-full">{t('login')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-5">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{t('newPassword')}</h1>
            <p className="text-foreground-muted mt-2">{t('newPasswordDescription')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{t('newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={PASSWORD_HINT}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('repeatPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('saving') : t('changePassword')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              {t('backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
