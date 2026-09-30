'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickContactForm, QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import { Button, Input, Badge, Card, CardContent, EmptyState } from '@/components/ui';
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

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }
> = {
  active: { label: 'Активний', variant: 'success' },
  inactive: { label: 'Неактивний', variant: 'secondary' },
  lead: { label: 'Лід', variant: 'default' },
  client: { label: 'Клієнт', variant: 'outline' },
};

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

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Quick-create popover
  const [quickOpen, setQuickOpen] = useState(false);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  useTourAutoStart('contacts');

  const handleQuickCreated = () => {
    setQuickOpen(false);
    setPage(1);
    fetchContacts();
  };

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
    } catch {
      // теги просто не покажем
    }
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
      // список просто останется пустым
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContacts();
  };

  const getName = (c: Contact) => `${c.firstName} ${c.lastName || ''}`.trim();

  // Bulk operations
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Видалити ${selectedIds.size} контактів?`)) return;

    setBulkLoading(true);
    try {
      await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedIds),
        }),
      });
      setSelectedIds(new Set());
      fetchContacts();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatus = async (status: string) => {
    setBulkLoading(true);
    try {
      await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          ids: Array.from(selectedIds),
          data: { status },
        }),
      });
      setSelectedIds(new Set());
      fetchContacts();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = async () => {
    const res = await fetch('/api/contacts/export?format=csv');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Контакти</h1>
          <p className="text-foreground-muted">{total} контактів</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <svg
              className="h-4 w-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Експорт
          </Button>
          <Link href="/dashboard/contacts/import" data-tour="contact-import">
            <Button variant="outline">
              <svg
                className="h-4 w-4 mr-2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Імпорт
            </Button>
          </Link>
          <Button ref={quickBtnRef} onClick={() => setQuickOpen(true)} data-tour="contact-add">
            <svg
              className="h-4 w-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Додати контакт
          </Button>
          <QuickCreatePopover
            anchorEl={quickBtnRef.current}
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            title="Новий контакт"
          >
            <QuickContactForm onCreated={handleQuickCreated} />
          </QuickCreatePopover>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Обрано: {selectedIds.size} контактів</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Скасувати вибір
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <QuickSelect
                    value=""
                    onChange={(v) => {
                      if (v) handleBulkStatus(v);
                    }}
                    options={[
                      { id: 'active', name: 'Активний' },
                      { id: 'inactive', name: 'Неактивний' },
                      { id: 'lead', name: 'Лід' },
                      { id: 'client', name: 'Клієнт' },
                    ]}
                    placeholder="Змінити статус..."
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                >
                  {bulkLoading ? 'Видалення...' : 'Видалити'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3" data-tour="contact-search">
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
              <svg
                className="h-4 w-4 mr-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Фільтри
            </Button>
          </form>

          {showFilters && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <div className="w-44">
                <QuickSelect
                  value={filterStatus}
                  onChange={(v) => {
                    setFilterStatus(v);
                    setPage(1);
                  }}
                  options={[
                    { id: '', name: 'Всі статуси' },
                    { id: 'active', name: 'Активний' },
                    { id: 'inactive', name: 'Неактивний' },
                    { id: 'lead', name: 'Лід' },
                    { id: 'client', name: 'Клієнт' },
                  ]}
                  placeholder="Всі статуси"
                />
              </div>

              <div className="w-44">
                <QuickSelect
                  value={filterTag}
                  onChange={(v) => {
                    setFilterTag(v);
                    setPage(1);
                  }}
                  options={[
                    { id: '', name: 'Всі теги' },
                    ...tags.map((tag) => ({ id: tag.name, name: tag.name })),
                  ]}
                  placeholder="Всі теги"
                />
              </div>

              {(filterStatus || filterTag) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterStatus('');
                    setFilterTag('');
                    setPage(1);
                  }}
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
          <CardContent>
            <EmptyState
              icon={
                <svg
                  className="h-12 w-12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Контактів не знайдено"
              description="Додайте перший контакт, щоб почати роботу"
              action={<Button onClick={() => setQuickOpen(true)}>Додати перший контакт</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table header — desktop only */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-foreground-muted">
            <div className="col-span-1">
              <input
                type="checkbox"
                checked={selectedIds.size === contacts.length && contacts.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-border"
              />
            </div>
            <div className="col-span-3">Ім'я</div>
            <div className="col-span-2">Компанія</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Телефон</div>
            <div className="col-span-1">Статус</div>
            <div className="col-span-1">Теги</div>
          </div>

          {/* Mobile cards (<md): имя + компания крупно, остальное ниже, тап = карточка */}
          <div className="md:hidden space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                className={cn(
                  'bg-card rounded-lg border border-border p-4 space-y-2 cursor-pointer active:bg-secondary/50 transition-colors',
                  selectedIds.has(contact.id) && 'border-primary bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {contact.firstName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base truncate">{getName(contact)}</p>
                    {(contact.company || contact.position) && (
                      <p className="text-sm text-foreground-muted truncate">
                        {[contact.position, contact.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-5 rounded border-border shrink-0"
                    aria-label="Обрати контакт"
                  />
                </div>
                {(contact.phone || contact.email) && (
                  <p className="text-sm text-foreground-muted truncate pl-[52px]">
                    {[contact.phone, contact.email].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex gap-1.5 flex-wrap items-center pl-[52px]">
                  <Badge
                    variant={statusConfig[contact.status]?.variant || 'outline'}
                    className="text-xs"
                  >
                    {statusConfig[contact.status]?.label || contact.status}
                  </Badge>
                  {contact.tags?.slice(0, 3).map((ct) => (
                    <Badge
                      key={ct.tag.id}
                      variant="outline"
                      className="text-xs"
                      style={
                        ct.tag.color
                          ? { borderColor: ct.tag.color, color: ct.tag.color }
                          : undefined
                      }
                    >
                      {ct.tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Rows — desktop table */}
          <div className="hidden md:block space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={cn(
                  'grid grid-cols-12 gap-4 px-4 py-3 bg-card rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer items-center',
                  selectedIds.has(contact.id) && 'border-primary bg-primary/5',
                )}
              >
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>
                <div
                  className="col-span-3"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
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

                <div
                  className="col-span-2 text-sm text-foreground-muted truncate"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  {contact.company || '—'}
                </div>

                <div
                  className="col-span-2 text-sm truncate"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  {contact.email || '—'}
                </div>

                <div
                  className="col-span-2 text-sm truncate"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  {contact.phone || '—'}
                </div>

                <div
                  className="col-span-1"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  <Badge
                    variant={statusConfig[contact.status]?.variant || 'outline'}
                    className="text-xs"
                  >
                    {statusConfig[contact.status]?.label || contact.status}
                  </Badge>
                </div>

                <div
                  className="col-span-1 flex gap-1 flex-wrap"
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  {contact.tags?.slice(0, 2).map((ct) => (
                    <Badge
                      key={ct.tag.id}
                      variant="outline"
                      className="text-xs"
                      style={
                        ct.tag.color
                          ? { borderColor: ct.tag.color, color: ct.tag.color }
                          : undefined
                      }
                    >
                      {ct.tag.name}
                    </Badge>
                  ))}
                  {(contact.tags?.length || 0) > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{contact.tags!.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
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
