'use client';

import { ChevronRight, EllipsisVertical, Loader2, Mail, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Badge,
  Modal,
  Skeleton,
  Table,
} from '@/components/ui';
import { currentLocaleFromPath } from '@/lib/use-locale-path';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

type Member = {
  id: string;
  role: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
};

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string | null; email: string | null };
}

const roleLabels: Record<string, string> = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
};

const roleVariants: Record<string, 'default' | 'secondary' | 'outline' | 'success'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

export default function TeamPage() {
  const params = useParams();
  const { data: session } = useSession();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form (діалог)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const currentUserId = session?.user?.id;

  useTourAutoStart('team');

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    try {
      const [tenantRes, membersRes, invitesRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch(`/api/tenants/${tenantId}/members`),
        fetch(`/api/tenants/${tenantId}/invites`),
      ]);

      const tenantData = await tenantRes.json();
      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();

      setTenant(tenantData.tenant);
      setMembers(membersData.members || []);
      setInvites(invitesData.invites || []);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setManualLink(null);

    const email = inviteEmail.trim();
    if (!email) {
      setInviteEmailError('Вкажіть email');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setInviteEmailError('Невірний формат email');
      return;
    }
    setInviteEmailError(null);

    setInviteLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: inviteRole,
          locale: currentLocaleFromPath(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.emailSent) {
        setInviteSuccess(`Запрошення надіслано на ${email}`);
        toast.success('Запрошення надіслано', { description: email });
      } else {
        setInviteSuccess(`Запрошення створено, але лист не надіслано — скопіюйте посилання вручну`);
        setManualLink(data.inviteUrl || null);
        toast.warning('Лист не надіслано', { description: 'Скопіюйте посилання вручну' });
      }
      setInviteEmail('');
      setInviteRole('member');
      setInviteOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка надсилання запрошення';
      setInviteError(msg);
      toast.error('Не вдалося надіслати запрошення', { description: msg });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setChangingRole(memberId);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Роль оновлено', { description: roleLabels[newRole] || newRole });
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося змінити роль';
      toast.error('Не вдалося змінити роль', { description: msg });
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Ви впевнені що хочете видалити ${memberName}?`)) return;

    try {
      const response = await fetch(`/api/tenants/${tenantId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Учасника видалено', { description: memberName });
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося видалити учасника';
      toast.error('Не вдалося видалити учасника', { description: msg });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Відкликати запрошення?')) return;

    try {
      const response = await fetch(`/api/tenants/${tenantId}/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Запрошення відкликано');
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося відкликати запрошення';
      toast.error('Не вдалося відкликати запрошення', { description: msg });
    }
  };

  const currentMember = members.find((m) => m.userId === currentUserId);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3 rounded" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-xl font-bold mb-2">Компанію не знайдено</h2>
        <Link href="/dashboard/settings/tenants">
          <Button>Повернутися до списку</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-foreground-muted mb-1">
            <Link
              href="/dashboard/settings/tenants"
              className="hover:text-foreground transition-colors"
            >
              Компанії
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/dashboard/settings/tenants/${tenantId}`}
              className="hover:text-foreground transition-colors"
            >
              {tenant.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold">Команда</h1>
          <p className="text-foreground-muted">Управління учасниками та ролями</p>
        </div>
        <Link href={`/dashboard/settings/tenants/${tenantId}`}>
          <Button variant="outline">Налаштування компанії</Button>
        </Link>
      </div>

      {/* Invite */}
      {canManage && (
        <>
          <Card data-tour="team-invite" className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Запросити учасника</CardTitle>
              <CardDescription>Надішліть запрошення на email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inviteSuccess && (
                <div className="p-3 bg-success/10 text-success rounded-lg text-sm">
                  {inviteSuccess}
                </div>
              )}
              {manualLink && (
                <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                  <code className="flex-1 min-w-0 truncate text-xs font-mono">{manualLink}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(manualLink).catch(() => {})}
                  >
                    Копіювати
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-foreground-muted">
                  Запрошення дійсне 7 днів. Посилання буде згенеровано автоматично.
                </p>
                <Button onClick={() => setInviteOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Запросити учасника
                </Button>
              </div>
            </CardContent>
          </Card>

          <Modal
            isOpen={inviteOpen}
            onClose={() => {
              if (!inviteLoading) setInviteOpen(false);
            }}
            title="Запросити учасника"
            size="md"
          >
            <form onSubmit={handleInvite} noValidate className="space-y-4">
              {inviteError && (
                <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{inviteError}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-xs text-foreground-muted">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteEmailError) setInviteEmailError(null);
                  }}
                  error={inviteEmailError ?? undefined}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">Роль</Label>
                <QuickSelect
                  value={inviteRole}
                  onChange={setInviteRole}
                  options={[
                    { id: 'member', name: 'Учасник' },
                    { id: 'admin', name: 'Адміністратор' },
                  ]}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteLoading}
                >
                  Скасувати
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {inviteLoading ? 'Надсилання...' : 'Надіслати'}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* Members */}
      <Card data-tour="team-members" className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Учасники ({members.length})</CardTitle>
          <CardDescription>Поточні учасники компанії</CardDescription>
        </CardHeader>
        <CardContent>
          <Table<Member>
            data={members}
            selectedRows={currentMember ? [currentMember] : []}
            columns={[
              {
                key: 'user',
                header: 'Учасник',
                render: (row) => {
                  const isCurrentUser = row.userId === currentUserId;
                  return (
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={row.user.image ?? undefined}
                        name={row.user.name || row.user.email || '?'}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {row.user.name || 'Без імені'}
                          {isCurrentUser && (
                            <span className="text-foreground-muted ml-1">(Ви)</span>
                          )}
                        </p>
                        <p className="text-xs text-foreground-muted">{row.user.email}</p>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'role',
                header: 'Роль',
                render: (row) => (
                  <Badge variant={roleVariants[row.role] || 'outline'}>
                    {roleLabels[row.role] || row.role}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'w-14',
                render: (row) => {
                  const isOwner = row.role === 'owner';
                  const isCurrentUser = row.userId === currentUserId;
                  if (!(canManage && !isOwner && !isCurrentUser)) {
                    return <span className="text-foreground-muted">—</span>;
                  }
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={changingRole === row.id}
                          aria-label="Дії з учасником"
                        >
                          <EllipsisVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Змінити роль</DropdownMenuLabel>
                        <DropdownMenuItem
                          disabled={row.role === 'member'}
                          onSelect={() => handleChangeRole(row.id, 'member')}
                        >
                          Учасник
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={row.role === 'admin'}
                          onSelect={() => handleChangeRole(row.id, 'admin')}
                        >
                          Адміністратор
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger focus:text-danger"
                          onSelect={() =>
                            handleRemoveMember(
                              row.id,
                              row.user.name || row.user.email || 'учасника',
                            )
                          }
                        >
                          Видалити з команди
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                },
              },
            ]}
            emptyMessage="Немає учасників"
          />
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {canManage && (
        <Card data-tour="team-invites" className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle>Очікуючі запрошення ({invites.length})</CardTitle>
            <CardDescription>Нещодавно надіслані запрошення</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-4">
                Немає очікуючих запрошень
              </p>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10 text-sm text-warning">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-foreground-muted">
                        Запросив {invite.invitedBy.name || invite.invitedBy.email} ·{' '}
                        {new Date(invite.createdAt).toLocaleDateString('uk')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={roleVariants[invite.role] || 'outline'}>
                      {roleLabels[invite.role] || invite.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvite(invite.id)}
                      aria-label="Відкликати запрошення"
                      title="Відкликати запрошення"
                    >
                      <X className="h-4 w-4 text-foreground-muted hover:text-danger" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles description */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Ролі та дозволи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="default">Власник</Badge>
              <p className="text-sm text-foreground-muted">
                Повний доступ. може видаляти компанію, змінювати будь-які налаштування, керувати
                всіма учасниками.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="secondary">Адміністратор</Badge>
              <p className="text-sm text-foreground-muted">
                Може додавати/видаляти учасників, змінювати ролі, керувати контактами та угодами.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="outline">Учасник</Badge>
              <p className="text-sm text-foreground-muted">
                Може переглядати та редагувати контакти, угоди, задачі в межах компанії.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
