// Чиста логіка командної палітри (без React) — юніт-тести імпортують цей модуль.

export interface PaletteNavItem {
  label: string;
  href: string;
  keywords: string;
}

export interface PaletteEntity {
  id: string;
  name: string;
  subtitle: string;
}

export interface PaletteSearchResults {
  contacts: PaletteEntity[];
  deals: PaletteEntity[];
  tasks: PaletteEntity[];
}

/**
 * Статичні пункти групи «Налаштування» (швидка навігація).
 * label — ключ перекладу next-intl (див. command-palette.tsx: tRoot(item.label)).
 * keywords — пошукові підказки для cmdk, не відображаються.
 */
export const SETTINGS_ITEMS: PaletteNavItem[] = [
  { label: 'navigation.settings', href: '/dashboard/settings', keywords: 'загальні settings' },
  {
    label: 'settings.profile',
    href: '/dashboard/settings/profile',
    keywords: 'акаунт email пароль',
  },
  {
    label: 'settings.telegramBotCardTitle',
    href: '/dashboard/settings/telegram',
    keywords: 'бот інтеграція',
  },
  {
    label: 'navigation.aiKeys',
    href: '/dashboard/settings/ai-keys',
    keywords: 'openai ключі провайдер',
  },
  {
    label: 'navigation.teamAndTenants',
    href: '/dashboard/settings/tenants',
    keywords: 'колеги запрошення роль',
  },
  {
    label: 'navigation.securityAudit',
    href: '/dashboard/settings/audit',
    keywords: 'лог журнал безпека',
  },
];

/** Нормалізує відповідь /api/search до внутрішнього вигляду. */
export function normalizeSearchResults(raw: unknown): PaletteSearchResults | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<Record<'contacts' | 'deals' | 'tasks', unknown>>;
  const pick = (list: unknown): PaletteEntity[] => {
    if (!Array.isArray(list)) return [];
    return list
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        subtitle: String(item.subtitle ?? ''),
      }))
      .filter((item) => item.name.length > 0);
  };
  return {
    contacts: pick(data.contacts),
    deals: pick(data.deals),
    tasks: pick(data.tasks),
  };
}

export function hasAnyResults(results: PaletteSearchResults | null): boolean {
  if (!results) return false;
  return results.contacts.length > 0 || results.deals.length > 0 || results.tasks.length > 0;
}

/**
 * value пункту для cmdk: містить сирий запит,
 * щоб серверні результати ніколи не відфільтровувалися клієнтським
 * підслівним пошуком cmdk (збіг вже зробив бекенд).
 */
export function dynamicItemValue(name: string, subtitle: string, query: string): string {
  return `${name} ${subtitle} ${query}`.trim();
}

/** value статичного пункту — фільтрується cmdk підслівно. */
export function settingsItemValue(item: PaletteNavItem): string {
  return `${item.label} ${item.keywords}`;
}

/**
 * Ключ перекладу (next-intl) для порожнього стану списку.
 * Повертаємо ключ, а не готовий текст: модуль чистий від React,
 * переклад застосовує command-palette.tsx через tRoot().
 */
export function emptyStateText(query: string, loading: boolean, hasResults: boolean): string {
  const q = query.trim();
  if (q.length < 2) return 'common.startTyping';
  if (loading) return 'common.searching';
  if (hasResults) return '';
  return 'common.nothingFound';
}
