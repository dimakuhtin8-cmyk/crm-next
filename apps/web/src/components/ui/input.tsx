import * as React from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm transition-colors placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-danger focus-visible:ring-danger'
              : 'border-border focus-visible:ring-ring',
            className,
          )}
          ref={ref}
          {...props}
        />
        {(error || helperText) && (
          <p className={cn('text-xs', error ? 'text-danger' : 'text-foreground-muted')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
