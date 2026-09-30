// Тур навчання: конфіг повний і коректний (чистий unit-тест, без DOM).

import { describe, it, expect } from 'vitest';

import { TOURS, tourDoneKey, type TourKey } from '@/components/tour/tour-config';

const KEYS: TourKey[] = ['dashboard', 'contacts', 'deals', 'tasks', 'copilot', 'team'];

describe('tour-config', () => {
  it('усі тури існують і мають щонайменше 2 кроки', () => {
    for (const key of KEYS) {
      expect(Array.isArray(TOURS[key])).toBe(true);
      expect(TOURS[key].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('кожен крок має data-tour якір, заголовок і текст', () => {
    for (const key of KEYS) {
      for (const step of TOURS[key]) {
        expect(step.target.startsWith('[data-tour="')).toBe(true);
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.text.length).toBeGreaterThan(10);
      }
    }
  });

  it('якорі унікальні в межах туру', () => {
    for (const key of KEYS) {
      const targets = TOURS[key].map((s) => s.target);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('ключ localStorage унікальний для кожного туру', () => {
    const keys = KEYS.map(tourDoneKey);
    expect(new Set(keys).size).toBe(KEYS.length);
  });
});
