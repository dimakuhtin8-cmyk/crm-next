/**
 * Forgot Password — отправка ссылки для сброса пароля
 */

'use client';

import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardContent, Button, Input, Label } from '@/components/ui';
import { useLocale, useLocalePath } from '@/lib/use-locale-path';

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const lp = useLocalePath();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || t('errors.generic'));
      }
    } catch {
      setError(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-5 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-success/10">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('checkYourEmail')}</h1>
            <p className="text-foreground-muted mb-6">
              {t('resetSentTo')} <strong>{email}</strong>
            </p>
            <p className="text-sm text-foreground-muted mb-6">{t('spamFolderHint')}</p>
            <Link href={lp('/auth/login')}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('backToLogin')}
              </Button>
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
            <h1 className="text-2xl font-bold">{t('forgotPassword')}</h1>
            <p className="text-foreground-muted mt-2">{t('forgotDescription')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('sending') : t('sendLink')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href={lp('/auth/login')}
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
