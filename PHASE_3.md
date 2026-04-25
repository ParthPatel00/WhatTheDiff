# Phase 3 Implementation Plan: Ghost Overlay + Structural Diff Stats Panel

## Context

Phase 0 (Foundation) is complete and stable. Phase 3 is being implemented in parallel with Phases 1 and 2; it owns the ghost overlay view and the structural diff stats sidebar. These are independent from the pixel diff pipeline (Phase 2) and the side-by-side/turntable viewers (Phase 1). Phase 4 will wire all views together.

The key goal: show the visual and numeric differences between two GLB models — ghost composite in 3D, and delta stats in a persistent sidebar.

---

## Critical Files

| File | Status | Role |
|------|--------|------|
| `frontend/src/lib/types.ts` | Exists (read-only for Phase 3) | `StructuralData`, `StructuralDiffResult`, `MaterialDiff`, `LoadedModel` |
| `frontend/src/stores/diffStore.ts` | Exists (read-only for Phase 3) | `opacity`, `colorblindMode`, `structuralDiffResult`, `setStructuralDiffResult`, `modelA/B` |
| `frontend/src/lib/modelLoader.ts` | Exists | Shows how gltf-transform `Document` is stored in `structuralData.document` |
| `frontend/src/lib/disposeModel.ts` | Exists | Pattern for duck-typing mesh traversal (use `.isMesh`, not `instanceof`) |
| **`frontend/src/lib/gltfParser.ts`** | **To create** | Read-only Document helpers |
| **`frontend/src/lib/structuralDiff.ts`** | **To create** | Pure diff computation |
| **`frontend/src/components/StatsPanel.tsx`** | **To create** | Persistent right sidebar |
| **`frontend/src/components/GhostOverlayView.tsx`** | **To create** | Three.js ghost composite viewer |

---

## Implementation Sequence

Build strictly in this order — each step validates the data layer before adding rendering complexity.

### Step 1: `src/lib/gltfParser.ts` (~30 min)

Pure helper wrappers over gltf-transform 4.x `Document` API. Zero dependencies. No React, no Three.js.

```typescript
import type { Document, Mesh, Material, Node, Animation } from "@gltf-transform/core";
import * as THREE from "three";

export function getMeshes(doc: Document): Mesh[]        // doc.getRoot().listMeshes()
export function getMaterials(doc: Document): Material[] // doc.getRoot().listMaterials()
export function getNodes(doc: Document): Node[]          // doc.getRoot().listNodes()
export function getAnimations(doc: Document): Animation[] // doc.getRoot().listAnimations()
export function getBoundingBox(doc: Document): THREE.Box3
```

**`getBoundingBox` implementation:**
- Iterate `listMeshes()` → `listPrimitives()` → `prim.getAttribute("POSITION")`
- Call `accessor.getArray()` once (returns shared `Float32Array`; do NOT mutate it)
- Walk in steps of 3 to expand a `THREE.Box3`
- **Limitation:** positions are in local mesh space; node transforms are NOT evaluated. Acceptable for stats display. GhostOverlayView uses `Box3.setFromObject(scene)` instead for camera framing (more accurate).
- Null-check: `if (!accessor) continue`

**gltf-transform 4.x API notes:**
- `accessor.getCount()` = number of vec3 elements (flat array length = `getCount() * 3`)
- `accessor.getArray()` returns the internal typed array — read-only
- `material.getName()` returns `""` for unnamed materials (not null)
- `material.getBaseColorFactor()` returns a new `number[]` on every call — cache it
- `material.getRoughnessFactor()` / `material.getMetallicFactor()` return `number`

---

### Step 2: `src/lib/structuralDiff.ts` (~60 min)

Pure function. No React, no Three.js rendering. Can be validated with `console.log` in a Node REPL before any UI exists.

```typescript
export function computeStructuralDiff(a: StructuralData, b: StructuralData): StructuralDiffResult
```

**Deltas (all precomputed in StructuralData):**
```
vertexDelta = b.vertexCount - a.vertexCount
triangleDelta = b.triangleCount - a.triangleCount
nodeCountDelta = b.nodeCount - a.nodeCount
animationCountDelta = b.animationCount - a.animationCount
```

