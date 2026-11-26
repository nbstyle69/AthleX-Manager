"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { plans, translations, type Locale } from "@/data/landing";
import { CheckList, SectionHeading } from "./sections";

export function Pricing({ locale }: { locale: Locale }) {
  const [annual, setAnnual] = useState(false);
  const t = translations[locale].pricing;
  const trial = translations[locale].common.trial;
  const cards = [
    {
      key: "coach",
      name: "Coach",
      description: t.coachDescription,
      features: t.coachFeatures,
      price: plans.coach,
      action: t.start,
      popular: false,
    },
    {
      key: "box",
      name: "Box",
      description: t.boxDescription,
      features: t.boxFeatures,
      price: plans.box,
      action: trial,
      popular: true,
    },
  ];
  return (
    <section id="tarifs" className="section" aria-labelledby="pricing-title">
      <SectionHeading
        id="pricing-title"
        label={t.label}
        title={t.title}
        copy={t.copy}
      />
      <div className="billing-switch" role="group" aria-label={t.billing}>
        <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
          {t.monthly}
        </button>
        <button aria-pressed={annual} onClick={() => setAnnual(true)}>
          {t.annually}
          <span className="discount-badge">{t.discount}</span>
        </button>
      </div>
      <div className="pricing-grid">
        {cards.map((plan) => (
          <article
            key={plan.key}
            className={`card price-card ${plan.popular ? "popular-plan" : ""}`}
          >
            <div className="plan-name">
              <h3 className="font-display">{plan.name}</h3>
              {plan.popular && <span className="popular-badge">{t.popular}</span>}
            </div>
            <p className="plan-description">{plan.description}</p>
            <div className="plan-price">
              <strong className="font-display">
                {annual ? plan.price.annual : plan.price.monthly} €
              </strong>
              <span>
                {t.perMonth}
                {annual && <small>{t.annualNote}</small>}
              </span>
            </div>
            <a
              className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
              href="/pricing/onboarding"
            >
              {plan.action}
              {plan.popular && <ArrowRight size={16} aria-hidden="true" />}
            </a>
            <CheckList items={plan.features} />
          </article>
        ))}
      </div>
      <div className="pricing-footer">
        <p>{t.reassurance}</p>
        <a className="text-link" href="/pricing">
          {t.compare}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
