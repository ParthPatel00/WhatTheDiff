"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useThreeViewer } from "@/hooks/useThreeViewer";
import { WebGLContextLostOverlay } from "./ErrorBoundary";
import type { LoadedModel } from "@/lib/types";

interface ViewerPanelProps {
  model: LoadedModel | null;
  style?: React.CSSProperties;
}

/**
 * Reusable single-canvas viewer for one model.
 * Used as a building block by other view modes and Phase 3 (ghost overlay).
 */
export function ViewerPanel({ model, style }: ViewerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(new THREE.PerspectiveCamera(45, 1, 0.01, 10000));
  const controlsRef = useRef<OrbitControls | null>(null);
  const [contextLost, setContextLost] = useState(false);

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

  // Setup camera, lights, and OrbitControls on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = sceneRef.current;
    applySceneLighting(scene);

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

    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    cameraRef.current.aspect = aspect;
    cameraRef.current.updateProjectionMatrix();

    return () => {
      controls.dispose();
      ro.disconnect();
      controlsRef.current = null;
    };
  }, []);

  // Add/remove model from scene and reframe camera
  useEffect(() => {
    const scene = sceneRef.current;
    const lights = scene.children.filter(
      (c) => c instanceof THREE.Light
    );
    scene.clear();
    lights.forEach((l) => scene.add(l));

    if (!model) return;

    scene.add(model.scene);
    frameCameraToObject(cameraRef.current, model.scene, controlsRef.current ?? undefined);

    return () => {
      scene.remove(model.scene);
    };
  }, [model]);

  return (
    <div style={{ position: "relative", flex: 1, ...style }}>
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
  );
}

// ─── Shared lighting + framing utilities ────────────────────────────────────

/**
 * Blender-style neutral lighting rig — matches Blender's solid/preview viewport.
 * HemisphereLight gives full all-around coverage (no dark back faces).
 * One soft directional adds subtle edge definition without hot spots.
 * No IBL/environment map — keeps PBR materials at their authored grey tones.
 *
 * Exported for SideBySideView, TurntableView, and Phase 3 (GhostOverlayView).
 */
export function applySceneLighting(scene: THREE.Scene) {
  // Low ambient so nothing is pure black, but directionality still reads
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  const dirs: [number, number, number][] = [
    [0, 0, 1],   // south (front)
    [0, 0, -1],  // north (back)
    [1, 0, 0],   // east
    [-1, 0, 0],  // west
    [0, 1, 0],   // top
    [0, -1, 0],  // bottom
  ];
  for (const [x, y, z] of dirs) {
    const light = new THREE.DirectionalLight(0xffffff, 0.35);
    light.position.set(x, y, z);
    scene.add(light);
  }
}

/** @deprecated Use applySceneLighting — kept for any external callers during migration */
export function applyEnvironmentLighting(
  _renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
) {
  applySceneLighting(scene);
}

/** @deprecated Lights now included in applySceneLighting */
export function addSceneLights(scene: THREE.Scene) {
  applySceneLighting(scene);
}

// ─── Shared framing utility ──────────────────────────────────────────────────

export function frameCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  controls?: OrbitControls
) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  const fov = (camera.fov * Math.PI) / 180;
  const dist = sphere.radius / Math.sin(fov / 2);

  camera.position.copy(sphere.center).add(new THREE.Vector3(0, 0, dist));
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(sphere.center);
    controls.update();
  }
}

/**
 * Frames two cameras to the LARGER bounding sphere of both objects,
 * ensuring identical framing for pixel-accurate comparison.
 */
export function frameCamerasToBoth(
  cameraA: THREE.PerspectiveCamera,
  cameraB: THREE.PerspectiveCamera,
  objectA: THREE.Object3D | null,
  objectB: THREE.Object3D | null,
  controls?: OrbitControls
) {
  const spheres: THREE.Sphere[] = [];

  for (const obj of [objectA, objectB]) {
    if (!obj) continue;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) continue;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    spheres.push(sphere);
  }

  if (spheres.length === 0) return;
  const largest = spheres.reduce((a, b) => (a.radius >= b.radius ? a : b));

  const fov = (cameraA.fov * Math.PI) / 180;
  const dist = largest.radius / Math.sin(fov / 2);
  const pos = largest.center.clone().add(new THREE.Vector3(0, 0, dist));

  for (const cam of [cameraA, cameraB]) {
    cam.position.copy(pos);
    cam.near = dist / 100;
    cam.far = dist * 100;
    cam.updateProjectionMatrix();
  }

  if (controls) {
    controls.target.copy(largest.center);
    controls.update();
  }
}
