"use client";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { translations, type Locale } from "@/data/landing";
export function Brand() {
  return (
    <a className="brand" href="/landing" aria-label="AthleX">
      <img src="/athex-mark-light.png" alt="" width={34} height={34} />
      <span className="font-display">ATHLEX</span>
    </a>
  );
}
export function Header({
  locale,
  onLocale,
  onTour,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  onTour: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const t = translations[locale].nav;
  const links = [
    [t.features, "#salle"],
    [t.ranking, "/classement"],
    [t.pricing, "#tarifs"],
    [t.faq, "#faq"],
    [t.find, "/box"],
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={t.main}>
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={href === "#salle" ? onTour : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <div className="language-switch" aria-label={t.language}>
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => onLocale(l)}
                  aria-pressed={locale === l}
                  aria-label={l === "fr" ? "Français" : "English"}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a className="login-link" href="/login">
              {t.login}
            </a>
            <a
              className="button button-light header-trial"
              href="/pricing/onboarding"
            >
              {t.trial}
              <ArrowUpRight size={16} />
            </a>
            <button
              className="mobile-menu-button"
              aria-expanded={menu}
              aria-controls="mobile-nav"
              aria-label={menu ? t.close : t.menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" className="mobile-nav" aria-label={t.main}>
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => {
                  setMenu(false);
                  if (href === "#salle") onTour();
                }}
              >
                {label}
                <ArrowUpRight size={16} />
              </a>
            ))}
            <a href="/login">{t.login}</a>
            <a href="/pricing/onboarding">{t.trial}</a>
          </nav>
        )}
      </header>
    </>
  );
}
