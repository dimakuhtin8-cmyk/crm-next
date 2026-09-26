import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Radix-style callback alias — receives the selected value. */
  onValueChange?: (value: string) => void;
}

function Select({ className, children, onValueChange, onChange, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:opacity-50',
        className
      )}
      onChange={(e) => {
        onChange?.(e);
        onValueChange?.(e.target.value);
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
