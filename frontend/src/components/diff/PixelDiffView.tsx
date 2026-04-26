"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useDiffStore } from "@/stores/diffStore";
import { applySceneLighting } from "@/components/viewer/ViewerPanel";
import { createViewportGrid } from "@/lib/viewportGrid";
import { CAMERA_ANGLE_ORDER, CAMERA_PRESETS } from "@/lib/cameraPresets";
import { CameraAngle } from "@/lib/types";

const FOV = 45;
const BG = 0x3a3a3a;
const BG_R = 58; // 0x3a
const MIX = 0.8;

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
  const tolerance = useDiffStore((s) => s.tolerance);
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
  const [livePct, setLivePct] = useState<number | null>(null);

  // Refs that the render loop reads — changes trigger re-render without remounting
  const angleIndexRef = useRef(angleIndex);
  const toleranceRef = useRef(tolerance);
  const needsUpdateRef = useRef(true);
  const needsSnapRef = useRef(true);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => { angleIndexRef.current = angleIndex; needsUpdateRef.current = true; needsSnapRef.current = true; }, [angleIndex]);
  useEffect(() => { toleranceRef.current = tolerance; needsUpdateRef.current = true; }, [tolerance]);

  // Camera reset: re-snap to current angle
  useEffect(() => {
    needsUpdateRef.current = true;
    needsSnapRef.current = true;
  }, [cameraResetToken]);

  // Main setup: mirrors FreeformPixelDiffView but with preset-locked camera
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelA || !modelB) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen WebGL renderer
    const offscreen = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas: offscreen, antialias: true, preserveDrawingBuffer: true });
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(1); // keep 1 — DPR applied manually to offscreen size
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(BG, 1);

    // Clones with shared offset (same as renderer.ts renderBothModels)
    const cloneA = modelA.scene.clone();
    const cloneB = modelB.scene.clone();
    cloneA.position.set(0, 0, 0);
    cloneB.position.set(0, 0, 0);
    const boxA = new THREE.Box3().setFromObject(cloneA);
    const centerA = new THREE.Vector3();
    boxA.getCenter(centerA);
    const offset = new THREE.Vector3(-centerA.x, -boxA.min.y, -centerA.z);
    cloneA.position.copy(offset);
    cloneB.position.copy(offset);

    const sceneA = new THREE.Scene();
    sceneA.background = new THREE.Color(BG);
    applySceneLighting(sceneA);
    sceneA.add(cloneA, createViewportGrid());

    const sceneB = new THREE.Scene();
    sceneB.background = new THREE.Color(BG);
    applySceneLighting(sceneB);
    sceneB.add(cloneB, createViewportGrid());

    // Initial canvas size
    const initW = canvas.clientWidth || 800;
    const initH = canvas.clientHeight || 600;
    canvas.width = Math.round(initW * dpr);
    canvas.height = Math.round(initH * dpr);
    renderer.setSize(Math.round(initW * dpr), Math.round(initH * dpr), false);

    const camera = new THREE.PerspectiveCamera(FOV, initW / initH, 0.01, 10000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Compute union sphere for camera distance (same as renderer.ts)
    const boxB = new THREE.Box3().setFromObject(cloneB);
    const unionBox = new THREE.Box3().setFromObject(cloneA).union(boxB);
    const unionSphere = new THREE.Sphere();
    unionBox.getBoundingSphere(unionSphere);
    const fovRad = (FOV * Math.PI) / 180;
    const cameraDistance = unionSphere.radius / Math.sin(fovRad / 2);

    function snapCamera(cam: THREE.PerspectiveCamera, ctrl: OrbitControls, angle: CameraAngle) {
      const preset = CAMERA_PRESETS[angle];
      const target = unionSphere.center;
      cam.position.copy(preset.direction).multiplyScalar(cameraDistance).add(target);
      cam.up.set(0, angle === CameraAngle.Top ? 0 : 1, angle === CameraAngle.Top ? -1 : 0);
      cam.lookAt(target);
      cam.near = cameraDistance * 0.001;
      cam.far = cameraDistance * 10;
      cam.updateProjectionMatrix();
      ctrl.target.copy(target);
      ctrl.update();
    }

    snapCamera(camera, controls, CAMERA_ANGLE_ORDER[angleIndexRef.current]);
    cameraRef.current = camera;
    controlsRef.current = controls;

    controls.addEventListener("change", () => { needsUpdateRef.current = true; });

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsUpdateRef.current = true;
    });
    ro.observe(canvas);

    const gl = renderer.getContext() as WebGLRenderingContext;

    function renderAndDiff() {
      const w = canvas!.width;
      const h = canvas!.height;
      const size = w * h;

      renderer.render(sceneA, camera);
      const pixelsA = new Uint8ClampedArray(size * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixelsA);

      renderer.render(sceneB, camera);
      const pixelsB = new Uint8ClampedArray(size * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixelsB);

      const tol = toleranceRef.current;
      const imageData = new ImageData(w, h);
      const out = imageData.data;
      let changed = 0;

      for (let y = 0; y < h; y++) {
        const srcY = h - 1 - y; // WebGL reads bottom-to-top
        for (let x = 0; x < w; x++) {
          const s = (srcY * w + x) * 4;
          const d = (y * w + x) * 4;
          const maxDiff = Math.max(
            Math.abs(pixelsA[s]     - pixelsB[s]),
            Math.abs(pixelsA[s + 1] - pixelsB[s + 1]),
            Math.abs(pixelsA[s + 2] - pixelsB[s + 2]),
          );
          if (maxDiff > tol) {
            out[d] = 255; out[d + 1] = 0; out[d + 2] = 0; out[d + 3] = 255;
            changed++;
          } else {
            out[d]     = (pixelsA[s]     * MIX + BG_R * (1 - MIX)) | 0;
            out[d + 1] = (pixelsA[s + 1] * MIX + BG_R * (1 - MIX)) | 0;
            out[d + 2] = (pixelsA[s + 2] * MIX + BG_R * (1 - MIX)) | 0;
            out[d + 3] = 255;
          }
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      setLivePct((changed / size) * 100);
    }

    needsUpdateRef.current = true;
    needsSnapRef.current = true;
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();

      const angle = CAMERA_ANGLE_ORDER[angleIndexRef.current];
      if (needsSnapRef.current) {
        snapCamera(camera, controls, angle);
        needsSnapRef.current = false;
        needsUpdateRef.current = true;
      }
      if (needsUpdateRef.current) {
        renderAndDiff();
        needsUpdateRef.current = false;
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      ro.disconnect();
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [modelA, modelB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setAngleIndex((i) => (i - 1 + CAMERA_ANGLE_ORDER.length) % CAMERA_ANGLE_ORDER.length);
      else if (e.key === "ArrowRight") setAngleIndex((i) => (i + 1) % CAMERA_ANGLE_ORDER.length);
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

  const currentAngle = CAMERA_ANGLE_ORDER[angleIndex];
  const storedResult = diffResults.find((r) => r.angle === currentAngle);
  const pct = livePct ?? storedResult?.pct ?? 0;
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
          {(livePct !== null || diffResults.length > 0) && (
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

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          aria-label={`Pixel diff — ${ANGLE_LABELS[currentAngle]} angle`}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
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
