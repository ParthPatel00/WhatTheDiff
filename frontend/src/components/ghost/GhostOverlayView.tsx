"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useDiffStore } from "@/stores/diffStore";
import { frameCamerasToBoth } from "@/components/viewer/ViewerPanel";
import { Slider } from "@/components/ui/slider";
import { createViewportGrid, disposeViewportGrid } from "@/lib/viewportGrid";

// ─── tintScene ───────────────────────────────────────────────────────────────
//
// Clones materials on every mesh in `scene` and replaces them with tinted
// versions. Returns the list of cloned materials so the caller can dispose
// them on cleanup without touching the originals.
//
// Call this on a `scene.clone(true)` copy — never on the original scene from
// the store, which is shared with other view modes.

// Replaces every mesh's material with a fresh flat-shaded MeshStandardMaterial
// of the given color. No textures, no maps — solid opaque shape.
// opacity/transparent are left at defaults (1.0, false) here; the crossfade
// effect updates them reactively via the returned material refs.
function tintScene(
  scene: THREE.Object3D,
  color: THREE.Color,
  renderOrder: number
): THREE.MeshStandardMaterial[] {
  const created: THREE.MeshStandardMaterial[] = [];

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const count = Array.isArray(mesh.material) ? mesh.material.length : 1;

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.0,
      transparent: true,
      depthWrite: false,
    });
    created.push(mat);
    mesh.material = count > 1 ? Array(count).fill(mat) : mat;
    mesh.renderOrder = renderOrder;
  });

  return created;
}

// ─── render normalization ────────────────────────────────────────────────────
//
// Centers each cloned scene at world origin, then sets camera distance based
// on the larger bounding sphere of the two centered scenes.
// Uses Box3.setFromObject which evaluates the full node-transform hierarchy —
// more accurate than gltfParser.getBoundingBox (local space only).

function normalizeClones(cloneA: THREE.Object3D, cloneB: THREE.Object3D) {
  // Use model A's bbox as the shared reference for both clones so their
  // relative positions are preserved (same logic as renderer.ts).
  const boxA = new THREE.Box3().setFromObject(cloneA);
  if (boxA.isEmpty()) return;

  const centerA = boxA.getCenter(new THREE.Vector3());
  const offsetX = -centerA.x;
  const offsetY = -boxA.min.y;
  const offsetZ = -centerA.z;

  cloneA.position.x += offsetX;
  cloneA.position.y += offsetY;
  cloneA.position.z += offsetZ;

  cloneB.position.x += offsetX;
  cloneB.position.y += offsetY;
  cloneB.position.z += offsetZ;
}

