import { ArrowRight, Check } from "lucide-react";
import { coachsHref, pageHref, translations, type Locale } from "@/data/landing";
import { CheckList, SIGNUP, StoreBadges } from "./sections";

const FIND = "/box";

// Emplacement d'une vraie capture de l'app (lot 4) : cadre de téléphone vide.
function PhoneSlot() {
  return <div className="phone-slot" aria-hidden="true" />;
}

function Actions({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <div className="actions">
      <a className="button button-primary" href={SIGNUP}>
        {t.common.signup}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
      <a className="button button-secondary" href={FIND}>
        {t.athletes.find}
      </a>
    </div>
  );
}

export function AthletesContent({ locale }: { locale: Locale }) {
  const t = translations[locale].athletes;
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
            <Actions locale={locale} />
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
          <div className="detail-hero-visual">
            <PhoneSlot />
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
            <div className="feature-visual">
              <PhoneSlot />
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
          <Actions locale={locale} />
          <a className="text-link" href={pageHref(coachsHref, locale, false)}>
            {t.exit.coachs}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
