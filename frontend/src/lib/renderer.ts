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
    _renderer.setClearColor(0x000000, 1);
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
  threeScene.background = new THREE.Color(0x000000);

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
 *
 * Normalization strategy:
 *   - The offset is derived from model A and applied to BOTH models unchanged.
 *     This preserves their relative positions, which is critical when B is a
 *     modified version of A exported from the same coordinate system. A
 *     per-model offset would shift B differently whenever the modification
 *     changes the bounding box (e.g. extruding a chin), making the whole mesh
 *     appear misaligned even though only one part changed.
 *   - Camera distance is sized from the union bounding box of both models after
 *     the shared offset is applied, so neither model is clipped.
 */
export function renderBothModels(sceneA: THREE.Group, sceneB: THREE.Group): RenderOutput {
  const cachedA = renderCache.get(sceneA);
  const cachedB = renderCache.get(sceneB);
  if (cachedA && cachedB) return { imageDataA: cachedA, imageDataB: cachedB };

  const boxA = new THREE.Box3().setFromObject(sceneA);
  const boxB = new THREE.Box3().setFromObject(sceneB);

  // Shared offset from model A: center X/Z, floor Y at 0
  const centerA = new THREE.Vector3();
  boxA.getCenter(centerA);
  const sharedOffset = new THREE.Vector3(-centerA.x, -boxA.min.y, -centerA.z);

  // Union of both bounding boxes after the shared offset → correct camera framing
  const unionBox = boxA.clone().translate(sharedOffset).union(boxB.clone().translate(sharedOffset));
  const unionSphere = new THREE.Sphere();
  unionBox.getBoundingSphere(unionSphere);

  const cameraDistance = (unionSphere.radius / Math.tan(((FOV / 2) * Math.PI) / 180)) * 1.2;
  const cameraTarget = unionSphere.center;

  const imageDataA = cachedA ?? renderAllAngles(sceneA, sharedOffset, cameraDistance, cameraTarget);
  const imageDataB = cachedB ?? renderAllAngles(sceneB, sharedOffset, cameraDistance, cameraTarget);

  if (!cachedA) renderCache.set(sceneA, imageDataA);
  if (!cachedB) renderCache.set(sceneB, imageDataB);

  return { imageDataA, imageDataB };
}

/** Call this when a model slot is replaced so stale renders aren't reused. */
export function invalidateRenderCache(scene: THREE.Group): void {
  renderCache.delete(scene);
}
