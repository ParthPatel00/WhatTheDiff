# Implementation Phases

This file breaks the webapp implementation in [`SPEC.md`](./SPEC.md) into discrete phases. Each phase is a unit of work that one developer can own end-to-end. Phases 1-3 are designed to run in **parallel** after Phase 0 lands. Phase 4 ties everything together. Phases 5-7 are **post-MVP / stretch** (Git integration tiers).

## How to use this doc

- **Three webapp devs.** One Phase 0 owner unblocks the other two. Once Phase 0 is in `main`, the three devs each pick one of Phase 1, 2, or 3.
- **Pick the next free phase when you finish.** If you complete Phase 1 and Phases 2 and 3 are still in flight, jump to Phase 4 (or to a Phase 5/6/7 stretch item if Phase 4 is also being worked on).
- **Mark a phase as in-progress** by editing this file or posting in the team channel before starting, so two people don't duplicate work.
- **Each phase lists its dependencies, deliverables, and an "I'm done when..." checklist.** A phase is done when the checklist is green and the code is on `main`.
- **Coordination contracts (Zustand store shape, types) are defined in Phase 0.** Stick to them. If a phase needs to extend the store, add a field; do not rename or break existing fields without telling the other devs.

The Blender plugin track is owned separately and does not appear here.

---

## Phase dependency graph

```
        Phase 0 (Foundation)
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
Phase 1    Phase 2    Phase 3
(Viewers)  (Pixel     (Ghost +
            diff)      Stats)
   └──────────┼──────────┘
              ▼
         Phase 4
       (Shell + a11y
        + polish + deploy)

   ─── stretch ───
   Phase 5: CLI + local git hook
   Phase 6: GitHub Actions CI
   Phase 7: GitHub App inline viewer
```

Phases 1, 2, 3 do not import from each other. They each consume the Phase 0 store and produce one or more view components that Phase 4 wires into the mode switcher.

---

## Phase 0 — Foundation ✅ COMPLETE

**Goal:** Stand up the Next.js project, the Zustand store, the model loader, and the file upload zone, so the other two devs can start building views against real loaded models.

**Spec sections:** Tech stack, Architecture, MVP feature 1 (Dual file upload), critical gotchas 1, 2, 9, 11, 12, 14.

**Deliverables:**
- `package.json` with pinned versions of `next@14+`, `three`, `@gltf-transform/core`, `@gltf-transform/extensions`, `react-dropzone`, `zustand`, `tailwindcss`, `shadcn/ui` deps.
- Next.js 14 App Router scaffold under `frontend/src/` with Tailwind configured.
- `src/lib/types.ts` — shared types: `LoadedModel`, `StructuralData`, `DiffResult`, `ViewMode` enum (`'side-by-side' | 'ghost' | 'pixel-diff' | 'turntable' | 'all-angles'`), `CameraAngle` enum.
- `src/lib/modelLoader.ts` — single load pass with `buffer.slice(0)` cloning. Configures `DRACOLoader` (CDN pinned to 1.5.6) and `KTX2Loader`. Returns `{ scene, structuralData }`.
- `src/lib/disposeModel.ts` — handles all `Object3D` subtypes via property access, not `instanceof Mesh`.
- `src/stores/diffStore.ts` — Zustand store with: `modelA`, `modelB`, `bufferA`, `bufferB`, `loadingA`, `loadingB`, `errorA`, `errorB`, `viewMode`, `tolerance` (default 10), `opacity` (default 0.50), `cameraSynced` (default true), `colorblindMode` (default false), `diffResults`, plus actions to set each.
- `src/components/FileUpload.tsx` — dual drag-and-drop, validates `.glb`, warns >50MB, rejects >200MB, calls `modelLoader` and writes to store.
- `src/components/LoadingOverlay.tsx` — progress overlay with file name, size, spinner.
- `src/app/page.tsx` — upload screen with `<FileUpload />` and a "Both models loaded" placeholder. Real layout comes in Phase 4.
- `src/app/layout.tsx`, `globals.css` — dark theme matching mockup design tokens (JetBrains Mono, Inter).
- Additional components matching `UI/diffglb_mockups.jsx`: `Header.tsx`, `UploadScreen.tsx`, `BothLoadedBanner.tsx`.

