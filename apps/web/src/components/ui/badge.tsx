import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        destructive:
          'border-transparent bg-danger text-danger-foreground hover:bg-danger-hover',
        outline: 'border-border text-foreground',
        success:
          'border-transparent bg-success-light text-success',
        warning:
          'border-transparent bg-warning-light text-warning',
        danger:
          'border-transparent bg-danger-light text-danger',
        info:
          'border-transparent bg-info-light text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  removable?: boolean;
  onRemove?: () => void;
}

function Badge({ className, variant, removable, onRemove, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 -mr-1 rounded-full p-0.5 hover:bg-foreground/10"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

export { Badge, badgeVariants };