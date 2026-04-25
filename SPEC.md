# 3D Model Visual Diff Tool

## What this is

A browser-based tool where users upload two .glb files and instantly see what changed. Five comparison modes: **side-by-side** (synced orbit controls with lock/unlock toggle), **ghost overlay** (both models composited in one viewport, red = removed, green = added), **pixel diff** (red highlights on changed pixels), **turntable** (auto-rotating side-by-side), and **all angles** (2x3 grid of all 6 angles with diff overlays and per-angle change percentages).

**GLB only.** Do not support .gltf (which references external .bin and texture files that complicate upload). GLB is self-contained and is what game engines export by default.

No server. No auth. No database. Everything runs client-side.

## Why this matters

82% of game developers use Git, but Git treats 3D models as opaque binary blobs: `git diff` returns "Binary files differ." Perforce (used by 19 of 20 top AAA publishers) has no visual diff either. GitHub added STL diffing in 2013 but it only supports the simplest mesh format (no materials, no skeleton, no animations) and hasn't been updated since. The industry workaround is manual: render both versions, eyeball the screenshots side by side. Our tool automates that entire workflow.

## Why pixel diff over geometry heatmap

Industry feedback from a professional using Perforce in film/VFX: artists validate with renders, not vertex data. "Technically right and artistically correct" are different things. A vertex moving 0.001 units might be invisible. A material tweak might change everything. The pixel diff matches how artists actually work: render both, compare visually.

## Why ghost overlay

The ghost overlay mode applies the same mental model as a code diff in a pull request: removed content in red, added content in green, unchanged content neutral. Both models are rendered into the same viewport simultaneously using additive alpha blending at ~0.5 opacity. The original model's materials are tinted `rgb(255, 80, 80)` and the modified model's materials are tinted `rgb(80, 220, 100)`. Where they perfectly overlap the result reads as a mixed tone (overlap appearance depends on original material brightness). The opacity slider lets reviewers dial transparency to taste. This mode requires the same render normalization as pixel diff: both models centered at world origin, same camera distance.

## Tech stack

- **Next.js 14+** (App Router, TypeScript, Tailwind, src directory)
- **Three.js** for 3D rendering, GLTFLoader, DRACOLoader, KTX2Loader
- **@gltf-transform/core + @gltf-transform/extensions** for parsing glTF structure
- **react-dropzone** for file upload
- **zustand** for state
- **shadcn/ui** for UI components

All Three.js viewer components must be loaded with `next/dynamic` and `{ ssr: false }`. Three.js accesses `window` and `document` at import time and will break the Next.js SSR build without this.

## Architecture

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── FileUpload.tsx          # Dual drag-and-drop zones
│   ├── ViewerPanel.tsx         # Single Three.js viewer (reusable)
│   ├── SideBySideView.tsx      # Two synced ViewerPanels (single renderer, scissor)
│   ├── GhostOverlayView.tsx    # Both models composited in one viewport
│   ├── PixelDiffView.tsx       # Diff overlay on rendered frames
│   ├── AllAnglesView.tsx       # 2x3 grid of all 6 angles with diff overlays
│   ├── TurntableView.tsx       # Auto-rotating side-by-side
│   ├── StatsPanel.tsx          # Structural diff results (persistent sidebar)
│   ├── DiffControls.tsx        # Tolerance slider, opacity slider, view mode toggle
│   ├── LoadingOverlay.tsx      # Progress indicator for file parsing and diff computation
│   ├── ErrorBoundary.tsx       # WebGL context loss recovery
│   └── Header.tsx
├── lib/
│   ├── renderer.ts             # Offscreen Three.js render pipeline (cached renders)
│   ├── pixelDiff.ts            # Pixel comparison coordinator (dispatches to workers)
│   ├── pixelDiff.worker.ts     # Web Worker entry point for off-thread diffing (one per angle)
│   ├── structuralDiff.ts       # Scene graph + material diffing
│   ├── cameraPresets.ts        # 6 predefined camera angles
│   ├── gltfParser.ts           # gltf-transform wrapper (uses cloned ArrayBuffer)
│   ├── modelLoader.ts          # Single load pass: Three.js scene + gltf-transform data
│   ├── disposeModel.ts         # GPU resource cleanup for all mesh types
│   └── types.ts
├── stores/
│   └── diffStore.ts
└── hooks/
    ├── useThreeViewer.ts
    └── useDiffResults.ts
