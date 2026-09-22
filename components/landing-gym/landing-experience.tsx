"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { translations, type Locale, type Profile } from "@/data/landing";
import { Header, Brand } from "./header";
import { FrontDesk } from "./entrance";
import { GymTour } from "./gym-tour";
import { PricingDesk } from "./pricing-desk";
import { Faq } from "./faq";
import { Testimonials } from "./testimonials";
import { ExitDoor } from "./final-cta";

export function LandingPage({
  initialLocale = "fr",
  initialProfile = null,
  screenshots = {},
}: {
  initialLocale?: Locale;
  initialProfile?: Profile | null;
  screenshots?: Partial<Record<number, string>>;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale),
    [profile, setProfile] = useState<Profile | null>(initialProfile),
    [tourKey, setTourKey] = useState(0),
    [ready, setReady] = useState(false);
  const [autoWalk, setAutoWalk] = useState(false);
  const openEntrance = () => {
    setAutoWalk(false);
    setTourKey((k) => k + 1);
  };
  const t = translations[locale];
  useEffect(() => {
    setReady(true);
    const sync = () => {
      const query = new URLSearchParams(window.location.search);
      setLocale(query.get("lang") === "en" ? "en" : "fr");
      const p = query.get("profil");
      setProfile(p === "athlete" || p === "pro" ? p : null);
    };
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
  const choose = (p: Profile) => {
    setAutoWalk(true);
    setProfile(p);
    setTourKey((k) => k + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("profil", p);
    url.hash = "salle";
    window.history.pushState({}, "", url);
    document.getElementById("salle")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const changeLocale = (l: Locale) => {
    setLocale(l);
    const url = new URL(window.location.href);
    if (l === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.pushState({}, "", url);
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-shell font-sans" data-ready={ready}>
        <Header locale={locale} onLocale={changeLocale} onTour={openEntrance} />
        <main id="main">
          <FrontDesk locale={locale} profile={profile} onChoose={choose} />
          <GymTour
            locale={locale}
            profile={profile ?? "athlete"}
            tourKey={tourKey}
            autoWalk={autoWalk}
            screenshots={screenshots}
          />
          <div className="practical-screen">
            <Testimonials locale={locale} />
            <PricingDesk locale={locale} />
            <Faq locale={locale} />
            <ExitDoor locale={locale} />
          </div>
        </main>
        <footer className="site-footer">
          <div className="footer-top">
            <div>
              <Brand />
              <p>{t.footer.description}</p>
            </div>
            <nav aria-label={t.footer.legal}>
              <a href="/privacy#confidentialite">{t.footer.privacy}</a>
              <a href="/privacy#cgu">{t.footer.terms}</a>
              <a href="/privacy#mentions-legales">{t.footer.legal}</a>
            </nav>
          </div>
          <div className="footer-bottom">
            {t.footer.copyright}
            <span>FUNCTIONAL / HYBRID / {t.common.strength.toUpperCase()}</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