**Note:** App lives under `frontend/` (create-next-app requires a lowercase directory name).

**I'm done when:**
- [x] `npm run dev` boots without errors.
- [x] Dropping two real `.glb` files (DamagedHelmet works) populates the store with both `scene` and `structuralData` for each.
- [x] Replacing a model calls `disposeModel` on the previous one (verify in console: no GPU leak warnings after 5 swaps).
- [x] `WebIO` is used for parsing (not `NodeIO`); does not throw in browser.
- [x] Buffer cloning is in place (`buffer.slice(0)` before second parser).
- [x] All Three.js imports use `next/dynamic` with `{ ssr: false }` where needed (in components, not in `lib/`).

---

## Phase 1 — Viewers core: Side-by-side, Turntable, WebGL recovery (one dev, ~6-8 hrs)

**Goal:** Implement the foundational 3D viewer and the two view modes that don't need the diff pipeline.

**Spec sections:** MVP features 2 (WebGL context loss), 3 (Side-by-side), View mode 4 (Turntable in section 8), critical gotchas 2, 3, 4, 5, 7.

**Depends on:** Phase 0 (`diffStore`, `modelLoader`, types).

**Deliverables:**
- `src/components/ViewerPanel.tsx` — reusable single-canvas Three.js viewer. Handles auto-framing (bounding-sphere camera distance), default lighting (ambient 0.5 + directional 1.0), `OrbitControls` from `three/addons/controls/OrbitControls.js`, continuous render loop, `preserveDrawingBuffer: true` on the renderer.
- `src/components/SideBySideView.tsx` — **single `WebGLRenderer`** with `setScissor` + `setViewport` for two views. Camera sync via `change` event with `syncingRef` guard. **Lock/unlock toggle** (default locked). When unlocked, only the viewport under the cursor orbits (determined by pointer X). Re-locking snaps secondary camera to primary. Auto-frames using the larger of the two bounding spheres.
- `src/components/TurntableView.tsx` — same as `SideBySideView` but with both cameras orbiting on the Y axis automatically (sync always on). No extra controls.
- `src/components/ErrorBoundary.tsx` — React error boundary plus `webglcontextlost` / `webglcontextrestored` handlers on every canvas. On loss: overlay "WebGL context lost. Click to restore." On click: `renderer.forceContextRestore()`. On restore: rebuild scenes and resume render loop.
- `src/hooks/useThreeViewer.ts` — encapsulates renderer setup, render loop, resize observer, cleanup on unmount (calls `disposeModel`, disposes `renderer`, removes event listeners).

**I'm done when:**
- [ ] Both models load and render side-by-side in a single canvas (verify: only one WebGL context in DevTools).
- [ ] Orbiting one viewport orbits the other when locked. Unlocking lets you orbit independently.
- [ ] Re-locking snaps the secondary camera to the primary's pose.
- [ ] Turntable mode auto-rotates both models in sync.
- [ ] Killing the WebGL context (DevTools → Rendering → "Lose WebGL context") shows the recovery overlay; clicking restores.
- [ ] No console errors after swapping models 5 times.

---

## Phase 2 — Pixel diff pipeline + All angles (one dev, ~8-10 hrs)

**Goal:** Build the offscreen render cache, the worker pool, and the two view modes that consume them.

**Spec sections:** MVP features 5 (Pixel diff), 6 (All angles), critical gotchas 6, 10, 15.

**Depends on:** Phase 0 (`diffStore`, types). Does **not** depend on Phase 1.

