'use client';

import {
  Building2,
  Download,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickContactForm, QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Table,
} from '@/components/ui';
import { cn } from '@/lib/utils';

type Contact = {
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
};

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

// Повна картка контакту з розшифрованими полями (GET /api/contacts/[id])
interface ContactDetail extends Contact {
  notes: string | null;
  owner?: { name: string | null; email: string | null } | null;
}

// Угоди, пов'язані з контактом (GET /api/deals?contactId=)
interface SheetDeal {
  id: string;
  title: string;
  value?: number | null;
  currency?: string | null;
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

const currencySymbols: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

// Сума угоди зі символом валюти; якщо суми немає — тире
const formatDealAmount = (
  value: number | null | undefined,
  currency: string | null | undefined,
): string => {
  if (value === null || value === undefined) return '—';
  const symbol = currency ? (currencySymbols[currency] ?? currency) : '';
  return `${symbol}${value.toLocaleString('uk')}`;
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

  // Шухляда з деталями контакту
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetContact, setSheetContact] = useState<ContactDetail | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetDeals, setSheetDeals] = useState<SheetDeal[]>([]);

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

  // Паралельно тягнемо контакт і його угоди; помилки ковтаємо тихо
  useEffect(() => {
    if (!openId) {
      setSheetContact(null);
      setSheetDeals([]);
      setSheetLoading(false);
      return;
    }

    let cancelled = false;
    setSheetContact(null);
    setSheetDeals([]);
    setSheetLoading(true);

    const loadSheet = async () => {
      try {
        const [contactRes, dealsRes] = await Promise.all([
          fetch(`/api/contacts/${openId}`),
          fetch(`/api/deals?contactId=${openId}`),
        ]);
        const contactData = await contactRes.json();
        const dealsData = await dealsRes.json();
        if (cancelled) return;
        setSheetContact(contactData.contact || null);
        setSheetDeals(dealsData?.data?.deals || dealsData?.deals || []);
      } catch {
        // тихо: шухляда просто лишиться порожньою
      } finally {
        if (!cancelled) setSheetLoading(false);
      }
    };

    loadSheet();

    return () => {
      cancelled = true;
    };
  }, [openId]);

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

  const openSheet = (id: string) => setOpenId(id);

  // Bulk operations
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

  // Стовпці десктопної таблиці
  const columns = [
    {
      key: 'name',
      header: 'Контакт',
      render: (contact: Contact) => (
        <div className="flex items-center gap-3">
          <Avatar name={getName(contact)} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{getName(contact)}</p>
            <p className="truncate text-xs text-foreground-muted">
              {contact.position || contact.company || ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'info',
      header: 'Email / Телефон',
      render: (contact: Contact) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{contact.email || '—'}</p>
          <p className="truncate text-xs text-foreground-muted">{contact.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (contact: Contact) => (
        <Badge variant={statusConfig[contact.status]?.variant || 'outline'} className="text-xs">
          {statusConfig[contact.status]?.label || contact.status}
        </Badge>
      ),
    },
    {
      key: 'tags',
      header: 'Теги',
      render: (contact: Contact) => (
        <div className="flex flex-wrap items-center gap-1">
          {contact.tags?.slice(0, 2).map((ct) => (
            <Badge
              key={ct.tag.id}
              variant="outline"
              className="text-xs"
              style={ct.tag.color ? { borderColor: ct.tag.color, color: ct.tag.color } : undefined}
            >
              {ct.tag.name}
            </Badge>
          ))}
          {(contact.tags?.length || 0) > 2 && (
            <Badge variant="outline" className="text-xs">
              +{contact.tags!.length - 2}
            </Badge>
          )}
          {!contact.tags?.length && <span className="text-foreground-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Дії',
      className: 'w-14',
      render: (contact: Contact) => (
        // Клік по меню не має відкривати шухляду
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Дії з контактом">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}>
                Відкрити картку
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger focus:bg-danger-light focus:text-danger"
                onClick={async () => {
                  if (!confirm('Видалити контакт?')) return;
                  await fetch('/api/contacts/' + contact.id, { method: 'DELETE' });
                  if (openId === contact.id) setOpenId(null);
                  fetchContacts();
                }}
              >
                Видалити
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Контакти</h1>
          <p className="text-sm text-foreground-muted">{total} контактів</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Експорт
          </Button>
          <Link href="/dashboard/contacts/import" data-tour="contact-import">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Імпорт
            </Button>
          </Link>
          <Button ref={quickBtnRef} onClick={() => setQuickOpen(true)} data-tour="contact-add">
            <Plus className="h-4 w-4" />
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
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
              <Filter className="h-4 w-4" />
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

      {/* Contacts List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
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
          {/* Мобільні картки (<md): тап відкриває шухляду */}
          <div className="space-y-2 md:hidden">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => openSheet(contact.id)}
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

          {/* Десктопна таблиця (md+) */}
          <div className="hidden md:block">
            <Table
              columns={columns}
              data={contacts}
              pageSize={50}
              selectable
              selectedRows={contacts.filter((c) => selectedIds.has(c.id))}
              onSelectionChange={(rows) => setSelectedIds(new Set(rows.map((r) => r.id)))}
              onRowClick={(contact) => openSheet(contact.id)}
              emptyMessage="Контактів не знайдено"
            />
          </div>
        </div>
      )}

      {/* Шухляда з деталями контакту */}
      <Sheet
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg" aria-describedby={undefined}>
          <SheetHeader>
            <div className="flex items-center gap-3 pr-8">
              <Avatar name={sheetContact ? getName(sheetContact) : 'Контакт'} />
              <div className="min-w-0">
                <SheetTitle className="truncate">
                  {sheetContact ? getName(sheetContact) : 'Контакт'}
                </SheetTitle>
                <p className="truncate text-xs text-foreground-muted">
                  {sheetContact
                    ? [sheetContact.position, sheetContact.company].filter(Boolean).join(' · ')
                    : ''}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {sheetLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : sheetContact ? (
              <>
                {/* Статус і теги */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={statusConfig[sheetContact.status]?.variant || 'outline'}
                    className="text-xs"
                  >
                    {statusConfig[sheetContact.status]?.label || sheetContact.status}
                  </Badge>
                  {sheetContact.tags?.map((ct) => (
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

                {/* Контактні дані */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="text-foreground-muted">{sheetContact.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="text-foreground-muted">{sheetContact.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="text-foreground-muted">
                      {[sheetContact.company, sheetContact.position].filter(Boolean).join(' · ') ||
                        '—'}
                    </span>
                  </div>
                </div>

                {/* Нотатки */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground-muted">Нотатки</p>
                  {sheetContact.notes ? (
                    <p className="rounded-lg border border-border bg-background p-3 text-sm whitespace-pre-wrap">
                      {sheetContact.notes}
                    </p>
                  ) : (
                    <p className="text-sm text-foreground-muted">Нотаток немає</p>
                  )}
                </div>

                {/* Пов'язані угоди */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground-muted">Пов&apos;язані угоди</p>
                  {sheetDeals.length > 0 ? (
                    <div className="space-y-2">
                      {sheetDeals.map((deal) => (
                        <Link
                          key={deal.id}
                          href={`/dashboard/deals/${deal.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                        >
                          <span className="truncate font-medium">{deal.title}</span>
                          <span className="shrink-0 text-sm font-semibold text-primary">
                            {formatDealAmount(deal.value, deal.currency)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-muted">Угод немає</p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <SheetFooter>
            <Link
              href={`/dashboard/contacts/${openId ?? ''}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Відкрити повну картку
            </Link>
            <SheetClose className="h-9 rounded-md px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-secondary">
              Закрити
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