```

## MVP features

### 1. Dual file upload

Drag-and-drop two .glb files. Validate extension and size (warn >50MB, reject >200MB). Store as ArrayBuffers in Zustand. Auto-start parsing and rendering after both load. Show thumbnail preview of each model.

**Loading states:** Show a progress overlay during file parsing. Display file name, file size, and a spinner while GLTFLoader and gltf-transform process the buffer. When both models are loaded, transition to the default view mode with an animation. For the pixel diff computation, show a progress bar (1/6, 2/6, etc.) and display each angle's result as it completes rather than waiting for all 6.

**Single load pass:** Parse each ArrayBuffer exactly once via `modelLoader.ts`, which runs GLTFLoader and gltf-transform's `WebIO` on the same buffer in parallel and stores both the Three.js scene and the structural data in Zustand. Do not run a second parse pass for the stats panel.

**ArrayBuffer cloning for dual parse (important).** GLTFLoader and gltf-transform's WebIO both need to read the same ArrayBuffer. ArrayBuffer ownership cannot be shared if either parser uses transferable messaging. Since both parsers run on the main thread (WebIO is not in a worker), clone the buffer before passing it to the second parser:

```typescript
async function loadModel(buffer: ArrayBuffer) {
  // Clone so both parsers have their own copy
  const bufferForThree = buffer;
  const bufferForGltf = buffer.slice(0);

  const [threeResult, gltfResult] = await Promise.all([
    loadWithThree(bufferForThree),
    parseWithGltfTransform(bufferForGltf),
  ]);

  return { scene: threeResult.scene, structuralData: gltfResult };
}
```

**Decoder setup (required; models will silently appear empty without this):** Most real-world GLBs use Draco mesh compression and/or KTX2 textures. Configure both decoders before loading:

```typescript
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
);

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath(
  "https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/"
);
ktx2Loader.detectSupport(renderer);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.setKTX2Loader(ktx2Loader);
```

**Draco decoder version pinning:** The CDN URL above pins to Draco 1.5.6. This is correct for reproducibility, but this version must stay compatible with the version of Three.js in `package.json`. When upgrading Three.js, check the Three.js changelog for Draco decoder version requirements and update the URL accordingly. A mismatch causes silent decode failures where meshes load as empty geometry.

**Memory cleanup:** When a model is replaced or the tool is reset, call `disposeModel(scene)` which traverses the scene graph and calls `.dispose()` on every geometry, material, and texture. This must handle all geometry-bearing subtypes, not just `THREE.Mesh`. Skipping this causes unbounded GPU memory growth and will crash the tab after a few file swaps.

```typescript
function disposeModel(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    // Handle all mesh types: Mesh, SkinnedMesh, InstancedMesh, Line, Points, etc.
    const geo = (obj as any).geometry;
    if (geo && typeof geo.dispose === "function") {
      geo.dispose();
    }

    const mat = (obj as any).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        if (m && typeof m.dispose === "function") {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        }
      });
    }
  });
}
```

**Error handling:** If a file fails to parse, show an error toast with the parse error message. If both models load but the pixel diff shows >95% pixels changed across all angles, show a warning: "These models appear to be entirely different. This tool is designed to compare two versions of the same asset."

**Identical files:** If both uploaded files produce identical pixel data across all 6 angles and identical structural data, show a clear "No differences found" state with a checkmark icon instead of an empty diff view. This prevents confusion when users accidentally upload the same file twice or when the changes are too subtle for the current tolerance setting.

### 2. WebGL context loss recovery

Register a `webglcontextlost` event handler on every canvas. Without this, GPU driver resets, tab backgrounding on mobile, or memory pressure will leave users with a black canvas and no recovery path.

```typescript
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault(); // Required to allow restoration
  setContextLost(true);
});

canvas.addEventListener("webglcontextrestored", () => {
  setContextLost(false);
  // Rebuild scenes, re-upload textures, restart render loop
  rebuildViewers();
});
```

When context is lost, overlay a message on the canvas: "WebGL context lost. Click to restore." On click, call `renderer.forceContextRestore()`. The `webglcontextrestored` handler then rebuilds all scenes and restarts the render loop.

### 3. Side-by-side viewer with synced controls

One `WebGLRenderer` renders both models in a single animation frame using `setScissor` + `setViewport`, not two separate renderers. Two renderers doubles GPU memory usage and often causes context limit errors on lower-end machines (browsers cap WebGL contexts per page).

```typescript
// Single renderer, two viewports per frame
renderer.setScissorTest(true);

