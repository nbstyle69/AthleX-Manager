"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, MoveUpRight, Pause, Play } from "lucide-react";
import { useGymVisit } from "@/hooks/use-gym-visit";
import {
  gymTranslations,
  stations,
  stationName,
  type Locale,
  type Profile,
} from "@/data/landing";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { GymMap } from "./gym-map";
import { GymFallback } from "./gym-fallback";
import { StationPanel } from "./station-panel";

const Scene = dynamic(() => import("./gym-3d/Scene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function GymTour({
  locale,
  profile,
  tourKey,
  autoWalk,
  screenshots,
}: {
  locale: Locale;
  profile: Profile;
  tourKey: number;
  autoWalk: boolean;
  screenshots: Partial<Record<number, string>>;
}) {
  const section = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const reduced = useReducedMotion();
  const fallback = reduced || webgl === false;
  const g = gymTranslations[locale];
  const tour = useGymVisit({ profile, tourKey, autoWalk, visible, fallback });
  const {
    active,
    visit,
    arrived,
    closed,
    tab,
    setTab,
    setClosed,
    onArrive,
    pause,
    mode,
  } = tour;
  const station = stations.find((s) => s.id === active);
  const side = station?.sides.includes(tab)
    ? tab
    : (station?.sides[0] ?? tour.selectedProfile);
  const select = (id: number) => {
    lastTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    tour.select(id);
  };
  const advance = useCallback(
    (direction: number) => {
      pause();
      tour.next(direction);
    },
    [pause, tour.next],
  );
  const close = useCallback(() => {
    pause();
    setClosed(true);
    const target = lastTrigger.current;
    if (
      target?.isConnected &&
      section.current?.contains(target) &&
      !target.closest(".station-panel")
    )
      target.focus({ preventScroll: true });
    else nextButton.current?.focus({ preventScroll: true });
  }, [pause, setClosed]);
  const onError = useCallback(() => setWebgl(false), []);
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          preload.disconnect();
        }
      },
      { rootMargin: "450px" },
    );
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.65),
      { threshold: [0, 0.35, 0.65, 1] },
    );
    preload.observe(el);
    observer.observe(el);
    return () => {
      preload.disconnect();
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!near || reduced) return;
    const canvas = document.createElement("canvas");
    try {
      const context = canvas.getContext("webgl2");
      setWebgl(!!context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }
  }, [near, reduced]);
  useEffect(() => {
    if (!visible) return;
    const key = (e: KeyboardEvent) => {
      if (
        e.isComposing ||
        e.keyCode === 229 ||
        e.altKey ||
        e.metaKey ||
        e.ctrlKey
      )
        return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[role="tablist"],[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        advance(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [visible, advance, close]);
  const panelOpen = active > 0 && visible && !closed && (fallback || arrived);
  const completed = mode === "complete" && visible && (fallback || arrived);
  return (
    <section
      id="salle"
      ref={section}
      className={`gym-screen ${panelOpen || completed ? "has-panel" : ""}`}
      aria-labelledby="gym-title"
      data-mode={fallback ? "plan" : "3d"}
      data-active={active}
      data-tour={mode}
      data-paused={tour.paused}
      data-profile={tour.selectedProfile}
      data-arrived={fallback || arrived}
    >
      {fallback ? (
        <GymFallback
          locale={locale}
          profile={tour.selectedProfile}
          active={active}
          onSelect={select}
        />
      ) : near && webgl === true ? (
        <SceneBoundary onError={onError}>
          <Scene
            locale={locale}
            active={active}
            visit={visit}
            running={visible}
            onSelect={select}
            onArrive={onArrive}
            onError={onError}
            onInteract={pause}
          />
        </SceneBoundary>
      ) : (
        <div className="gym-loading" role="status">
          {g.loading}
        </div>
      )}
      {active === 0 ? (
        <div className="gym-heading">
          <p>
            {g.eyebrow} / {g[tour.selectedProfile]}
          </p>
          <h2 id="gym-title" className="font-display">
            {g.title}
          </h2>
          <span>{fallback ? g.fallbackCopy : g.instruction}</span>
          <div className="entrance-profile" role="group" aria-label={g.profile}>
            {(["athlete", "pro"] as const).map((p) => (
              <button
                key={p}
                aria-pressed={tour.selectedProfile === p}
                onClick={() => {
                  pause();
                  tour.setSelectedProfile(p);
                }}
              >
                {g[p]}
              </button>
            ))}
          </div>
          <div className="visit-actions">
            <button
              className="button button-accent"
              onClick={() => tour.start("guided")}
            >
              {g.guided}
              <ArrowRight size={18} />
            </button>
            <button
              className="button button-outline"
              onClick={() => tour.start("free")}
            >
              {g.free}
            </button>
          </div>
          {fallback && <span className="stepwise-note">{g.stepwise}</span>}
        </div>
      ) : (
        <h2 id="gym-title" className="sr-only">
          {g.title}
        </h2>
      )}
      <div className="tour-controls">
        {mode === "guided" && !fallback && (
          <button
            className="tour-play"
            onClick={() => (tour.paused ? tour.resume() : pause())}
          >
            {tour.paused ? <Play size={16} /> : <Pause size={16} />}
            <span>{tour.paused ? g.resume : g.pause}</span>
          </button>
        )}
        <button
          className="icon-button"
          disabled={active === 0}
          onClick={() => advance(-1)}
          aria-label={g.previous}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          className="tour-current"
          onClick={() => {
            pause();
            if (active === 0) tour.start("free");
            else if (fallback || arrived) setClosed(false);
          }}
          aria-label={`${g.showPanel} · ${stationName(locale, active)}`}
        >
          <span>{stationName(locale, active)}</span>
          {!fallback && !arrived ? (
            <span className="tour-moving" role="status">
              {g.moving}
            </span>
          ) : (
            <MoveUpRight size={16} />
          )}
        </button>
        <button
          ref={nextButton}
          className="icon-button"
          onClick={() => advance(1)}
          aria-label={g.next}
        >
          <ArrowRight size={20} />
        </button>
      </div>
      {completed && (
        <aside
          className="station-panel tour-complete"
          aria-labelledby="tour-complete-title"
        >
          <div className="station-panel-body">
            <p className="station-sign">{g.eyebrow}</p>
            <h3 className="font-display" id="tour-complete-title">
              {g.complete}
            </h3>
            <a className="button button-accent" href="#tarifs">
              {g.pricing}
              <ArrowRight size={18} />
            </a>
            <button
              className="button button-outline"
              onClick={() => tour.start("guided")}
            >
              {g.restart}
            </button>
          </div>
        </aside>
      )}
      {panelOpen && station && (
        <StationPanel
          key={active}
          station={station}
          locale={locale}
          side={side}
          onSide={(p) => {
            pause();
            setTab(p);
          }}
          onInteract={pause}
          progress={
            mode === "guided" && !fallback ? tour.remaining / 9000 : undefined
          }
          onClose={close}
          onNext={() => advance(1)}
          screenshotSrc={screenshots[active]}
        />
      )}
      {visible && !fallback && (
        <GymMap
          onInteract={pause}
          locale={locale}
          profile={tour.selectedProfile}
          active={active}
          onSelect={select}
        />
      )}
    </section>
  );
}