**Bounding box:**
- Call `getBoundingBox(a.document)` and `getBoundingBox(b.document)`
- `delta.x/y/z` = per-axis size difference: `b.getSize(v).x - a.getSize(v).x`

**Material matching — Strategy: name-based with unnamed fallback:**
1. Build `Map<string, Material>` for both A and B using `getMaterials(doc)`.
2. Named materials: match by `material.getName()`.
3. Unnamed materials (`getName() === ""`): match by index within the unnamed subset.
4. In A but not B → `materialsRemoved`
5. In B but not A → `materialsAdded`
6. In both → compare properties → `materialsModified` if any differ

**Property comparison with epsilon:**
```typescript
const EPS = 0.001;
const bcfA = matA.getBaseColorFactor();  // cache: allocates each call
const bcfB = matB.getBaseColorFactor();
const bcfChanged = bcfA.some((v, i) => Math.abs(v - bcfB[i]) > EPS);

const roughChanged = Math.abs(matA.getRoughnessFactor() - matB.getRoughnessFactor()) > EPS;
const metalChanged = Math.abs(matA.getMetallicFactor() - matB.getMetallicFactor()) > EPS;
// Note: gltf-transform uses getMetallicFactor(), types.ts uses property name "metalness"
```

**Edge case guards:** if either model has 0 materials, skip material matching entirely.

---

### Step 3: `src/components/StatsPanel.tsx` (~90 min)

`"use client"` directive. No Three.js. Reads from store; triggers diff computation.

**Store reads:**
```typescript
const modelA = useDiffStore(s => s.modelA);
const modelB = useDiffStore(s => s.modelB);
const result = useDiffStore(s => s.structuralDiffResult);
const setResult = useDiffStore(s => s.setStructuralDiffResult);
const colorblindMode = useDiffStore(s => s.colorblindMode);
```

**Side effect — runs the diff:**
```typescript
useEffect(() => {
  if (modelA && modelB) {
    setResult(computeStructuralDiff(modelA.structuralData, modelB.structuralData));
  } else {
    setResult(null);
  }
}, [modelA, modelB]);
```

**Collapse behavior:**
```typescript
const [userCollapsed, setUserCollapsed] = useState(false);
const [autoCollapsed, setAutoCollapsed] = useState(false);

useEffect(() => {
  const mq = window.matchMedia("(max-width: 900px)");
  const handler = (e: MediaQueryListEvent) => setAutoCollapsed(e.matches);
  setAutoCollapsed(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);

const isCollapsed = autoCollapsed || userCollapsed;
```

**Layout:**
- Expanded: `<aside>` ~280px wide, two-column CSS grid, monospace font
- Collapsed: 48px icon button (use `PanelRight` or `BarChart2` from `lucide-react`)
- `aria-live="polite"` + `aria-atomic="false"` on the delta values container

**Delta color coding:**
```typescript
function deltaColor(delta: number, colorblindMode: boolean): string {
  if (delta > 0) return colorblindMode ? "var(--blue)" : "var(--green)";
  if (delta < 0) return colorblindMode ? "var(--orange)" : "var(--red)";
  return "var(--text-muted)";
}
// Materials: added=green/blue, removed=red/orange, modified=yellow
```

**Format deltas:** prefix `+` for positive, no prefix for negative (already has `-`).

**State: no result yet.** When `result === null` and neither model loaded, show empty state ("Upload two models to see structural differences"). When one model loaded, show partial state or nothing.

---

### Step 4: `src/components/GhostOverlayView.tsx` (~3-4 hrs)

`"use client"` directive. Most complex step.

**Renderer setup (once on mount, local variable + ref):**
```typescript
useEffect(() => {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.current!,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x1e1e1e, 1);
  rendererRef.current = renderer;
  // ResizeObserver
  const ro = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = canvasRef.current!;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  });
  ro.observe(canvasRef.current!);
  return () => { ro.disconnect(); renderer.dispose(); rendererRef.current = null; };
}, []);
```

