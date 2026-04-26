"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useThreeViewer } from "@/hooks/useThreeViewer";
import { applySceneLighting, frameCamerasToBoth } from "@/components/viewer/ViewerPanel";
import { WebGLContextLostOverlay } from "@/components/viewer/ErrorBoundary";
import { createViewportGrid, disposeViewportGrid } from "@/lib/viewportGrid";
import { useDiffStore } from "@/stores/diffStore";
import { CAMERA_ANGLE_ORDER } from "@/lib/cameraPresets";
import { CameraAngle } from "@/lib/types";

const ANGLE_LABELS: Record<CameraAngle, string> = {
  [CameraAngle.Front]: "Front",
  [CameraAngle.Back]: "Back",
  [CameraAngle.Left]: "Left",
  [CameraAngle.Right]: "Right",
  [CameraAngle.Top]: "Top",
  [CameraAngle.ThreeQuarter]: "3/4",
};

interface Props {
  initialAngle?: CameraAngle;
  onClose?: () => void;
}

export default function PixelDiffView({ initialAngle, onClose }: Props) {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const fileNameA = useDiffStore((s) => s.fileNameA);
  const diffResults = useDiffStore((s) => s.diffResults);
  const cameraResetToken = useDiffStore((s) => s.cameraResetToken);

  const [angleIndex, setAngleIndex] = useState(() => {
    if (initialAngle !== undefined) return CAMERA_ANGLE_ORDER.indexOf(initialAngle);
    return 0;
  });

  useEffect(() => {
    if (initialAngle !== undefined) {
      const idx = CAMERA_ANGLE_ORDER.indexOf(initialAngle);
      if (idx !== -1) setAngleIndex(idx);
    }
  }, [initialAngle]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.Group | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const currentAngle = CAMERA_ANGLE_ORDER[angleIndex];
  const result = diffResults.find((r) => r.angle === currentAngle);

  const { rendererRef } = useThreeViewer(
    canvasRef,
    (renderer) => {
      controlsRef.current?.update();
      renderer.setScissorTest(false);
      renderer.render(sceneRef.current, cameraRef.current);
    },
    {
      onContextLost: () => setContextLost(true),
      onContextRestored: () => setContextLost(false),
    }
  );

  // One-time setup: lights, camera, controls, resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = sceneRef.current;
    applySceneLighting(scene);
    scene.background = new THREE.Color(0x3a3a3a);

    cameraRef.current.position.set(0, 0, 5);

    const controls = new OrbitControls(cameraRef.current, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    });
    ro.observe(canvas);

    const initAspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    cameraRef.current.aspect = initAspect;
    cameraRef.current.updateProjectionMatrix();

    return () => {
      controls.dispose();
      ro.disconnect();
      controlsRef.current = null;
    };
  }, []);

  // Load model A into scene (model A is the reference for diff display)
  useEffect(() => {
    const scene = sceneRef.current;
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    scene.clear();
    lights.forEach((l) => scene.add(l));
    if (gridRef.current) { disposeViewportGrid(gridRef.current); gridRef.current = null; }

    if (!modelA) return;

    const box = new THREE.Box3().setFromObject(modelA.scene);
    if (!box.isEmpty()) modelA.scene.position.y = -box.min.y;
    scene.add(modelA.scene);

    frameCamerasToBoth(
      cameraRef.current,
      cameraRef.current,
      modelA.scene,
      modelB?.scene ?? null,
      controlsRef.current ?? undefined
    );

    const grid = createViewportGrid();
    gridRef.current = grid;
    scene.add(grid);

    return () => { modelA.scene.position.y = 0; scene.remove(modelA.scene); };
  }, [modelA]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reframe when model B changes (affects framing even though B isn't in this scene)
  useEffect(() => {
    if (!modelA) return;
    frameCamerasToBoth(
      cameraRef.current,
      cameraRef.current,
      modelA.scene,
      modelB?.scene ?? null,
      controlsRef.current ?? undefined
    );
  }, [modelB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset camera
  useEffect(() => {
    if (!modelA) return;
    frameCamerasToBoth(
      cameraRef.current,
      cameraRef.current,
      modelA.scene,
      modelB?.scene ?? null,
      controlsRef.current ?? undefined
    );
  }, [cameraResetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paint diff overlay: only changed pixels in red, everything else transparent
  useEffect(() => {
    const overlay = overlayRef.current;
    const glCanvas = canvasRef.current;
    if (!overlay || !glCanvas) return;

    function paint() {
      if (!overlay || !glCanvas || !result) {
        // No result — clear overlay
        if (overlay) {
          overlay.width = overlay.clientWidth;
          overlay.height = overlay.clientHeight;
        }
        return;
      }
      const w = glCanvas.clientWidth;
      const h = glCanvas.clientHeight;
      if (w === 0 || h === 0) return;
      overlay.width = w;
      overlay.height = h;

      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Build a transparent image with only changed pixels highlighted
      const src = result.diff; // Uint8ClampedArray, 1024×1024 RGBA
      const size = 1024;
      const out = new Uint8ClampedArray(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        const r = src[i * 4];
        const g = src[i * 4 + 1];
        const b = src[i * 4 + 2];
        const a = src[i * 4 + 3];
        // The diff image uses red pixels (high R, low G/B) to mark changes
        if (r > 180 && g < 80 && b < 80 && a > 0) {
          out[i * 4] = 255;
          out[i * 4 + 1] = 0;
          out[i * 4 + 2] = 0;
          out[i * 4 + 3] = 220;
        }
        // else: transparent — live 3D render shows through
      }

      const offscreen = new OffscreenCanvas(size, size);
      const octx = offscreen.getContext("2d")!;
      octx.putImageData(new ImageData(out, size, size), 0, 0);
      ctx.drawImage(offscreen, 0, 0, w, h);
    }

    paint();

    const ro = new ResizeObserver(paint);
    ro.observe(glCanvas);
    return () => ro.disconnect();
  }, [result]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setAngleIndex((i) => (i - 1 + CAMERA_ANGLE_ORDER.length) % CAMERA_ANGLE_ORDER.length);
      } else if (e.key === "ArrowRight") {
        setAngleIndex((i) => (i + 1) % CAMERA_ANGLE_ORDER.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!modelA && !modelB) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", fontFamily: "var(--font-mono)", fontSize: 13,
        color: "var(--text-dim)",
      }}>
        Load two models to see the pixel diff.
      </div>
    );
  }

  const pct = result?.pct ?? 0;
  const badgeColor = pct < 1 ? "var(--green)" : pct > 50 ? "var(--red)" : "var(--yellow)";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Sub-header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>original</span>
          {fileNameA && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fileNameA}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {diffResults.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: badgeColor, fontWeight: 600 }}>
              {pct.toFixed(1)}% changed
            </span>
          )}
          {onClose && (
            <button
              aria-label="Close expanded view"
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 18, lineHeight: 1, padding: "0 2px",
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Canvas — identical structure to SideBySideView */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
        {/* Diff overlay — transparent canvas on top, pointer-events: none so orbit controls still work */}
        <canvas
          ref={overlayRef}
          aria-label={`Pixel diff overlay for ${ANGLE_LABELS[currentAngle]} angle`}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none",
          }}
        />
        {contextLost && (
          <WebGLContextLostOverlay
            onRestore={() => rendererRef.current?.forceContextRestore()}
          />
        )}
        <span style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
          pointerEvents: "none",
        }}>
          ← → to cycle angles
        </span>
      </div>

      {/* Dot navigation */}
      {diffResults.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 8, padding: "10px 16px", background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)", flexShrink: 0,
        }}>
          {CAMERA_ANGLE_ORDER.map((angle, i) => {
            const r = diffResults.find((d) => d.angle === angle);
            const dotColor = !r ? "var(--border)"
              : r.pct < 1 ? "var(--green)"
              : r.pct > 50 ? "var(--red)"
              : "var(--yellow)";
            return (
              <button
                key={angle}
                aria-label={`${ANGLE_LABELS[angle]}: ${r?.pct.toFixed(1) ?? "—"}% changed`}
                onClick={() => setAngleIndex(i)}
                title={`${ANGLE_LABELS[angle]} — ${r?.pct.toFixed(1) ?? "—"}%`}
                style={{
                  width: i === angleIndex ? 10 : 8,
                  height: i === angleIndex ? 10 : 8,
                  borderRadius: "50%",
                  background: i === angleIndex ? dotColor : "var(--bg-elevated)",
                  border: `2px solid ${dotColor}`,
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.15s ease",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
