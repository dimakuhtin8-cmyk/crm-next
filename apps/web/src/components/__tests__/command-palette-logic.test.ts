// Юніт-тести чистої логіки командної палітри (без DOM, без API, без React).

import { describe, expect, it } from 'vitest';

import {
  SETTINGS_ITEMS,
  dynamicItemValue,
  emptyStateText,
  hasAnyResults,
  normalizeSearchResults,
  settingsItemValue,
} from '@/components/command-palette-logic';

describe('normalizeSearchResults', () => {
  const raw = {
    contacts: [
      { id: 'c1', name: 'Іван Петренко', subtitle: 'CEO' },
      { id: 'c2', name: '', subtitle: 'без імені' },
      'не-обʼєкт',
    ],
    deals: [{ id: 'd1', name: 'Ліцензія', subtitle: '₴10 000' }],
    tasks: [{ id: 't1', name: 'Дзвінок', subtitle: '' }],
  };

  it('групує відповідь /api/search у три колекції', () => {
    const r = normalizeSearchResults(raw);
    expect(r).not.toBeNull();
    expect(r!.contacts.map((c) => c.id)).toEqual(['c1']);
    expect(r!.deals[0].name).toEqual('Ліцензія');
    expect(r!.tasks[0].id).toEqual('t1');
  });

  it('примусово приводить поля до рядка і відкидає пункти без імені', () => {
    const r = normalizeSearchResults(raw)!;
    expect(typeof r.contacts[0].subtitle).toBe('string');
    expect(r.contacts).toHaveLength(1); // пусте імʼя та не-обʼєкт відкинуті
  });

  it('повертає null для відсутньої/некоректної відповіді', () => {
    expect(normalizeSearchResults(null)).toBeNull();
    expect(normalizeSearchResults(undefined)).toBeNull();
    expect(normalizeSearchResults('рядок')).toBeNull();
    expect(normalizeSearchResults({})).toEqual({ contacts: [], deals: [], tasks: [] });
  });

  it('толерує відсутність окремих колекцій', () => {
    const r = normalizeSearchResults({ contacts: 'пошкоджено' })!;
    expect(r.contacts).toEqual([]);
    expect(r.deals).toEqual([]);
    expect(r.tasks).toEqual([]);
  });
});

describe('hasAnyResults', () => {
  it('false для null і порожніх колекцій', () => {
    expect(hasAnyResults(null)).toBe(false);
    expect(hasAnyResults({ contacts: [], deals: [], tasks: [] })).toBe(false);
  });

  it('true хоча б для однієї непорожньої колекції', () => {
    expect(
      hasAnyResults({ contacts: [], deals: [], tasks: [{ id: '1', name: 'А', subtitle: '' }] }),
    ).toBe(true);
  });
});

describe('dynamicItemValue', () => {
  it('містить сирий запит — cmdk ніколи не відфільтрує серверний результат', () => {
    const value = dynamicItemValue('Іван Петренко', 'CEO', '0931234567');
    expect(value).toContain('0931234567');
    expect(value).toContain('Іван Петренко');
  });

  it('запит входить у value як підрядок (гарантія підслівного збігу)', () => {
    const query = 'петренко';
    const value = dynamicItemValue('Іван Петренко', 'CEO', query);
    expect(value.toLowerCase()).toContain(query);
  });
});

describe('settingsItemValue', () => {
  it('містить мітку та ключові слова для підслівного фільтру', () => {
    const item = SETTINGS_ITEMS[0];
    const value = settingsItemValue(item);
    expect(value).toContain(item.label);
    expect(value).toContain(item.keywords);
  });
});

describe('emptyStateText', () => {
  it('підказка для короткого запиту', () => {
    expect(emptyStateText('', false, false)).toBe('Почніть вводити для пошуку...');
    expect(emptyStateText('а', false, false)).toBe('Почніть вводити для пошуку...');
  });

  it('індикатор завантаження для валідного запиту', () => {
    expect(emptyStateText('ivan', true, false)).toBe('Шукаю...');
  });

  it('порожній стан коли нічого не знайдено', () => {
    expect(emptyStateText('ivan', false, false)).toBe('Нічого не знайдено');
  });

  it('порожній рядок коли результати є (стан не відображається)', () => {
    expect(emptyStateText('ivan', false, true)).toBe('');
  });
});

describe('SETTINGS_ITEMS', () => {
  it('унікальні href у межах групи', () => {
    const hrefs = SETTINGS_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('усі пункти ведуть у розділ налаштувань', () => {
    for (const item of SETTINGS_ITEMS) {
      expect(item.href.startsWith('/dashboard/settings')).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
