'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accordéon shadcn, sur Radix et en Tailwind 3.4.
 *
 * Les attributs `data-slot` sont ceux de la version d'origine : la FAQ de la
 * landing les cible dans `app/landing/landing.css`.
 */
const Accordion = AccordionPrimitive.Root;

function AccordionItem({ className, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('[&:not(:last-child)]:border-b', className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium outline-none transition-all hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          data-slot="accordion-trigger-icon"
          className="pointer-events-none ml-auto h-4 w-4 shrink-0 text-muted-foreground group-aria-expanded:hidden"
        />
        <ChevronUp
          data-slot="accordion-trigger-icon"
          className="pointer-events-none ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground group-aria-expanded:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div
        className={cn(
          'pb-2.5 pt-0 [&_a:hover]:text-foreground [&_a]:underline [&_a]:underline-offset-[3px] [&_p:not(:last-child)]:mb-4',
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
