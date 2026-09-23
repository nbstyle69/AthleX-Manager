"use client";

import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Smartphone, X } from "lucide-react";
import {
  getStationCopy,
  gymTranslations,
  type Locale,
  type Profile,
  type Station,
} from "@/data/landing";
import { ProductMockup, StoreBadges } from "./product-mockup";

export function StationPanel({
  station,
  locale,
  side,
  onSide,
  onClose,
  onNext,
  screenshotSrc,
  onInteract,
  progress,
}: {
  station: Station;
  locale: Locale;
  side: Profile;
  onSide: (side: Profile) => void;
  onClose: () => void;
  onNext: () => void;
  screenshotSrc?: string;
  onInteract: () => void;
  progress?: number;
}) {
  const panel = useRef<HTMLElement>(null);
  const [showApp, setShowApp] = useState(false);
  const g = gymTranslations[locale];
  const copy = getStationCopy(locale, station.id, side);

  const href =
    side === "pro"
      ? "/pricing/onboarding"
      : station.id === 7
        ? "/classement"
        : "/signup";
  const preview = (
    <ProductMockup
      key={`${station.id}-${side}`}
      locale={locale}
      zone={station.mockups[side] ?? 1}
      screenshotSrc={screenshotSrc ?? station.screenshots?.[side]}
    />
  );
  return (
    <>
      <div
        className={`station-mockup ${side === "pro" ? "pro-preview" : ""}`}
        onPointerMove={onInteract}
        onFocusCapture={onInteract}
        onPointerDownCapture={onInteract}
      >
        {preview}
      </div>
      <aside
        ref={panel}
        tabIndex={-1}
        className={`station-panel ${showApp ? "show-app" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="station-title"
        onPointerMove={onInteract}
        onPointerDownCapture={onInteract}
        onFocusCapture={onInteract}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {progress !== undefined && (
          <div
            className="tour-progress"
            role="progressbar"
            aria-label={locale === "fr" ? "Temps restant" : "Time remaining"}
            aria-valuemin={0}
            aria-valuemax={9}
            aria-valuenow={Math.ceil(progress * 9)}
          >
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
        <div className="station-panel-heading">
          <span className="station-sign">{copy.label}</span>
          <button
            className="icon-button"
            aria-label={g.close}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="station-panel-body">
          {station.sides.length === 2 && (
            <div className="station-tabs" role="tablist" aria-label={g.tabs}>
              {station.sides.map((p, i) => (
                <button
                  key={p}
                  id={`station-tab-${p}`}
                  role="tab"
                  aria-selected={p === side}
                  aria-controls="station-content"
                  tabIndex={p === side ? 0 : -1}
                  onClick={() => onSide(p)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      e.stopPropagation();
                      const next = station.sides[(i + 1) % 2];
                      onSide(next);
                      document.getElementById(`station-tab-${next}`)?.focus();
                    }
                  }}
                >
                  {g[p]}
                </button>
              ))}
            </div>
          )}
          <div
            id="station-content"
            role={station.sides.length === 2 ? "tabpanel" : undefined}
            aria-labelledby={
              station.sides.length === 2 ? `station-tab-${side}` : undefined
            }
            className="station-copy"
          >
            <h3 id="station-title" className="font-display text-balance">
              {copy.title}
            </h3>
            <div className="station-text">
              <p>{copy.copy}</p>
              <ul>
                {copy.features.slice(0, 4).map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a className="station-action" href={href}>
                {copy.action}
                <ArrowUpRight size={16} />
              </a>
              {station.id === 1 && side === "athlete" && (
                <div className="reception-links">
                  {/* Navigation complète, comme tous les liens de la landing : elle
                      décharge la scène 3D et ne laisse pas la langue de la
                      landing sur <html> en arrivant sur /box. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a className="station-action" href="/box">
                    {locale === "fr" ? "Trouver une box" : "Find a gym"}
                    <ArrowUpRight size={16} />
                  </a>
                  <StoreBadges locale={locale} />
                </div>
              )}
            </div>
          </div>
          <button
            className="mobile-app-toggle"
            aria-expanded={showApp}
            aria-controls="mobile-app-preview"
            onClick={() => setShowApp((v) => !v)}
          >
            <Smartphone size={16} />
            {showApp ? g.hideApp : g.showApp}
          </button>
          {showApp && (
            <div id="mobile-app-preview" className="mobile-app-preview">
              {preview}
            </div>
          )}
        </div>
        <button className="station-continue" onClick={onNext}>
          {g.next}
          <ArrowRight size={18} />
        </button>
      </aside>
    </>
  );
}
