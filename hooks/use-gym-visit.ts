"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tourOrder, type Profile } from "@/data/landing";

export function useGymVisit({
  profile,
  tourKey,
  autoWalk,
  visible,
  fallback,
}: {
  profile: Profile;
  tourKey: number;
  autoWalk: boolean;
  visible: boolean;
  fallback: boolean;
}) {
  const [selectedProfile, setSelectedProfile] = useState(profile);
  const [mode, setMode] = useState<"entrance" | "guided" | "free" | "complete">(
    "entrance",
  );
  const [active, setActive] = useState(0);
  const [visit, setVisit] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [closed, setClosed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<Profile>(profile);
  const [remaining, setRemaining] = useState(9000);
  const remainingRef = useRef(9000);
  const pauseRef = useRef(false);
  const path = tourOrder[selectedProfile];
  const move = useCallback(
    (id: number) => {
      setActive(id);
      setVisit((v) => v + 1);
      setArrived(false);
      setClosed(false);
      setTab(selectedProfile);
      remainingRef.current = 9000;
      setRemaining(9000);
    },
    [selectedProfile],
  );
  const pause = useCallback(() => {
    pauseRef.current = true;
    setPaused(true);
    setPending(false);
  }, []);
  const start = useCallback(
    (kind: "guided" | "free") => {
      setPending(false);
      pauseRef.current = false;
      setPaused(false);
      setMode(kind);
      move(-1);
    },
    [move],
  );
  const next = useCallback(
    (direction = 1) => {
      const index = path.indexOf(active);
      if (direction > 0 && index === path.length - 1 && mode === "guided") {
        setMode("complete");
        move(-2);
        return;
      }
      const target =
        index < 0
          ? direction > 0
            ? 1
            : 0
          : Math.max(0, Math.min(path.length - 1, index + direction));
      if (target === 0) setMode("entrance");
      else if (mode === "entrance" || mode === "complete") setMode("free");
      move(path[target]);
    },
    [active, path, mode, move],
  );
  const select = useCallback(
    (id: number) => {
      pause();
      if (id === 0) setMode("entrance");
      else if (mode === "entrance" || mode === "complete") setMode("free");
      move(id);
    },
    [pause, mode, move],
  );
  const resume = () => {
    pauseRef.current = false;
    setPaused(false);
    setClosed(false);
    if (active === -1 && (arrived || fallback)) move(path[1]);
  };
  useEffect(() => {
    setSelectedProfile(profile);
    setMode("entrance");
    setActive(0);
    setVisit((v) => v + 1);
    setArrived(false);
    setClosed(false);
    setPaused(false);
    pauseRef.current = false;
    setPending(autoWalk && tourKey > 0);
    setTab(profile);
  }, [profile, tourKey, autoWalk]);
  useEffect(() => {
    if (!pending || !visible || active !== 0 || (!fallback && !arrived)) return;
    const timer = window.setTimeout(() => start("guided"), 1500);
    return () => window.clearTimeout(timer);
  }, [pending, visible, active, fallback, arrived, start]);
  useEffect(() => {
    if (active === -1 && (arrived || fallback) && mode === "guided" && !paused)
      move(path[1]);
  }, [active, arrived, fallback, mode, paused, move, path]);
  useEffect(() => {
    if (
      mode !== "guided" ||
      paused ||
      fallback ||
      !visible ||
      !arrived ||
      active <= 0 ||
      closed
    )
      return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      if (pauseRef.current) return;
      const now = performance.now();
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (now - previous),
      );
      previous = now;
      setRemaining(remainingRef.current);
      if (remainingRef.current === 0) {
        window.clearInterval(timer);
        next();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [mode, paused, fallback, visible, arrived, active, closed, next]);
  useEffect(() => {
    if (!visible && mode === "guided") pause();
  }, [visible, mode, pause]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && mode === "guided") pause();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [mode, pause]);
  const onArrive = useCallback(() => setArrived(true), []);
  return {
    selectedProfile,
    setSelectedProfile,
    mode,
    active,
    visit,
    arrived,
    closed,
    setClosed,
    paused,
    tab,
    setTab,
    remaining,
    path,
    pause,
    start,
    next,
    select,
    resume,
    onArrive,
  };
}
