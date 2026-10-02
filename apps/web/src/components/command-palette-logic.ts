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

/** Статичні пункти групи «Налаштування» (швидка навігація). */
export const SETTINGS_ITEMS: PaletteNavItem[] = [
  { label: 'Налаштування', href: '/dashboard/settings', keywords: 'загальні settings' },
  { label: 'Профіль', href: '/dashboard/settings/profile', keywords: 'акаунт email пароль' },
  { label: 'AI-ключі', href: '/dashboard/settings/ai-keys', keywords: 'openai ключі провайдер' },
  { label: 'Telegram-бот', href: '/dashboard/settings/telegram', keywords: 'бот інтеграція' },
  {
    label: 'Команда й тенанти',
    href: '/dashboard/settings/tenants',
    keywords: 'колеги запрошення роль',
  },
  { label: 'Аудит безпеки', href: '/dashboard/settings/audit', keywords: 'лог журнал безпека' },
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

/** Який текст показувати у порожньому стані списку. */
export function emptyStateText(query: string, loading: boolean, hasResults: boolean): string {
  const q = query.trim();
  if (q.length < 2) return 'Почніть вводити для пошуку...';
  if (loading) return 'Шукаю...';
  if (hasResults) return '';
  return 'Нічого не знайдено';
}
