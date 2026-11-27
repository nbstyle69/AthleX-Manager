import Image from "next/image";
import type { ReactNode } from "react";
import { translations, type LandingCopy, type Locale } from "@/data/landing";

// Captures exportées des maquettes Figma (données fictives), 2x, dans public/landing/screens/.
// App : premier écran 390×844 ; Manager : zone de contenu 1200×786 (sans la barre latérale).
export type Screen = keyof LandingCopy["screens"];

export const isApp = (s: Screen) => s.startsWith("app");

export function Shot({
  screen,
  locale,
  sizes,
  priority = false,
}: {
  screen: Screen;
  locale: Locale;
  sizes: string;
  priority?: boolean;
}) {
  const file = screen.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return (
    <Image
      className="shot"
      src={`/landing/screens/${file}.webp`}
      alt={translations[locale].screens[screen]}
      width={isApp(screen) ? 780 : 2400}
      height={isApp(screen) ? 1688 : 1572}
      sizes={sizes}
      quality={90}
      priority={priority}
    />
  );
}

export function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="browser-slot">
      <div className="browser-bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {children}
    </div>
  );
}