**Deliverables:**
- `src/lib/cameraPresets.ts` — 6 camera angle definitions: `front`, `back`, `left`, `right`, `top`, `34` (3/4). Each is a position vector + look-at target (origin).
- `src/lib/renderer.ts` — offscreen render pipeline. **Render normalization is critical:** center each model at world origin (translate by negative bounding-box center), use the larger bounding sphere of both centered models to set camera distance for both. Identical lighting/background/FOV/canvas size (1024x1024) for both. Returns `ImageData[6]` per model. Caches results keyed by model identity; invalidates on model change.
- `src/lib/pixelDiff.ts` — coordinator: spawns worker pool (one worker per angle, up to 6), runs all 6 comparisons in parallel via `Promise.all`, returns `DiffResult[]`. Re-runs against cached `ImageData` when tolerance changes (no re-render).
- `src/lib/pixelDiff.worker.ts` — worker entry. **Allocates a fresh `Uint8ClampedArray` on every invocation** (transferred buffer is neutered after `postMessage`). Writes red highlight `(255, 0, 0, 200)` to changed pixels, dims unchanged pixels to alpha 80. Returns `{ diff, pct }` with the buffer transferred.
- `src/components/PixelDiffView.tsx` — displays one angle's diff overlay. Arrow keys step through the 6 angles. Shows percentage badge.
- `src/components/AllAnglesView.tsx` — 2x3 grid of all 6 angles, each cell shows angle name + percentage + diff overlay. Click a cell to expand to `PixelDiffView` focused on that angle. Same worker pool and render cache.
- `src/hooks/useDiffResults.ts` — subscribes to model changes, triggers cache fill on model load, re-runs comparison on tolerance change.

**I'm done when:**
- [ ] Loading two models triggers 6 offscreen renders (visible in a perf log).
- [ ] All 6 angles compute their diff in parallel; total wall time <200ms on a mid-range laptop.
- [ ] Adjusting the tolerance slider re-runs only the comparison pass (verify: render count does not increment).
- [ ] Two identical files report ~0% changed across all angles.
- [ ] Two models with different pivot positions but identical geometry report ~0% changed (proves normalization works).
- [ ] Repeated slider adjustments (move it 20 times rapidly) do not produce blank/zero-diff output (proves no buffer-neutering bug).
- [ ] All angles grid renders all 6 cells; clicking a cell expands it.
- [ ] Render cache invalidates when either model changes.

---

## Phase 3 — Ghost overlay + Structural diff stats panel (one dev, ~6-8 hrs)

**Goal:** Build the ghost overlay view and the persistent structural-diff sidebar.

**Spec sections:** MVP features 4 (Ghost overlay), 7 (Stats panel), critical gotchas 1, 7, 8.

**Depends on:** Phase 0 (`diffStore`, `modelLoader`, types). Does **not** depend on Phase 1 or 2.

**Deliverables:**
- `src/components/GhostOverlayView.tsx` — single canvas, both models in one scene. Includes a `tintScene` utility function that **clones materials before tinting** (mutating originals would tint models in other view modes). Red `(255, 80, 80)` for model A, green `(80, 220, 100)` for model B. `transparent: true`, `depthWrite: false` on both. **`AdditiveBlending` on the green (second) model only.** `renderOrder` 1 for red, 2 for green. Same render normalization as pixel diff (center at origin, larger bounding sphere for camera distance). Opacity slider (default 0.50, range 0.20-0.90). Legend strip below canvas: red = "only in v1", green = "only in v2", neutral = "overlap (mixed tone)". OrbitControls active (always synced in this mode).
- `src/lib/gltfParser.ts` — thin wrapper around `gltf-transform`'s `WebIO`. Already invoked from `modelLoader.ts` in Phase 0; this file exposes helpers like `getMeshes(doc)`, `getMaterials(doc)`, `getNodes(doc)`, `getAnimations(doc)`, `getBoundingBox(doc)`.
- `src/lib/structuralDiff.ts` — compares two parsed `Document`s. Returns: `vertexDelta`, `triangleDelta`, `boundingBox` (a/b/delta), `materialsAdded[]`, `materialsRemoved[]`, `materialsModified[]` (with property-level diffs: `baseColorFactor`, `roughness`, `metalness`), `nodeCountDelta`, `animationCountDelta`.
- `src/components/StatsPanel.tsx` — **persistent right sidebar**, always visible across all view modes. Two-column layout. Color-coded deltas: green=added, red=removed, yellow=modified. `aria-live="polite"`. Collapses to an icon on screens <900px wide.

