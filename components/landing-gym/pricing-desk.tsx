"use client";
import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import {
  translations,
  plans,
  gymTranslations,
  type Locale,
} from "@/data/landing";
export function PricingDesk({ locale }: { locale: Locale }) {
  const [annual, setAnnual] = useState(false);
  const t = translations[locale].pricing;
  return (
    <section
      id="tarifs"
      data-zone={19}
      className="shared-zone pricing-section"
      aria-labelledby="pricing-title"
    >
      <div className="shared-heading">
        <div className="zone-sign">{t.label}</div>
        <h2 className="font-display" id="pricing-title">
          {t.title}
        </h2>
        <p>{t.copy}</p>
        <div className="billing-switch" role="group" aria-label={t.label}>
          <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
            {t.monthly}
          </button>
          <button aria-pressed={annual} onClick={() => setAnnual(true)}>
            {t.annually}
          </button>
        </div>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article
            className={`price-card ${plan.popular ? "popular-plan" : ""}`}
            key={plan.name}
          >
            {plan.popular && <span className="popular-label">{t.popular}</span>}
            <div className="plan-heading">
              <h3 className="font-display">{plan.name}</h3>
              <p>{plan.popular ? t.boxDescription : t.coachDescription}</p>
            </div>
            <div className="plan-price">
              <strong className="font-display">
                {annual ? plan.annual : plan.monthly}
                <span> €</span>
              </strong>
              <span>{t.perMonth}</span>
            </div>
            <p className="billing-note">
              {annual
                ? t.annualNote
                : `${plan.annual} € ${t.perMonth} ${t.annualEquivalent}`}
            </p>
            <a
              className={`button ${plan.popular ? "button-accent" : "button-outline"}`}
              href="/pricing/onboarding"
            >
              {plan.popular ? t.trial : t.start}
              <ArrowUpRight size={17} />
            </a>
            <ul className="plan-features">
              {(plan.popular ? t.boxFeatures : t.coachFeatures).map((f) => (
                <li key={f}>
                  <Check size={16} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <p className="plan-stripe">{gymTranslations[locale].stripe}</p>
          </article>
        ))}
      </div>
      <p className="pricing-reassurance">{t.reassurance}</p>
    </section>
  );
}
