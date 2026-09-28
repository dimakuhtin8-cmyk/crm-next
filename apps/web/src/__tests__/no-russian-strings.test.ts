// П1.4: защита от возврата русских строк в UI.
// Сканирует tsx под app и components (кроме тестов), вырезает комментарии
// (двойной слэш и блочные) и падает при буквах ы э ъ ё вне комментариев.

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '..');

/** Убрать комментарии, сохранив строковые литералы как есть. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next || '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function collectTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      collectTsx(full, acc);
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('П1.4: нет русских букв в UI-строках', () => {
  it('ы э ъ ё (и заглавные) вне комментариев — ни в одном tsx', () => {
    const files = [
      ...collectTsx(path.join(SRC, 'app')),
      ...collectTsx(path.join(SRC, 'components')),
    ];
    expect(files.length).toBeGreaterThan(0);
    const bad: string[] = [];
    const re = /[ыэъёЫЭЪЁ]/;
    for (const f of files) {
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      const lines = code.split('\n');
      lines.forEach((line, idx) => {
        if (re.test(line)) {
          bad.push(`${path.relative(SRC, f)}:${idx + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