**tintScene utility (outside component):**
```typescript
function tintScene(
  scene: THREE.Group,
  color: THREE.Color,
  opacity: number,
  additive: boolean,
  renderOrder: number
): THREE.Material[] {
  const cloned: THREE.Material[] = [];
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats = mats.map((m: THREE.Material) => {
      const c = m.clone();
      if ('color' in c) (c as THREE.MeshStandardMaterial).color.set(color);
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
```

**Model tinting effect (fires on modelA, modelB, colorblindMode change):**
```typescript
useEffect(() => {
  if (!modelA || !modelB || !sceneRef.current) return;

  // Clean up previous clones
  if (cloneARef.current) sceneRef.current.remove(cloneARef.current);
  if (cloneBRef.current) sceneRef.current.remove(cloneBRef.current);
  tintedMatsRef.current.forEach(m => m.dispose());
  tintedMatsRef.current = [];

  // Clone scenes (do NOT mutate originals)
  const cloneA = modelA.scene.clone(true);  // clones hierarchy, shares material refs
  const cloneB = modelB.scene.clone(true);

  // Determine colors
  const colorA = colorblindMode
    ? new THREE.Color(80/255, 130/255, 255/255)   // blue
    : new THREE.Color(255/255, 80/255, 80/255);    // red
  const colorB = colorblindMode
    ? new THREE.Color(255/255, 165/255, 0)          // orange
    : new THREE.Color(80/255, 220/255, 100/255);    // green

  // Tint clones — clones materials on the cloned meshes; originals untouched
  const matsA = tintScene(cloneA, colorA, opacity, false, 1);  // red: no additive
  const matsB = tintScene(cloneB, colorB, opacity, true,  2);  // green: additive

  tintedMatsRef.current = [...matsA, ...matsB];
  cloneARef.current = cloneA;
  cloneBRef.current = cloneB;

  // Render normalization using Three.js Box3 (evaluates node transforms — more accurate than gltfParser.getBoundingBox)
  const boxA = new THREE.Box3().setFromObject(modelA.scene);
  const boxB = new THREE.Box3().setFromObject(modelB.scene);
  cloneA.position.sub(boxA.getCenter(new THREE.Vector3()));
  cloneB.position.sub(boxB.getCenter(new THREE.Vector3()));

  const rA = new THREE.Sphere(); new THREE.Box3().setFromObject(cloneA).getBoundingSphere(rA);
  const rB = new THREE.Sphere(); new THREE.Box3().setFromObject(cloneB).getBoundingSphere(rB);
  const radius = Math.max(rA.radius, rB.radius);
  const fov = cameraRef.current!.fov * (Math.PI / 180);
  const dist = (radius / Math.sin(fov / 2)) * 1.2;
  cameraRef.current!.position.set(0, 0, dist);
  cameraRef.current!.near = dist / 100;
  cameraRef.current!.far = dist * 10;
  cameraRef.current!.updateProjectionMatrix();
  controlsRef.current!.target.set(0, 0, 0);
  controlsRef.current!.update();

  sceneRef.current.add(cloneA, cloneB);

  // Start render loop if not running
  if (!frameRunningRef.current) startLoop();
}, [modelA, modelB, colorblindMode]);
```

**Opacity reactivity (no re-clone — just update existing material refs):**
```typescript
useEffect(() => {
  tintedMatsRef.current.forEach(m => {
    m.opacity = opacity;
    m.needsUpdate = true;
  });
}, [opacity]);
```

**Lighting:** Add `AmbientLight(0xffffff, 0.5)` + `DirectionalLight(0xffffff, 1.0)` to ghost scene. Required for PBR materials.

**Cleanup on unmount:** cancel RAF, `controls.dispose()`, dispose tinted materials only (NOT `disposeModel` on originals — store owns those), remove clones from scene, `renderer.dispose()`.

**Opacity slider:** Use existing `Slider` from `src/components/ui/slider.tsx`:
```tsx
<Slider min={0.20} max={0.90} step={0.01} value={[opacity]}
  onValueChange={([v]) => setOpacity(v)} aria-label="Ghost overlay opacity" />
```

