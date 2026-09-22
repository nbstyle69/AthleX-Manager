"use client";

import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { stations, stationName, type Locale } from "@/data/landing";

export function StationLabels({
  active,
  locale,
}: {
  active: number;
  locale: Locale;
}) {
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const anchor = useRef<Group>(null);
  const forward = useRef(new Vector3());
  const point = useRef(new Vector3());
  useFrame(({ camera, size }) => {
    camera.getWorldDirection(forward.current);
    if (anchor.current) {
      anchor.current.position.copy(camera.position).add(forward.current);
      anchor.current.updateMatrixWorld();
    }
    const inFront = stations.filter(
      (s) =>
        s.id !== 0 &&
        point.current
          .set(s.position[0], 2.9, s.position[2])
          .sub(camera.position)
          .dot(forward.current) > 0,
    );
    const nearest = inFront
      .sort(
        (a, b) =>
          camera.position.distanceToSquared(new Vector3(...a.position)) -
          camera.position.distanceToSquared(new Vector3(...b.position)),
      )
      .slice(0, 5)
      .map((s) => s.id);
    for (const station of stations) {
      const el = labels.current[station.id];
      if (!el) continue;
      const shown =
        inFront.some((s) => s.id === station.id) &&
        (nearest.includes(station.id) || active === station.id);
      el.style.display = shown ? "block" : "none";
      if (!shown) continue;
      point.current
        .set(
          station.position[0],
          station.id === 8 ? 3.8 : station.id === 6 ? 3.5 : 3.15,
          station.position[2],
        )
        .project(camera);
      const halfWidth = el.offsetWidth / 2 + 12;
      const x = Math.max(
        halfWidth,
        Math.min(
          size.width - halfWidth,
          ((point.current.x + 1) * size.width) / 2,
        ),
      );
      const y = Math.max(
        active === 0 && size.width < 768 ? 260 : 22,
        Math.min(size.height - 92, ((1 - point.current.y) * size.height) / 2),
      );
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  });
  return (
    <group ref={anchor}>
      <Html
        calculatePosition={(_, __, size) => [size.width / 2, size.height / 2]}
        fullscreen
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="scene-labels" aria-hidden="true">
          {stations
            .filter((s) => s.id !== 0)
            .map((s) => (
              <span
                key={s.id}
                ref={(el) => {
                  labels.current[s.id] = el;
                }}
                data-station-label={s.id}
                className={`hotspot-label ${s.id === active ? "hotspot-active" : ""}`}
              >
                {stationName(locale, s.id)}
              </span>
            ))}
        </div>
      </Html>
    </group>
  );
}
