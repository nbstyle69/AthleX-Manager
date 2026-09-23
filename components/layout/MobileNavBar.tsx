'use client';

import { Menu } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetCloseButton } from '@/components/ui/sheet';
import { useLanguage } from '@/components/language-provider';
import { MAIN_CONTENT_ID } from '@/components/layout/mainContent';

const STRINGS = {
  fr: { open: 'Ouvrir le menu', title: 'Menu' },
  en: { open: 'Open menu', title: 'Menu' },
} as const;

/**
 * État du menu mobile. `onNavigate` ferme le panneau ; une fois la nouvelle
 * route rendue, le focus est posé sur `<main>` (sans défilement) plutôt que
 * de retomber sur `body`. Échap / fond / × restent gérés par Radix, qui rend
 * le focus au bouton ☰.
 */
export function useMobileMenu(pathname: string) {
  const [open, setOpen] = useState(false);
  const focusMainOnRoute = useRef(false);

  const onNavigate = useCallback(() => {
    if (open) focusMainOnRoute.current = true;
    setOpen(false);
  }, [open]);

  const focusMain = useCallback(() => {
    document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
  }, []);

  const onCloseAutoFocus = useCallback(
    (e: Event) => {
      if (!focusMainOnRoute.current) return;
      e.preventDefault();
      focusMain();
    },
    [focusMain],
  );

  useEffect(() => {
    setOpen(false);
    if (!focusMainOnRoute.current) return;
    focusMainOnRoute.current = false;
    focusMain();
  }, [pathname, focusMain]);

  return { open, setOpen, onNavigate, onCloseAutoFocus };
}

interface MobileNavBarProps {
  logo: ReactNode;
  title: string;
  badge?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (e: Event) => void;
  /** Contenu du panneau : la même barre latérale que sur bureau. */
  children: ReactNode;
}

/**
 * Barre supérieure collante affichée sous 1024 px, à la place de la barre
 * latérale fixe. Le bouton ouvre un panneau (Sheet) qui reçoit exactement le
 * contenu de la barre latérale : une seule source pour les entrées.
 */
export default function MobileNavBar({ logo, title, badge, open, onOpenChange, onCloseAutoFocus, children }: MobileNavBarProps) {
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
          onCloseAutoFocus={onCloseAutoFocus}
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
