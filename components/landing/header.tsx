'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';

const ONBOARDING = '/pricing/onboarding';

export function LandingHeader() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const nav = [
    { href: '#features', label: t.nav.features },
    { href: '#app', label: t.nav.app },
    { href: '/classement', label: t.nav.ranking },
    { href: '#pricing', label: t.nav.pricing },
    { href: '/box', label: t.nav.boxes },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" aria-label="AthleX">
          <Logo />
        </a>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
          aria-label="Principale"
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle />
          <a
            href="/login"
            className="inline-flex min-w-[76px] justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.nav.login}
          </a>
          <Button asChild size="sm">
            <a href={ONBOARDING}>
              <span className="inline-block min-w-[96px] text-center">{t.nav.cta}</span>
            </a>
          </Button>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
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
          <div className="mt-3 flex items-center justify-between">
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
