"use client";

import { useEffect, useState } from "react";
import { translations, type Locale } from "@/data/landing";
import { Header } from "./header";
import { Audience, FinalCta, Footer, Hero, Steps } from "./sections";
import { Pricing } from "./pricing";
import { Faq } from "./faq";

export function LandingPage({ initialLocale = "fr" }: { initialLocale?: Locale }) {
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
    document.title = translations[locale].meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translations[locale].meta.description);
  }, [locale]);
  const changeLocale = (l: Locale) => {
    setLocale(l);
    const url = new URL(window.location.href);
    if (l === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.pushState({}, "", url);
  };
  return (
    <div className="landing-shell">
      <Header locale={locale} onLocale={changeLocale} />
      <main id="main">
        <Hero locale={locale} />
        <Audience locale={locale} />
        <Steps locale={locale} />
        <Pricing locale={locale} />
        <Faq locale={locale} />
        <FinalCta locale={locale} />
      </main>
      <Footer locale={locale} onLocale={changeLocale} />
    </div>
  );
}
