// Юніт-тести табової фільтрації задач (чисті функції, без DOM).

import { describe, expect, it } from 'vitest';

import {
  filterTasksByTab,
  isSameCalendarDay,
  isTaskOverdue,
  isTaskToday,
  type TabTaskLike,
} from '@/lib/task-tabs';

const NOW = new Date('2026-10-02T12:00:00'); // пʼятниця, фіксований «зараз»
const TODAY = '2026-10-02T18:00:00';
const YESTERDAY = '2026-10-01T18:00:00';
const TOMORROW = '2026-10-03T18:00:00';

const task = (status: string, dueDate: string | null): TabTaskLike => ({ status, dueDate });

describe('isSameCalendarDay', () => {
  it('однаковий рік/місяць/день → true', () => {
    expect(isSameCalendarDay(new Date('2026-10-02T01:00'), new Date('2026-10-02T23:59'))).toBe(
      true,
    );
  });

  it('різні доби/місяці → false', () => {
    expect(isSameCalendarDay(new Date('2026-10-02T23:59'), new Date('2026-10-03T00:01'))).toBe(
      false,
    );
    expect(isSameCalendarDay(new Date('2026-10-02'), new Date('2026-11-02'))).toBe(false);
  });
});

describe('isTaskOverdue', () => {
  it('дедлайн у минулому, статус активний → true', () => {
    expect(isTaskOverdue(task('todo', YESTERDAY), NOW)).toBe(true);
    expect(isTaskOverdue(task('in_progress', YESTERDAY), NOW)).toBe(true);
  });

  it('завершені/скасовані не прострочуються', () => {
    expect(isTaskOverdue(task('done', YESTERDAY), NOW)).toBe(false);
    expect(isTaskOverdue(task('cancelled', YESTERDAY), NOW)).toBe(false);
  });

  it('майбутній або відсутній дедлайн → false', () => {
    expect(isTaskOverdue(task('todo', TOMORROW), NOW)).toBe(false);
    expect(isTaskOverdue(task('todo', null), NOW)).toBe(false);
  });

  it('сьогоднішній дедлайн ще не прострочений до кінця доби', () => {
    expect(isTaskOverdue(task('todo', TODAY), NOW)).toBe(false);
  });
});

describe('isTaskToday', () => {
  it('дедлайн сьогодні, статус активний → true', () => {
    expect(isTaskToday(task('todo', TODAY), NOW)).toBe(true);
    expect(isTaskToday(task('in_progress', '2026-10-02T00:30:00'), NOW)).toBe(true);
  });

  it('завершені/скасовані сьогодні не потрапляють', () => {
    expect(isTaskToday(task('done', TODAY), NOW)).toBe(false);
    expect(isTaskToday(task('cancelled', TODAY), NOW)).toBe(false);
  });

  it('інший день або відсутній дедлайн → false', () => {
    expect(isTaskToday(task('todo', TOMORROW), NOW)).toBe(false);
    expect(isTaskToday(task('todo', YESTERDAY), NOW)).toBe(false);
    expect(isTaskToday(task('todo', null), NOW)).toBe(false);
  });
});

describe('filterTasksByTab', () => {
  const tasks: TabTaskLike[] = [
    task('todo', YESTERDAY), // прострочена
    task('in_progress', TODAY), // сьогодні
    task('todo', TOMORROW), // майбутня
    task('done', YESTERDAY), // завершена (в минулому)
    task('done', null), // завершена без дедлайну
    task('todo', null), // без дедлайну
  ];

  it('all → усі задачі без змін', () => {
    expect(filterTasksByTab(tasks, 'all', NOW)).toHaveLength(6);
  });

  it('today → лише активні з дедлайном на сьогодні', () => {
    const r = filterTasksByTab(tasks, 'today', NOW);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('in_progress');
  });

  it('overdue → лише активні з минулим дедлайном', () => {
    const r = filterTasksByTab(tasks, 'overdue', NOW);
    expect(r).toHaveLength(1);
    expect(r[0].dueDate).toBe(YESTERDAY);
    expect(r[0].status).toBe('todo');
  });

  it('completed → усі done незалежно від дедлайну', () => {
    const r = filterTasksByTab(tasks, 'completed', NOW);
    expect(r).toHaveLength(2);
    expect(r.every((t) => t.status === 'done')).toBe(true);
  });

  it('порожній список → порожній результат для будь-якого табу', () => {
    for (const tab of ['all', 'today', 'overdue', 'completed'] as const) {
      expect(filterTasksByTab([], tab, NOW)).toEqual([]);
    }
  });

  it('не мутує вхідний масив', () => {
    const input = [task('todo', YESTERDAY)];
    filterTasksByTab(input, 'completed', NOW);
    expect(input).toHaveLength(1);
  });
});
