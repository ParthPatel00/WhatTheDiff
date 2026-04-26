"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useThreeViewer } from "@/hooks/useThreeViewer";
import { applySceneLighting, frameCamerasToBoth } from "./ViewerPanel";
import { WebGLContextLostOverlay } from "./ErrorBoundary";
import { useDiffStore } from "@/stores/diffStore";
import { createViewportGrid, disposeViewportGrid } from "@/lib/viewportGrid";

export function SideBySideView() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const fileNameA = useDiffStore((s) => s.fileNameA);
  const fileNameB = useDiffStore((s) => s.fileNameB);
  const cameraSynced = useDiffStore((s) => s.cameraSynced);
  const setCameraSynced = useDiffStore((s) => s.setCameraSynced);
  const cameraResetToken = useDiffStore((s) => s.cameraResetToken);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneARef = useRef(new THREE.Scene());
  const sceneBRef = useRef(new THREE.Scene());
  const cameraARef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  const cameraBRef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  const controlsRef = useRef<OrbitControls | null>(null);
  const syncingRef = useRef(false);
  const gridARef = useRef<THREE.Group | null>(null);
  const gridBRef = useRef<THREE.Group | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const { rendererRef } = useThreeViewer(
    canvasRef,
    (renderer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      controlsRef.current?.update();

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

  // One-time setup: lights, initial camera pose, OrbitControls, resize, pointer handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const scene of [sceneARef.current, sceneBRef.current]) {
      applySceneLighting(scene);
      scene.background = new THREE.Color(0x3a3a3a);
    }

    cameraARef.current.position.set(0, 0, 5);
    cameraBRef.current.position.set(0, 0, 5);

    // Single OrbitControls on cameraA (primary). In unlocked mode,
    // pointerdown swaps controls.object to whichever camera's side was clicked.
    const controls = new OrbitControls(cameraARef.current, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    controls.addEventListener("change", () => {
      if (syncingRef.current) return;
      if (!useDiffStore.getState().cameraSynced) return;
      syncingRef.current = true;
      cameraBRef.current.position.copy(cameraARef.current.position);
      cameraBRef.current.quaternion.copy(cameraARef.current.quaternion);
      cameraBRef.current.zoom = cameraARef.current.zoom;
      cameraBRef.current.updateProjectionMatrix();
      syncingRef.current = false;
    });

    function onPointerDown(e: PointerEvent) {
      if (useDiffStore.getState().cameraSynced) return;
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Swap which camera the controls are driving based on pointer side
      if (x > rect.width / 2) {
        controls.object = cameraBRef.current;
        controls.target.copy(cameraBRef.current.position).multiplyScalar(0); // reset toward origin
      } else {
        controls.object = cameraARef.current;
      }
      controls.update();
    }
    canvas.addEventListener("pointerdown", onPointerDown);

    // Keep camera aspects in sync with canvas size
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const aspect = w / 2 / h;
      cameraARef.current.aspect = aspect;
      cameraARef.current.updateProjectionMatrix();
      cameraBRef.current.aspect = aspect;
      cameraBRef.current.updateProjectionMatrix();
    });
    ro.observe(canvas);

    const initAspect = canvas.clientWidth / 2 / Math.max(canvas.clientHeight, 1);
    cameraARef.current.aspect = initAspect;
    cameraARef.current.updateProjectionMatrix();
    cameraBRef.current.aspect = initAspect;
    cameraBRef.current.updateProjectionMatrix();

    return () => {
      controls.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      ro.disconnect();
      controlsRef.current = null;
    };
  }, []);

  // Load model A into sceneA; remove on unmount or model change
  useEffect(() => {
    const scene = sceneARef.current;
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    scene.clear();
    lights.forEach((l) => scene.add(l));
    if (gridARef.current) { disposeViewportGrid(gridARef.current); gridARef.current = null; }

    if (!modelA) return;
    // Floor the model: shift so bbox.min.y = 0 (model sits on the grid)
    const boxA = new THREE.Box3().setFromObject(modelA.scene);
    if (!boxA.isEmpty()) modelA.scene.position.y = -boxA.min.y;
    scene.add(modelA.scene);
    frameCamerasToBoth(
      cameraARef.current,
      cameraBRef.current,
      modelA.scene,
      modelB?.scene ?? null,
      controlsRef.current ?? undefined
    );

    const grid = createViewportGrid();
    gridARef.current = grid;
    scene.add(grid);

    return () => { modelA.scene.position.y = 0; scene.remove(modelA.scene); };
  }, [modelA]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load model B into sceneB; remove on unmount or model change
  useEffect(() => {
    const scene = sceneBRef.current;
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    scene.clear();
    lights.forEach((l) => scene.add(l));
    if (gridBRef.current) { disposeViewportGrid(gridBRef.current); gridBRef.current = null; }

    if (!modelB) return;
    const boxB = new THREE.Box3().setFromObject(modelB.scene);
    if (!boxB.isEmpty()) modelB.scene.position.y = -boxB.min.y;
    scene.add(modelB.scene);
    frameCamerasToBoth(
      cameraARef.current,
      cameraBRef.current,
      modelA?.scene ?? null,
      modelB.scene,
      controlsRef.current ?? undefined
    );

    const grid = createViewportGrid();
    gridBRef.current = grid;
    scene.add(grid);

    return () => { modelB.scene.position.y = 0; scene.remove(modelB.scene); };
  }, [modelB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset camera to initial framing
  useEffect(() => {
    if (!modelA || !modelB) return;
    frameCamerasToBoth(
      cameraARef.current, cameraBRef.current,
      modelA.scene, modelB.scene,
      controlsRef.current ?? undefined
    );
  }, [cameraResetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-lock: snap cameraB to cameraA and reset controls to primary camera
  useEffect(() => {
    if (!cameraSynced) return;
    const cB = cameraBRef.current;
    const cA = cameraARef.current;
    cB.position.copy(cA.position);
    cB.quaternion.copy(cA.quaternion);
    cB.zoom = cA.zoom;
    cB.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.object = cA;
      controlsRef.current.update();
    }
  }, [cameraSynced]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Sub-header */}
      <div style={{ display: "flex", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ flex: 1, padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>original</span>
          {fileNameA && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fileNameA}</span>
          )}
        </div>
        <div style={{ flex: 1, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>modified</span>
            {fileNameB && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fileNameB}</span>
            )}
          </div>
          <button
            onClick={() => setCameraSynced(!cameraSynced)}
            aria-label={cameraSynced ? "Unlock camera sync" : "Lock camera sync"}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: cameraSynced ? "var(--accent)" : "var(--text-dim)",
              background: cameraSynced ? "rgba(80, 220, 100, 0.1)" : "transparent",
              border: `1px solid ${cameraSynced ? "rgba(80, 220, 100, 0.4)" : "var(--border)"}`,
              padding: "3px 10px",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {cameraSynced ? (
                <>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </>
              ) : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              )}
            </svg>
            {cameraSynced ? "synced" : "unlocked"}
          </button>
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
