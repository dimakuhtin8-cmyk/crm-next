'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  emptyMessage?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 20,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  emptyMessage = 'Немає даних',
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDirection>(null);
  const [page, setPage] = React.useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = String(aVal).localeCompare(String(bVal), 'uk');
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  const isSelected = (item: T) =>
    selectedRows.some((r) => r.id === item.id);

  const toggleRow = (item: T) => {
    if (!onSelectionChange) return;
    if (isSelected(item)) {
      onSelectionChange(selectedRows.filter((r) => r.id !== item.id));
    } else {
      onSelectionChange([...selectedRows, item]);
    }
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedRows.length === pagedData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...pagedData]);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pagedData.length > 0 && selectedRows.length === pagedData.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground',
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <svg
                        className={cn('h-4 w-4', sortDir === 'desc' && 'rotate-180')}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5l0 14M5 12l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-foreground-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((item, i) => (
                <tr
                  key={i}
                  className={cn(
                    'transition-colors hover:bg-card-hover',
                    isSelected(item) && 'bg-primary-light',
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected(item)}
                        onChange={() => toggleRow(item)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sortedData.length)} з{' '}
            {sortedData.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg px-3 py-1.5 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Назад
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    page === pageNum
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary',
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="rounded-lg px-3 py-1.5 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Далі
            </button>
          </div>
        </div>
      )}
    </div>
  );
}