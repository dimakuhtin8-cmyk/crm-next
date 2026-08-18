'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Input, Badge, Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  status: string;
  source: string | null;
  createdAt: string;
  tags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }> = {
  active: { label: 'Активний', variant: 'success' },
  inactive: { label: 'Неактивний', variant: 'secondary' },
  lead: { label: 'Лід', variant: 'default' },
  client: { label: 'Клієнт', variant: 'outline' },
};

const tagColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterTag, setFilterTag] = useState(searchParams.get('tag') || '');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [page, filterStatus, filterTag]);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setTags(data.tags || []);
    } catch {}
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterTag) params.set('tag', filterTag);
      params.set('page', String(page));
      params.set('limit', '50');

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContacts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Видалити контакт "${name}"?`)) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch {}
  };

  const getName = (c: Contact) => `${c.firstName} ${c.lastName || ''}`.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Контакти</h1>
          <p className="text-foreground-muted">{total} контактів</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/contacts/import">
            <Button variant="outline">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Імпорт
            </Button>
          </Link>
          <Link href="/dashboard/contacts/new">
            <Button>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Додати контакт
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Пошук за ім'ям, email, телефоном, компанією..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <Button type="submit" variant="secondary">
              Знайти
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-primary-light')}
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Фільтри
            </Button>
          </form>

          {showFilters && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Всі статуси</option>
                <option value="active">Активний</option>
                <option value="inactive">Неактивний</option>
                <option value="lead">Лід</option>
                <option value="client">Клієнт</option>
              </select>

              <select
                value={filterTag}
                onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Всі теги</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>{tag.name}</option>
                ))}
              </select>

              {(filterStatus || filterTag) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterStatus(''); setFilterTag(''); setPage(1); }}
                >
                  Скинути фільтри
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="h-12 w-12 mx-auto text-foreground-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="text-foreground-muted mb-4">Контактів не знайдено</p>
            <Link href="/dashboard/contacts/new">
              <Button>Додати перший контакт</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-foreground-muted">
            <div className="col-span-3">Ім'я</div>
            <div className="col-span-2">Компанія</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Телефон</div>
            <div className="col-span-1">Статус</div>
            <div className="col-span-2">Теги</div>
          </div>

          {/* Rows */}
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 bg-card rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer items-center"
              onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
            >
              <div className="col-span-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {contact.firstName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{getName(contact)}</p>
                    {contact.position && (
                      <p className="text-xs text-foreground-muted truncate">{contact.position}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-2 text-sm text-foreground-muted truncate">
                {contact.company || '—'}
              </div>

              <div className="col-span-2 text-sm truncate">
                {contact.email || '—'}
              </div>

              <div className="col-span-2 text-sm truncate">
                {contact.phone || '—'}
              </div>

              <div className="col-span-1">
                <Badge variant={statusConfig[contact.status]?.variant || 'outline'} className="text-xs">
                  {statusConfig[contact.status]?.label || contact.status}
                </Badge>
              </div>

              <div className="col-span-2 flex gap-1 flex-wrap">
                {contact.tags?.slice(0, 3).map((ct) => (
                  <Badge
                    key={ct.tag.id}
                    variant="outline"
                    className="text-xs"
                    style={ct.tag.color ? { borderColor: ct.tag.color, color: ct.tag.color } : undefined}
                  >
                    {ct.tag.name}
                  </Badge>
                ))}
                {(contact.tags?.length || 0) > 3 && (
                  <Badge variant="outline" className="text-xs">+{contact.tags!.length - 3}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-foreground-muted">
            Сторінка {page} з {Math.ceil(total / 50)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / 50)}
            onClick={() => setPage(page + 1)}
          >
            Далі
          </Button>
        </div>
      )}
    </div>
  );
}