function renderBothViews() {
  const w = canvas.clientWidth / 2,
    h = canvas.clientHeight;

  // Left: model A
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.render(sceneA, camera);

  // Right: model B
  renderer.setViewport(w, 0, w, h);
  renderer.setScissor(w, 0, w, h);
  renderer.render(sceneB, camera);
}
```

**Camera sync with lock/unlock toggle.** OrbitControls binds to the canvas DOM element, and with a single canvas you cannot have independent hover/click regions for left vs. right. By default, both views orbit together via a `change` event listener that copies camera position/quaternion/zoom from source to target (with a boolean flag to prevent sync loops). However, real review workflows often require inspecting one model independently. Add a lock/unlock toggle button (default: locked/synced). When unlocked, the user orbits only the viewport their cursor is over, determined by checking whether the pointer's X coordinate falls in the left or right half. When re-locked, the secondary camera snaps to match the primary.

```typescript
const [synced, setSynced] = useState(true);

function onControlsChange(source: "left" | "right") {
  if (!synced) return;
  if (syncingRef.current) return;
  syncingRef.current = true;
  const [src, dst] =
    source === "left" ? [cameraA, cameraB] : [cameraB, cameraA];
  dst.position.copy(src.position);
  dst.quaternion.copy(src.quaternion);
  dst.zoom = src.zoom;
  dst.updateProjectionMatrix();
  syncingRef.current = false;
}
```

Auto-frame models on load using bounding box. Default lighting: ambient (0.5) + directional (1.0). Add the lights to both scenes.

### 4. Ghost overlay mode

Single Three.js canvas with both models loaded into the same scene. Tint the original model's materials red (`rgb(255, 80, 80)`) and the modified model's materials green (`rgb(80, 220, 100)`). Set `depthWrite: false` and `transparent: true` on all tinted materials, and use `THREE.AdditiveBlending` on the _second_ (green) model so it composites over the first rather than occluding it. Render order: red model first (renderOrder 1), green model second (renderOrder 2).

Do not use `THREE.NormalBlending` on both models. That just draws one on top of the other and the "overlay" effect disappears wherever the green model occludes the red. Additive blending on the green layer is what produces the overlap tone where geometry coincides.

Opacity is configurable (default 0.50, range 0.20 to 0.90 via slider). The 0.50 default is deliberate: at higher defaults (e.g. 0.65), additive blending on the green model causes the green layer to visually dominate on bright materials, biasing perception. 0.50 stays balanced regardless of material brightness. **Clone materials before tinting.** Mutating originals leaves the models tinted in every other view mode.

```typescript
function tintScene(
  scene: THREE.Object3D,
  color: THREE.Color,
  opacity: number,
  additive: boolean
) {
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      obj.material = mats.map((m) => {
        const clone = m.clone();
        clone.color = color;
        clone.opacity = opacity;
        clone.transparent = true;
        clone.depthWrite = false;
        if (additive) clone.blending = THREE.AdditiveBlending;
        return clone;
      });
    }
  });
}
```

Apply the same render normalization as pixel diff: center both models at world origin, use the larger bounding sphere to set camera distance. OrbitControls still active so reviewers can orbit the composite. Legend strip below the canvas: red swatch = "only in v1", green swatch = "only in v2", neutral swatch = "overlap (mixed tone)".

**Legend wording is deliberate.** Do not label the neutral swatch "unchanged" — that implies a single consistent neutral color, but the actual visual result of additive blending over overlapping geometry depends on the underlying material colors and brightness. "Overlap (mixed tone)" accurately describes what users see.

### 5. Rendered pixel diff

Render both models from 6 camera angles (front, back, left, right, top, 3/4) into offscreen canvases at 1024x1024. Compare pixel data with configurable tolerance (0 to 50, default 10). Output: diff canvas with red highlights where pixels diverge, change percentage per angle. Tolerance slider re-runs the comparison in real time.

**Tolerance slider visibility:** The tolerance slider only appears when pixel diff or all angles mode is active. It is hidden during side-by-side, ghost overlay, and turntable modes where it has no effect. Showing it in irrelevant modes confuses users into thinking it controls something.

**Multi-worker parallel diffing for responsive slider.** Do not run all 6 angles through a single Web Worker. At 1024x1024 per angle, each comparison takes 50 to 100ms on mid-range hardware, which would total 300 to 600ms sequentially and make the tolerance slider feel sluggish. Spawn a pool of workers (one per angle, up to 6) so all comparisons run in parallel. Wall time then drops to 50 to 100ms.

```typescript
// Create a pool of workers, one per angle
const workerPool = Array.from(
  { length: 6 },
  () => new Worker(new URL("./pixelDiff.worker.ts", import.meta.url))
);