// ─── legend ──────────────────────────────────────────────────────────────────

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 2,
        background: color,
        flexShrink: 0,
      }} />
      <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-sans)", fontSize: 10 }}>
        {label}
      </span>
    </span>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export function GhostOverlayView() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const opacity = useDiffStore((s) => s.opacity);
  const setOpacity = useDiffStore((s) => s.setOpacity);
  const colorblindMode = useDiffStore((s) => s.colorblindMode);
  const cameraResetToken = useDiffStore((s) => s.cameraResetToken);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cloneARef = useRef<THREE.Object3D | null>(null);
  const cloneBRef = useRef<THREE.Object3D | null>(null);
  const tintedMatsARef = useRef<THREE.MeshStandardMaterial[]>([]);
  const tintedMatsBRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const gridRef = useRef<THREE.Group | null>(null);
  const frameIdRef = useRef<number>(0);
  const frameRunningRef = useRef(false);

  // ── mount: create renderer, scene, camera, controls, lighting ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Local variable — not a ref — so the cleanup closure captures the exact
    // instance created here (safe under React StrictMode double-invoke).
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x3a3a3a, 1);
    renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    // Six directional lights covering all axis directions (±X, ±Y, ±Z).
    // Gives even coverage with subtle surface shading — more natural than pure ambient,
    // less one-sided than a single directional.
    const lightIntensity = 0.6;
    const lightDirections = [
      [1, 0, 0],   // east
      [-1, 0, 0],  // west
      [0, 0, 1],   // south
      [0, 0, -1],  // north
      [0, 1, 0],   // top (pointing down at scene)
      [0, -1, 0],  // bottom (pointing up at scene)
    ];
    lightDirections.forEach(([x, y, z]) => {
      const light = new THREE.DirectionalLight(0xffffff, lightIntensity);
      light.position.set(x, y, z);
      scene.add(light);
    });
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      (canvas.clientWidth || 800) / (canvas.clientHeight || 600),
      0.01,
      1000
    );
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controlsRef.current = controls;

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    return () => {
      frameRunningRef.current = false;
      cancelAnimationFrame(frameIdRef.current);
      ro.disconnect();
      controls.dispose();
      tintedMatsARef.current.forEach((m) => m.dispose());
      tintedMatsBRef.current.forEach((m) => m.dispose());
      tintedMatsARef.current = [];
      tintedMatsBRef.current = [];
      if (gridRef.current) { disposeViewportGrid(gridRef.current); gridRef.current = null; }
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── re-tint when models or colorblind mode change ──
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!modelA || !modelB || !scene || !camera || !controls) return;

    // Remove old clones, grid, and dispose their materials.
    if (cloneARef.current) scene.remove(cloneARef.current);
    if (cloneBRef.current) scene.remove(cloneBRef.current);
    if (gridRef.current) { scene.remove(gridRef.current); disposeViewportGrid(gridRef.current); gridRef.current = null; }
    tintedMatsARef.current.forEach((m) => m.dispose());
    tintedMatsBRef.current.forEach((m) => m.dispose());
    tintedMatsARef.current = [];
    tintedMatsBRef.current = [];

    // Clone scene hierarchies — tintScene replaces materials on the clones only.
    const cloneA = modelA.scene.clone(true);
    const cloneB = modelB.scene.clone(true);

    const colorA = colorblindMode
      ? new THREE.Color(80 / 255, 130 / 255, 255 / 255)  // blue
      : new THREE.Color(255 / 255, 80 / 255, 80 / 255);  // red

    const colorB = colorblindMode
      ? new THREE.Color(255 / 255, 165 / 255, 0)          // orange
      : new THREE.Color(80 / 255, 220 / 255, 100 / 255);  // green

    tintedMatsARef.current = tintScene(cloneA, colorA, 1);
    tintedMatsBRef.current = tintScene(cloneB, colorB, 2);

    // Apply initial crossfade from current blend value
    const blend = useDiffStore.getState().opacity;
    const opA = 1 - blend;
    const opB = blend;
    cloneA.visible = opA > 0;
    cloneB.visible = opB > 0;
    tintedMatsARef.current.forEach((m) => { m.opacity = opA; m.needsUpdate = true; });
    tintedMatsBRef.current.forEach((m) => { m.opacity = opB; m.needsUpdate = true; });

    cloneARef.current = cloneA;
    cloneBRef.current = cloneB;

    normalizeClones(cloneA, cloneB);
    frameCamerasToBoth(camera, camera, cloneA as THREE.Group, cloneB as THREE.Group, controls);

    // Models are now floored at Y=0 by normalizeAndFrame, so grid sits at Y=0.
    const grid = createViewportGrid();
    gridRef.current = grid;
    scene.add(grid);

    scene.add(cloneA, cloneB);

    // Start the render loop if it isn't running yet.
    if (!frameRunningRef.current) {
      frameRunningRef.current = true;
      const animate = () => {
        if (!frameRunningRef.current) return;
        frameIdRef.current = requestAnimationFrame(animate);
        controlsRef.current?.update();
        const r = rendererRef.current;
        const s = sceneRef.current;
        const c = cameraRef.current;
        if (r && s && c) r.render(s, c);
      };
      animate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelA, modelB, colorblindMode]);

  // ── crossfade: A fades out as blend → 1, B fades in ──
  useEffect(() => {
    const blend = opacity;
    const opA = 1 - blend;
    const opB = blend;

    // Hide fully-transparent clones so they don't write to depth or occlude.
    if (cloneARef.current) cloneARef.current.visible = opA > 0;
    if (cloneBRef.current) cloneBRef.current.visible = opB > 0;

    tintedMatsARef.current.forEach((m) => { m.opacity = opA; m.needsUpdate = true; });
    tintedMatsBRef.current.forEach((m) => { m.opacity = opB; m.needsUpdate = true; });
  }, [opacity]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const cloneA = cloneARef.current;
    const cloneB = cloneBRef.current;
    if (!camera || !controls || !cloneA || !cloneB) return;
    frameCamerasToBoth(camera, camera, cloneA as THREE.Group, cloneB as THREE.Group, controls);
  }, [cameraResetToken]);

  // ── colors for the legend strip ──
  const colorAStr = colorblindMode ? "rgb(80,130,255)" : "rgb(255,80,80)";
  const colorBStr = colorblindMode ? "rgb(255,165,0)" : "rgb(80,220,100)";

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* 3D canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: "block", width: "100%", minHeight: 400 }}
      />

      {/* Controls + legend strip */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-toolbar)",
        gap: 24,
        flexWrap: "wrap",
      }}>
        {/* Blend slider — 0 = only A, 1 = only B */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-muted)", flexShrink: 0 }}>
            Blend
          </span>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[opacity]}
            onValueChange={(v) => setOpacity(Array.isArray(v) ? v[0] : v)}
            aria-label="Ghost overlay blend"
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", width: 48, textAlign: "right" }}>
            {opacity < 0.05 ? "A only" : opacity > 0.95 ? "B only" : `${Math.round(opacity * 100)}%`}
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <LegendSwatch color={colorAStr} label="only in v1" />
          <LegendSwatch color={colorBStr} label="only in v2" />
          <LegendSwatch color="rgb(136,136,136)" label="overlap (mixed tone)" />
        </div>
      </div>
    </div>
  );
}
