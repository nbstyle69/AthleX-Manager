'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';
import { useHomeHref } from '@/lib/useHomeHref';

const ONBOARDING = '/pricing/onboarding';

/**
 * Barre haute unique de toutes les pages publiques.
 *
 * `variant="funnel"` sert les pages de tunnel (connexion, création de compte,
 * invitation, onboarding) : même barre, sans la nav ni le CTA, pour ne pas
 * offrir six sorties à quelqu'un en train de finir son inscription.
 */
export function LandingHeader({ variant = 'full' }: { variant?: 'full' | 'funnel' }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const homeHref = useHomeHref();

  // Ancres préfixées : le header vit aussi sur /box, /classement et /privacy,
  // où un « #pricing » nu ne mènerait nulle part.
  const nav = [
    { href: '/landing#features', label: t.nav.features },
    { href: '/landing#app', label: t.nav.app },
    { href: '/classement', label: t.nav.ranking },
    { href: '/landing#pricing', label: t.nav.pricing },
    { href: '/landing#faq', label: t.faq.tag },
    { href: '/box', label: t.nav.boxes },
  ];

  if (variant === 'funnel') {
    return (
      <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <a href={homeHref} aria-label="AthleX">
            <Logo />
          </a>
          <LanguageToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      {/* Nav dans le flux : le bloc de droite la repousse au lieu de passer par-dessus.
          Bascule burger à lg, dimensionnée sur le français (libellés plus longs). */}
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <a href={homeHref} aria-label="AthleX" className="shrink-0">
          <Logo />
        </a>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-6 lg:flex xl:gap-8"
          aria-label="Principale"
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <LanguageToggle />
          <a
            href="/login"
            className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.nav.login}
          </a>
          <Button asChild size="sm">
            <a href={ONBOARDING} className="whitespace-nowrap">
              {t.nav.cta}
            </a>
          </Button>
        </div>

        <button
          type="button"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground lg:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t.nav.login}
            </a>
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3">
            <LanguageToggle />
            <Button asChild size="sm">
              <a href={ONBOARDING}>{t.nav.cta}</a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
