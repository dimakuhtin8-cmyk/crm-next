'use client';

import { Bot, CheckSquare, Settings, TrendingUp, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  SETTINGS_ITEMS,
  dynamicItemValue,
  emptyStateText,
  hasAnyResults,
  normalizeSearchResults,
  settingsItemValue,
  type PaletteSearchResults,
} from './command-palette-logic';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui';

/** Подія відкриття палітри (header диспатчить її на клік по кнопці пошуку). */
export const OPEN_PALETTE_EVENT = 'crm:open-command-palette';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteSearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K та зовнішній запит на відкриття.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Скидання стану при закритті.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      setLoading(false);
    }
  }, [open]);

  // Дебаунс-пошук по /api/search (250 мс).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setResults(normalizeSearchResults(d)))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const showResults = hasAnyResults(results);
  const emptyText = emptyStateText(query, loading, showResults);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Пошук контактів, угод, задач..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>

        {showResults && results && (
          <>
            {results.contacts.length > 0 && (
              <CommandGroup heading="Контакти">
                {results.contacts.map((c) => (
                  <CommandItem
                    key={`c-${c.id}`}
                    value={dynamicItemValue(c.name, c.subtitle, query)}
                    onSelect={() => go(`/dashboard/contacts/${c.id}`)}
                  >
                    <Users className="text-foreground-muted" />
                    <span className="truncate font-medium">{c.name}</span>
                    {c.subtitle && (
                      <span className="ml-auto truncate text-xs text-foreground-muted">
                        {c.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.deals.length > 0 && (
              <CommandGroup heading="Угоди">
                {results.deals.map((d) => (
                  <CommandItem
                    key={`d-${d.id}`}
                    value={dynamicItemValue(d.name, d.subtitle, query)}
                    onSelect={() => go(`/dashboard/deals/${d.id}`)}
                  >
                    <TrendingUp className="text-foreground-muted" />
                    <span className="truncate font-medium">{d.name}</span>
                    {d.subtitle && (
                      <span className="ml-auto truncate text-xs text-foreground-muted">
                        {d.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.tasks.length > 0 && (
              <CommandGroup heading="Задачі">
                {results.tasks.map((t) => (
                  <CommandItem
                    key={`t-${t.id}`}
                    value={dynamicItemValue(t.name, t.subtitle, query)}
                    onSelect={() => go(`/dashboard/tasks/${t.id}`)}
                  >
                    <CheckSquare className="text-foreground-muted" />
                    <span className="truncate font-medium">{t.name}</span>
                    {t.subtitle && (
                      <span className="ml-auto truncate text-xs text-foreground-muted">
                        {t.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        <CommandGroup heading="Налаштування">
          {SETTINGS_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={settingsItemValue(item)}
              onSelect={() => go(item.href)}
            >
              {item.href.endsWith('ai-keys') ? (
                <Bot className="text-foreground-muted" />
              ) : (
                <Settings className="text-foreground-muted" />
              )}
              <span className="truncate">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
