import { ArrowUpRight, DoorOpen } from "lucide-react";
import { translations, type Locale } from "@/data/landing";
import { StoreBadges } from "./product-mockup";
export function ExitDoor({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <section
      id="zone-21"
      data-zone={21}
      className="shared-zone exit-section"
      aria-labelledby="exit-title"
    >
      <div className="exit-symbol" aria-hidden="true">
        <DoorOpen size={40} />
      </div>
      <div className="zone-sign">{t.exit.label}</div>
      <h2 className="font-display" id="exit-title">
        {t.exit.title}
      </h2>
      <p>{t.exit.copy}</p>
      <div className="exit-actions">
        <a className="button button-accent" href="/pricing/onboarding">
          {t.common.create}
          <ArrowUpRight size={18} />
        </a>
        <a className="button button-outline" href="/signup">
          {t.common.signup}
          <ArrowUpRight size={18} />
        </a>
      </div>
      <StoreBadges locale={locale} />
    </section>
  );
}
