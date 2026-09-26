'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

import { TelegramLoginWidget, type TelegramAuthData } from '@/components/auth/telegram-login-widget';

const OAUTH_ERRORS: Record<string, string> = {
  Configuration: 'Помилка конфігурації сервера. Зверніться до адміністратора.',
  AccessDenied: 'Доступ відхилено.',
  Verification: 'Посилання для верифікації вже використане або прострочене.',
  Default: 'Помилка авторизації. Спробуйте ще раз.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(OAUTH_ERRORS[oauthError] || `Помилка: ${oauthError}`);
    }
  }, [searchParams]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Ошибка входа. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const locale = 'uk';
      const res = await fetch(`/${locale}/api/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Ссылка для входа отправлена на ${email}. Проверьте почту.`);
        if (data.link) {
          console.log('Magic link:', data.link);
        }
      } else {
        setError(data.error || 'Ошибка отправки ссылки');
      }
    } catch {
      setError('Ошибка соединения. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
  };

  const handleTelegramAuth = useCallback(async (data: TelegramAuthData) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/uk/api/auth/callback/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(result.error || 'Ошибка авторизации через Telegram');
      }
    } catch {
      setError('Ошибка соединения. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg
              className="h-8 w-8 text-indigo-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="text-xl font-bold">CRM-Next</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">
            {mode === 'password' ? 'Увійти в акаунт' : 'Вхід по посиланню'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === 'password'
              ? 'Введіть свої дані для входу'
              : 'Вкажіть email — надішлемо посилання для входу без пароля'}
          </p>
        </div>

        {(error || success) && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              error ? 'border-red-500/20 bg-red-500/10 text-red-500' : 'border-green-500/20 bg-green-500/10 text-green-600'
            }`}
          >
            {error || success}
          </div>
        )}

        <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {mode === 'password' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {mode === 'password' && (
            <div className="text-right">
              <Link href="/uk/auth/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                Забули пароль?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Зачекайте...' : mode === 'password' ? 'Увійти' : 'Отримати посилання'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">або</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Увійти через Google
        </button>

        <div className="text-center text-sm text-muted-foreground">
          або
        </div>

        <TelegramLoginWidget
          botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''}
          onAuth={handleTelegramAuth}
        />

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'password' ? (
            <>
              Хочете ввійти без пароля?{' '}
              <button
                type="button"
                onClick={() => setMode('magic-link')}
                className="text-indigo-500 hover:text-indigo-400 font-medium"
              >
                Отримати посилання
              </button>
            </>
          ) : (
            <>
              Пам'ятаєте пароль?{' '}
              <button
                type="button"
                onClick={() => setMode('password')}
                className="text-indigo-500 hover:text-indigo-400 font-medium"
              >
                Увійти паролем
              </button>
            </>
          )}
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Ще немає акаунту?{' '}
          <Link href="/uk/auth/register" className="text-indigo-500 hover:text-indigo-400 font-medium">
            Зареєструватися
          </Link>
        </p>
      </div>
    </div>
  );
}