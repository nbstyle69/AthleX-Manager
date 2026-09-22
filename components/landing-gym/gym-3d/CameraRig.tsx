"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Euler,
  MathUtils,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { stations, insideView, middleView } from "@/data/landing";

export function CameraRig({
  active,
  visit,
  onArrive,
  gesture,
  onInteract,
}: {
  active: number;
  visit: number;
  onArrive: () => void;
  gesture: MutableRefObject<boolean>;
  onInteract: () => void;
}) {
  const { camera, gl, size } = useThree();
  const arrival = useRef(onArrive);
  const movement = useRef({
    elapsed: 0,
    moving: true,
    from: new Vector3(),
    to: new Vector3(),
    fromRotation: new Quaternion(),
    toRotation: new Quaternion(),
    yaw: 0,
    pitch: 0,
    wantedYaw: 0,
    wantedPitch: 0,
  });
  const rotation = useRef(new Euler(0, 0, 0, "YXZ"));
  useEffect(() => {
    arrival.current = onArrive;
  }, [onArrive]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = active === 0 ? (size.width < 768 ? 88 : 78) : 66;
    if (size.width < 768 && active > 0) {
      camera.setViewOffset(
        size.width,
        size.height,
        0,
        size.height * 0.2,
        size.width,
        size.height,
      );
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, active]);
  useEffect(() => {
    const station =
      active === -1
        ? insideView
        : active === -2
          ? middleView
          : stations.find((s) => s.id === active)!;
    const m = movement.current;
    m.from.copy(camera.position);
    m.to.set(...station.camera);
    m.fromRotation.copy(camera.quaternion);
    m.toRotation.setFromRotationMatrix(
      new Matrix4().lookAt(m.to, new Vector3(...station.target), camera.up),
    );
    m.elapsed = 0;
    m.moving = true;
  }, [active, visit, camera]);
  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: {
      id: number;
      x: number;
      y: number;
      lastX: number;
      lastY: number;
      touch: boolean;
      axis: string;
    } | null = null;
    const down = (event: PointerEvent) => {
      gesture.current = false;
      onInteract();
      if (movement.current.moving || event.button !== 0) return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        touch: event.pointerType === "touch",
        axis: "",
      };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.axis && Math.hypot(dx, dy) > 5) {
        pointer.axis =
          pointer.touch && Math.abs(dy) >= Math.abs(dx) ? "scroll" : "look";
        gesture.current = true;
        onInteract();
        if (pointer.axis === "look") {
          canvas.setPointerCapture(event.pointerId);
          canvas.style.cursor = "grabbing";
        }
      }
      if (pointer.axis === "look") {
        movement.current.wantedYaw -= (event.clientX - pointer.lastX) * 0.005;
        if (!pointer.touch)
          movement.current.wantedPitch = MathUtils.clamp(
            movement.current.wantedPitch -
              (event.clientY - pointer.lastY) * 0.004,
            -Math.PI / 7.2,
            Math.PI / 7.2,
          );
      }
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      pointer = null;
      canvas.style.cursor = "grab";
    };
    const click = (event: MouseEvent) => {
      if (gesture.current) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerup", up, true);
    canvas.addEventListener("pointercancel", up, true);
    canvas.addEventListener("click", click, true);
    return () => {
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", up, true);
      canvas.removeEventListener("pointercancel", up, true);
      canvas.removeEventListener("click", click, true);
    };
  }, [gl, gesture, onInteract]);
  useFrame((_, delta) => {
    const m = movement.current;
    if (m.moving) {
      m.elapsed = Math.min(1.2, m.elapsed + delta);
      const t = m.elapsed / 1.2;
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(m.from, m.to, eased);
      camera.quaternion.slerpQuaternions(m.fromRotation, m.toRotation, eased);
      if (t === 1) {
        m.moving = false;
        rotation.current.setFromQuaternion(camera.quaternion, "YXZ");
        m.yaw = m.wantedYaw = rotation.current.y;
        m.pitch = m.wantedPitch = rotation.current.x;
        arrival.current();
      }
    } else {
      const damping = 1 - Math.exp(-12 * delta);
      m.yaw = MathUtils.lerp(m.yaw, m.wantedYaw, damping);
      m.pitch = MathUtils.lerp(m.pitch, m.wantedPitch, damping);
      camera.quaternion.setFromEuler(
        rotation.current.set(m.pitch, m.yaw, 0, "YXZ"),
      );
    }
  });
  return null;
}
