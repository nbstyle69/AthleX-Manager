import Image, { getImageProps } from "next/image";
import type { ReactNode } from "react";
import { translations, type LandingCopy, type Locale } from "@/data/landing";

// Captures exportées des maquettes Figma (données fictives), dans public/landing/screens/.
// App : premier écran 390×844, ×2. Manager (#479) : cadre « Fenêtre » des maquettes /coachs,
// recadré sur la zone utile, ×2 en bureau (266:6518) et ×3 en mobile (266:13775, suffixe -mobile).
export type Screen = keyof LandingCopy["screens"];

export const isApp = (s: Screen) => s.startsWith("app");

// Dimensions des exports du Manager (px), bureau puis mobile.
const MANAGER: Record<string, [number, number, number, number]> = {
  "manager-dashboard-hero": [1286, 858, 957, 897],
  "manager-dashboard": [1356, 884, 927, 897],
  "manager-whiteboard": [1356, 884, 927, 897],
  "manager-horaires": [1147, 753, 807, 777],
  "manager-abonnes": [1356, 884, 927, 897],
  "manager-tournoi": [1356, 884, 927, 897],
};

export function Shot({
  screen,
  locale,
  sizes,
  priority = false,
  hero = false,
}: {
  screen: Screen;
  locale: Locale;
  sizes: string;
  priority?: boolean;
  // Dashboard du hero : recadrage plus court que celui du bloc 05.
  hero?: boolean;
}) {
  const alt = translations[locale].screens[screen];
  const file = screen.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  if (isApp(screen)) {
    return (
      <Image
        className="shot"
        src={`/landing/screens/${file}.webp`}
        alt={alt}
        width={780}
        height={1688}
        sizes={sizes}
        quality={90}
        priority={priority}
      />
    );
  }
  // Recadrage bureau ou mobile : <picture> ne télécharge que la source retenue.
  const base = screen === "managerDashboard" && hero ? `${file}-hero` : file;
  const [w, h, mw, mh] = MANAGER[base];
  const common = { alt, sizes, quality: 90 };
  const mobile = getImageProps({ ...common, src: `/landing/screens/${base}-mobile.webp`, width: mw, height: mh });
  const { props } = getImageProps({
    ...common,
    src: `/landing/screens/${base}.webp`,
    width: w,
    height: h,
    priority,
  });
  return (
    <picture>
      <source
        media="(max-width: 767px)"
        srcSet={mobile.props.srcSet}
        sizes={sizes}
        width={mw}
        height={mh}
      />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img {...props} className="shot" />
    </picture>
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
