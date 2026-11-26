import { ArrowRight, Check, Smartphone, User, Users } from "lucide-react";
import {
  athletesHref,
  coachsHref,
  pageHref,
  translations,
  type Locale,
} from "@/data/landing";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/store-links";
import { Brand, LanguageSwitch, navLinks } from "./header";

export const SIGNUP = "/signup";
export const ONBOARDING = "/pricing/onboarding";

export function SectionHeading({
  label,
  title,
  copy,
  id,
}: {
  label: string;
  title: string;
  copy?: string;
  id: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow font-display">{label}</p>
      <h2 className="font-display" id={id}>
        {title}
      </h2>
      {copy && <p className="section-copy">{copy}</p>}
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>
          <Check size={18} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function StoreBadges({ locale }: { locale: Locale }) {
  const t = translations[locale].common;
  const stores = [
    [APP_STORE_URL, t.download, t.appStore],
    [PLAY_STORE_URL, t.available, t.playStore],
  ];
  return (
    <div className="store-badges">
      {stores.map(([href, small, name]) => (
        <a
          key={name}
          className="store-badge"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Smartphone size={20} aria-hidden="true" />
          <span>
            <small>{small}</small>
            <strong>{name}</strong>
          </span>
        </a>
      ))}
    </div>
  );
}

export function Hero({ locale }: { locale: Locale }) {
  const t = translations[locale].hero;
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-text">
          <p className="eyebrow font-display">{t.eyebrow}</p>
          <h1 className="font-display" id="hero-title">
            {t.title}
          </h1>
          <p className="hero-subtitle">{t.subtitle}</p>
          <div className="actions">
            <a className="button button-primary" href={ONBOARDING}>
              {t.create}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a className="button button-secondary" href={SIGNUP}>
              {t.athlete}
            </a>
          </div>
          <ul className="reassurance">
            {t.reassurance.map((item) => (
              <li key={item}>
                <Check size={14} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <StoreBadges locale={locale} />
        </div>
        {/* Emplacement des vraies captures (lot 4). */}
        <div className="hero-visual" aria-hidden="true" />
      </div>
    </section>
  );
}

export function Audience({ locale }: { locale: Locale }) {
  const t = translations[locale].audience;
  const c = translations[locale].common;
  const cards = [
    {
      ...t.athlete,
      Icon: User,
      action: c.signup,
      href: SIGNUP,
      primary: false,
      moreHref: pageHref(athletesHref, locale, true),
    },
    {
      ...t.pro,
      Icon: Users,
      action: c.trial,
      href: ONBOARDING,
      primary: true,
      moreHref: pageHref(coachsHref, locale, true),
    },
  ];
  return (
    <section id="pour-qui" className="section" aria-labelledby="audience-title">
      <SectionHeading
        id="audience-title"
        label={t.label}
        title={t.title}
        copy={t.copy}
      />
      <div className="audience-grid">
        {cards.map(({ Icon, ...card }) => (
          <article className="card audience-card" key={card.title}>
            <span className="card-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <div className="card-heading">
              <h3 className="font-display">{card.title}</h3>
              <p>{card.tagline}</p>
            </div>
            <CheckList items={card.features} />
            <a
              className={`button ${card.primary ? "button-primary" : "button-secondary"}`}
              href={card.href}
            >
              {card.action}
              {card.primary && <ArrowRight size={16} aria-hidden="true" />}
            </a>
            <a className="text-link" href={card.moreHref}>
              {card.more}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Steps({ locale }: { locale: Locale }) {
  const t = translations[locale].steps;
  return (
    <section className="section section-alt" aria-labelledby="steps-title">
      <SectionHeading id="steps-title" label={t.label} title={t.title} />
      <ol className="steps-grid">
        {t.items.map((step, i) => (
          <li className="step-card" key={step.title}>
            <span className="step-number font-display" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-display">{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FinalCta({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <section className="section final-section" aria-labelledby="exit-title">
      <div className="final-panel">
        <h2 className="font-display" id="exit-title">
          {t.exit.title}
        </h2>
        <p>{t.exit.copy}</p>
        <div className="actions">
          <a className="button button-primary" href={ONBOARDING}>
            {t.common.create}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="button button-secondary" href={SIGNUP}>
            {t.common.signup}
          </a>
        </div>
        <StoreBadges locale={locale} />
      </div>
    </section>
  );
}

export function Footer({
  locale,
  onLocale,
  active,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  active?: string;
}) {
  const t = translations[locale].footer;
  const [athletes, coachs, pricing, faq, find, ranking] = navLinks(locale, active);
  const columns = [
    [t.product, [athletes, coachs, pricing, faq]],
    [t.discover, [find, ranking]],
    [
      t.legalTitle,
      [
        [t.privacy, "/privacy#confidentialite"],
        [t.terms, "/privacy#cgu"],
        [t.legal, "/privacy#mentions-legales"],
      ],
    ],
  ] as const;
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Brand locale={locale} />
          <p>{t.description}</p>
        </div>
        <div className="footer-columns">
          {columns.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <p className="font-display">{title}</p>
              {links.map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <p>{t.copyright}</p>
        <LanguageSwitch locale={locale} onLocale={onLocale} />
      </div>
    </footer>
  );
}
