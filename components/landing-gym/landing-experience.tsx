"use client";

import { useEffect, useState, type ReactNode } from "react";
import { translations, type Locale } from "@/data/landing";
import { Header } from "./header";
import { Audience, FinalCta, Footer, Hero, Steps } from "./sections";
import { Pricing } from "./pricing";
import { Faq } from "./faq";
import { AthletesContent } from "./athletes";

type Meta = { title: string; description: string };

// Chrome commun des pages de la landing : langue (?lang=en), en-tête, pied de page.
// `active` : chemin de la page (lien en menthe), absent sur l'accueil.
function LandingShell({
  initialLocale,
  meta,
  active,
  children,
}: {
  initialLocale: Locale;
  meta: (l: Locale) => Meta;
  active?: string;
  children: (locale: Locale) => ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    const sync = () =>
      setLocale(
        new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "fr",
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = meta(locale).title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", meta(locale).description);
  }, [locale, meta]);
  const changeLocale = (l: Locale) => {
    setLocale(l);
    const url = new URL(window.location.href);
    if (l === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.pushState({}, "", url);
  };
  return (
    <div className="landing-shell">
      <Header locale={locale} onLocale={changeLocale} active={active} />
      <main id="main">{children(locale)}</main>
      <Footer locale={locale} onLocale={changeLocale} active={active} />
    </div>
  );
}

const homeMeta = (l: Locale) => translations[l].meta;
const athletesMeta = (l: Locale) => translations[l].athletes.meta;

export function LandingPage({ initialLocale = "fr" }: { initialLocale?: Locale }) {
  return (
    <LandingShell initialLocale={initialLocale} meta={homeMeta}>
      {(locale) => (
        <>
          <Hero locale={locale} />
          <Audience locale={locale} />
          <Steps locale={locale} />
          <Pricing locale={locale} />
          <Faq locale={locale} />
          <FinalCta locale={locale} />
        </>
      )}
    </LandingShell>
  );
}

export function AthletesPage({ initialLocale = "fr" }: { initialLocale?: Locale }) {
  return (
    <LandingShell initialLocale={initialLocale} meta={athletesMeta} active="/athletes">
      {(locale) => <AthletesContent locale={locale} />}
    </LandingShell>
  );
}