**Legend strip:**
```tsx
<div style={{ display: "flex", gap: 16 }}>
  <LegendSwatch color={colorblindMode ? "rgb(80,130,255)" : "rgb(255,80,80)"} label="only in v1" />
  <LegendSwatch color={colorblindMode ? "rgb(255,165,0)" : "rgb(80,220,100)"} label="only in v2" />
  <LegendSwatch color="#888" label="overlap (mixed tone)" />
</div>
```

**React StrictMode double-invoke:** Use local closure variable (not ref) for renderer in the mount effect, so cleanup always disposes the right instance.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Material type narrowing — not all materials have `.color` | Guard with `if ('color' in clone)` before setting |
| `scene.clone(true)` shares material refs — tintScene must clone them | Confirmed: clone creates new Mesh instances sharing material refs. `tintScene` `m.clone()` creates new materials. Originals untouched. |
| `SkinnedMesh` + `clone()` — bones reference originals | Acceptable for static tint. Flag: no animation in ghost mode for Phase 3. |
| SSR: Three.js / OrbitControls access DOM in constructor | Phase 4 wraps with `next/dynamic({ ssr: false })`. `"use client"` alone is not enough. |
| React StrictMode double-invoke of mount effect | Renderer created as local variable in closure; cleanup disposes via closure ref. |
| `getBaseColorFactor()` allocates a new array per call | Cache result: `const bcfA = matA.getBaseColorFactor()` before comparison |
| `accessor.getArray()` returns shared typed array | Read-only traversal in getBoundingBox. Never mutate. |
| gltf-transform name: `getMetallicFactor()` vs types.ts name `"metalness"` | Map correctly: gltf-transform API → types.ts property name |
| 900px vs 800px inconsistency in spec | Use 900px (PHASES.md and SPEC.md layout section); note the discrepancy |
| Render normalization before textures initialized | `Box3.setFromObject` uses CPU geometry data; safe before first render frame |

---

## High-Value Feature Expansions (Near-Free)

1. **Individual A/B visibility toggle** — `sceneAClone.visible = false`. ~10 lines.
2. **Stats panel "No structural differences" inline state** — check all deltas === 0 and arrays empty. ~4 lines.
3. **Stats panel JSON export** — `JSON.stringify(result)` blob download. Matches Phase 5 `stats.json` format. ~8 lines.
4. **Bounding box wireframe in ghost overlay** — `Box3Helper`. Toggle button. Useful for normalization debugging. ~15 lines.
5. **Colorblind mode in stats panel** — `deltaColor` already wires in `colorblindMode`; just needs the CSS vars (`--blue`, `--orange`) to exist in globals.css.

---

## Phase 4 Contracts (What Phase 3 Must Export)

- **`GhostOverlayView`**: no props, fills parent container (`width: 100%, height: 100%`), conditionally rendered by Phase 4 when `viewMode === "ghost"`, must support `next/dynamic({ ssr: false })` wrapping.
- **`StatsPanel`**: no props, ~280px expanded / 48px collapsed, always visible across all modes, `role="complementary"`.
- **`computeStructuralDiff`**: pure function matching `StructuralDiffResult` from `types.ts` exactly. Result is JSON-serializable (for Phase 5 `stats.json`).
- **`gltfParser` helpers**: isomorphic (no browser globals); Phase 5/6 CLI will import them in Node.js.
- **Store**: no new fields added. `structuralDiffResult` written by `StatsPanel`'s `useEffect`; Phase 4 reads it for "identical file" detection.

---

## Verification Checklist

- [ ] Drop two identical GLBs → StatsPanel shows all-zero deltas
- [ ] Drop modified GLB (translated node + changed roughness) → correct vertex delta and material diff
- [ ] Ghost overlay renders red/green composite; overlap region shows mixed tone (additive blending)
- [ ] Switch from ghost to side-by-side and back → original materials intact (no red/green taint)
- [ ] Move opacity slider 0.20→0.90 → smooth visual transition, no re-clone flash
- [ ] Toggle colorblind mode → legend and overlay colors change; stats panel color coding changes
- [ ] Resize browser to 800px → StatsPanel collapses to icon; click to re-expand
- [ ] Swap a model 5 times → no console errors, no GPU leak warnings
- [ ] Screen reader: load second model → VoiceOver announces delta changes
