import * as THREE from "three";
import { CameraAngle } from "./types";
import { CAMERA_PRESETS, CAMERA_ANGLE_ORDER } from "./cameraPresets";

const RENDER_SIZE = 1024;
const FOV = 45;

// WeakMap so entries are GC'd automatically when a scene is replaced
const renderCache = new WeakMap<THREE.Group, ImageData[]>();

let _renderer: THREE.WebGLRenderer | null = null;

function getRenderer(): THREE.WebGLRenderer {
  if (!_renderer) {
    const canvas = document.createElement("canvas");
    canvas.width = RENDER_SIZE;
    canvas.height = RENDER_SIZE;
    _renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    _renderer.setSize(RENDER_SIZE, RENDER_SIZE);
    _renderer.setPixelRatio(1);
    _renderer.setClearColor(0x1a1a1a, 1);
  }
  return _renderer;
}

// WebGL reads pixels bottom-to-top; flip so (0,0) is top-left
function flipVertically(src: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) {
    out.set(src.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  }
  return out;
}

interface Normalization {
  // Translation applied to the scene clone before rendering
  offset: THREE.Vector3;
  // Bounding sphere of the model after the offset is applied
  sphere: THREE.Sphere;
}

/**
 * Computes the minimal transform needed to position a model consistently:
 * - X and Z: centered on the bounding box midpoint (handles horizontal drift)
 * - Y: aligned so the floor (bounding box minimum) sits at y = 0
 *
 * This keeps the model's base at the origin it was exported with, rather than
 * shifting it by the bounding box center (which differs between models of
 * different heights and breaks alignment of shared base positions).
 */
function computeNormalization(scene: THREE.Group): Normalization {
  const box = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

  // Sphere of the normalized model (used to size the camera distance)
  const normalizedBox = box.clone().translate(offset);
  const sphere = new THREE.Sphere();
  normalizedBox.getBoundingSphere(sphere);

  return { offset, sphere };
}

function renderAngle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  angle: CameraAngle,
  cameraDistance: number,
  cameraTarget: THREE.Vector3,
): ImageData {
  const preset = CAMERA_PRESETS[angle];

  // Position the camera along the preset direction, offset by the target
  camera.position
    .copy(preset.direction)
    .multiplyScalar(cameraDistance)
    .add(cameraTarget);

  // Top-down camera can't use the default (0,1,0) up vector — use -Z instead
  camera.up.set(0, angle === CameraAngle.Top ? 0 : 1, angle === CameraAngle.Top ? -1 : 0);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);

  const gl = renderer.getContext() as WebGLRenderingContext;
  const pixels = new Uint8ClampedArray(RENDER_SIZE * RENDER_SIZE * 4);
  gl.readPixels(0, 0, RENDER_SIZE, RENDER_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const imageData = new ImageData(RENDER_SIZE, RENDER_SIZE);
  imageData.data.set(flipVertically(pixels, RENDER_SIZE, RENDER_SIZE));
  return imageData;
}

function renderAllAngles(
  scene: THREE.Group,
  offset: THREE.Vector3,
  cameraDistance: number,
  cameraTarget: THREE.Vector3,
): ImageData[] {
  const renderer = getRenderer();

  const threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x1a1a1a);

  // Identical lighting for both models — critical for a fair pixel diff
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(5, 10, 7.5);
  threeScene.add(ambient, directional);

  // Apply the normalization offset via a wrapper (clone shares geometry/materials)
  const clone = scene.clone();
  const wrapper = new THREE.Group();
  wrapper.position.copy(offset);
  wrapper.add(clone);
  threeScene.add(wrapper);

  const near = cameraDistance * 0.001;
  const far = cameraDistance * 10;
  const camera = new THREE.PerspectiveCamera(FOV, 1, near, far);

  const results: ImageData[] = CAMERA_ANGLE_ORDER.map((angle) =>
    renderAngle(renderer, threeScene, camera, angle, cameraDistance, cameraTarget),
  );

  wrapper.remove(clone);
  threeScene.remove(wrapper);

  return results;
}

export interface RenderOutput {
  imageDataA: ImageData[];
  imageDataB: ImageData[];
}

/**
 * Renders both models from all 6 camera angles with identical normalization.
 * Results are cached by scene identity and reused on subsequent calls.
 */
export function renderBothModels(sceneA: THREE.Group, sceneB: THREE.Group): RenderOutput {
  const cachedA = renderCache.get(sceneA);
  const cachedB = renderCache.get(sceneB);
  if (cachedA && cachedB) return { imageDataA: cachedA, imageDataB: cachedB };

  const normA = computeNormalization(sceneA);
  const normB = computeNormalization(sceneB);

  const radius = Math.max(normA.sphere.radius, normB.sphere.radius);
  // Add 20% padding so the model never clips the canvas edge
  const cameraDistance = (radius / Math.tan(((FOV / 2) * Math.PI) / 180)) * 1.2;

  // Point the camera at the midpoint between the two normalized sphere centers
  // so both models are framed consistently regardless of height difference
  const cameraTarget = normA.sphere.center.clone().add(normB.sphere.center).multiplyScalar(0.5);

  const imageDataA = cachedA ?? renderAllAngles(sceneA, normA.offset, cameraDistance, cameraTarget);
  const imageDataB = cachedB ?? renderAllAngles(sceneB, normB.offset, cameraDistance, cameraTarget);

  if (!cachedA) renderCache.set(sceneA, imageDataA);
  if (!cachedB) renderCache.set(sceneB, imageDataB);

  return { imageDataA, imageDataB };
}

/** Call this when a model slot is replaced so stale renders aren't reused. */
export function invalidateRenderCache(scene: THREE.Group): void {
  renderCache.delete(scene);
}
