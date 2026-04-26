"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useDiffStore } from "@/stores/diffStore";
import { applySceneLighting } from "@/components/viewer/ViewerPanel";
import { createViewportGrid } from "@/lib/viewportGrid";

const FOV = 45;

export default function FreeformPixelDiffView() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const tolerance = useDiffStore((s) => s.tolerance);
  const cameraResetToken = useDiffStore((s) => s.cameraResetToken);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState<number | null>(null);

  const toleranceRef = useRef(tolerance);
  const needsUpdateRef = useRef(true);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialPosRef = useRef(new THREE.Vector3());
  const initialTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    toleranceRef.current = tolerance;
    needsUpdateRef.current = true;
  }, [tolerance]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(initialPosRef.current);
    controls.target.copy(initialTargetRef.current);
    controls.update();
    needsUpdateRef.current = true;
  }, [cameraResetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelA || !modelB) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Offscreen WebGL renderer — sized to canvas display size ──────────────
    const offscreen = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({
      canvas: offscreen,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(1); // keep 1 — DPR applied manually to offscreen size
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(0x3a3a3a, 1);

    // ── Scenes — clones floored at Y=0, centered on A's XZ ──────────────────
    const cloneA = modelA.scene.clone();
    const cloneB = modelB.scene.clone();

    // Zero out any position baked in by other views, then floor to Y=0
    cloneA.position.set(0, 0, 0);
    cloneB.position.set(0, 0, 0);
    const boxA = new THREE.Box3().setFromObject(cloneA);
    const boxB = new THREE.Box3().setFromObject(cloneB);
    const centerA = new THREE.Vector3();
    boxA.getCenter(centerA);
    cloneA.position.set(-centerA.x, -boxA.min.y, -centerA.z);
    cloneB.position.set(-centerA.x, -boxB.min.y, -centerA.z);

    const sceneA = new THREE.Scene();
    sceneA.background = new THREE.Color(0x3a3a3a);
    applySceneLighting(sceneA);
    sceneA.add(cloneA, createViewportGrid());

    const sceneB = new THREE.Scene();
    sceneB.background = new THREE.Color(0x3a3a3a);
    applySceneLighting(sceneB);
    sceneB.add(cloneB, createViewportGrid());

    // ── Set initial size first so aspect ratio is correct before framing ──────
    const initW = canvas.clientWidth || 800;
    const initH = canvas.clientHeight || 600;
    // Display canvas: full DPR resolution for crisp output
    canvas.width = Math.round(initW * dpr);
    canvas.height = Math.round(initH * dpr);
    // Diff renderer: CSS-pixel resolution only — readPixels+CPU loop cost is
    // proportional to pixel count, so we never scale it by DPR
    renderer.setSize(initW, initH, false);

    // ── Camera + OrbitControls ────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(FOV, initW / initH, 0.01, 10000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Frame camera manually — frameCamerasToBoth passes controls which causes
    // OrbitControls.update() to overwrite camera.position from its internal state.
    // Instead: compute sphere, set target first, then position, then update.
    {
      const boxAfter = new THREE.Box3().setFromObject(cloneA);
      const sphere = new THREE.Sphere();
      boxAfter.getBoundingSphere(sphere);
      const fov = (camera.fov * Math.PI) / 180;
      const dist = sphere.radius / Math.sin(fov / 2);
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).add(new THREE.Vector3(0, 0, dist));
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    }

    cameraRef.current = camera;
    controlsRef.current = controls;
    initialPosRef.current.copy(camera.position);
    initialTargetRef.current.copy(controls.target);

    controls.addEventListener("change", () => { needsUpdateRef.current = true; });

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      renderer.setSize(w, h, false); // diff renderer stays at CSS pixels
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsUpdateRef.current = true;
    });
    ro.observe(canvas);

    const gl = renderer.getContext() as WebGLRenderingContext;

    function renderAndDiff() {
      // Diff at CSS-pixel resolution (offscreen renderer is sized to CSS pixels)
      const w = offscreen.width;
      const h = offscreen.height;
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

      const BG = 58; // matches 0x3a3a3a
      const MIX = 0.8;

      for (let y = 0; y < h; y++) {
        const srcY = h - 1 - y;
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
            out[d]     = (pixelsA[s]     * MIX + BG * (1 - MIX)) | 0;
            out[d + 1] = (pixelsA[s + 1] * MIX + BG * (1 - MIX)) | 0;
            out[d + 2] = (pixelsA[s + 2] * MIX + BG * (1 - MIX)) | 0;
            out[d + 3] = 255;
          }
        }
      }

      // Write diff result to a small offscreen canvas, then scale up to the
      // full-DPR display canvas — GPU does the upscale for free
      const tmp = new OffscreenCanvas(w, h);
      tmp.getContext("2d")!.putImageData(imageData, 0, 0);
      ctx!.drawImage(tmp, 0, 0, canvas!.width, canvas!.height);
      setPct((changed / size) * 100);
    }

    needsUpdateRef.current = true;
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
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
    };
  }, [modelA, modelB]); // eslint-disable-line react-hooks/exhaustive-deps

  const pctColor = pct === null ? "var(--text-dim)"
    : pct < 1 ? "var(--green)"
    : pct > 50 ? "var(--red)"
    : "var(--yellow)";

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Badge bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "6px 16px", background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: pctColor, fontWeight: 600 }}>
          {pct !== null ? `${pct.toFixed(1)}% changed` : "—"}
        </span>
      </div>

      {/* Canvas — same layout as GhostOverlayView */}
      <canvas
        ref={canvasRef}
        aria-label="Freeform pixel diff — drag to orbit"
        style={{ flex: 1, display: "block", width: "100%", minHeight: 400, cursor: "grab" }}
      />
    </div>
  );
}
