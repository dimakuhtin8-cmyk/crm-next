// Тур навчання: кожен якір із конфігу реально існує у відповідному файлі.
// Тип тесту: статичний скан fs-файлів (аналог no-russian-strings) + імпорт конфігу.

import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { TOURS, type TourKey } from '@/components/tour/tour-config';

const SRC = path.resolve(__dirname, '..', '..', '..');

/** Якір → файл (відносно apps/web/src), де він має існувати. */
function fileForAnchor(target: string): string {
  if (target === 'nav') return 'app/[locale]/dashboard/sidebar.tsx';
  if (target === 'quick-create' || target === 'search') return 'app/[locale]/dashboard/header.tsx';
  if (target.startsWith('first-steps')) return 'app/[locale]/dashboard/page.tsx';
  if (target.startsWith('contact-')) return 'app/[locale]/dashboard/contacts/page.tsx';
  if (target.startsWith('deal-')) return 'app/[locale]/dashboard/deals/page.tsx';
  if (target.startsWith('task-')) return 'app/[locale]/dashboard/tasks/page.tsx';
  if (target.startsWith('copilot-')) return 'app/[locale]/dashboard/copilot/page.tsx';
  if (target.startsWith('team-'))
    return 'app/[locale]/dashboard/settings/tenants/[id]/team/page.tsx';
  throw new Error(`Невідомий якір туру: ${target}`);
}

const TOUR_KEYS: TourKey[] = ['dashboard', 'contacts', 'deals', 'tasks', 'copilot', 'team'];

describe('якорі турів існують у сторінках', () => {
  it('конфіг містить усі тури', () => {
    for (const key of TOUR_KEYS) {
      expect(TOURS[key].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('кожен data-tour якір з конфігу наявний у своєму файлі', () => {
    const missing: string[] = [];

    for (const key of TOUR_KEYS) {
      for (const step of TOURS[key]) {
        const match = step.target.match(/^\[data-tour="([^"]+)"\]$/);
        expect(match, `ціль туру "${key}" має бути [data-tour="..."]`).not.toBeNull();

        const anchor = match![1];
        const relFile = fileForAnchor(anchor);
        const absFile = path.join(SRC, relFile);
        expect(fs.existsSync(absFile), `файл ${relFile} має існувати`).toBe(true);

        const content = fs.readFileSync(absFile, 'utf8');
        if (!content.includes(`data-tour="${anchor}"`)) {
          missing.push(`${key} → ${anchor} (немає в ${relFile})`);
        }
      }
    }

    expect(missing, `якорі відсутні: ${missing.join(', ')}`).toEqual([]);
  });

  it('якорі унікальні в межах файлів, де шукаються', () => {
    const files = [
      'app/[locale]/dashboard/contacts/page.tsx',
      'app/[locale]/dashboard/deals/page.tsx',
      'app/[locale]/dashboard/tasks/page.tsx',
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(SRC, rel), 'utf8');
      const found = [...content.matchAll(/data-tour="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(found).size, `дублі якорів у ${rel}`).toBe(found.length);
    }
  });
});
