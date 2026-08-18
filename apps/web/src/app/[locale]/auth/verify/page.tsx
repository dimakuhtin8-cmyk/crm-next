'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setStatus('error');
      setError('Неверная ссылка авторизации');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/${searchParams.get('locale') || 'uk'}/api/auth/verify`, {
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
          setError(data.error || 'Ошибка авторизации');
        }
      } catch {
        setStatus('error');
        setError('Ошибка соединения');
      }
    };

    verify();
  }, [router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="animate-pulse text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold">Проверяем ссылку...</h1>
          <p className="mt-2 text-foreground-secondary">
            Перенаправляем вас в CRM-Next
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold">Вы авторизованы!</h1>
          <p className="mt-2 text-foreground-secondary">
            Перенаправление в дашборд...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-2xl font-bold">Ошибка авторизации</h1>
        <p className="mt-2 text-foreground-secondary">{error}</p>
        <div className="mt-6 flex gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link href="/uk/auth/login">Войти паролем</Link>
          </Button>
          <Button asChild>
            <Link href="/uk/auth/login">Запросить новую ссылку</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}