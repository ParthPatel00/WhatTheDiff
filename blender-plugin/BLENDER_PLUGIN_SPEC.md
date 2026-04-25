# WhatTheDiff — Blender Plugin Spec

## What this is

A Blender add-on that lets artists visually diff two `.glb` files without leaving Blender. Five comparison modes that mirror the web app exactly: **side-by-side** (two synced 3D viewports), **ghost overlay** (both models in one viewport, red = removed, green = added), **pixel diff** (rendered red highlights on changed pixels), **turntable** (auto-rotating side-by-side), and **all angles** (2×3 grid of 6 angles with per-angle change percentages). A persistent stats panel shows structural deltas (vertices, triangles, materials, bounding box, animations) at all times.

**GLB only.** Same constraint as the web app: `.gltf` with external files is not supported. GLB is self-contained.

No cloud. No server. Everything runs locally inside Blender's Python runtime.

---

## Why a Blender plugin, not just the web app

Artists already have Blender open. A plugin means:

- Zero context switching — diff without opening a browser
- Access to Blender's actual render engine (Eevee / Cycles) for pixel diff renders instead of a WebGL approximation
- Native file browser integration — pick files from the OS dialog instead of dragging into a browser tab
- Works offline on a studio network with no internet access
- Can diff files that are already open in Blender, not just files on disk

---

## Tech stack

