'use client';

import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';
import { useHomeHref } from '@/lib/useHomeHref';
import './public-chrome.css';

const ONBOARDING = '/pricing/onboarding';

const A11Y = {
  fr: { main: 'Navigation principale', menu: 'Ouvrir le menu', close: 'Fermer le menu' },
  en: { main: 'Main navigation', menu: 'Open menu', close: 'Close menu' },
} as const;

/**
 * Barre haute unique de toutes les pages publiques, identique à celle de la
 * landing (components/landing-gym/header.tsx) : fond vitré, bordure basse,
 * hauteur 80 / 72 / 66 px, menu mobile sous 1024 px. Styles dans
 * public-chrome.css, à unifier avec la landing au lot 12.
 *
 * `variant="funnel"` sert les pages de tunnel (connexion, création de compte,
 * invitation, onboarding) : même barre, sans la nav ni le CTA, pour ne pas
 * offrir six sorties à quelqu'un en train de finir son inscription.
 *
 * `axp-dark` garde la page sombre quel que soit le thème du back-office.
 */
export function LandingHeader({ variant = 'full' }: { variant?: 'full' | 'funnel' }) {
  const { t, lang } = useLanguage();
  const a11y = A11Y[lang];
  const [open, setOpen] = useState(false);
  const homeHref = useHomeHref();

  // Ancres préfixées : le header vit aussi sur /box, /classement et /privacy,
  // où un « #tarifs » nu ne mènerait nulle part.
  const nav = [
    { href: '/landing#salle', label: t.nav.features },
    { href: '/classement', label: t.nav.ranking },
    { href: '/landing#tarifs', label: t.nav.pricing },
    { href: '/landing#faq', label: t.faq.tag },
    { href: '/box', label: t.nav.boxes },
  ];

  const brand = (
    <a href={homeHref} aria-label="AthleX" className="axp-brand">
      <Logo />
    </a>
  );

  if (variant === 'funnel') {
    return (
      <header className="axp-dark axp-header">
        <div className="axp-inner">
          {brand}
          <LanguageToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="axp-dark axp-header">
      <div className="axp-inner">
        {brand}
        <nav className="axp-nav" aria-label={a11y.main}>
          {nav.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="axp-actions">
          <LanguageToggle />
          <a className="axp-login" href="/login">
            {t.nav.login}
          </a>
          <a className="axp-trial" href={ONBOARDING}>
            {t.nav.cta}
            <ArrowUpRight size={16} />
          </a>
          <button
            type="button"
            className="axp-menu-button"
            aria-expanded={open}
            aria-controls="axp-mobile-nav"
            aria-label={open ? a11y.close : a11y.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="axp-mobile-nav" className="axp-mobile-nav" aria-label={a11y.main}>
          {nav.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
              <ArrowUpRight size={16} />
            </a>
          ))}
          <a href="/login" onClick={() => setOpen(false)}>
            {t.nav.login}
          </a>
          <a href={ONBOARDING} onClick={() => setOpen(false)}>
            {t.nav.cta}
          </a>
        </nav>
      )}
    </header>
  );
}
