# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before writing any code

Read these docs in order:
1. **`SPEC.md`** — single source of truth. Includes a 15-item "Critical gotchas" section covering silent-failure traps (SSR issues, buffer neutering, WebGL context limits, material cloning). Do not skim it.
2. **`PHASES.md`** — how work is divided. Each phase has a dependency graph, deliverables, and a "done when" checklist.
3. **`PHASE_3.md`** — detailed implementation plan for Phase 3 (ghost overlay + structural diff), including specific API gotchas and risks.

## Commands

**The working directory for all commands is `frontend/`, not the repo root.** There is no `package.json` at the repo root. Running any npm command from the repo root will fail.

Always `cd frontend` first:

```bash
cd /Users/eugene/Hackathons/SJHacks2026/WhatTheDiff/frontend

npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint via next lint
```

No test runner is configured yet.

## Architecture

### Directory layout

```
frontend/src/
  app/           # Next.js App Router — layout.tsx, page.tsx, globals.css
  components/    # React components
  lib/           # Pure logic: modelLoader, disposeModel, types, utils
  stores/        # Zustand store (diffStore.ts)
```

### Data flow

1. User drops `.glb` files into `FileUpload.tsx` (dual drop zones, side A and B).
2. `loadModel(buffer, renderer)` in `modelLoader.ts` runs two parsers in parallel:
   - **Three.js GLTFLoader** → `THREE.Group` (for rendering)
   - **gltf-transform WebIO** → `Document` + extracted counts (for structural diff)
   - Buffer is cloned with `buffer.slice(0)` before the second parser; gltf-transform's WebIO may consume/neuter the buffer.
3. Both results land in the **Zustand store** (`diffStore.ts`) as `modelA`/`modelB` (`LoadedModel`).
4. View components read from the store. No prop drilling.

### Store shape (all fields, `stores/diffStore.ts`)

```
modelA/B: LoadedModel | null       — { scene: THREE.Group, structuralData: StructuralData }
bufferA/B: ArrayBuffer | null
loadingA/B, errorA/B
viewMode: ViewMode                 — 'side-by-side'|'ghost'|'pixel-diff'|'turntable'|'all-angles'
tolerance: number (default 10)     — pixel diff threshold
opacity: number (default 0.5)      — ghost overlay opacity, range 0.20–0.90
cameraSynced: boolean (default true)
colorblindMode: boolean (default false)
diffResults: DiffResult[]          — pixel diff results per CameraAngle
structuralDiffResult: StructuralDiffResult | null
```

### Key types (`lib/types.ts`)

- `StructuralData` — includes a live `document: any` (gltf-transform `Document`) plus precomputed `vertexCount`, `triangleCount`, `materialCount`, `nodeCount`, `animationCount`.
- `StructuralDiffResult` — output of structural comparison: deltas, bounding boxes, `materialsAdded/Removed/Modified`.
- `MaterialDiff.changes[].property` uses Three.js naming: `"metalness"` — but gltf-transform's API is `material.getMetallicFactor()`. Map carefully.

### Phase dependency: what is built

- **Phase 0 (done):** Store, types, `modelLoader`, `disposeModel`, `FileUpload`, `UploadScreen`, `Header`. Shared renderer singleton in `FileUpload.tsx` (1×1 px, used only for KTX2 support detection).
- **Phase 1 (in progress):** `ViewerPanel`, `SideBySideView`, `TurntableView`, `ErrorBoundary`, `useThreeViewer`.
- **Phase 2 (in progress):** Pixel diff worker pool, `PixelDiffView`, `AllAnglesView`, offscreen render cache.
- **Phase 3 (in progress):** `gltfParser`, `structuralDiff`, `GhostOverlayView`, `StatsPanel`.
- **Phase 4:** Shell layout, mode switcher, keyboard shortcuts, colorblind mode, deploy.

Phases 1, 2, 3 are **parallel** and do not import from each other. They all consume Phase 0's store and types.

## Critical implementation rules

**SSR / Three.js:** All Three.js components must be wrapped with `next/dynamic({ ssr: false })` in Phase 4. `"use client"` alone is insufficient — Three.js constructors access the DOM. Do not import Three.js at the top level of server components.

**WebGL context limit:** There is exactly one `WebGLRenderer` per view. `SideBySideView` uses a single renderer with `setScissor`/`setViewport` — NOT two renderers. Browsers allow ~8–16 WebGL contexts total. The shared renderer in `FileUpload.tsx` is for model loading only (not for display).

**Dispose pattern:** `disposeModel.ts` uses duck-typing (`(obj as unknown as { geometry? }).geometry`) instead of `instanceof Mesh`, to handle `SkinnedMesh`, `InstancedMesh`, `Line`, etc. Follow this pattern everywhere. Never `instanceof THREE.Mesh`.

**Material cloning:** When tinting models in `GhostOverlayView`, call `scene.clone(true)` first (clones the mesh hierarchy, shares material refs), then clone-and-replace materials on the cloned meshes via `tintScene`. Never mutate materials on `modelA.scene` or `modelB.scene` directly — those objects are owned by the store and shared with other view modes.

**gltf-transform Document API (v4.x):**
- Use `WebIO`, not `NodeIO` (NodeIO is Node.js only; WebIO is isomorphic).
- `accessor.getArray()` returns the internal typed array — read-only; do not mutate.
- `material.getBaseColorFactor()` allocates a new array on every call — cache the result before comparison.
- `material.getMetallicFactor()` (not `getMetalnessFactor`).

**Render normalization (ghost overlay, pixel diff):** Center each model at world origin by translating by the negative bounding-box center. Use `new THREE.Box3().setFromObject(scene)` (evaluates node transforms) for camera framing — not `gltfParser.getBoundingBox()` (local space only). Use the larger bounding sphere of both centered models to set camera distance for both.

**Draco decoder:** Pinned to `1.5.6` at `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`. Must stay in sync with the Three.js version. Do not change.

## Design tokens

CSS variables defined in `globals.css`:
```
--bg, --bg-surface, --bg-elevated, --bg-canvas
--border, --border-focus
--text, --text-muted, --text-dim
--red, --red-muted, --green, --green-muted, --yellow, --blue, --orange
--accent  (= --green, #50dc64)
--font-mono, --font-sans
```

Colorblind mode swaps: `--red` → `--blue` for removed/A, `--green` → `--orange` for added/B.

## Test assets

Use [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets). DamagedHelmet is the canonical test model. For diff testing, generate pairs via a gltf-transform script (translate a node → save) — see `SPEC.md § Test models`.