async function runParallelDiff(tolerance: number): Promise<DiffResult[]> {
  if (!renderCache.current) {
    renderCache.current = {
      a: await renderAllAngles(sceneA),
      b: await renderAllAngles(sceneB),
    };
  }

  const promises = workerPool.map(
    (worker, i) =>
      new Promise<DiffResult>((resolve) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.postMessage({
          pixelsA: renderCache.current!.a[i].data,
          pixelsB: renderCache.current!.b[i].data,
          tolerance,
        });
      })
  );

  return Promise.all(promises);
}
```

**Worker re-allocation for repeated slider adjustments.** The worker creates a new `Uint8ClampedArray` on each invocation and transfers its buffer back to the main thread. After transfer, the worker's array becomes neutered. Each slider change triggers a fresh invocation that allocates a new array. The worker code must not reuse a previously transferred array:

```typescript
// pixelDiff.worker.ts
self.onmessage = ({ data: { pixelsA, pixelsB, tolerance } }) => {
  // Always allocate fresh - previous diff buffer was transferred and is neutered
  const diff = new Uint8ClampedArray(pixelsA.length);
  let changed = 0;
  for (let i = 0; i < pixelsA.length; i += 4) {
    const dr = Math.abs(pixelsA[i] - pixelsB[i]);
    const dg = Math.abs(pixelsA[i + 1] - pixelsB[i + 1]);
    const db = Math.abs(pixelsA[i + 2] - pixelsB[i + 2]);
    if (dr + dg + db > tolerance * 3) {
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
      diff[i + 3] = 200;
      changed++;
    } else {
      diff[i] = pixelsA[i];
      diff[i + 1] = pixelsA[i + 1];
      diff[i + 2] = pixelsA[i + 2];
      diff[i + 3] = 80;
    }
  }
  self.postMessage({ diff, pct: (changed / (pixelsA.length / 4)) * 100 }, [
    diff.buffer,
  ]);
};
```

**Render cache; never re-render when only tolerance changes.** The 6-angle offscreen renders are slow (GPU work). Cache the raw `ImageData` for both models after the first render pass. The tolerance slider only re-runs the _comparison pass_ (fast, in the workers) against the cached pixel arrays. It never triggers a re-render.

Invalidate the render cache when either model changes (new file uploaded or models swapped).

**Render normalization (critical).** The pixel diff only works if both models are rendered under identical conditions. Before offscreen rendering:

- Center both models at world origin by translating by the negative of their bounding box center. Without this, models with different pivot offsets appear shifted and produce false diffs.
- Compute the bounding sphere of _both_ centered models. Use the _larger_ radius to set camera distance for both renders. This ensures identical framing.
- Use identical lighting, background color, and FOV for both.

The models themselves can differ in any way (different vertex counts, topology, scale, materials). That is what you are detecting. What must be identical is the render setup: canvas size, camera, lighting, background.

### 6. All angles mode (MVP)

A 2x3 grid displaying all 6 camera angles simultaneously, each with its pixel diff overlay and per-angle change percentage. This was originally listed as a stretch goal ("multi-angle gallery") but the mockups include an "all angles" button in the mode bar, so it is an MVP feature.

Each cell in the grid shows:

- The diff overlay image (same as pixel diff mode, using cached renders)
- The angle name (front, back, left, right, top, 3/4)
- The change percentage for that angle

Clicking any cell expands it to full size (same as pixel diff mode focused on that angle). The tolerance slider applies to all 6 cells simultaneously, using the same worker pool and render cache as pixel diff mode.

### 7. Structural diff stats panel (persistent sidebar)

Use gltf-transform to compare: vertex count delta, triangle count delta, bounding box dimensions, materials added/removed/modified (property-level: baseColorFactor, roughness, metalness), scene graph node count delta, animation count delta. Display as a two-column layout with color-coded deltas (green = added, red = removed, yellow = modified).

**This panel is always visible as a right sidebar across all view modes.** It is not a toggleable mode. Structural data (vertex counts, material changes, bounding box deltas) provides useful context regardless of which visual comparison mode the user is viewing. The sidebar collapses to an icon on screens narrower than 900px and can be expanded with a tap.

### 8. View mode controls

Toggle between five modes: side-by-side (default), ghost overlay, pixel diff, turntable (auto-rotating Y axis in sync), and all angles.

**Keyboard shortcuts:** Power users can switch modes with number keys: 1 = side-by-side, 2 = ghost overlay, 3 = pixel diff, 4 = turntable, 5 = all angles. S toggles camera sync lock/unlock in side-by-side mode. Left/right arrow keys step through the 6 angles in pixel diff mode.

**Conditional controls per mode:**

- **Side-by-side:** Show camera sync lock/unlock toggle. Hide tolerance slider. Hide opacity slider.
- **Ghost overlay:** Show opacity slider. Hide tolerance slider. Show camera sync info (orbit is always synced in this mode).
- **Pixel diff:** Show tolerance slider. Hide opacity slider.
- **Turntable:** No extra controls. Hide tolerance and opacity sliders.
- **All angles:** Show tolerance slider. Hide opacity slider.

**Layout:** Each viewer canvas fills 50% of available width in side-by-side mode, maintaining 1:1 aspect ratio. Ghost overlay and pixel diff fill 100% of available width (single canvas). All angles mode displays a 3x2 grid. Minimum canvas size 400x400. On screens narrower than 900px, stack vertically. Stats panel sidebar sits to the right of the viewers, never overlapping them.

### 9. Accessibility

**Colorblind-safe mode.** The red/green color scheme for diff visualization is unusable for users with deuteranopia or protanopia (roughly 8% of male users). Provide a toggle for an alternative color scheme that uses **blue (`rgb(80, 130, 255)`) for "only in v1"** and **orange (`rgb(255, 165, 0)`) for "only in v2"**. This blue/orange pair has high contrast for all common forms of color vision deficiency.

The colorblind-safe toggle applies to:

- Ghost overlay tinting colors
- Pixel diff highlight color (blue instead of red for changed pixels)
- Stats panel delta colors (blue for removed, orange for added, yellow remains for modified)
- The legend strip below ghost overlay

Store the preference in `localStorage` so it persists across sessions.

**Screen reader labels:** All interactive controls (mode buttons, sliders, file upload zones) must have `aria-label` attributes. The stats panel values should use `aria-live="polite"` to announce changes when a new model is loaded.

---

## Git integration

The tool ships in three integration tiers. Build them in order: each tier depends on the previous one.

### Tier 1: Local git hook (1 day, zero server required)

Package diffglb as an npm CLI: `npx diffglb`. A `prepare` script in `package.json` installs the hook automatically when a developer runs `npm install` in their repo.

**How it works:**

- `.git/hooks/post-commit` shells out to `npx diffglb`
- The hook runs `git diff --name-only HEAD~1 HEAD` to find changed `.glb` files
- For each changed file it runs `git show HEAD~1:<path>` and `git show HEAD:<path>` to extract the two binary blobs into temp files
- Calls `diffglb --a /tmp/prev.glb --b /tmp/curr.glb` which serves the viewer at `localhost:4242` and opens it in the browser
- Process exits cleanly; port is released after the browser tab closes

**Handling new files (no previous version).** `git show HEAD~1:<path>` fails on the initial commit of a new GLB file because there is no previous version. The hook must detect newly added files (status "A" in `git diff --name-status`) and skip them with a message: "Skipping <filename>: new file, nothing to diff against." Without this, the hook crashes on the first commit that introduces a GLB.

**Batch commit protection.** The hook fires on every commit that touches any GLB files, including batch commits that modify dozens of assets. Opening a browser tab for each file would be disruptive. Add a `--max-files` flag (default 3). When the changed file count exceeds the limit, prompt the user: "12 GLB files changed. Open diffs for all? [y/N/pick]" where "pick" lets them choose which files to diff. The `--no-prompt` flag skips the prompt and opens all (for scripted use).

**Install for a repo:**

```bash
# Option A: one-time manual install
cp node_modules/.bin/diffglb-hook .git/hooks/post-commit
chmod +x .git/hooks/post-commit

