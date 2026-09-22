"use client";

import { useTexture } from "@react-three/drei";
import { GymClock, TrophyWall } from "./GymFixtures";
import type { MutableRefObject } from "react";
import { gymPalette as p, stations, type Point3 } from "@/data/landing";
import { Block, Pole } from "./Room";
import { StationHotspot } from "./StationHotspot";

function Barbell({ at = [0, 0.35, 0] }: { at?: Point3 }) {
  return (
    <group position={at}>
      <Pole
        at={[0, 0, 0]}
        height={2.8}
        size={0.035}
        rotation={[0, 0, Math.PI / 2]}
      />
      {[-1.05, 1.05].map((x) => (
        <group key={x}>
          <Pole
            at={[x, 0, 0]}
            height={0.18}
            size={0.34}
            rotation={[0, 0, Math.PI / 2]}
            color={p.background}
          />
          <Pole
            at={[x * 1.13, 0, 0]}
            height={0.08}
            size={0.26}
            rotation={[0, 0, Math.PI / 2]}
            color={p.neon}
          />
        </group>
      ))}
    </group>
  );
}
function Rig({ bench = false }: { bench?: boolean }) {
  return (
    <group>
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <Block at={[x, 1.5, 0]} size={[0.13, 3, 0.13]} color={p.metal} />
          <Block at={[x, 0.07, 0.1]} size={[0.6, 0.1, 1.2]} />
          {[0.6, 1, 1.4, 1.8, 2.2].map((y) => (
            <Block
              key={y}
              at={[x, y, 0.08]}
              size={[0.045, 0.045, 0.03]}
              color={p.background}
            />
          ))}
        </group>
      ))}
      <Pole at={[0, 2.8, 0]} height={3.15} rotation={[0, 0, Math.PI / 2]} />
      <Barbell at={[0, bench ? 1.6 : 0.36, 0.3]} />
      {bench && (
        <>
          <Block at={[0, 0.65, 1]} size={[0.7, 0.2, 2]} color={p.background} />
          <Block at={[0, 0.3, 1]} size={[0.15, 0.6, 1.6]} color={p.metal} />
        </>
      )}
    </group>
  );
}
function Monitor({
  at = [0, 1.5, 0],
  wide = false,
}: {
  at?: Point3;
  wide?: boolean;
}) {
  return (
    <group position={at}>
      <Block size={[wide ? 2.1 : 0.95, 0.65, 0.09]} color={p.background} />
      <Block
        at={[0, 0, 0.052]}
        size={[wide ? 1.95 : 0.83, 0.52, 0.015]}
        color={p.neon}
        glow={0.8}
      />
      <Pole at={[0, -0.4, 0]} height={0.4} size={0.04} />
      <Block at={[0, -0.6, 0]} size={[0.45, 0.04, 0.3]} />
    </group>
  );
}
function Counter({ terminal = false }: { terminal?: boolean }) {
  const logo = useTexture("/athex-mark.png");
  return (
    <group>
      {!terminal && (
        <mesh position={[0, 0.78, 0.66]}>
          <planeGeometry args={[0.78, 0.78]} />
          <meshBasicMaterial map={logo} transparent toneMapped={false} />
        </mesh>
      )}
      <Block at={[0, 0.65, 0]} size={[4, 1.3, 1.2]} />
      <Block at={[0, 1.32, 0]} size={[4.2, 0.12, 1.4]} color={p.metal} />
      <Block
        at={[0, 0.12, 0.62]}
        size={[3.8, 0.06, 0.03]}
        color={p.neon}
        glow={2}
      />
      {Array.from({ length: 15 }, (_, i) => (
        <Block
          key={i}
          at={[-1.8 + i * 0.25, 0.72, 0.62]}
          size={[0.04, 0.95, 0.025]}
          color={p.background}
        />
      ))}
      {terminal ? (
        <Block
          at={[0.6, 1.5, 0.1]}
          size={[0.4, 0.18, 0.55]}
          color={p.neon}
          glow={0.4}
          rotation={[0.2, 0, 0]}
        />
      ) : (
        <Monitor at={[0.7, 1.9, 0]} />
      )}
    </group>
  );
}
function Board() {
  return (
    <group>
      <Block at={[0, 1.8, -0.4]} size={[4.8, 2.5, 0.16]} color={p.metal} />
      <Block at={[0, 1.8, -0.3]} size={[4.6, 2.3, 0.06]} color={p.background} />
      {[-1.45, 0, 1.45].map((x) => (
        <group key={x}>
          <Block
            at={[x, 2.6, -0.26]}
            size={[1, 0.09, 0.015]}
            color={p.neon}
            glow={1}
          />
          {[1.1, 1.45, 1.8, 2.15].map((y) => (
            <Block
              key={y}
              at={[x, y, -0.26]}
              size={[1, 0.035, 0.01]}
              color={p.metal}
            />
          ))}
        </group>
      ))}
      <Block at={[0, 0.55, -0.1]} size={[4.8, 0.06, 0.45]} />
    </group>
  );
}
function Track() {
  return (
    <group>
      {[-1.8, 0, 1.8].map((x) => (
        <Block
          key={x}
          at={[x, 0.05, 0]}
          size={[0.045, 0.02, 6]}
          color={p.neon}
          glow={0.4}
        />
      ))}
      <Block at={[-0.8, 0.23, 0.6]} size={[0.8, 0.2, 1.3]} />
      {[-1.1, -0.5].map((x) => (
        <Pole key={x} at={[x, 0.8, 0.8]} height={1.2} size={0.05} />
      ))}
      <Pole
        at={[-0.8, 0.43, 0.45]}
        height={0.3}
        size={0.27}
        color={p.background}
      />
      <Block at={[0.9, 0.3, -0.8]} size={[0.25, 0.2, 2.8]} color={p.metal} />
      <Pole
        at={[0.9, 0.7, -1.9]}
        size={0.45}
        height={0.4}
        rotation={[0, 0, Math.PI / 2]}
      />
      <Block at={[0.9, 0.6, -0.3]} size={[0.55, 0.15, 0.4]} />
    </group>
  );
}
function Strength() {
  return (
    <group>
      <Rig bench />
      <group position={[0, 0, -1.8]}>
        <Block at={[0, 0.8, 0]} size={[4, 0.13, 0.5]} />
        {[-1.5, -0.75, 0, 0.75, 1.5].map((x) => (
          <group key={x} position={[x, 1, 0]}>
            <Pole
              at={[0, 0, 0]}
              height={0.5}
              size={0.04}
              rotation={[0, 0, Math.PI / 2]}
            />
            {[-0.23, 0.23].map((dx) => (
              <Block
                key={dx}
                at={[dx, 0, 0]}
                size={[0.18, 0.3, 0.3]}
                color={p.metal}
              />
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
function Arena() {
  return (
    <group>
      <Block at={[0, 0.1, 0]} size={[5, 0.18, 4]} color={p.background} />
      {[-2.5, 2.5].map((x) => (
        <Block
          key={x}
          at={[x, 0.2, 0]}
          size={[0.04, 0.04, 4]}
          color={p.neon}
          glow={2}
        />
      ))}
      <Board />
      <Barbell at={[0, 0.5, 1]} />
      {[-2.2, 2.2].map((x) => (
        <group key={x}>
          <Pole at={[x, 1.9, -1.7]} height={3.8} />
          <Pole
            at={[x, 3.7, -1.5]}
            size={0.16}
            height={0.4}
            rotation={[0.8, 0, 0]}
            color={p.light}
          />
        </group>
      ))}
    </group>
  );
}
function Lounge() {
  return (
    <group>
      {[-1.4, 1.4].map((x) => (
        <group key={x}>
          <Block at={[x, 0.4, 0]} size={[1.8, 0.7, 1.3]} />
          <Block at={[x, 0.9, -0.55]} size={[1.8, 1, 0.25]} color={p.metal} />
          <Block at={[x, 0.8, 0.05]} size={[1.5, 0.15, 0.95]} color={p.metal} />
        </group>
      ))}
      <Pole at={[0, 0.4, 1.6]} height={0.8} size={0.04} />
      <Pole at={[0, 0.82, 1.6]} height={0.06} size={0.8} color={p.metal} />
      <Block at={[0, 1, -1.8]} size={[4, 2, 0.5]} />
      {[-1, 0, 1].map((x) => (
        <Pole
          key={x}
          at={[x, 2.15, -1.8]}
          height={0.25}
          size={0.1}
          color={p.neon}
        />
      ))}
    </group>
  );
}
function Office() {
  return (
    <group>
      {[-2.6, 2.6].map((x) => (
        <group key={x}>
          <Block
            at={[x, 1.8, 0]}
            size={[0.04, 3.6, 4]}
            color={p.neon}
            opacity={0.08}
          />
          <Pole at={[x, 1.8, -2]} height={3.6} size={0.035} />
          <Pole at={[x, 1.8, 2]} height={3.6} size={0.035} />
        </group>
      ))}
      <Block at={[0, 3.6, 0]} size={[5.3, 0.12, 4.1]} color={p.metal} />
      <Block at={[0, 1, 0]} size={[3, 0.15, 1.3]} color={p.metal} />
      {[-1.3, 1.3].map((x) => (
        <Block key={x} at={[x, 0.5, 0]} size={[0.1, 1, 1]} />
      ))}
      <Monitor at={[0, 1.75, 0]} wide />
      <Block at={[0, 0.65, -1]} size={[1, 0.2, 1]} />
      <Block at={[0, 1.1, -1.4]} size={[1, 1, 0.15]} />
    </group>
  );
}
const objects = [
  Counter,
  Board,
  Rig,
  Track,
  Strength,
  GymClock,
  Arena,
  TrophyWall,
  Lounge,
  Office,
  () => <Counter terminal />,
];
export function Stations({
  active,
  onSelect,
  gesture,
}: {
  active: number;
  onSelect: (id: number) => void;
  gesture: MutableRefObject<boolean>;
}) {
  return (
    <group>
      {stations.map((station) => {
        const Object = objects[station.id - 1];
        return (
          <StationHotspot
            key={station.id}
            station={station}
            active={active === station.id}
            onSelect={onSelect}
            gesture={gesture}
          >
            {station.id !== 0 && <Object />}
          </StationHotspot>
        );
      })}
    </group>
  );
}
