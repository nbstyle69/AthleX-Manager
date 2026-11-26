import { ArrowRight, Check } from "lucide-react";
import {
  athletesHref,
  coachsHref,
  pageHref,
  translations,
  type Locale,
} from "@/data/landing";
import { CheckList, ONBOARDING, SIGNUP, StoreBadges } from "./sections";
import { BrowserFrame, isApp, Shot, type Screen } from "./screens";

// Une ou deux captures par visuel : un écran d’app = téléphone, un écran du Manager =
// navigateur ; Manager + app = navigateur que le téléphone chevauche ; deux écrans d’app =
// deux téléphones côte à côte.
type Visual = [Screen] | [Screen, Screen];

const visualKind = ([first, second]: Visual) =>
  isApp(first) ? (second ? "phones" : "phone") : second ? "browser-phone" : "browser";

function Slot({ shots, locale, hero }: { shots: Visual; locale: Locale; hero: boolean }) {
  const [first, second] = shots;
  if (isApp(first)) {
    const sizes = hero ? "(min-width: 768px) 248px, 182px" : "(min-width: 768px) 272px, 232px";
    const phones = shots.map((s) => (
      <div className="phone-slot" key={s}>
        <Shot screen={s} locale={locale} sizes={sizes} priority={hero} />
      </div>
    ));
    return second ? <div className="phones-slot">{phones}</div> : phones[0];
  }
  const browser = (
    <BrowserFrame>
      <Shot
        screen={first}
        locale={locale}
        sizes={second ? "(min-width: 1024px) 560px, 93vw" : "(min-width: 1024px) 600px, 100vw"}
        priority={hero}
      />
    </BrowserFrame>
  );
  if (!second) return browser;
  return (
    <div className="combo-slot">
      {browser}
      <div className="phone-slot">
        <Shot screen={second} locale={locale} sizes="(min-width: 1024px) 204px, 34vw" priority={hero} />
      </div>
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
          <div className={`detail-hero-visual visual-${visualKind(heroVisual)}`}>
            <Slot shots={heroVisual} locale={locale} hero />
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
            <div className={`feature-visual visual-${visualKind(featureVisuals[i])}`}>
              <Slot shots={featureVisuals[i]} locale={locale} hero={false} />
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
      visuals={[
        ["appAccueil", "appMinuteur"],
        ["appWod"],
        ["appMinuteur"],
        ["appBracket"],
        ["appBadges"],
        ["appReservation", "appAnnonces"],
      ]}
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
      visuals={[
        ["managerDashboard", "appAnnonces"],
        ["managerWhiteboard"],
        ["managerHoraires", "appReservation"],
        ["managerAbonnes"],
        ["managerTournoi"],
        ["managerDashboard"],
      ]}
      otherHref={pageHref(athletesHref, locale, false)}
    />
  );
}
