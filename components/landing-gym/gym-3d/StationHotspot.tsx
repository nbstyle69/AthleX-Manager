"use client";

import { useState, type ReactNode, type MutableRefObject } from "react";
import { gymPalette as p, type Station } from "@/data/landing";
import { Block } from "./Room";

export function StationHotspot({
  station,
  active,
  onSelect,
  gesture,
  children,
}: {
  station: Station;
  active: boolean;
  onSelect: (id: number) => void;
  gesture: MutableRefObject<boolean>;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (!gesture.current && e.delta <= 5) onSelect(station.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <group position={station.position} rotation={station.rotation}>
        {children}
        {(hover || active) && (
          <pointLight
            position={[0, 1.4, 1]}
            intensity={12}
            distance={5}
            color={p.neon}
          />
        )}
      </group>
      <group position={[station.camera[0], 0.035, station.camera[2]]}>
        {[-0.15, 0.15].map((x, i) => (
          <group
            key={x}
            position={[x, 0, i * 0.2]}
            rotation={[0, i ? -0.12 : 0.12, 0]}
          >
            <Block
              at={[0, 0, 0]}
              size={[0.17, 0.035, 0.3]}
              color={p.neon}
              glow={hover || active ? 3 : 1}
            />
            <Block
              at={[0, 0, 0.24]}
              size={[0.14, 0.035, 0.12]}
              color={p.neon}
              glow={hover || active ? 3 : 1}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
