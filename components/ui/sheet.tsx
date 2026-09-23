'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/**
 * Panneau latéral bâti sur le Dialog Radix déjà présent dans le projet. Il
 * garde la page dessous montée : le formulaire en cours de saisie n'est pas
 * perdu quand on ouvre l'aide (§5.2).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  children,
  className,
  title,
  description,
  side = 'right',
  hideTitle = false,
  bodyClassName,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: ReactNode;
  side?: 'left' | 'right';
  hideTitle?: boolean;
  bodyClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ax-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-0 z-50 flex h-full w-full max-w-md flex-col bg-ax-glass text-ax-text shadow-ax-panel backdrop-blur-ax-glass outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
          side === 'right'
            ? 'right-0 border-l border-ax-border sm:rounded-l-ax-panel data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'
            : 'left-0 border-r border-ax-border sm:rounded-r-ax-panel data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
          className,
        )}
        {...props}
      >
        <div className={cn('flex items-start justify-between gap-3 border-b border-ax-border px-5 py-4', hideTitle && 'sr-only')}>
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-xl font-medium uppercase tracking-wide text-ax-text">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-xs leading-relaxed text-ax-text-secondary">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {!hideTitle && <SheetCloseButton />}
        </div>
        <div className={cn('flex-1 overflow-y-auto', bodyClassName ?? 'px-5 py-4')}>{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetCloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Fermer"
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-ax-control text-ax-text-secondary transition-colors hover:bg-ax-hover hover:text-ax-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface motion-reduce:transition-none',
        className,
      )}
    >
      <X size={16} />
    </DialogPrimitive.Close>
  );
}
