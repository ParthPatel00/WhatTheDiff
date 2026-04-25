"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useThreeViewer } from "@/hooks/useThreeViewer";
import { applySceneLighting, frameCamerasToBoth } from "./ViewerPanel";
import { WebGLContextLostOverlay } from "./ErrorBoundary";
import { useDiffStore } from "@/stores/diffStore";

const ROTATION_SPEED = 0.005; // radians per frame

export function TurntableView() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const fileNameA = useDiffStore((s) => s.fileNameA);
  const fileNameB = useDiffStore((s) => s.fileNameB);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneARef = useRef(new THREE.Scene());
  const sceneBRef = useRef(new THREE.Scene());
  const cameraARef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  const cameraBRef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  // Controls are used for OrbitControls damping/target but autoRotate drives the orbit
  const controlsARef = useRef<OrbitControls | null>(null);
  const controlsBRef = useRef<OrbitControls | null>(null);
  const angleRef = useRef(0);
  const [contextLost, setContextLost] = useState(false);
  const [degrees, setDegrees] = useState(0);

  const { rendererRef } = useThreeViewer(
    canvasRef,
    (renderer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Advance rotation angle
      angleRef.current = (angleRef.current + ROTATION_SPEED) % (Math.PI * 2);
      const angle = angleRef.current;

      // Both cameras orbit at the same Y angle, keeping sync always on
      const target = controlsARef.current?.target ?? new THREE.Vector3();
      const dist = cameraARef.current.position.distanceTo(target);

      for (const cam of [cameraARef.current, cameraBRef.current]) {
        cam.position.x = target.x + dist * Math.sin(angle);
        cam.position.z = target.z + dist * Math.cos(angle);
        cam.position.y = cameraARef.current.position.y; // preserve elevation
        cam.lookAt(target);
      }

      // Degrees display update — throttled via integer comparison
      const deg = Math.round((angle * 180) / Math.PI);
      setDegrees(deg);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const halfW = Math.floor(w / 2);

      renderer.setScissorTest(true);

      renderer.setViewport(0, 0, halfW, h);
      renderer.setScissor(0, 0, halfW, h);
      renderer.render(sceneARef.current, cameraARef.current);

      renderer.setViewport(halfW, 0, halfW, h);
      renderer.setScissor(halfW, 0, halfW, h);
      renderer.render(sceneBRef.current, cameraBRef.current);
    },
    {
      onContextLost: () => setContextLost(true),
      onContextRestored: () => setContextLost(false),
    }
  );

  // One-time setup: lights, cameras, resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const scene of [sceneARef.current, sceneBRef.current]) {
      applySceneLighting(scene);
    }

    cameraARef.current.position.set(0, 0, 5);
    cameraBRef.current.position.set(0, 0, 5);

    // OrbitControls are created to establish a stable target; no user input needed
    const ctrlA = new OrbitControls(cameraARef.current, canvas);
    const ctrlB = new OrbitControls(cameraBRef.current, canvas);
    ctrlA.enabled = false; // user cannot orbit; turntable drives it
    ctrlB.enabled = false;
    controlsARef.current = ctrlA;
    controlsBRef.current = ctrlB;

    const ro = new ResizeObserver(() => {
      const aspect = canvas.clientWidth / 2 / Math.max(canvas.clientHeight, 1);
      for (const cam of [cameraARef.current, cameraBRef.current]) {
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
      }
    });
    ro.observe(canvas);

    const initAspect = canvas.clientWidth / 2 / Math.max(canvas.clientHeight, 1);
    for (const cam of [cameraARef.current, cameraBRef.current]) {
      cam.aspect = initAspect;
      cam.updateProjectionMatrix();
    }

    return () => {
      ctrlA.dispose();
      ctrlB.dispose();
      ro.disconnect();
      controlsARef.current = null;
      controlsBRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneARef.current;
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    scene.clear();
    lights.forEach((l) => scene.add(l));

    if (!modelA) return;
    scene.add(modelA.scene);
    frameCamerasToBoth(
      cameraARef.current,
      cameraBRef.current,
      modelA.scene,
      modelB?.scene ?? null,
      controlsARef.current ?? undefined
    );
    return () => { scene.remove(modelA.scene); };
  }, [modelA]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const scene = sceneBRef.current;
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    scene.clear();
    lights.forEach((l) => scene.add(l));

    if (!modelB) return;
    scene.add(modelB.scene);
    frameCamerasToBoth(
      cameraARef.current,
      cameraBRef.current,
      modelA?.scene ?? null,
      modelB.scene,
      controlsARef.current ?? undefined
    );
    return () => { scene.remove(modelB.scene); };
  }, [modelB]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Sub-header */}
      <div style={{ display: "flex", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ flex: 1, padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>v1</span>
          {fileNameA && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fileNameA}</span>
          )}
        </div>
        <div style={{ flex: 1, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>v2</span>
            {fileNameB && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fileNameB}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
              auto-rotating · synced Y axis
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
              {degrees}°
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
        {contextLost && (
          <WebGLContextLostOverlay
            onRestore={() => rendererRef.current?.forceContextRestore()}
          />
        )}
      </div>
    </div>
  );
}
