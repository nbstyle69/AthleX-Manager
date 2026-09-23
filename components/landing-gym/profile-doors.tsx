"use client";
import { ArrowUpRight, Dumbbell, LayoutDashboard } from "lucide-react";
import { translations, type Locale, type Profile } from "@/data/landing";
export function ProfileDoors({
  locale,
  profile,
  onChoose,
}: {
  locale: Locale;
  profile: Profile | null;
  onChoose: (profile: Profile) => void;
}) {
  const t = translations[locale];
  return (
    <div className="profile-entrances">
      <p className="entrance-caption">{t.hero.choice}</p>
      <div className="profile-doors">
        {(["athlete", "pro"] as const).map((p) => (
          <button
            key={p}
            className={`profile-door ${p === "pro" ? "pro-door" : ""}`}
            onClick={() => onChoose(p)}
            aria-pressed={profile === p}
          >
            <span className="door-top">
              {p === "athlete" ? (
                <Dumbbell size={20} />
              ) : (
                <LayoutDashboard size={20} />
              )}
              <ArrowUpRight size={20} />
            </span>
            <strong>{t.hero[p]}</strong>
            <span>{p === "athlete" ? t.hero.athleteLine : t.hero.proLine}</span>
          </button>
        ))}
      </div>
      <p className="door-reassurance">{t.hero.reassurance}</p>
    </div>
  );
}
