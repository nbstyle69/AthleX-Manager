"use client";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import {
  athletesHref,
  coachsHref,
  pageHref,
  translations,
  type Locale,
} from "@/data/landing";

export function Brand({ locale = "fr" }: { locale?: Locale }) {
  return (
    <a className="brand" href={pageHref("/landing", locale, false)} aria-label="AthleX">
      <img src="/athex-mark-light.png" alt="" width={30} height={30} />
      <span className="font-display">ATHLEX</span>
    </a>
  );
}

export function LanguageSwitch({
  locale,
  onLocale,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
}) {
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={translations[locale].nav.language}
    >
      <button
        onClick={() => onLocale("fr")}
        aria-pressed={locale === "fr"}
        aria-label="Français"
      >
        FR
      </button>
      <span aria-hidden="true">/</span>
      <button
        onClick={() => onLocale("en")}
        aria-pressed={locale === "en"}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}

// `active` : chemin de la page en cours (lien en menthe), absent sur l'accueil.
export function navLinks(locale: Locale, active?: string) {
  const t = translations[locale].nav;
  const href = (target: string) => pageHref(target, locale, !active);
  return [
    [t.athletes, href(athletesHref), athletesHref === active],
    [t.coachs, href(coachsHref), coachsHref === active],
    [t.pricing, href("#tarifs"), false],
    [t.faq, href("#faq"), false],
    [t.find, "/box", false],
    [t.ranking, "/classement", false],
  ] as const;
}

export function Header({
  locale,
  onLocale,
  active,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  active?: string;
}) {
  const [menu, setMenu] = useState(false);
  const t = translations[locale].nav;
  const links = navLinks(locale, active);
  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <Brand locale={locale} />
            <nav className="desktop-nav" aria-label={t.main}>
              {links.map(([label, href, current]) => (
                <a key={label} href={href} aria-current={current ? "page" : undefined}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="header-actions">
            <LanguageSwitch locale={locale} onLocale={onLocale} />
            <a className="login-link" href="/login">
              {t.login}
            </a>
            <a className="button button-primary header-trial" href="/pricing/onboarding">
              {t.trial}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <button
              className="mobile-menu-button"
              aria-expanded={menu}
              aria-controls="mobile-nav"
              aria-label={menu ? t.close : t.menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" className="mobile-nav" aria-label={t.main}>
            {links.map(([label, href, current]) => (
              <a
                key={label}
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {label}
              </a>
            ))}
            <a href="/login">{t.login}</a>
            <LanguageSwitch locale={locale} onLocale={onLocale} />
          </nav>
        )}
      </header>
    </>
  );
}
