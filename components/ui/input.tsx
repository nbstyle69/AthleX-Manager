import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex min-h-11 w-full min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text shadow-none sm:text-sm',
        'placeholder:text-ax-text-muted file:mr-3 file:rounded-ax-control file:border-0 file:bg-ax-surface-secondary file:px-2 file:py-1 file:text-sm file:font-medium file:text-ax-text',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:bg-ax-neutral-soft [html.light_&]:disabled:bg-ax-surface-secondary disabled:text-ax-text-muted aria-[invalid=true]:border-ax-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
