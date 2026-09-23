"use client";

import { Text, useTexture } from "@react-three/drei";
import {
  gymFont,
  gymPalette as p,
  gymTranslations,
  type Locale,
  type Point3,
} from "@/data/landing";

export function Block({
  at = [0, 0, 0],
  size,
  color = p.surface,
  glow = 0,
  rotation = [0, 0, 0],
  opacity = 1,
}: {
  at?: Point3;
  size: Point3;
  color?: string;
  glow?: number;
  rotation?: Point3;
  opacity?: number;
}) {
  return (
    <mesh position={at} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.72}
        metalness={0.35}
        emissive={p.neon}
        emissiveIntensity={glow}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
      />
    </mesh>
  );
}
export function Pole({
  at,
  size = 0.07,
  height = 2,
  color = p.metal,
  rotation = [0, 0, 0],
}: {
  at: Point3;
  size?: number;
  height?: number;
  color?: string;
  rotation?: Point3;
}) {
  return (
    <mesh position={at} rotation={rotation}>
      <cylinderGeometry args={[size, size, height, 12]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
    </mesh>
  );
}
export function Room({ locale }: { locale: Locale }) {
  const logo = useTexture("/athex-mark-light.png");
  return (
    <group>
      <Block at={[0, -0.12, 22]} size={[10, 0.2, 5]} color={p.background} />
      <Block at={[0, 4.6, 19.4]} size={[5.6, 1.65, 0.3]} />
      <mesh position={[0, 4.65, 19.58]}>
        <planeGeometry args={[1.12, 0.88]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
      <pointLight
        position={[0, 4.6, 19.9]}
        color={p.neon}
        intensity={5}
        distance={4}
      />
      <Text
        font={gymFont}
        position={[0, 3.85, 19.62]}
        fontSize={0.29}
        anchorX="center"
      >
        {gymTranslations[locale].welcome}
        <meshStandardMaterial
          color={p.light}
          emissive={p.neon}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </Text>
      {[-2.1, 2.1].map((x) => (
        <group key={x}>
          <Block
            at={[x, 1.8, 19.4]}
            size={[1.25, 3.6, 0.06]}
            color={p.light}
            opacity={0.14}
          />
          <Block
            at={[Math.sign(x) * 1.45, 1.8, 19.4]}
            size={[0.08, 3.6, 0.12]}
            color={p.metal}
          />
        </group>
      ))}
      <Text
        font={gymFont}
        position={[0, 0.025, 16]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.84}
        color={p.metal}
        anchorX="center"
        characters="ATHLEX"
      >
        ATHLEX
        <meshStandardMaterial
          color={p.metal}
          roughness={0.95}
          transparent
          opacity={0.6}
          emissive={p.neon}
          emissiveIntensity={0.04}
        />
      </Text>
      {[-7.4, 7.4].map((x) => (
        <Block key={x} at={[x, 2.7, 19.4]} size={[9.2, 5.4, 0.25]} />
      ))}
      <Block at={[0, 4.9, 19.4]} size={[5.6, 1, 0.25]} />
      {[-2.8, 2.8].map((x) => (
        <Block
          key={x}
          at={[x, 2.2, 19.3]}
          size={[0.12, 4.4, 0.2]}
          color={p.neon}
          glow={1.5}
        />
      ))}
      {[-1.3, -0.65, 0, 0.65, 1.3].map((z) => (
        <group key={z} position={[-11.6, 0, 15.5 + z]}>
          <Block at={[0, 1.2, 0]} size={[0.65, 2.4, 0.58]} color={p.metal} />
          <Block
            at={[0.34, 1.2, 0.15]}
            size={[0.04, 0.25, 0.035]}
            color={p.background}
          />
        </group>
      ))}
      <Block at={[0, -0.15, 0]} size={[24, 0.3, 40]} />
      <Block at={[0, 2.7, -19]} size={[24, 5.4, 0.25]} />
      <Block at={[-12, 2.7, 0]} size={[0.25, 5.4, 38]} />
      <Block at={[12, 2.7, 0]} size={[0.25, 5.4, 38]} />
      <Block at={[0, 5.4, 0]} size={[24, 0.15, 38]} color={p.background} />
      {[-12, -6, 0, 6, 12, 18].map((z) => (
        <group key={z}>
          <Block at={[0, 5.05, z]} size={[24, 0.22, 0.22]} color={p.metal} />
          {[-11.7, 11.7].map((x) => (
            <Block
              key={x}
              at={[x, 2.5, z]}
              size={[0.22, 5, 0.22]}
              color={p.metal}
            />
          ))}
          <Block
            at={[0, 4.98, z]}
            size={[7, 0.035, 0.14]}
            color={p.light}
            glow={1.5}
          />
        </group>
      ))}
      {[-11.8, 11.8].map((x) => (
        <group key={x}>
          <Block
            at={[x, 0.18, 0]}
            size={[0.035, 0.04, 38]}
            color={p.neon}
            glow={3}
          />
          <Block
            at={[x, 4.5, 0]}
            size={[0.035, 0.05, 38]}
            color={p.neon}
            glow={2}
          />
        </group>
      ))}
      {Array.from({ length: 11 }, (_, i) => -18 + i * 3.6).map((z) => (
        <Block
          key={z}
          at={[0, 0.007, z]}
          size={[24, 0.008, 0.015]}
          color={p.background}
        />
      ))}
      {[-10, -6, -2, 2, 6, 10].map((x) => (
        <Block
          key={x}
          at={[x, 0.008, 0]}
          size={[0.015, 0.008, 38]}
          color={p.background}
        />
      ))}
      {[-2.7, 2.7].map((x) => (
        <Block
          key={x}
          at={[x, 0.015, 0]}
          size={[0.035, 0.01, 36]}
          color={p.neon}
          glow={0.3}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <group key={i}>
          <Block
            at={[11.82, 2.8, -15 + i * 5]}
            size={[0.05, 3.2, 3.4]}
            color={p.background}
          />
          <Block
            at={[11.77, 2.8, -15 + i * 5]}
            size={[0.06, 3.2, 0.04]}
            color={p.metal}
          />
          <Block
            at={[11.77, 2.8, -15 + i * 5]}
            size={[0.06, 0.04, 3.4]}
            color={p.metal}
          />
        </group>
      ))}
      <ambientLight intensity={0.6} />
      <hemisphereLight args={[p.light, p.background, 1.6]} />
      <directionalLight position={[0, 8, 12]} intensity={1.5} color={p.light} />
      <pointLight
        position={[-8, 3, 4]}
        color={p.neon}
        intensity={35}
        distance={17}
        decay={2}
      />
      <pointLight
        position={[7, 4, -10]}
        color={p.neon}
        intensity={45}
        distance={20}
        decay={2}
      />
      <pointLight
        position={[7, 3, 13]}
        color={p.light}
        intensity={25}
        distance={15}
        decay={2}
      />
    </group>
  );
}