- **Python 3.10+** (Blender's embedded interpreter, no pip installs required at runtime)
- **`bpy`** — Blender's Python API for scene manipulation, rendering, and UI panels
- **`mathutils`** — bounding box and matrix math
- **`io_scene_gltf2`** — Blender's built-in glTF importer (already ships with Blender 3.3+)
- **`PIL` / `numpy`** — pixel diff computation (bundled with the add-on as a vendor dependency since Blender's Python does not guarantee these)
- **Blender 3.6 LTS or 4.x** — minimum supported version

All rendering uses Blender's built-in Eevee engine (fast, GPU-accelerated, no extra setup). Cycles is opt-in for higher-fidelity pixel diff renders.

---

## Architecture

```
whatthe_diff/
├── __init__.py                  # Add-on entry point, bl_info, register/unregister
├── operators/
│   ├── load_models.py           # OT_LoadModelA, OT_LoadModelB — file picker ops
│   ├── side_by_side.py          # OT_SideBySideView — split viewport setup
│   ├── ghost_overlay.py         # OT_GhostOverlayView — material tinting + blending
│   ├── pixel_diff.py            # OT_PixelDiffView — offscreen render + pixel compare
│   ├── turntable.py             # OT_TurntableView — animation handler for auto-rotate
│   ├── all_angles.py            # OT_AllAnglesView — 6-angle render grid
│   └── reset.py                 # OT_ResetDiff — cleanup all diff state
├── panels/
│   ├── main_panel.py            # PT_WhatTheDiff — main N-panel sidebar
│   ├── stats_panel.py           # PT_StatsPanel — persistent structural diff sidebar
│   └── controls_panel.py        # PT_DiffControls — tolerance/opacity sliders, mode buttons
├── lib/
│   ├── model_loader.py          # Import GLB into a named collection, return metadata
│   ├── structural_diff.py       # Compare mesh/material/node counts between two collections
│   ├── pixel_diff.py            # Render both models offscreen, compare pixel arrays
│   ├── camera_presets.py        # 6 predefined camera angles (front/back/left/right/top/34)
│   ├── material_tint.py         # Clone + tint materials without mutating originals
│   ├── cleanup.py               # Remove collections, meshes, materials, textures from scene
│   └── types.py                 # Dataclasses: DiffResult, StructuralDelta, AngleResult
├── vendor/
│   ├── numpy/                   # Bundled numpy for pixel math
│   └── PIL/                     # Bundled Pillow for image I/O
└── icons/
    └── wtd_icon.png
```

---

## Add-on registration (`bl_info`)

```python
bl_info = {
    "name": "WhatTheDiff",
    "author": "WhatTheDiff Team",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > WhatTheDiff",
    "description": "Visual diff for GLB 3D model files",
    "category": "3D View",
}
```

All operators register with the prefix `WHATTHEFIELD_OT_` and panels with `WHATTHEFIELD_PT_`. This avoids collisions with other add-ons.

---

## MVP Features

### 1. Dual file load

Two file picker buttons in the N-panel sidebar: **Load Model A** and **Load Model B**. Uses `bpy.ops.wm.open_dialog` (file browser). Each button triggers a `FILE_OT_select` operator that calls `bpy.ops.import_scene.gltf()` with the chosen file path.

Each model is imported into its own named collection:
- `WTD_ModelA` — original model
- `WTD_ModelB` — modified model

Both collections are created hidden by default. The active view mode controls which collections are shown.

**File validation:**
- Reject non-`.glb` extensions with a modal error popup
- Warn (non-blocking) if file size > 50 MB
- Reject if file size > 500 MB (Blender can handle larger files than a browser)

**Thumbnail preview:** After import, render a quick Eevee thumbnail (128×128) and display it in the panel next to the file name using `bpy.types.UILayout.template_preview`.

**Loading state:** Show a progress bar in the panel during import using `wm.progress_begin` / `wm.progress_update` / `wm.progress_end`.

**Identical file detection:** After both models load, compare structural data. If vertex count, triangle count, bounding box, and material hashes are all identical, display "No differences found" with a checkmark in the panel.

**Replace behavior:** If a model is already loaded, call `cleanup.remove_collection("WTD_ModelA")` before re-importing. Do not accumulate stale objects in the scene.

---

### 2. Side-by-side view

Split the active 3D viewport into two vertical halves using the Blender area split API:

```python
# operator invoke
bpy.ops.screen.area_split(direction='VERTICAL', factor=0.5)
```

Left viewport shows `WTD_ModelA`, right viewport shows `WTD_ModelB`. Each viewport gets its own camera (auto-framed on the model's bounding sphere).

**Camera sync (locked by default):** A `bpy.app.handlers.depsgraph_update_post` handler copies `view_matrix` from the active (left) viewport to the passive (right) viewport on every update. A **Lock/Unlock** toggle button in the controls panel disables the sync handler so each viewport orbits independently.

**Keyboard shortcut:** `S` key toggles the sync lock when the cursor is in the 3D viewport area and WhatTheDiff mode is active.

**Auto-framing:** On load, set each viewport's `view_location` to the model's bounding box center and `view_distance` to `bounding_sphere_radius / sin(fov/2)`.

**Lighting:** Add a shared world light (ambient 0.5) + sun lamp (strength 1.0) to both collections on load if no lights exist in the scene.

---

### 3. Ghost overlay mode

Both models are placed in the same viewport. Materials on `WTD_ModelA` are cloned and tinted red (`(1.0, 0.31, 0.31, 1.0)` in linear color space). Materials on `WTD_ModelB` are cloned and tinted green (`(0.31, 0.86, 0.39, 1.0)`).

**Blending:** Use Blender's `Material.blend_method = 'BLEND'` and set `Material.alpha_threshold`. Add an Eevee transparent BSDF node mixed with the tinted Principled BSDF at the configured opacity. Set `Material.show_transparent_back = False` to prevent Z-fighting artifacts.

**Material tinting implementation:**

```python
def tint_material(original: bpy.types.Material, color: tuple, opacity: float) -> bpy.types.Material:
    clone = original.copy()
    clone.name = f"{original.name}_WTD_tint"
    clone.use_nodes = True
    nodes = clone.node_tree.nodes
    links = clone.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Alpha"].default_value = opacity

    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    clone.blend_method = "BLEND"
    return clone
```

**Opacity slider:** Default 0.50, range 0.20–0.90. Changing the slider value calls `tint_material` again with the new opacity and reassigns materials in-place.

**Normalization:** Center both models at world origin before compositing (same as pixel diff). Use the larger bounding sphere to position the camera.

**Legend strip:** Below the viewport controls, draw colored rectangles with labels using `layout.label` + `layout.prop` colored icons: red = "only in v1", green = "only in v2", neutral = "overlap (mixed tone)".

**Colorblind-safe mode:** A toggle in the panel switches the tint pair to blue (`(0.31, 0.51, 1.0)`) and orange (`(1.0, 0.65, 0.0)`).

---

### 4. Pixel diff mode

Render both models from 6 predefined camera angles into offscreen images at 1024×1024, then compare pixel arrays.

**Camera angles (same as web app):**

```python
CAMERA_PRESETS = {
    "front":  {"location": (0, -3, 0),  "rotation": (90, 0, 0)},
    "back":   {"location": (0,  3, 0),  "rotation": (90, 0, 180)},
    "left":   {"location": (-3, 0, 0),  "rotation": (90, 0, -90)},
    "right":  {"location": ( 3, 0, 0),  "rotation": (90, 0, 90)},
    "top":    {"location": (0,  0, 3),  "rotation": (0,  0, 0)},
    "34":     {"location": (2, -2, 1.5),"rotation": (65, 0, 45)},
}
```

**Offscreen render pipeline:**

```python
import bpy, bgl, numpy as np

def render_angle(scene, angle_name: str, model_collection) -> np.ndarray:
    # Position camera from presets
    cam = setup_camera(angle_name, model_collection)
    scene.camera = cam
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.filepath = f"/tmp/wtd_{angle_name}.png"
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(scene.render.filepath)
    pixels = np.array(img.pixels[:]).reshape(1024, 1024, 4)
    bpy.data.images.remove(img)
    return pixels
```

**Pixel comparison:**

```python
def compute_diff(pixels_a: np.ndarray, pixels_b: np.ndarray, tolerance: int) -> tuple[np.ndarray, float]:
    diff_rgb = np.abs(pixels_a[:,:,:3] - pixels_b[:,:,:3])
    changed_mask = diff_rgb.sum(axis=2) > (tolerance * 3 / 255.0)
    diff_image = pixels_a.copy()
    diff_image[changed_mask] = [1.0, 0.0, 0.0, 0.78]  # red highlight
    diff_image[~changed_mask, 3] = 0.31                 # dim unchanged
    pct = changed_mask.sum() / (1024 * 1024) * 100
    return diff_image, pct
```

**Render cache:** Cache the 6 rendered `np.ndarray` images for each model. Only re-render when a new file is loaded. Tolerance slider changes re-run `compute_diff` only (fast, no re-render).

**Render normalization:** Before rendering, center both models at world origin (apply inverse of bounding box center as object offset). Use the larger bounding sphere radius to set the camera distance for both renders. Apply this normalization temporarily (restore original transforms after render).

**Display:** After computing all 6 diffs, the results are shown as image previews in the panel using `bpy.types.UILayout.template_image`. The active angle can be cycled with left/right arrow keys.

**Progress feedback:** Show "Rendering 1/6… 2/6…" in the panel status label during the render pass.

---

### 5. All angles mode

Identical to pixel diff mode but displays all 6 angle results simultaneously as a 2×3 grid in the panel. Each cell shows:

- The diff overlay image (128×128 thumbnail from the 1024×1024 cached render)
- The angle name label
- The change percentage

Clicking any cell expands it to a full-size overlay popup (`bpy.types.WindowManager.invoke_popup`).

The tolerance slider applies to all 6 cells simultaneously (same render cache, re-run `compute_diff` for all 6 angles on slider change).

---

### 6. Turntable mode

Auto-rotates both models around the world Z axis in sync. Implemented as a modal operator with a timer:

```python
class OT_TurntableView(bpy.types.Operator):
    bl_idname = "whatthefield.turntable_view"
    bl_label = "Turntable"

    _timer = None
    _angle = 0.0

    def modal(self, context, event):
        if event.type == 'TIMER':
            self._angle += 1.0  # degrees per frame
            for col_name in ("WTD_ModelA", "WTD_ModelB"):
                col = bpy.data.collections.get(col_name)
                if col:
                    for obj in col.objects:
                        obj.rotation_euler.z = math.radians(self._angle)
            context.area.tag_redraw()
        if event.type == 'ESC':
            return self.cancel(context)
        return {'PASS_THROUGH'}

    def execute(self, context):
        self._timer = context.window_manager.event_timer_add(1/60, window=context.window)
        context.window_manager.modal_handler_add(self)
        return {'RUNNING_MODAL'}

    def cancel(self, context):
        context.window_manager.event_timer_remove(self._timer)
        return {'CANCELLED'}
```

Speed is configurable (default 1°/frame). The two viewports from side-by-side mode remain active during turntable.

---

### 7. Structural diff stats panel

Always-visible panel in the N-panel sidebar showing:

| Property | Model A | Model B | Delta |
|---|---|---|---|
| Vertices | 12,450 | 13,100 | +650 |
| Triangles | 24,300 | 25,800 | +1,500 |
| Materials | 3 | 4 | +1 |
| Objects | 5 | 5 | 0 |
| Animations | 2 | 2 | 0 |
| Bounding Box | 1.2×0.8×2.1 | 1.2×0.8×2.2 | +0.1 Z |

Color coding: green = added, red = removed, yellow = modified. Implemented with `layout.label(text=..., icon='ADD')` etc.

**Material-level diff:** Expand/collapse list of material changes. For each modified material: show which properties changed (base color, roughness, metalness, emission).

**Computed once on load** using `structural_diff.py`. Not recomputed on tolerance/opacity slider changes.

---

### 8. View mode controls

Five mode buttons in the controls panel: **Side-by-Side**, **Ghost Overlay**, **Pixel Diff**, **Turntable**, **All Angles**.

**Keyboard shortcuts** (active when cursor is in 3D View and WTD is running):
- `1` → Side-by-side
- `2` → Ghost overlay
- `3` → Pixel diff
- `4` → Turntable
- `5` → All angles
- `S` → Toggle camera sync lock (side-by-side only)
- `←` / `→` → Step through 6 angles (pixel diff only)

**Conditional controls:**
- Side-by-side: show sync lock toggle, hide tolerance + opacity sliders
- Ghost overlay: show opacity slider, hide tolerance slider
- Pixel diff: show tolerance slider (0–50, default 10), hide opacity slider
- Turntable: hide both sliders
- All angles: show tolerance slider, hide opacity slider

**Mode switching cleanup:** Each mode transition calls a cleanup function that hides unused collections, removes temp lights, and cancels any running modal operators (turntable timer) before setting up the new mode.

---

### 9. Accessibility

**Colorblind-safe mode toggle:** Stored as an add-on preference (`bpy.types.AddonPreferences`). Persists across sessions. When enabled:
- Ghost overlay tints: blue `(0.31, 0.51, 1.0)` and orange `(1.0, 0.65, 0.0)` instead of red/green
- Pixel diff highlights: blue instead of red for changed pixels
- Stats panel delta labels: blue for removed, orange for added

**Tooltips:** All operator buttons and sliders have `bl_description` set. Blender automatically shows these on hover.

**Screen reader:** Blender's UI is not accessible to screen readers in the traditional sense. Ensure all panel label text is descriptive (avoid icon-only labels).

---

## Add-on Preferences

Accessed via `Edit > Preferences > Add-ons > WhatTheDiff`:

```python
class WTD_AddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    colorblind_mode: bpy.props.BoolProperty(
        name="Colorblind-Safe Colors",
        description="Use blue/orange instead of red/green for diff highlights",
        default=False,
    )
    render_engine: bpy.props.EnumProperty(
        name="Pixel Diff Render Engine",
        items=[("BLENDER_EEVEE", "Eevee (Fast)", ""), ("CYCLES", "Cycles (High Quality)", "")],
        default="BLENDER_EEVEE",
    )
    max_file_size_mb: bpy.props.IntProperty(
        name="Max File Size (MB)",
        default=500,
        min=50,
        max=2000,
    )
    turntable_speed: bpy.props.FloatProperty(
        name="Turntable Speed (°/frame)",
        default=1.0,
        min=0.1,
        max=10.0,
    )
```

---

## State management

All plugin state is stored on a single `PropertyGroup` attached to `bpy.types.Scene`:

```python
class WTD_State(bpy.types.PropertyGroup):
    model_a_path: bpy.props.StringProperty()
    model_b_path: bpy.props.StringProperty()
    active_mode: bpy.props.EnumProperty(
        items=[
            ("SIDE_BY_SIDE", "Side-by-Side", ""),
            ("GHOST_OVERLAY", "Ghost Overlay", ""),
            ("PIXEL_DIFF", "Pixel Diff", ""),
            ("TURNTABLE", "Turntable", ""),
            ("ALL_ANGLES", "All Angles", ""),
        ],
        default="SIDE_BY_SIDE",
    )
    tolerance: bpy.props.IntProperty(default=10, min=0, max=50)
    opacity: bpy.props.FloatProperty(default=0.50, min=0.20, max=0.90)
    sync_cameras: bpy.props.BoolProperty(default=True)
    models_loaded: bpy.props.BoolProperty(default=False)
    diff_computed: bpy.props.BoolProperty(default=False)
    no_differences: bpy.props.BoolProperty(default=False)
```

Access via `context.scene.wtd`.

---

## Cleanup

**`cleanup.py`** is responsible for removing all WTD objects from the scene on reset or unregister:

```python
def full_cleanup():
    # Remove collections
    for name in ("WTD_ModelA", "WTD_ModelB"):
        col = bpy.data.collections.get(name)
        if col:
            for obj in col.objects:
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.collections.remove(col)

    # Remove tinted materials
    for mat in bpy.data.materials:
        if "_WTD_tint" in mat.name:
            bpy.data.materials.remove(mat)

    # Remove temp render images
    for img in bpy.data.images:
        if img.name.startswith("wtd_"):
            bpy.data.images.remove(img)

    # Remove WTD cameras and lights
    for obj in bpy.data.objects:
        if obj.name.startswith("WTD_"):
            bpy.data.objects.remove(obj, do_unlink=True)
```

Called by `OT_ResetDiff` and by the add-on's `unregister()` function.

---

## Installation

Distributed as a `.zip` file. Install via `Edit > Preferences > Add-ons > Install` and browse to the zip. The zip includes all vendor dependencies (numpy, PIL) bundled under `vendor/`.

```
whatthefield-blender-v1.0.0.zip
└── whatthefield/
    ├── __init__.py
    ├── operators/
    ├── panels/
    ├── lib/
    ├── vendor/
    └── icons/
```

**No internet access required.** All dependencies are bundled.

---

## Critical implementation gotchas

1. **Use `io_scene_gltf2` operator, not a custom importer.** Blender's built-in glTF importer handles Draco compression, KTX2 textures, and skinned meshes correctly. Do not reimplement GLB parsing in Python.
2. **`bpy.ops` context requirements.** Many operators (area split, render) require a specific context (`INVOKE_DEFAULT` vs `EXEC_DEFAULT`). Use `bpy.ops.render.render(write_still=True)` from a non-modal operator context. Calling it from a panel `draw()` function will crash.
3. **Render normalization before pixel diff.** Temporarily translate models to world origin, render, then restore. Do not apply transforms permanently. Use `obj.matrix_world` manipulation, not `obj.location` directly, to preserve parent relationships.
4. **Clone materials before tinting.** `original.copy()` in `tint_material()`. Mutating originals leaves the scene permanently tinted after mode switch.
5. **`bpy.data.images` cleanup.** Blender accumulates render result images in memory. Every offscreen render call must be followed by `bpy.data.images.remove(img)` after the pixel data is captured.
6. **Area split context.** `bpy.ops.screen.area_split()` requires the operator context to have a valid `area` of type `VIEW_3D`. Always override context: `bpy.ops.screen.area_split({"area": vtd_area}, direction='VERTICAL', factor=0.5)`.
7. **Handler cleanup on unregister.** All `bpy.app.handlers` registered by the add-on must be removed in `unregister()`. Stale handlers persist across Blender sessions and cause AttributeErrors on properties that no longer exist.
8. **Turntable modal operator.** The modal operator must return `{'PASS_THROUGH'}` (not `{'RUNNING_MODAL'}`) to allow normal Blender interaction while the turntable runs. `{'RUNNING_MODAL'}` blocks all other input.
9. **Numpy not guaranteed in Blender's Python.** Bundle numpy under `vendor/` and prepend it to `sys.path` in `__init__.py`. Do not `import numpy` at module level — wrap in a try/except and show a user-friendly error if missing.
10. **Eevee vs Cycles for headless.** Eevee requires a display context; in a fully headless environment (e.g., `blender --background`), use Cycles with `--cycles-device CPU`. Document this as a known limitation.
11. **Bounding box after applying modifiers.** `obj.bound_box` gives the bounding box in local space before modifiers. Use `depsgraph = bpy.context.evaluated_depsgraph_get(); obj_eval = obj.evaluated_get(depsgraph); bbox = obj_eval.bound_box` for correct post-modifier bounds.
12. **Identical file detection timing.** Run the structural comparison after both models have fully loaded (i.e., at the end of the second model's import operator). Do not run it during `draw()`.

---

## Stretch goals (in priority order)

1. **Diff region callouts:** Cluster adjacent changed pixels into numbered bounding box overlays in the 3D viewport
2. **Animation comparison:** Sync-play animations from both models, pixel diff per keyframe
3. **Vertex displacement heatmap:** Per-vertex distance heatmap using Blender's vertex color layer (matching topology only)
4. **Export diff report:** Save a PDF/HTML with screenshots and structural stats
5. **Blender Git integration:** Add a `git post-commit` hook launcher directly from the add-on preferences (shell out to the same CLI as the web app's Tier 1 integration)
6. **Live reload:** Watch file paths for changes on disk and auto-reload models (useful when an export pipeline is running)

---

## Test models

Use Khronos glTF sample models (DamagedHelmet, BoxAnimated, Fox) from `https://github.com/KhronosGroup/glTF-Sample-Assets`. Generate controlled before/after pairs using `gltf-transform` CLI.

**Required test cases:**
- Material changes only (no geometry change)
- Geometry changes only (no material change)
- Different pivot/origin positions (tests render normalization)
- Two identical files (tests "No differences found" state)
- A file with skinned meshes (tests `SkinnedMesh` import and cleanup)
- A large file (~100MB) to test loading states and panel responsiveness
- A file with animations (tests animation count delta in stats panel)

---

## Feature parity with web app

| Feature | Web App | Blender Plugin |
|---|---|---|
| GLB-only input | ✅ | ✅ |
| Side-by-side view | ✅ | ✅ (native area split) |
| Camera sync lock/unlock | ✅ | ✅ (depsgraph handler) |
| Ghost overlay | ✅ | ✅ (material node tinting) |
| Pixel diff (6 angles) | ✅ | ✅ (Eevee render) |
| Turntable mode | ✅ | ✅ (modal timer op) |
| All angles (2×3 grid) | ✅ | ✅ (panel image grid) |
| Tolerance slider | ✅ | ✅ |
| Opacity slider | ✅ | ✅ |
| Structural diff stats | ✅ | ✅ |
| Material-level diff | ✅ | ✅ |
| Colorblind-safe mode | ✅ | ✅ (addon prefs) |
| Keyboard shortcuts | ✅ | ✅ |
| Identical file detection | ✅ | ✅ |
| Loading progress | ✅ | ✅ (wm.progress_*) |
| No cloud / fully local | ✅ | ✅ |
| Git integration | ✅ (Tier 1–3) | Stretch goal |
