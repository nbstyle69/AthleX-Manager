"use client";

import { useMemo, useRef, useState } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group, Object3D, Quaternion, Vector2, Vector3 } from "three";
import { gymFont, gymPalette as p, type Point3 } from "@/data/landing";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Block, Pole } from "./Room";

const metals = { gold: "#c8a45e", silver: p.metal, bronze: "#a8754e" };
const recordingRed = "#ef5252";
const digitSegments = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];
const segments: { key: string; at: Point3; vertical: boolean }[] = [
  { key: "a", at: [0, 0.29, 0], vertical: false },
  { key: "b", at: [0.16, 0.145, 0], vertical: true },
  { key: "c", at: [0.16, -0.145, 0], vertical: true },
  { key: "d", at: [0, -0.29, 0], vertical: false },
  { key: "e", at: [-0.16, -0.145, 0], vertical: true },
  { key: "f", at: [-0.16, 0.145, 0], vertical: true },
  { key: "g", at: [0, 0, 0], vertical: false },
];
function LedDigit({ digit, x }: { digit: string; x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {segments.map((s) => {
        const lit = digitSegments[Number(digit)].includes(s.key);
        return (
          <mesh
            key={s.key}
            position={s.at}
            rotation={[0, 0, s.vertical ? Math.PI / 2 : 0]}
          >
            <boxGeometry args={[0.25, 0.045, 0.018]} />
            <meshStandardMaterial
              color={lit ? p.neon : p.surface}
              emissive={p.neon}
              emissiveIntensity={lit ? 2.2 : 0.035}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
function Rod({
  from,
  to,
  radius = 0.025,
  color = p.metal,
}: {
  from: Point3;
  to: Point3;
  radius?: number;
  color?: string;
}) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from),
      b = new Vector3(...to),
      direction = b.clone().sub(a);
    return {
      midpoint: a.add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
      length: direction.length(),
    };
  }, [from, to]);
  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} metalness={0.75} roughness={0.3} />
    </mesh>
  );
}
function PhoneTripod() {
  return (
    <group position={[1.3, 0, 1.45]} rotation={[0, -0.15, 0]}>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => {
        const foot: Point3 = [
          Math.cos(angle) * 0.58,
          0.055,
          Math.sin(angle) * 0.58,
        ];
        const joint: Point3 = [
          Math.cos(angle) * 0.28,
          0.64,
          Math.sin(angle) * 0.28,
        ];
        return (
          <group key={angle}>
            <Rod from={[0, 1.13, 0]} to={joint} radius={0.028} />
            <Rod from={joint} to={foot} radius={0.021} />
            <Rod from={[0, 0.63, 0]} to={joint} radius={0.012} />
            <mesh position={joint}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color={p.background} />
            </mesh>
            <RoundedBox
              position={foot}
              args={[0.11, 0.075, 0.13]}
              radius={0.025}
              smoothness={2}
            >
              <meshStandardMaterial color={p.background} roughness={1} />
            </RoundedBox>
          </group>
        );
      })}
      <Pole at={[0, 1.15, 0]} height={1.05} size={0.037} />
      <Pole at={[0, 1.61, 0]} height={0.12} size={0.08} color={p.background} />
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.065, 12, 10]} />
        <meshStandardMaterial
          color={p.metal}
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>
      <Rod from={[0, 1.65, 0]} to={[0.22, 1.5, -0.15]} radius={0.016} />
      <Block
        at={[0, 1.82, -0.045]}
        size={[0.09, 0.22, 0.09]}
        color={p.background}
      />
      {[-0.225, 0.225].map((y) => (
        <RoundedBox
          key={y}
          position={[0, 2.03 + y, -0.005]}
          args={[0.23, 0.055, 0.12]}
          radius={0.018}
          smoothness={2}
        >
          <meshStandardMaterial color={p.metal} />
        </RoundedBox>
      ))}
      <RoundedBox
        position={[0, 2.03, 0]}
        args={[0.94, 0.46, 0.065]}
        radius={0.055}
        smoothness={4}
      >
        <meshStandardMaterial
          color={p.background}
          metalness={0.7}
          roughness={0.3}
        />
      </RoundedBox>
      <RoundedBox
        position={[0, 2.03, 0.037]}
        args={[0.85, 0.37, 0.008]}
        radius={0.026}
        smoothness={3}
      >
        <meshStandardMaterial
          color={p.surface}
          emissive={p.neon}
          emissiveIntensity={0.18}
        />
      </RoundedBox>
      <mesh position={[-0.34, 2.14, 0.047]}>
        <circleGeometry args={[0.017, 14]} />
        <meshBasicMaterial color={recordingRed} />
      </mesh>
      <Text
        font={gymFont}
        position={[-0.22, 2.14, 0.047]}
        fontSize={0.055}
        color={p.light}
      >
        REC
      </Text>
      <Text
        font={gymFont}
        position={[0.27, 2.14, 0.047]}
        fontSize={0.055}
        color={p.light}
      >
        12:34
      </Text>
      <mesh position={[0.33, 2, 0.047]}>
        <ringGeometry args={[0.032, 0.043, 20]} />
        <meshBasicMaterial color={p.light} />
      </mesh>
      {[-0.09, -0.055].map((y) => (
        <Block
          key={y}
          at={[-0.18, 2.03 + y, 0.047]}
          size={[0.25, 0.007, 0.004]}
          color={p.light}
          glow={0.5}
        />
      ))}
      {[-0.19, 0.12].map((x) => (
        <Block
          key={x}
          at={[x, 2.03, 0.047]}
          size={[0.005, 0.11, 0.004]}
          color={p.metal}
        />
      ))}
    </group>
  );
}
export function GymClock() {
  const timer = useRef<Group>(null);
  const elapsed = useRef(0);
  const projected = useMemo(() => new Vector3(), []);
  const [seconds, setSeconds] = useState(20 * 60);
  const reduced = useReducedMotion();
  useFrame(({ camera }, delta) => {
    if (reduced || !timer.current) return;
    timer.current.getWorldPosition(projected);
    projected.project(camera);
    if (
      Math.abs(projected.x) > 1.1 ||
      Math.abs(projected.y) > 1.1 ||
      projected.z < -1 ||
      projected.z > 1
    )
      return;
    elapsed.current += Math.min(delta, 0.1);
    if (elapsed.current >= 1) {
      elapsed.current -= 1;
      setSeconds((s) => Math.max(0, s - 1));
    }
  });
  const digits = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <group>
      <group position={[0, 2.5, 0]} ref={timer}>
        {[-1.1, 1.1].map((x) => (
          <group key={x}>
            <Block
              at={[x, 0, -0.19]}
              size={[0.12, 0.65, 0.13]}
              color={p.metal}
            />
            <Block
              at={[x, -0.28, -0.08]}
              size={[0.12, 0.08, 0.3]}
              color={p.metal}
            />
          </group>
        ))}
        <RoundedBox args={[3, 1.1, 0.22]} radius={0.065} smoothness={4}>
          <meshStandardMaterial
            color={p.metal}
            metalness={0.75}
            roughness={0.3}
          />
        </RoundedBox>
        <RoundedBox
          position={[0, 0, 0.02]}
          args={[2.94, 1.04, 0.23]}
          radius={0.055}
          smoothness={4}
        >
          <meshStandardMaterial color={p.background} roughness={0.7} />
        </RoundedBox>
        <Text
          font={gymFont}
          position={[0.22, 0.4, 0.145]}
          fontSize={0.11}
          color={p.metal}
        >
          AMRAP
        </Text>
        <Text
          font={gymFont}
          position={[-1.12, 0.03, 0.145]}
          fontSize={0.2}
          color={p.neon}
        >
          R 3
        </Text>
        <group position={[0.3, -0.055, 0.15]}>
          {[...digits].map((d, i) => (
            <LedDigit key={i} digit={d} x={[-0.72, -0.28, 0.32, 0.76][i]} />
          ))}
          {[-0.12, 0.12].map((y) => (
            <mesh key={y} position={[0.02, y, 0]}>
              <circleGeometry args={[0.027, 12]} />
              <meshBasicMaterial color={p.neon} toneMapped={false} />
            </mesh>
          ))}
        </group>
        <pointLight
          position={[0, 0, 0.35]}
          color={p.neon}
          intensity={0.6}
          distance={2}
        />
      </group>
      <PhoneTripod />
    </group>
  );
}
const cupProfile = [
  [0, 0],
  [0.07, 0.02],
  [0.07, 0.14],
  [0.17, 0.19],
  [0.26, 0.34],
  [0.3, 0.54],
  [0.28, 0.56],
  [0.25, 0.35],
  [0.14, 0.23],
  [0, 0.21],
].map(([x, y]) => new Vector2(x, y));
function Cup({
  at,
  color,
  tall = false,
}: {
  at: Point3;
  color: string;
  tall?: boolean;
}) {
  return (
    <group position={at} scale={[1, tall ? 1.45 : 1, 1]}>
      <Block
        at={[0, 0.055, 0]}
        size={[0.46, 0.11, 0.37]}
        color={p.background}
      />
      <Block at={[0, 0.13, 0]} size={[0.34, 0.05, 0.29]} color={color} />
      <Block at={[0, 0.06, 0.19]} size={[0.24, 0.045, 0.012]} color={color} />
      <mesh position={[0, 0.16, 0]}>
        <latheGeometry args={[cupProfile, 40]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.22} />
      </mesh>
      {[-1, 1].map((sign) => (
        <mesh
          key={sign}
          position={[sign * 0.28, 0.52, 0]}
          rotation={[0, 0, sign < 0 ? Math.PI / 2 : -Math.PI / 2]}
        >
          <torusGeometry args={[0.17, 0.025, 8, 24, Math.PI * 1.35]} />
          <meshStandardMaterial
            color={color}
            metalness={0.95}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
function ShelfLight({ x }: { x: number }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <group>
      <primitive object={target} position={[x, 1.8, 0.03]} />
      <Pole
        at={[x, 3.5, 0.15]}
        height={0.2}
        size={0.09}
        rotation={[0.35, 0, 0]}
        color={p.background}
      />
      <spotLight
        position={[x, 3.4, 0.22]}
        target={target}
        color={p.light}
        intensity={9}
        distance={4}
        angle={0.65}
        penumbra={0.7}
        decay={2}
      />
    </group>
  );
}
export function TrophyWall() {
  return (
    <group>
      <Block
        at={[0, 1.9, -0.28]}
        size={[4.4, 3.2, 0.13]}
        color={p.background}
      />
      {[1.1, 2.25].map((y) => (
        <group key={y}>
          <Block
            at={[0, y, -0.01]}
            size={[4.35, 0.085, 0.62]}
            color={p.metal}
          />
          {[-1.75, 1.75].map((x) => (
            <group key={x}>
              <Block
                at={[x, y - 0.16, -0.22]}
                size={[0.055, 0.32, 0.06]}
                color={p.metal}
              />
              <Rod
                from={[x, y - 0.28, -0.2]}
                to={[x, y - 0.04, 0.2]}
                radius={0.018}
              />
            </group>
          ))}
        </group>
      ))}
      <Cup at={[-1.45, 2.3, 0]} color={metals.silver} />
      <Cup at={[-0.4, 2.3, 0]} color={metals.gold} tall />
      <Cup at={[0.65, 2.3, 0]} color={metals.bronze} />
      {[-1.5, -0.95].map((x, i) => (
        <group key={x} position={[x, 1.16, 0]} rotation={[-0.08, 0, 0]}>
          <Block
            at={[0, 0.29, 0]}
            size={[0.43, 0.58, 0.075]}
            color={i ? metals.bronze : metals.gold}
          />
          <Block
            at={[0, 0.29, 0.04]}
            size={[0.35, 0.5, 0.01]}
            color={p.background}
          />
          <Text
            font={gymFont}
            position={[0, 0.35, 0.048]}
            fontSize={0.07}
            color={p.light}
          >
            ATHLEX
          </Text>
          <Text
            font={gymFont}
            position={[0, 0.2, 0.048]}
            fontSize={0.075}
            color={i ? metals.bronze : metals.gold}
          >
            {i ? "2025" : "2026"}
          </Text>
        </group>
      ))}
      {[metals.gold, metals.silver, metals.bronze].map((color, i) => (
        <group key={color} position={[0.05 + i * 0.65, 1.93, -0.05]}>
          <Pole
            at={[0, 0, -0.07]}
            size={0.025}
            height={0.18}
            rotation={[Math.PI / 2, 0, 0]}
          />
          {[-1, 1].map((sign) => (
            <Block
              key={sign}
              at={[sign * 0.055, -0.18, 0.02]}
              size={[0.065, 0.4, 0.013]}
              rotation={[0, 0, sign * -0.28]}
              color={i === 1 ? p.metal : p.neon}
            />
          ))}
          <mesh position={[0, -0.44, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.027, 32]} />
            <meshStandardMaterial
              color={color}
              metalness={0.95}
              roughness={0.24}
            />
          </mesh>
          <Text
            font={gymFont}
            position={[0, -0.44, 0.06]}
            fontSize={0.12}
            color={p.background}
          >
            {i + 1}
          </Text>
        </group>
      ))}
      <Block at={[1.7, 0.31, 0]} size={[0.65, 0.62, 0.7]} color={p.surface} />
      <Text
        font={gymFont}
        position={[1.7, 0.33, 0.36]}
        fontSize={0.28}
        color={metals.gold}
      >
        1
      </Text>
      {[-1.5, 0, 1.5].map((x) => (
        <ShelfLight key={x} x={x} />
      ))}
    </group>
  );
}
