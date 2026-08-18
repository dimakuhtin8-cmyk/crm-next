import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-glow',
        destructive:
          'bg-danger text-danger-foreground hover:bg-danger-hover shadow-lg shadow-danger/25',
        outline:
          'border border-border bg-transparent hover:bg-secondary hover:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        ghost:
          'hover:bg-secondary hover:text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
        danger:
          'bg-danger text-danger-foreground hover:bg-danger-hover',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonBaseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

interface ButtonAsChildProps extends ButtonBaseProps {
  asChild: true;
  children: React.ReactElement;
}

interface ButtonDefaultProps extends ButtonBaseProps {
  asChild?: false;
}

type ButtonProps = ButtonAsChildProps | ButtonDefaultProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const { className: childClassName, disabled: childDisabled, ...rest } = children.props as Record<string, unknown>;
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        ref,
        className: cn(
          buttonVariants({ variant, size, className }),
          childClassName as string | undefined,
        ),
        disabled: disabled || isLoading || (childDisabled as boolean | undefined),
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
