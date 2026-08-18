'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  className?: string;
}

export function Dropdown({ trigger, items, className }: DropdownProps) {
  return (
    <div className={cn('relative group', className)}>
      {trigger}
      <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-lg group-hover:block">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary',
              item.danger && 'text-red-500 hover:bg-red-500/10',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