**I'm done when:**
- [ ] Ghost overlay shows red/green composite with mixed-tone overlap regions.
- [ ] Toggling away from ghost overlay to side-by-side shows untainted original materials (proves clone-before-tint).
- [ ] Opacity slider smoothly adjusts overlap visibility from 0.20 to 0.90.
- [ ] Stats panel shows correct vertex/triangle/material/bbox deltas for a known test pair (e.g. DamagedHelmet vs. modified DamagedHelmet).
- [ ] Stats panel is visible in side-by-side, ghost, pixel diff, turntable, and all-angles modes.
- [ ] Stats panel collapses to an icon at viewport width 800px and re-expands on click.

---

## Phase 4 — Shell, controls, accessibility, polish, deploy (one dev, ~8-10 hrs)

**Goal:** Wire the views together into a cohesive app: header, mode switcher, conditional controls, keyboard shortcuts, colorblind mode, layout, identical-file detection, deploy.

**Spec sections:** MVP features 8 (View mode controls), 9 (Accessibility), Deploy, MVP feature 1 paragraphs on error/identical-file handling.

**Depends on:** Phase 0 (always). Can **start in parallel** with Phases 1-3 by stubbing view components, but final integration needs all three to be at least usable.

**Deliverables:**
- `src/components/Header.tsx` — app title, link to repo, colorblind toggle.
- `src/components/DiffControls.tsx` — mode switcher (5 buttons) and conditional sliders/toggles per mode:
  - Side-by-side: camera sync lock/unlock toggle.
  - Ghost overlay: opacity slider.
  - Pixel diff: tolerance slider.
  - Turntable: no extras.
  - All angles: tolerance slider.
- **Keyboard shortcuts:** `1`-`5` for modes, `S` for sync toggle, `←` / `→` to step angles in pixel diff mode. Implement via a single `useEffect` keydown listener on `document`.
- **Colorblind-safe mode:** toggle in header. Persists to `localStorage`. When active: ghost overlay uses blue `(80, 130, 255)` and orange `(255, 165, 0)`; pixel diff highlights blue instead of red; stats panel deltas use blue (removed) / orange (added) / yellow (modified). Ensure all three view modes read from a single `colorblindMode` selector.
- **Aria labels** on every interactive control (mode buttons, sliders, file upload zones).
- **Layout:** viewers in main area, stats panel as right sidebar, controls in top bar. Side-by-side fills 50%/50%, ghost/pixel-diff fill 100%, all-angles is 3x2 grid. Min canvas 400x400. Stack vertically below 900px width.
- **Identical-file detection:** when all 6 angles report 0% changed AND `structuralDiff` reports zero deltas, render a "No differences found" state with checkmark icon over the active view. (Implementation: a selector in the store; the view components render an overlay if true.)
- **>95% changed warning:** when all 6 angles report >95% changed, show a non-blocking toast: "These models appear to be entirely different. This tool is designed to compare two versions of the same asset."
- **Vercel deploy:** `vercel.json` if needed, push to Vercel, confirm production URL works with real GLB drops.

**I'm done when:**
- [ ] All five view modes are reachable from the mode switcher.
- [ ] Conditional controls appear and disappear correctly per mode.
- [ ] Keyboard shortcuts work (test all 7).
- [ ] Colorblind toggle visibly changes colors in ghost overlay, pixel diff, and stats panel; persists across page reloads.
- [ ] Screen reader (VoiceOver / NVDA) announces stats panel changes when a new model loads.
- [ ] Layout is usable at 1920px, 1366px, and 800px widths.
- [ ] Two identical files show the "No differences found" state.
- [ ] Two completely different files show the >95% changed warning toast.
- [ ] Production deploy on Vercel works with at least 3 real test pairs.

---

## Phase 5 — CLI + local git hook (STRETCH, post-MVP, ~1 day)

**Goal:** Ship `npx diffglb` for local use after a `git commit`.

**Spec section:** Tier 1: Local git hook.

**Depends on:** Phase 4 (the webapp must be deployable as a local server before the CLI can wrap it).

