"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import {
  entranceView,
  gymPalette,
  gymTranslations,
  type Locale,
} from "@/data/landing";
import { CameraRig } from "./CameraRig";
import { Room } from "./Room";
import { Stations } from "./Stations";
import { StationLabels } from "./StationLabels";

function ContextGuard({ onError }: { onError: () => void }) {
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      onError();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [canvas, onError]);
  return null;
}
export default function Scene({
  locale,
  active,
  visit,
  running,
  onSelect,
  onArrive,
  onError,
  onInteract,
}: {
  locale: Locale;
  active: number;
  visit: number;
  running: boolean;
  onSelect: (id: number) => void;
  onArrive: () => void;
  onError: () => void;
  onInteract: () => void;
}) {
  const [dpr, setDpr] = useState(1.5);
  const gesture = useRef(false);
  return (
    <Canvas
      className="gym-canvas"
      aria-label={gymTranslations[locale].canvas}
      role="img"
      dpr={dpr}
      shadows={false}
      frameloop={running ? "always" : "never"}
      camera={{ position: entranceView.camera, fov: 66, near: 0.1, far: 70 }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={[gymPalette.background]} />
      <fog attach="fog" args={[gymPalette.background, 18, 50]} />
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onFallback={() => setDpr(0.8)}
        flipflops={2}
      />
      <ContextGuard onError={onError} />
      <Suspense fallback={null}>
        <Room locale={locale} />
        <Stations active={active} onSelect={onSelect} gesture={gesture} />
      </Suspense>
      <CameraRig
        active={active}
        visit={visit}
        onArrive={onArrive}
        onInteract={onInteract}
        gesture={gesture}
      />
      <StationLabels active={active} locale={locale} />
    </Canvas>
  );
}