# Option B: auto-install via package.json (recommended)
{
  "scripts": {
    "prepare": "npx diffglb install-hook"
  }
}
```

**CLI flags:**

```
npx diffglb --a <file> --b <file>     # compare two files
npx diffglb --headless                 # render to PNG, no browser (used by CI)
npx diffglb --max-files <n>            # max files before prompting (default 3)
npx diffglb --no-prompt                # skip batch prompt, open all
npx diffglb install-hook               # write post-commit hook to .git/hooks/
npx diffglb uninstall-hook             # remove hook
```

### Tier 2: CI pipeline via GitHub Actions (2 to 3 days)

A reusable workflow file that teams drop into `.github/workflows/glb-diff.yml`. Triggers on any PR that touches `.glb` files. Runs diffglb headlessly via Playwright, uploads artifacts, and posts a bot comment to the PR.

**Correct base comparison for PRs.** Do not use `HEAD~1` with `fetch-depth: 2`. That breaks on merge commits and squash merges where `HEAD~1` is not the PR base. Use the PR event's base and head SHAs (`github.event.pull_request.base.sha` and `github.sha`) with `fetch-depth: 0`, which correctly compares the PR branch to its target regardless of merge strategy:

**`glb-diff.yml`:**

```yaml
name: GLB visual diff
on:
  pull_request:
    paths: ["**.glb"]

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history for accurate base comparison

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install diffglb + Playwright
        run: |
          npm install -g diffglb
          npx playwright install chromium --with-deps

      - name: Find changed GLB files
        id: changed
        run: |
          BASE_SHA=${{ github.event.pull_request.base.sha }}
          HEAD_SHA=${{ github.sha }}
          FILES=$(git diff --diff-filter=M --name-only "$BASE_SHA" "$HEAD_SHA" -- '*.glb' | tr '\n' ' ')
          ADDED=$(git diff --diff-filter=A --name-only "$BASE_SHA" "$HEAD_SHA" -- '*.glb' | tr '\n' ' ')
          echo "files=$FILES" >> $GITHUB_OUTPUT
          echo "added=$ADDED" >> $GITHUB_OUTPUT

      - name: Run headless diff
        if: steps.changed.outputs.files != ''
        run: |
          BASE_SHA=${{ github.event.pull_request.base.sha }}
          for f in ${{ steps.changed.outputs.files }}; do
            git show "$BASE_SHA:$f" > /tmp/prev.glb || continue
            git show HEAD:"$f" > /tmp/curr.glb
            npx diffglb --a /tmp/prev.glb --b /tmp/curr.glb \
              --headless \
              --out ./diff-output/$(basename $f .glb)
          done

      - name: Upload diff artifacts
        uses: actions/upload-artifact@v4
        with:
          name: glb-diffs
          path: diff-output/

      - name: Post PR comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let body = '## GLB visual diff\n\n';

            // Report newly added files (no diff possible)
            const added = '${{ steps.changed.outputs.added }}'.trim();
            if (added) {
              body += '**New files (no previous version to diff):** ' + added + '\n\n';
            }

            // Report modified files with diffs
            if (fs.existsSync('diff-output')) {
              const files = fs.readdirSync('diff-output');
              for (const dir of files) {
                body += `### ${dir}\n`;
                body += `| angle | diff |\n|---|---|\n`;
                for (const angle of ['front','back','left','right','top','34']) {
                  const img = `diff-output/${dir}/${angle}.png`;
                  if (fs.existsSync(img)) {
                    const b64 = fs.readFileSync(img).toString('base64');
                    body += `| ${angle} | ![${angle}](data:image/png;base64,${b64}) |\n`;
                  }
                }
                const stats = JSON.parse(fs.readFileSync(`diff-output/${dir}/stats.json`));
                body += `\n**Vertices:** ${stats.vertexDelta > 0 ? '+' : ''}${stats.vertexDelta} &nbsp; `;
                body += `**Triangles:** ${stats.triangleDelta > 0 ? '+' : ''}${stats.triangleDelta} &nbsp; `;
                body += `**Materials changed:** ${stats.materialsModified}\n\n`;
              }
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

**Key changes from original workflow:**

- `fetch-depth: 0` (full history) instead of `fetch-depth: 2`, because the PR base SHA may not be exactly one commit behind HEAD.
- Uses `github.event.pull_request.base.sha` and `github.sha` instead of `HEAD~1` and `HEAD`. This correctly handles merge commits, squash merges, and rebased branches.
- Uses `--diff-filter=M` to only diff _modified_ files. Newly added files (`--diff-filter=A`) have no previous version and are reported separately in the PR comment.
- Adds `|| continue` after `git show` to gracefully skip files that somehow cannot be extracted (edge case with renames).

**Headless output format** (`--out <dir>` writes):

```
<dir>/
  front.png       # pixel diff overlay, 1024x1024
  back.png
  left.png
  right.png
  top.png
  34.png          # 3/4 angle
  stats.json      # { vertexDelta, triangleDelta, materialsAdded, materialsRemoved, materialsModified, ... }
```

### Tier 3: GitHub App with inline PR viewer (1+ week)

A GitHub App that registers as a rich diff renderer for `.glb` files. Reviewers see the full interactive diffglb viewer embedded directly in the PR's "Files changed" tab, not as a bot comment or artifact download, but a live Three.js viewer where the binary blob used to say "Binary files differ."

**How it works:**

1. The app registers a `content_reference` webhook for the `.glb` extension in its GitHub App manifest.
2. When GitHub renders a PR that contains a changed `.glb`, it calls the app's webhook with the blob URLs for both the base and head versions.
3. The app's server fetches both blobs from the GitHub Contents API using the installation token, stores them temporarily (TTL: 10 minutes), and returns a signed iframe URL.
4. GitHub renders that iframe inline in the diff view. The iframe loads the full diffglb viewer (the same Next.js app) with the two blobs pre-loaded via URL params.
5. The viewer runs entirely client-side inside the iframe. Blobs are passed as signed short-lived URLs, never stored permanently.

**App manifest (`app-manifest.json`):**

```json
{
  "name": "diffglb",
  "description": "Visual diff for GLB 3D model files in pull requests",
  "url": "https://diffglb.app",
  "hook_attributes": { "url": "https://diffglb.app/api/webhook" },
  "default_permissions": {
    "contents": "read",
    "pull_requests": "read"
  },
  "default_events": ["content_reference"],
  "content_references": [{ "type": "file_extension", "value": "glb" }]
}
```

**Webhook handler (`/api/webhook`):**

```typescript
// POST /api/webhook
export async function POST(req: Request) {
  const payload = await req.json();
  if (payload.action !== "created") return new Response("ok");

  const { content_reference, installation } = payload;
  const token = await getInstallationToken(installation.id);

  // Fetch both blob URLs from GitHub Contents API
  const baseUrl = content_reference.reference.base_blob_url;
  const headUrl = content_reference.reference.head_blob_url;

  // Store blobs temporarily, return signed iframe URL
  const sessionId = await storeBlobUrls({ baseUrl, headUrl, token, ttl: 600 });

  await createContentAttachment(installation.id, content_reference.id, {
    title: "GLB visual diff",
    body: `[View interactive diff](https://diffglb.app/view/${sessionId})`,
  });

  return new Response("ok");
}
```

**Viewer route (`/view/[sessionId]`):**
The existing Next.js app gains a route that accepts `sessionId`, fetches the two signed blob URLs from the session store, loads them as ArrayBuffers, and pre-populates the Zustand store, skipping the upload step entirely and dropping the user directly into the diff view.

---

## Stretch goals (in priority order)

1. **Diff region clustering:** Group adjacent changed pixels into numbered bounding-box callouts
2. **Animation comparison:** Sync-play animations in both models, pixel diff per frame
3. **Vertex displacement heatmap:** Per-vertex distance mapping for models with matching topology only
4. **Downloadable diff report:** Static HTML with embedded screenshots and stats
5. **USD support:** Only if MVP is fully polished

_Note: "Multi-angle gallery" was promoted from stretch goals to MVP as the "all angles" mode._

---

## Critical implementation gotchas

These are the things an AI coding agent (or a human in a hurry) will get wrong without explicit guidance. Every one of these has been observed as a silent failure in practice:

1. **WebIO, not NodeIO.** gltf-transform's `NodeIO` uses Node.js `fs` and crashes in the browser. Use `WebIO` for all client-side parsing.
2. **`preserveDrawingBuffer: true`** on the WebGLRenderer or `toDataURL()` / `getImageData()` returns blank.
3. **OrbitControls import path:** `three/addons/controls/OrbitControls.js`, not from the main `three` package.
4. **Render loop required even for static models.** OrbitControls needs continuous `renderer.render()` calls to reflect camera changes.
5. **Camera auto-framing:** Compute bounding box with `new THREE.Box3().setFromObject(scene)`, get sphere radius, set camera distance to `radius / Math.sin(fov/2)`.
6. **Offscreen renders must normalize both models.** Center both at world origin (translate by negative bounding box center), then use the same camera distance for both, calculated from the _larger_ bounding sphere. Without centering, different pivot offsets produce false positional diffs.
7. **Ghost overlay requires normalization too.** The same centering + shared camera distance logic from gotcha 6 applies to the overlay viewport. Without it, models with different pivots appear offset and the overlay is meaningless.
8. **Ghost overlay material tinting.** Clone materials before tinting. Do not mutate the originals. Otherwise toggling away from overlay mode leaves the models tinted in every other view.
9. **GLB only.** Do not accept .gltf files. A .gltf references external .bin and texture files; if those are missing, the model half-loads or crashes. GLB is self-contained.
10. **Headless rendering in CI requires `preserveDrawingBuffer: true` and a real GPU context.** Playwright's `--enable-webgl` flag is required. Software rasterization (SwiftShader) is fast enough for 1024x1024 at 6 angles.
11. **ArrayBuffer cloning for dual parse.** GLTFLoader and gltf-transform's WebIO both need to read the same ArrayBuffer. Clone it with `buffer.slice(0)` before passing to the second parser. If either parser neuters the buffer via transferable messaging, the other will receive an empty buffer and silently produce an empty scene.
12. **Dispose all mesh subtypes.** The cleanup function must handle `SkinnedMesh`, `InstancedMesh`, `Line`, `Points`, and any other `Object3D` subtype that carries geometry or materials. Checking only `instanceof THREE.Mesh` misses skinned meshes from character models (very common in game engine GLB exports) and causes GPU memory leaks.
13. **WebGL context loss recovery.** Register `webglcontextlost` and `webglcontextrestored` handlers on every canvas. Without this, GPU driver resets or tab backgrounding leave users with a permanent black canvas and no recovery path.
14. **Draco decoder version compatibility.** The pinned CDN URL for Draco decoders must stay compatible with the Three.js version in `package.json`. Check the Three.js changelog when upgrading. A version mismatch causes silent decode failures (empty geometry, no errors in console).
15. **Worker buffer neutering.** After `self.postMessage(data, [diff.buffer])` transfers the buffer, the worker's `diff` variable becomes neutered. Each invocation (e.g., from the tolerance slider) must allocate a fresh `Uint8ClampedArray`. Reusing a neutered array produces zero-length reads and blank diff output.

---

## Test models

Use Khronos glTF sample models (DamagedHelmet, BoxAnimated, etc.) from `https://github.com/KhronosGroup/glTF-Sample-Assets`. Write a small script under `scripts/` that loads a sample .glb with gltf-transform, shifts a node or changes a material color, and saves a modified copy. Use this script to create controlled before/after pairs. Test against real files early; do not defer testing until integration.

**Required test cases:**

- Two versions with material changes only (no geometry change)
- Two versions with geometry changes only (no material change)
- Two versions with different pivot/origin positions (tests normalization)
- Two identical files (tests "no differences found" state)
- A file with skinned meshes (tests disposal of SkinnedMesh)
- A large file (~50MB) to test loading states and performance

---

Demo script lives in [`DEMO.md`](./DEMO.md).

---

## Deploy

Vercel. Zero config for Next.js. No env vars needed for the web app.

The GitHub App (Tier 3) requires a separate deployment with a server component. A lightweight Express or Next.js API route handler is sufficient. Needs `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, and `SESSION_SECRET` as env vars. Blob sessions can be stored in Redis (Upstash works on Vercel) with a 10-minute TTL.

