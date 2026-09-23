import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 rounded-ax-badge border border-current px-2 py-1 text-xs font-semibold leading-4',
  {
    variants: {
      variant: {
        neutral: 'bg-ax-neutral-soft text-ax-neutral',
        accent: 'bg-ax-accent-soft text-ax-accent-text',
        success: 'bg-ax-success-soft text-ax-success',
        warning: 'bg-ax-warning-soft text-ax-warning',
        danger: 'bg-ax-danger-soft text-ax-danger',
        info: 'bg-ax-info-soft text-ax-info',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
  ),
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
