import { ArrowRight, Check } from "lucide-react";
import {
  athletesHref,
  coachsHref,
  pageHref,
  translations,
  type Locale,
} from "@/data/landing";
import { CheckList, ONBOARDING, SIGNUP, StoreBadges } from "./sections";

// Emplacements des vraies captures (lot 4) : cadres vides, aucun écran dessiné.
type Visual = "phone" | "browser" | "browser-phone";

function Slot({ kind }: { kind: Visual }) {
  const browser = (
    <div className="browser-slot">
      <div className="browser-bar">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
  if (kind === "phone") return <div className="phone-slot" aria-hidden="true" />;
  if (kind === "browser") return <div aria-hidden="true">{browser}</div>;
  return (
    <div className="combo-slot" aria-hidden="true">
      {browser}
      <div className="phone-slot" />
    </div>
  );
}

type Action = { label: string; href: string; primary?: boolean };

type DetailCopy =
  | typeof translations.fr.athletes
  | typeof translations.fr.coachs;

function DetailContent({
  locale,
  t,
  actions,
  badges,
  visuals,
  otherHref,
}: {
  locale: Locale;
  t: DetailCopy;
  actions: Action[];
  badges: boolean;
  // Hero, puis un visuel par bloc de fonction.
  visuals: [Visual, ...Visual[]];
  otherHref: string;
}) {
  const [heroVisual, ...featureVisuals] = visuals;
  const buttons = (
    <div className="actions">
      {actions.map((a) => (
        <a
          key={a.href}
          className={`button ${a.primary ? "button-primary" : "button-secondary"}`}
          href={a.href}
        >
          {a.label}
          {a.primary && <ArrowRight size={16} aria-hidden="true" />}
        </a>
      ))}
    </div>
  );
  return (
    <>
      <section className="hero detail-hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <div className="hero-text">
            <nav className="breadcrumb" aria-label={t.breadcrumb.label}>
              <a href={pageHref("/landing", locale, false)}>{t.breadcrumb.home}</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{t.breadcrumb.current}</span>
            </nav>
            <p className="eyebrow font-display">{t.eyebrow}</p>
            <h1 className="font-display" id="hero-title">
              {t.title}
            </h1>
            <p className="hero-subtitle">{t.subtitle}</p>
            {buttons}
            <ul className="reassurance">
              {t.reassurance.map((item) => (
                <li key={item}>
                  <Check size={14} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {badges && <StoreBadges locale={locale} />}
          </div>
          <div className={`detail-hero-visual visual-${heroVisual}`}>
            <Slot kind={heroVisual} />
          </div>
        </div>
      </section>

      <ul className="stats-grid">
        {t.stats.map((stat) => (
          <li className="stat-card" key={stat.label}>
            <strong className="font-display">{stat.value}</strong>
            <span>{stat.label}</span>
          </li>
        ))}
      </ul>

      <div className="features">
        {t.features.map((feature, i) => (
          <section
            className={`feature-block ${i % 2 ? "feature-reverse" : ""}`}
            key={feature.label}
            aria-labelledby={`feature-${i}`}
          >
            <div className="feature-text">
              <p className="eyebrow font-display">{feature.label}</p>
              <h2 className="font-display" id={`feature-${i}`}>
                {feature.title}
              </h2>
              <p className="feature-copy">{feature.copy}</p>
              <CheckList items={feature.points} />
            </div>
            <div className={`feature-visual visual-${featureVisuals[i]}`}>
              <Slot kind={featureVisuals[i]} />
            </div>
          </section>
        ))}
      </div>

      <section className="section final-section" aria-labelledby="exit-title">
        <div className="final-panel detail-final">
          <h2 className="font-display" id="exit-title">
            {t.exit.title}
          </h2>
          <p>{t.exit.copy}</p>
          {buttons}
          <a className="text-link" href={otherHref}>
            {t.exit.other}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}

export function AthletesContent({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <DetailContent
      locale={locale}
      t={t.athletes}
      actions={[
        { label: t.common.signup, href: SIGNUP, primary: true },
        { label: t.athletes.find, href: "/box" },
      ]}
      badges
      visuals={["phone", "phone", "phone", "phone", "phone", "phone"]}
      otherHref={pageHref(coachsHref, locale, false)}
    />
  );
}

export function CoachsContent({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <DetailContent
      locale={locale}
      t={t.coachs}
      actions={[
        { label: t.common.trial, href: ONBOARDING, primary: true },
        { label: t.coachs.pricing, href: "/pricing" },
      ]}
      badges={false}
      visuals={["browser-phone", "browser", "browser-phone", "browser", "browser", "browser"]}
      otherHref={pageHref(athletesHref, locale, false)}
    />
  );
}
