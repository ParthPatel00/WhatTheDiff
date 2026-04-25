"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useDiffStore } from "@/stores/diffStore";
import { applySceneLighting } from "@/components/viewer/ViewerPanel";

// Lower render resolution for interactive speed; still sharp enough to be useful
const RENDER_SIZE = 512;
const FOV = 45;

export default function FreeformPixelDiffView() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const tolerance = useDiffStore((s) => s.tolerance);

  const cameraResetToken = useDiffStore((s) => s.cameraResetToken);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState<number | null>(null);

  // Stable refs so the animation loop always sees current values without
  // needing to be recreated when they change
  const toleranceRef = useRef(tolerance);
  const needsUpdateRef = useRef(true);

  // Refs so the reset effect can reach inside the animation loop's closure
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

    canvas.width = RENDER_SIZE;
    canvas.height = RENDER_SIZE;

    // ── Offscreen WebGL renderer ──────────────────────────────────────────────
    const offscreen = document.createElement("canvas");
    offscreen.width = RENDER_SIZE;
    offscreen.height = RENDER_SIZE;
    const renderer = new THREE.WebGLRenderer({
      canvas: offscreen,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(RENDER_SIZE, RENDER_SIZE);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a1a1a, 1);

    // ── Shared normalization (mirrors renderer.ts logic exactly) ─────────────
    const boxA = new THREE.Box3().setFromObject(modelA.scene);
    const boxB = new THREE.Box3().setFromObject(modelB.scene);
    const centerA = new THREE.Vector3();
    boxA.getCenter(centerA);
    const sharedOffset = new THREE.Vector3(-centerA.x, -boxA.min.y, -centerA.z);

    const unionBox = boxA.clone().translate(sharedOffset).union(boxB.clone().translate(sharedOffset));
    const unionSphere = new THREE.Sphere();
    unionBox.getBoundingSphere(unionSphere);
    const cameraTarget = unionSphere.center.clone();
    const cameraDistance = (unionSphere.radius / Math.tan(((FOV / 2) * Math.PI) / 180)) * 1.2;

    // ── Scenes (cloned so we don't fight SideBySideView over scene ownership) ─
    function makeScene(source: THREE.Group): THREE.Scene {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      applySceneLighting(scene);
      const wrapper = new THREE.Group();
      wrapper.position.copy(sharedOffset);
      wrapper.add(source.clone());
      scene.add(wrapper);
      return scene;
    }

    const sceneA = makeScene(modelA.scene);
    const sceneB = makeScene(modelB.scene);

    // ── Camera + OrbitControls ────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      FOV, 1, cameraDistance * 0.001, cameraDistance * 10,
    );
    camera.position.copy(cameraTarget).add(new THREE.Vector3(0, 0, cameraDistance));
    camera.lookAt(cameraTarget);

    // Attach controls to the 2D canvas — it only needs DOM events, not WebGL
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(cameraTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.update();

    // Expose to reset effect
    cameraRef.current = camera;
    controlsRef.current = controls;
    initialPosRef.current.copy(camera.position);
    initialTargetRef.current.copy(cameraTarget);

    controls.addEventListener("change", () => { needsUpdateRef.current = true; });

    // ── Reusable pixel buffers (avoids per-frame allocation) ──────────────────
    const pixelsA = new Uint8ClampedArray(RENDER_SIZE * RENDER_SIZE * 4);
    const pixelsB = new Uint8ClampedArray(RENDER_SIZE * RENDER_SIZE * 4);
    const gl = renderer.getContext() as WebGLRenderingContext;

    function renderAndDiff() {
      renderer.render(sceneA, camera);
      gl.readPixels(0, 0, RENDER_SIZE, RENDER_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixelsA);

      renderer.render(sceneB, camera);
      gl.readPixels(0, 0, RENDER_SIZE, RENDER_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixelsB);

      const tol = toleranceRef.current;
      const imageData = new ImageData(RENDER_SIZE, RENDER_SIZE);
      const out = imageData.data;
      let changed = 0;

      // Background color (matches --bg-canvas: #1e1e1e)
      const BG = 30;
      // Unchanged pixels: pre-composite 80% model + 20% background, fully opaque.
      // This keeps the model bright (matching side-by-side lighting) while the
      // solid red diff pixels still stand out clearly by hue contrast alone.
      const MIX = 0.8;

      // Flip vertically and compute diff in one pass (WebGL origin is bottom-left)
      for (let y = 0; y < RENDER_SIZE; y++) {
        const srcY = RENDER_SIZE - 1 - y;
        for (let x = 0; x < RENDER_SIZE; x++) {
          const s = (srcY * RENDER_SIZE + x) * 4;
          const d = (y * RENDER_SIZE + x) * 4;

          const maxDiff = Math.max(
            Math.abs(pixelsA[s] - pixelsB[s]),
            Math.abs(pixelsA[s + 1] - pixelsB[s + 1]),
            Math.abs(pixelsA[s + 2] - pixelsB[s + 2]),
          );

          if (maxDiff > tol) {
            out[d] = 255; out[d + 1] = 0; out[d + 2] = 0; out[d + 3] = 255;
            changed++;
          } else {
            // Pre-composite against background → fully opaque, full brightness
            out[d]     = (pixelsA[s]     * MIX + BG * (1 - MIX)) | 0;
            out[d + 1] = (pixelsA[s + 1] * MIX + BG * (1 - MIX)) | 0;
            out[d + 2] = (pixelsA[s + 2] * MIX + BG * (1 - MIX)) | 0;
            out[d + 3] = 255;
          }
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      setPct((changed / (RENDER_SIZE * RENDER_SIZE)) * 100);
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    needsUpdateRef.current = true;
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update(); // required for damping to work
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
    };
  }, [modelA, modelB]); // tolerance handled via ref — no need to restart the loop

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
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: pctColor, fontWeight: 600,
        }}>
          {pct !== null ? `${pct.toFixed(1)}% changed` : "—"}
        </span>
      </div>

      {/* Canvas — fills available space, keeps 1:1 aspect */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-canvas)", overflow: "hidden",
      }}>
        <canvas
          ref={canvasRef}
          aria-label="Freeform pixel diff — drag to orbit"
          style={{ maxWidth: "100%", maxHeight: "100%", aspectRatio: "1 / 1", display: "block", cursor: "grab" }}
        />
      </div>
    </div>
  );
}
