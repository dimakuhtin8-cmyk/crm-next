/**
 * Табова фільтрація задач (Усі / Сьогодні / Прострочені / Завершені).
 * Чисті функції без React — юніт-тести можуть викликати напряму.
 */

export type TaskTab = 'all' | 'today' | 'overdue' | 'completed';

export interface TabTaskLike {
  status: string;
  dueDate: string | null;
}

/** Календарна рівність дат: рік, місяць і день збігаються. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Прострочена: дедлайн у минулому, статус не done/cancelled. */
export function isTaskOverdue(task: TabTaskLike, now: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}

/** Сьогодні: дедлайн сьогодні (календарно), статус не done/cancelled. */
export function isTaskToday(task: TabTaskLike, now: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return isSameCalendarDay(new Date(task.dueDate), now);
}

/** Табова фільтрація списку. */
export function filterTasksByTab<T extends TabTaskLike>(
  tasks: T[],
  tab: TaskTab,
  now: Date = new Date(),
): T[] {
  switch (tab) {
    case 'today':
      return tasks.filter((task) => isTaskToday(task, now));
    case 'overdue':
      return tasks.filter((task) => isTaskOverdue(task, now));
    case 'completed':
      return tasks.filter((task) => task.status === 'done');
    case 'all':
    default:
      return tasks;
  }
}
