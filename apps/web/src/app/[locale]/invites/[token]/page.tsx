'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent } from '@/components/ui';
import { currentLocaleFromPath, useLocalePath } from '@/lib/use-locale-path';

interface InviteInfo {
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  tenant: { name: string; slug: string };
  invitedBy: { name: string | null; email: string | null };
}

const roleLabels: Record<string, string> = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
  viewer: 'Глядач',
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const lp = useLocalePath();
  const token = params.token as string;
  const { data: session, status } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Запрошення недоступне');
        setInvite(data.invite);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося прийняти');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Помилка прийняття');
    } finally {
      setAccepting(false);
    }
  };

  const sessionEmail = session?.user?.email?.toLowerCase() || null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            {loading || status === 'loading' ? (
              <p className="text-foreground-muted animate-pulse">Завантаження...</p>
            ) : loadError || !invite ? (
              <>
                <div className="text-4xl mb-4">❌</div>
                <h1 className="text-2xl font-bold">Запрошення недоступне</h1>
                <p className="mt-2 text-foreground-secondary">{loadError}</p>
                <div className="mt-6">
                  <Button variant="outline" asChild>
                    <Link href={lp('/auth/login')}>До входу</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">✉️</div>
                <h1 className="text-2xl font-bold">Запрошення в команду</h1>
                <p className="mt-2 text-foreground-secondary">
                  {invite.invitedBy.name || invite.invitedBy.email} запрошує вас в{' '}
                  <strong>{invite.tenant.name}</strong> як «{roleLabels[invite.role] || invite.role}
                  »
                </p>
                <p className="mt-1 text-sm text-foreground-muted">Для: {invite.email}</p>

                {status === 'unauthenticated' ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-foreground-secondary">
                      Увійдіть або зареєструйтесь на <strong>{invite.email}</strong>, потім
                      поверніться за цим посиланням.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button asChild>
                        <Link href={lp('/auth/register')}>Зареєструватися</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={lp('/auth/login')}>Увійти</Link>
                      </Button>
                    </div>
                  </div>
                ) : sessionEmail && sessionEmail !== invite.email.toLowerCase() ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-foreground-secondary">
                      Ви увійшли як <strong>{session?.user?.email}</strong>, а запрошення — для{' '}
                      <strong>{invite.email}</strong>. Вийдіть і увійдіть потрібним акаунтом.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        signOut({ callbackUrl: `/${currentLocaleFromPath()}/invites/${token}` })
                      }
                    >
                      Вийти
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {acceptError && <p className="text-sm text-destructive">{acceptError}</p>}
                    <Button onClick={handleAccept} disabled={accepting} className="w-full">
                      {accepting ? 'Приймаємо...' : 'Прийняти запрошення'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
