'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Member {
  id: string;
  role: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

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
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const currentUserId = session?.user?.id;

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
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const response = await fetch(`/api/tenants/${tenantId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setInviteSuccess(`Запрошення надіслано на ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('member');
      fetchData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Помилка надсилання запрошення');
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

      fetchData();
    } catch (err) {
      console.error('Failed to change role:', err);
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

      fetchData();
    } catch (err) {
      console.error('Failed to remove member:', err);
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

      fetchData();
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  };

  const currentMember = members.find((m) => m.userId === currentUserId);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
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
            <Link href="/dashboard/settings/tenants" className="hover:text-foreground transition-colors">
              Компанії
            </Link>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <Link href={`/dashboard/settings/tenants/${tenantId}`} className="hover:text-foreground transition-colors">
              {tenant.name}
            </Link>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Команда</h1>
          <p className="text-foreground-muted">Управління учасниками та ролями</p>
        </div>
        <Link href={`/dashboard/settings/tenants/${tenantId}`}>
          <Button variant="outline">Налаштування компанії</Button>
        </Link>
      </div>

      {/* Invite Form */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Запросити учасника</CardTitle>
            <CardDescription>Надішліть запрошення на email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="p-3 bg-success/10 text-success rounded-lg text-sm">
                  {inviteSuccess}
                </div>
              )}

              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="member">Учасник</option>
                  <option value="admin">Адміністратор</option>
                </select>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? 'Надсилання...' : 'Надіслати'}
                </Button>
              </div>

              <p className="text-xs text-foreground-muted">
                Запрошення дійсне 7 днів. Посилання буде згенеровано автоматично.
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Учасники ({members.length})</CardTitle>
          <CardDescription>Поточні учасники компанії</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-4">Немає учасників</p>
          ) : (
            members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const isOwner = member.role === 'owner';

              return (
                <div
                  key={member.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg transition-colors',
                    isCurrentUser ? 'bg-primary-light/30 border border-primary/20' : 'bg-secondary/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {member.user.name?.charAt(0) || member.user.email?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.name || 'Без імені'}
                        {isCurrentUser && <span className="text-foreground-muted ml-1">(Ви)</span>}
                      </p>
                      <p className="text-xs text-foreground-muted">{member.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && !isOwner && !isCurrentUser ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        disabled={changingRole === member.id}
                        className="h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="member">Учасник</option>
                        <option value="admin">Адміністратор</option>
                      </select>
                    ) : (
                      <Badge variant={roleVariants[member.role] || 'outline'}>
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    )}

                    {canManage && !isOwner && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.user.name || member.user.email || 'учасника')}
                        className="rounded p-1.5 text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Видалити з команди"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Очікуючі запрошення ({invites.length})</CardTitle>
            <CardDescription>Нещодавно надіслані запрошення</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-4">Немає очікуючих запрошень</p>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10 text-sm text-warning">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
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
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="rounded p-1.5 text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Відкликати запрошення"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles description */}
      <Card>
        <CardHeader>
          <CardTitle>Ролі та дозволи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="default">Власник</Badge>
              <p className="text-sm text-foreground-muted">Повний доступ. може видаляти компанію, змінювати будь-які налаштування, керувати всіма учасниками.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="secondary">Адміністратор</Badge>
              <p className="text-sm text-foreground-muted">Може додавати/видаляти учасників, змінювати ролі, керувати контактами та угодами.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
              <Badge variant="outline">Учасник</Badge>
              <p className="text-sm text-foreground-muted">Може переглядати та редагувати контакти, угоди, задачі в межах компанії.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
