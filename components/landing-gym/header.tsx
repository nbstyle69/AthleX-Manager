"use client";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import {
  athletesHref,
  coachsHref,
  translations,
  type Locale,
} from "@/data/landing";

export function Brand() {
  return (
    <a className="brand" href="/landing" aria-label="AthleX">
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

export function navLinks(locale: Locale) {
  const t = translations[locale].nav;
  return [
    [t.athletes, athletesHref],
    [t.coachs, coachsHref],
    [t.pricing, "#tarifs"],
    [t.faq, "#faq"],
    [t.find, "/box"],
    [t.ranking, "/classement"],
  ] as const;
}

export function Header({
  locale,
  onLocale,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
}) {
  const [menu, setMenu] = useState(false);
  const t = translations[locale].nav;
  const links = navLinks(locale);
  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <Brand />
            <nav className="desktop-nav" aria-label={t.main}>
              {links.map(([label, href]) => (
                <a key={label} href={href}>
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
            {links.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMenu(false)}>
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
