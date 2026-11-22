'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';
import { useLocale } from '@/lib/use-locale-path';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('auth');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setStatus('error');
      setError(t('errors.invalidAuthLink'));
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/${searchParams.get('locale') || locale}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          setStatus('error');
          setError(data.error || t('errors.authorization'));
        }
      } catch {
        setStatus('error');
        setError(t('errors.connectionFailed'));
      }
    };

    verify();
  }, [router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="animate-pulse text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold">{t('verifyingLink')}</h1>
          <p className="mt-2 text-foreground-secondary">{t('redirectingToApp')}</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold">{t('authorized')}</h1>
          <p className="mt-2 text-foreground-secondary">{t('redirectingToDashboard')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-2xl font-bold">{t('errors.authorization')}</h1>
        <p className="mt-2 text-foreground-secondary">{error}</p>
        <div className="mt-6 flex gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link href={`/${locale}/auth/login`}>{t('loginWithPassword')}</Link>
          </Button>
          <Button asChild>
            <Link href={`/${locale}/auth/login`}>{t('requestNewLink')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
