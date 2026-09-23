'use client';

import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetCloseButton } from '@/components/ui/sheet';
import { useLanguage } from '@/components/language-provider';

const STRINGS = {
  fr: { open: 'Ouvrir le menu', title: 'Menu' },
  en: { open: 'Open menu', title: 'Menu' },
} as const;

interface MobileNavBarProps {
  logo: ReactNode;
  title: string;
  badge?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contenu du panneau : la même barre latérale que sur bureau. */
  children: ReactNode;
}

/**
 * Barre supérieure collante affichée sous 1024 px, à la place de la barre
 * latérale fixe. Le bouton ouvre un panneau (Sheet) qui reçoit exactement le
 * contenu de la barre latérale : une seule source pour les entrées.
 */
export default function MobileNavBar({ logo, title, badge, open, onOpenChange, children }: MobileNavBarProps) {
  const { lang } = useLanguage();
  const t = STRINGS[lang] ?? STRINGS.fr;

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-ax-glass backdrop-blur-ax-glass border-b border-ax-border">
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger
          aria-label={t.open}
          className="flex h-11 w-11 -ml-2 shrink-0 items-center justify-center rounded-ax-control text-ax-text transition-colors hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
        >
          <Menu size={22} />
        </SheetTrigger>
        <SheetContent
          side="left"
          title={t.title}
          hideTitle
          bodyClassName="flex flex-col"
          className="max-w-[300px] p-0"
        >
          <SheetCloseButton className="absolute top-3 right-3 z-10" />
          {children}
        </SheetContent>
      </Sheet>
      <div className="w-8 h-8 shrink-0">{logo}</div>
      <p className="text-sm font-bold text-ax-text truncate min-w-0 flex-1">{title}</p>
      {badge}
    </header>
  );
}
