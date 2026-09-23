"use client";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  ArrowDown,
  ArrowDownRight,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { translations, type Locale, type Profile } from "@/data/landing";
import { ProfileDoors } from "./profile-doors";

export function FrontDesk({
  locale,
  profile,
  onChoose,
}: {
  locale: Locale;
  profile: Profile | null;
  onChoose: (p: Profile) => void;
}) {
  const t = translations[locale],
    reduced = useReducedMotion();
  return (
    <section id="entree" className="hero" aria-labelledby="hero-title">
      <div className="hero-topline">
        <span>
          <i className="status-dot" />
          {t.hero.welcome}
        </span>
        <span>
          {t.hero.tour}
          <ArrowDownRight size={15} />
        </span>
      </div>
      <div className="hero-layout">
        <motion.div
          className="hero-content"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="hero-eyebrow">{t.hero.eyebrow}</p>
          <h1 className="font-display" id="hero-title">
            {t.hero.title}
          </h1>
          <p className="hero-subtitle">{t.hero.subtitle}</p>
        </motion.div>
        <motion.div
          className="entrance-choice"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <ProfileDoors locale={locale} profile={profile} onChoose={onChoose} />
        </motion.div>
      </div>
      <div className="hero-bottom">
        <a href="#salle">
          <span className="scroll-icon">
            <ArrowDown size={17} />
          </span>
          {t.hero.scroll}
        </a>
        <div>
          <span>
            <Smartphone size={15} />
            iOS & Android · {t.common.soon}
          </span>
          <span>
            <ShieldCheck size={15} />
            {t.common.secure}
          </span>
        </div>
      </div>
    </section>
  );
}