**Deliverables:**
- `bin/diffglb.js` — CLI entrypoint. Flags: `--a <file>`, `--b <file>`, `--headless`, `--max-files <n>` (default 3), `--no-prompt`, `install-hook`, `uninstall-hook`.
- Post-commit hook script that runs `git diff --name-only HEAD~1 HEAD`, extracts each changed `.glb` via `git show`, opens the viewer at `localhost:4242` with both files pre-loaded.
- **New-file handling:** detect status "A" via `git diff --name-status` and skip with a message; do not crash.
- **Batch-commit prompt:** when changed file count exceeds `--max-files`, prompt `[y/N/pick]`; `--no-prompt` skips prompt and opens all.
- `package.json` `bin` field; `prepare` script auto-installs the hook on `npm install`.
- Headless mode (`--headless`) writes diff PNGs and `stats.json` to `--out <dir>` for CI consumption (used by Phase 6).

**I'm done when:**
- [ ] `npx diffglb --a one.glb --b two.glb` opens the viewer in the default browser with both pre-loaded.
- [ ] After `npx diffglb install-hook`, a `git commit` that touches a `.glb` opens the viewer automatically.
- [ ] Initial commit of a new `.glb` skips the file with a clear message instead of crashing.
- [ ] Batch commit with >3 GLBs prompts before opening tabs.

---

## Phase 6 — GitHub Actions CI workflow (STRETCH, post-MVP, ~2-3 days)

**Goal:** Reusable workflow that posts visual diffs as PR comments.

**Spec section:** Tier 2: CI pipeline via GitHub Actions.

**Depends on:** Phase 5 (`--headless` mode + `stats.json` output).

**Deliverables:**
- `.github/workflows/glb-diff.yml` (the example in spec, copy-pasteable for consuming repos).
- Documentation in `README.md` for installing the workflow in a downstream repo.
- Use `github.event.pull_request.base.sha` and `github.sha` (not `HEAD~1`) with `fetch-depth: 0`.
- Use `--diff-filter=M` for modified files; report `--diff-filter=A` (added) files separately in the PR comment.
- Playwright Chromium with `--enable-webgl` for headless GPU rendering.

**I'm done when:**
- [ ] Open a PR in a test repo that touches a `.glb`; the workflow runs and posts a comment with embedded diff images.
- [ ] Squash-merge and rebase-merge scenarios produce the correct base comparison.
- [ ] Newly added `.glb` files are listed in the comment without crashing the job.

---

## Phase 7 — GitHub App with inline PR viewer (STRETCH, post-MVP, ~1+ week)

**Goal:** Embed the live viewer in the GitHub PR "Files changed" tab via a `content_reference` webhook.

**Spec section:** Tier 3: GitHub App with inline PR viewer.

**Depends on:** Phase 4 (deployed webapp), Phase 6 (validates the headless rendering pipeline first).

**Deliverables:**
- `app-manifest.json` with `content_reference` for `.glb`.
- `/api/webhook` route handler for content reference creation events.
- Session store (Redis / Upstash) with 10-minute TTL for signed blob URLs.
- `/view/[sessionId]` route in the Next.js app that fetches the two signed blobs, loads them as `ArrayBuffer`s, and pre-populates the Zustand store.
- Server deploy with `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `SESSION_SECRET` env vars.

**I'm done when:**
- [ ] Installing the app in a test org and opening a PR with a changed `.glb` shows the inline viewer in the "Files changed" tab.
- [ ] Blob URLs expire after 10 minutes.
- [ ] App handles the `pull_request` `synchronize` event (force-pushes) by re-issuing fresh session URLs.

---

## Notes for picking up phases

- **If you're the second or third person to start a phase**, sanity-check that the previous phase's "I'm done when" checklist actually passes. Don't trust commit messages.
- **Cross-phase coordination:** any change to `diffStore` shape or `types.ts` should be announced. Adding fields is fine; renaming or repurposing fields breaks parallel work.
- **Test pairs:** generate a few early using a quick gltf-transform script (load → translate a node → save). Keep them in `scripts/` and reference them in this doc when you have them. Worth doing as soon as Phase 0 is in.
- **If you finish all webapp phases**, Phase 5 is the highest-value stretch (real demo material), then 6, then 7.
