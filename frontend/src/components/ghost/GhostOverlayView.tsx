"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useDiffStore } from "@/stores/diffStore";
import { frameCameraToObject } from "@/components/viewer/ViewerPanel";
import { Slider } from "@/components/ui/slider";

// ─── tintScene ───────────────────────────────────────────────────────────────
//
// Clones materials on every mesh in `scene` and replaces them with tinted
// versions. Returns the list of cloned materials so the caller can dispose
// them on cleanup without touching the originals.
//
// Call this on a `scene.clone(true)` copy — never on the original scene from
// the store, which is shared with other view modes.

function tintScene(
  scene: THREE.Object3D,
  color: THREE.Color,
  opacity: number,
  additive: boolean,
  renderOrder: number
): THREE.Material[] {
  const cloned: THREE.Material[] = [];

  scene.traverse((obj) => {
    // Use .isMesh flag — covers Mesh, SkinnedMesh, InstancedMesh (all have isMesh = true).
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats = mats.map((m: THREE.Material) => {
      const c = m.clone();
      if ("color" in c) (c as THREE.MeshStandardMaterial).color.set(color);
      c.opacity = opacity;
      c.transparent = true;
      c.depthWrite = false;
      if (additive) c.blending = THREE.AdditiveBlending;
      c.needsUpdate = true;
      cloned.push(c);
      return c;
    });

    mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
    mesh.renderOrder = renderOrder;
  });

  return cloned;
}

// ─── render normalization ────────────────────────────────────────────────────
//
// Centers each cloned scene at world origin, then sets camera distance based
// on the larger bounding sphere of the two centered scenes.
// Uses Box3.setFromObject which evaluates the full node-transform hierarchy —
// more accurate than gltfParser.getBoundingBox (local space only).

function normalizeAndFrame(
  cloneA: THREE.Object3D,
  cloneB: THREE.Object3D,
  originalA: THREE.Object3D,
  originalB: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
) {
  // Compute centers from the originals (pre-clone positions are reliable).
  const boxA = new THREE.Box3().setFromObject(originalA);
  const boxB = new THREE.Box3().setFromObject(originalB);

  // Center all three axes so the model's geometric center sits at world origin.
  if (!boxA.isEmpty()) {
    const centerA = boxA.getCenter(new THREE.Vector3());
    cloneA.position.sub(centerA);
  }
  if (!boxB.isEmpty()) {
    const centerB = boxB.getCenter(new THREE.Vector3());
    cloneB.position.sub(centerB);
  }

  // Bounding spheres after centering — centers should now be near origin.
  const sphereA = new THREE.Sphere();
  const sphereB = new THREE.Sphere();
  new THREE.Box3().setFromObject(cloneA).getBoundingSphere(sphereA);
  new THREE.Box3().setFromObject(cloneB).getBoundingSphere(sphereB);

  const radius = Math.max(sphereA.radius, sphereB.radius, 0.01);
  const fov = camera.fov * (Math.PI / 180);
  const dist = (radius / Math.sin(fov / 2)) * 1.2;

  // Position camera along +Z, looking at the scene center (origin after centering).
  camera.position.set(0, 0, dist);
  camera.near = dist / 100;
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
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
      <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
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
  const tintedMatsRef = useRef<THREE.Material[]>([]);
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
    renderer.setClearColor(0x1e1e1e, 1);
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
      tintedMatsRef.current.forEach((m) => m.dispose());
      tintedMatsRef.current = [];
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

    // Remove old clones and dispose their materials.
    if (cloneARef.current) scene.remove(cloneARef.current);
    if (cloneBRef.current) scene.remove(cloneBRef.current);
    tintedMatsRef.current.forEach((m) => m.dispose());
    tintedMatsRef.current = [];

    // Clone scene hierarchies. clone(true) creates new Object3D/Mesh instances
    // but shares geometry and material references — tintScene then replaces the
    // material refs on the cloned meshes, leaving originals untouched.
    const cloneA = modelA.scene.clone(true);
    const cloneB = modelB.scene.clone(true);

    const colorA = colorblindMode
      ? new THREE.Color(80 / 255, 130 / 255, 255 / 255)  // blue
      : new THREE.Color(255 / 255, 80 / 255, 80 / 255);  // red

    const colorB = colorblindMode
      ? new THREE.Color(255 / 255, 165 / 255, 0)          // orange
      : new THREE.Color(80 / 255, 220 / 255, 100 / 255);  // green

    const matsA = tintScene(cloneA, colorA, opacity, false, 1);
    const matsB = tintScene(cloneB, colorB, opacity, true, 2);

    tintedMatsRef.current = [...matsA, ...matsB];
    cloneARef.current = cloneA;
    cloneBRef.current = cloneB;

    normalizeAndFrame(cloneA, cloneB, modelA.scene, modelB.scene, camera, controls);

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

  // ── opacity: update material refs without re-cloning ──
  useEffect(() => {
    tintedMatsRef.current.forEach((m) => {
      m.opacity = opacity;
      m.needsUpdate = true;
    });
  }, [opacity]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;
    frameCameraToObject(camera, scene, controls);
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
        padding: "10px 16px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
        gap: 24,
        flexWrap: "wrap",
      }}>
        {/* Opacity slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
            opacity
          </span>
          <Slider
            min={0.20}
            max={0.90}
            step={0.01}
            value={[opacity]}
            onValueChange={(v) => setOpacity(Array.isArray(v) ? v[0] : v)}
            aria-label="Ghost overlay opacity"
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", width: 32, textAlign: "right" }}>
            {Math.round(opacity * 100)}%
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
