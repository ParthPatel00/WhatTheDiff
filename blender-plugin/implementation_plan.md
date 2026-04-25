# WhatTheDiff Blender Plugin — Implementation Steps

> **The web app SPEC.md is the source of truth for all behavior.** If this plan and the web spec conflict, the web spec wins.

---

## Parity Acceptance Criteria

The plugin is only complete when it matches the web app on every item below.

| # | Behavior | Module | Verified |
|---|---|---|---|
| P1 | GLB-only input, reject .gltf | `operators/load_models.py` | ☐ |
| P2 | Dual file load with size warnings | `operators/load_models.py` | ☐ |
| P3 | Side-by-side, locked camera sync by default | `operators/side_by_side.py` | ☐ |
| P4 | Sync unlock → independent orbit | `lib/camera_sync.py` | ☐ |
| P5 | Re-lock → cameras realign | `lib/camera_sync.py` | ☐ |
| P6 | Ghost overlay: red v1, green v2, overlap = mixed tone | `lib/material_tint.py` | ☐ |
| P7 | Ghost overlay default opacity 0.50 | `lib/colors.py` | ☐ |
| P8 | Clone materials before tinting (originals untouched) | `lib/material_tint.py` | ☐ |
| P9 | Pixel diff: 6 angles, 1024×1024 | `lib/pixel_diff.py` | ☐ |
| P10 | Tolerance slider → no re-render, only re-diff | `lib/pixel_diff.py` | ☐ |
| P11 | New file load → render cache invalidated | `lib/pixel_diff.py` | ☐ |
| P12 | All angles reuses same pixel diff cache | `panels/controls_panel.py` | ☐ |
| P13 | Structural stats always visible across all modes | `panels/stats_panel.py` | ☐ |
| P14 | Stats: vertex, triangle, bbox, material, object, anim deltas | `lib/structural_diff.py` | ☐ |
| P15 | Material-level diff (base color, roughness, metalness) | `lib/structural_diff.py` | ☐ |
| P16 | Identical file → "No differences found" state | `operators/load_models.py` | ☐ |
| P17 | Colorblind toggle affects overlay + pixel diff + stats + legend | `lib/colors.py` | ☐ |
| P18 | Keyboard shortcuts 1–5, S, ←/→ | `__init__.py` | ☐ |
| P19 | Conditional controls per mode | `panels/controls_panel.py` | ☐ |
| P20 | Reset removes all WTD_* objects cleanly | `lib/cleanup.py` | ☐ |

---

## Naming Convention (fixed)

Use **`wtd`** everywhere. No exceptions.

| Thing | Correct name |
|---|---|
| Package directory | `wtd/` |
| Zip file | `wtd-blender-v1.0.0.zip` |
| Operator prefix | `wtd.load_model_a` |
| Class prefix | `WTD_OT_`, `WTD_PT_`, `WTD_MT_` |
| Scene property | `context.scene.wtd` |
| Collections | `WTD_ModelA`, `WTD_ModelB` |
| Cameras | `WTD_CamA`, `WTD_CamB` |
| bl_info name | `"WhatTheDiff"` (display name only) |

---

Build in strict phase order. Each phase produces something testable in Blender before moving on.

---

## Phase 0 — Environment setup (30 min)

### 0.1 Confirm Blender version
- Install **Blender 3.6 LTS** or **4.x** (both supported)
- Confirm Python version: open Blender's built-in Python console → `import sys; print(sys.version)`
- Should be Python 3.10+

### 0.2 Set up a dev reload workflow
- In Blender Preferences → Interface → enable **Developer Extras**
- Install the **Blender Development** VS Code extension (Jacqueslvv) — lets you reload the add-on with `Ctrl+Shift+P → Blender: Reload Addons` without restarting Blender
- Alternatively, add this snippet to Blender's scripting tab to enable hot-reload:

```python
import importlib, sys
def reload_addon(name):
    mods = [k for k in sys.modules if k.startswith(name)]
    for m in mods:
        del sys.modules[m]
    bpy.ops.preferences.addon_enable(module=name)
```

### 0.3 Bundle vendor dependencies
```bash
mkdir -p wtd/vendor
pip install numpy Pillow --target wtd/vendor --no-deps
```

Add to `__init__.py` (must be first before any other imports):
```python
import sys, os
vendor_path = os.path.join(os.path.dirname(__file__), "vendor")
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)
```

### 0.4 Create the directory scaffold
```
wtd/
├── __init__.py
├── operators/
│   ├── __init__.py
│   ├── load_models.py
│   ├── side_by_side.py
│   ├── ghost_overlay.py
│   ├── pixel_diff.py
│   ├── turntable.py
│   ├── all_angles.py
│   └── reset.py
├── panels/
│   ├── __init__.py
│   ├── main_panel.py
│   ├── stats_panel.py
│   └── controls_panel.py
├── lib/
│   ├── __init__.py
│   ├── model_loader.py
│   ├── structural_diff.py
│   ├── pixel_diff.py
│   ├── camera_presets.py
│   ├── material_tint.py
│   ├── camera_sync.py
│   ├── colors.py          ← NEW: single source of truth for all diff colors
│   ├── cleanup.py
│   └── types.py
├── vendor/
└── icons/
    └── wtd_icon.png
```

**Verify:** Zip the folder (`wtd-blender-v1.0.0.zip`), install via Preferences → Add-ons → Install, enable it. Should load with no errors.

---

## Phase 1 — Add-on skeleton + N-panel (1–2 hrs)

### 1.1 `__init__.py`

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

import bpy
from . import operators, panels
from .lib.types import WTD_State
from .lib import camera_sync

def register():
    bpy.utils.register_class(WTD_State)
    bpy.types.Scene.wtd = bpy.props.PointerProperty(type=WTD_State)
    operators.register()
    panels.register()
    register_keymaps()

def unregister():
    unregister_keymaps()
    camera_sync.unregister_sync()   # must happen before panels/operators
    panels.unregister()
    operators.unregister()
    del bpy.types.Scene.wtd
    bpy.utils.unregister_class(WTD_State)
```

### 1.2 `lib/colors.py` — centralized color constants (parity item P17)

All diff colors live here. Every operator and panel imports from this module. Nothing hardcodes a color literal.

```python
# Default: web app red/green scheme
COLOR_V1       = (1.0,  0.31, 0.31)   # red   — only in v1
COLOR_V2       = (0.31, 0.86, 0.39)   # green — only in v2
COLOR_DIFF_PX  = (1.0,  0.0,  0.0)   # pixel diff highlight

# Colorblind-safe: blue/orange scheme
COLOR_V1_CB    = (0.31, 0.51, 1.0)   # blue
COLOR_V2_CB    = (1.0,  0.65, 0.0)   # orange
COLOR_DIFF_CB  = (0.31, 0.51, 1.0)   # blue pixel highlight

DEFAULT_OPACITY = 0.50

def get_colors(colorblind: bool) -> dict:
    if colorblind:
        return {"v1": COLOR_V1_CB, "v2": COLOR_V2_CB, "diff_px": COLOR_DIFF_CB}
    return {"v1": COLOR_V1, "v2": COLOR_V2, "diff_px": COLOR_DIFF_PX}
```

### 1.3 `lib/types.py` — `WTD_State` PropertyGroup

All plugin state lives here:

```python
import bpy

class WTD_State(bpy.types.PropertyGroup):
    model_a_path:     bpy.props.StringProperty()
    model_b_path:     bpy.props.StringProperty()
    active_mode: bpy.props.EnumProperty(
        items=[
            ("SIDE_BY_SIDE",   "Side-by-Side",  ""),
            ("GHOST_OVERLAY",  "Ghost Overlay",  ""),
            ("PIXEL_DIFF",     "Pixel Diff",     ""),
            ("TURNTABLE",      "Turntable",      ""),
            ("ALL_ANGLES",     "All Angles",     ""),
        ],
        default="SIDE_BY_SIDE",
    )
    tolerance:        bpy.props.IntProperty(default=10, min=0, max=50)
    opacity:          bpy.props.FloatProperty(default=0.50, min=0.20, max=0.90)
    sync_cameras:     bpy.props.BoolProperty(default=True)
    models_loaded:    bpy.props.BoolProperty(default=False)
    diff_computed:    bpy.props.BoolProperty(default=False)
    no_differences:   bpy.props.BoolProperty(default=False)
    turntable_speed:  bpy.props.FloatProperty(
        name="Speed (°/frame)",
        default=1.0, min=0.1, max=10.0
    )  # session state, not a preference — lives here so it resets with the scene
```

### 1.3 Skeleton N-panel in `panels/main_panel.py`

- Category: `"WhatTheDiff"`, Space: `VIEW_3D`, Region: `UI`
- Draw "Load Model A" / "Load Model B" buttons (operators not wired yet — use `operator("wm.open_mainfile")` as placeholder)
- Draw 5 mode toggle buttons reading from `wtd.active_mode`

**Verify:** Press `N` in 3D viewport → WhatTheDiff tab appears.

---

## Phase 2 — File loading + structural diff + no-difference state (3–4 hrs)

### 2.1 `operators/load_models.py`

Two operators `OT_LoadModelA` and `OT_LoadModelB` — both subclass `bpy.types.Operator` and mix in `bpy.types.ImportHelper`.

Each operator's `execute()`:
1. Reject non-`.glb` with `self.report({'ERROR'}, ...)` → `return {'CANCELLED'}`
2. Warn if filesize > 50 MB; reject > 500 MB
3. Call `lib.cleanup.remove_collection("WTD_ModelA")`
4. Create collection, make it active
5. `bpy.ops.import_scene.gltf(filepath=self.filepath)`
6. Move all newly imported objects into `WTD_ModelA`
7. Store path in `wtd.model_a_path`
8. If both paths set:
   - Call `structural_diff.compute()`, set `wtd.models_loaded = True`
   - Call `pixel_diff.invalidate_cache()` (parity item P11)
   - Run identical-file check (parity item P16)

> **Gotcha:** After `import_scene.gltf`, newly imported objects are in `bpy.context.selected_objects`. Grab them immediately before calling anything else that changes selection.

### Identical-file detection (parity item P16 — first-class, not optional)

After both models load, compare:
- Total vertex count A == B
- Total triangle count A == B  
- Bounding box dimensions A == B (within float epsilon)
- All material names and property values identical

If all match: set `wtd.no_differences = True`. The stats panel and main panel both check this flag and show a "✓ No differences found" banner instead of diff controls. This prevents a blank-looking UI that confuses users who upload the same file twice.

**Parity requirement:** Show the banner. *(Optional UX — not a parity requirement: grey out mode buttons while no_differences is True. Implement only if the team explicitly wants it.)*

**Acceptance test:** Load DamagedHelmet.glb as both A and B → banner appears.

### 2.2 `lib/model_loader.py`

Helper functions:
- `ensure_collection(name)` → create or return collection, link to master
- `move_to_collection(objects, target_col)` → unlink from all, link to target
- `get_bounds(collection)` → returns `(center: Vector, radius: float)` using evaluated depsgraph

### 2.3 `lib/structural_diff.py`

```python
from dataclasses import dataclass

@dataclass
class StructuralDelta:
    vertex_a: int;   vertex_b: int
    tri_a: int;      tri_b: int
    obj_count_a: int; obj_count_b: int
    anim_count_a: int; anim_count_b: int
    mat_names_a: list; mat_names_b: list
    mats_added: list; mats_removed: list; mats_modified: list
    bbox_a: tuple;   bbox_b: tuple

_delta: StructuralDelta | None = None

def compute(col_a, col_b) -> StructuralDelta:
    global _delta
    # Count vertices, tris, materials, animations per collection
    # Compare material property values (base_color, roughness, metallic)
    _delta = StructuralDelta(...)
    return _delta

def get() -> StructuralDelta | None:
    return _delta
```

### 2.4 `panels/stats_panel.py`

Always-visible panel below mode buttons. Reads from `structural_diff.get()`. Draw a 4-column table: Property / A / B / Δ.

**Stats colorblind parity (P17):** Delta row colors must come from `lib/colors.py`, not hardcoded. Icons alone (`ADD`/`REMOVE`) are not sufficient — the row label text color must also switch. Use `layout.label` with a custom icon color driven by `colors.get_colors(prefs.colorblind_mode)`:
- Removed delta: red (default) or blue (colorblind)
- Added delta: green (default) or orange (colorblind)
- Modified: yellow in both modes

> **Blender API note:** Blender does not support arbitrary label text colors via the standard UI API. Use colored icon constants (`SEQUENCE_COLOR_01` through `_09`) as color indicators next to the label text. Map: red→`SEQUENCE_COLOR_01`, green→`SEQUENCE_COLOR_03`, blue→`SEQUENCE_COLOR_04`, orange→`SEQUENCE_COLOR_08`, yellow→`SEQUENCE_COLOR_05`. This is the correct Blender-idiomatic way to add color indication without custom drawing.

**Verify (parity items P13, P14, P15):**
- Load two GLBs with different vertex counts → stats show correct deltas
- Load two GLBs where only a material roughness differs → material-level diff row appears under "Materials modified"
- Switch through all 5 modes → stats panel remains visible in every mode
- Enable colorblind mode → stats delta colors switch from red/green to blue/orange

---

## Phase 3 — Side-by-side view (2–3 hrs)

### 3.1 `operators/side_by_side.py`

```python
def execute(self, context):
    # 1. Find the VIEW_3D area
    v3d = next(a for a in context.screen.areas if a.type == 'VIEW_3D')
    # 2. Split it
    bpy.ops.screen.area_split({"area": v3d}, direction='VERTICAL', factor=0.5)
    # 3. Identify left and right VIEW_3D areas
    v3d_areas = [a for a in context.screen.areas if a.type == 'VIEW_3D']
    left, right = v3d_areas[0], v3d_areas[-1]
    # 4. Create WTD_CamA, WTD_CamB, auto-frame on each collection
    # 5. Assign cameras to spaces
    # 6. Register camera sync handler
    # 7. Set wtd.active_mode = 'SIDE_BY_SIDE'
    return {'FINISHED'}
```

### 3.2 Camera sync handler (`lib/camera_sync.py`)

```python
_syncing = False

def sync_cameras(scene, depsgraph):
    global _syncing
    if not scene.wtd.sync_cameras or _syncing:
        return
    _syncing = True
    cam_a = bpy.data.objects.get("WTD_CamA")
    cam_b = bpy.data.objects.get("WTD_CamB")
    if cam_a and cam_b:
        cam_b.matrix_world = cam_a.matrix_world.copy()
    _syncing = False

def register_sync():
    if sync_cameras not in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.append(sync_cameras)

def unregister_sync():
    if sync_cameras in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.remove(sync_cameras)
```

Call `unregister_sync()` inside the add-on's `unregister()` — stale handlers persist across sessions.

### 3.3 Sync lock/unlock toggle button

In `controls_panel.py`:
```python
if wtd.active_mode == 'SIDE_BY_SIDE':
    icon = 'LOCKED' if wtd.sync_cameras else 'UNLOCKED'
    layout.prop(wtd, "sync_cameras", toggle=True, icon=icon, text="Sync Cameras")
```

Changing `wtd.sync_cameras` auto-calls the `update=` callback on the property which calls `register_sync()` or `unregister_sync()`.

**Verify (parity items P3, P4, P5):**
- Orbit left viewport while locked → right viewport follows exactly
- Click Unlock → orbit left → right stays still
- Click Lock again → right camera snaps to match left
- Switch to Ghost Overlay mode → sync lock control disappears from panel

---

## Phase 4 — Ghost overlay (2 hrs)

### 4.1 `lib/material_tint.py`

```python
def tint_collection(collection, color_rgb: tuple, opacity: float):
    for obj in collection.all_objects:
        if obj.type != 'MESH':
            continue
        new_mats = []
        for slot in obj.material_slots:
            original = slot.material
            clone = original.copy() if original else bpy.data.materials.new("WTD_base")
            clone.name = f"{original.name if original else 'mat'}_WTD_tint"
            _build_tint_nodes(clone, color_rgb, opacity)
            new_mats.append(clone)
        obj.data.materials.clear()
        for m in new_mats:
            obj.data.materials.append(m)

def _build_tint_nodes(mat, color_rgb, opacity):
    mat.use_nodes = True
    mat.blend_method = 'BLEND'
    mat.show_transparent_back = False
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out   = nodes.new("ShaderNodeOutputMaterial")
    bsdf  = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color_rgb, 1.0)
    bsdf.inputs["Alpha"].default_value = opacity
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
```

### 4.2 `operators/ghost_overlay.py`

1. Ensure single viewport (undo area split if present)

   > **Viewport cleanup note:** Undoing the area split is non-trivial in Blender. The safest approach is to store a reference to the original single-area layout before splitting in Phase 3, and restore it on mode switch. Alternatively, iterate `context.screen.areas` and call `bpy.ops.screen.area_close()` on all but the primary VIEW_3D. Do not skip this — overlapping splits accumulate and break the layout irreversibly during a demo.

2. Normalize both models to world origin (see normalization rule below)
3. Show both `WTD_ModelA` and `WTD_ModelB`
4. Read colors from `lib/colors.py` — never use literals:

```python
from ..lib.colors import get_colors
import bpy

addon_key = __package__.split('.')[0]  # 'wtd', not 'wtd.operators'
prefs = bpy.context.preferences.addons[addon_key].preferences
colors = get_colors(prefs.colorblind_mode)
tint_collection(col_a, colors["v1"], wtd.opacity)  # red or blue
tint_collection(col_b, colors["v2"], wtd.opacity)  # green or orange
```

5. Set `wtd.active_mode = 'GHOST_OVERLAY'`

**Verify (parity items P6, P7, P8, P17):**
- Ghost overlay shows red v1, green v2 with neutral mixed tone where they overlap
- Default opacity is 0.50 (matches web app default exactly)
- Toggle to Side-by-Side and back → original materials intact, no red/green bleed
- Enable colorblind mode → overlay switches to blue/orange
- Colorblind mode also updates pixel diff highlights and stats delta colors in the same toggle

---

## Phase 5 — Pixel diff pipeline (4–5 hrs)

This is the most complex phase. Build sub-steps 5A → 5B → 5C in order. Do not combine them.

### 5A — Single render pipeline
Build and verify one angle renders correctly before wiring all 6.

### 5B — Cached 6-angle pipeline  
Wire all 6 angles with the render cache. Verify cache invalidation on file change.

### 5C — All angles UI over the same data (parity item P12 — mandatory, not optional)
All angles mode is an MVP feature (same as the web app). It must reuse the exact same `_diff_results` dict as pixel diff mode. One render pass feeds both modes.

### Normalization rule (both models, before every render or overlay)

This must be implemented in `lib/pixel_diff._normalize_transforms()` and called before any offscreen render or ghost overlay setup:

1. Compute the bounding box center of each model using `obj.evaluated_get(depsgraph).bound_box`
2. Translate each model so its bounding box center is at world origin (apply as `obj.location` offset)
3. Compute the bounding sphere radius of **both** centered models
4. Use the **larger radius** to set the camera distance for both renders: `distance = radius / sin(fov/2)`
5. After rendering, restore original transforms

Without step 3–4, models with different sizes produce false diffs because one model is framed closer than the other.

### 5.1 `lib/camera_presets.py`

```python
from mathutils import Vector, Euler
import math

PRESETS = {
    "front": {"location": Vector((0, -3, 0)),  "rotation": Euler((math.radians(90), 0, 0))},
    "back":  {"location": Vector((0,  3, 0)),  "rotation": Euler((math.radians(90), 0, math.radians(180)))},
    "left":  {"location": Vector((-3, 0, 0)),  "rotation": Euler((math.radians(90), 0, math.radians(-90)))},
    "right": {"location": Vector(( 3, 0, 0)),  "rotation": Euler((math.radians(90), 0, math.radians(90)))},
    "top":   {"location": Vector((0,  0, 3)),  "rotation": Euler((0, 0, 0))},
    "34":    {"location": Vector((2, -2, 1.5)),"rotation": Euler((math.radians(65), 0, math.radians(45)))},
}
ANGLE_NAMES = list(PRESETS.keys())
```

### 5.2 `lib/pixel_diff.py` — offscreen render

```python
import bpy, numpy as np

_render_cache = {}   # {"A": {angle: ndarray}, "B": {angle: ndarray}}
_diff_results = {}   # {angle: (diff_ndarray, pct)}

def render_angle(col_name: str, label: str, angle: str) -> np.ndarray:
    scene = bpy.context.scene
    _hide_all_except(col_name)
    _position_camera(angle, _get_bounds(col_name))
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    path = f"/tmp/wtd_{label}_{angle}.png"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    pixels = np.array(img.pixels[:]).reshape(1024, 1024, 4).copy()
    bpy.data.images.remove(img)   # ← critical: prevent memory leak
    _restore_visibility()
    return pixels

def compute_diff(px_a, px_b, tolerance, colorblind: bool = False):
    from ..lib.colors import get_colors
    colors = get_colors(colorblind)
    r, g, b = colors["diff_px"]
    changed = np.abs(px_a[:,:,:3] - px_b[:,:,:3]).sum(axis=2) > (tolerance * 3 / 255.0)
    result = px_a.copy()
    result[changed]    = [r, g, b, 0.78]   # colorblind-aware highlight
    result[~changed, 3] = 0.31
    pct = float(changed.sum() / (1024*1024) * 100)
    return result, pct

def run_all(tolerance: int, colorblind: bool = False):
    global _diff_results
    if not _render_cache:
        # Full render pass — show progress in UI
        for label, col_name in (("A","WTD_ModelA"), ("B","WTD_ModelB")):
            _render_cache[label] = {}
            for angle in ANGLE_NAMES:
                _render_cache[label][angle] = render_angle(col_name, label, angle)
    # Comparison pass only — never re-renders on tolerance change
    for angle in ANGLE_NAMES:
        _diff_results[angle] = compute_diff(
            _render_cache["A"][angle], _render_cache["B"][angle], tolerance, colorblind
        )

def invalidate_cache():
    _render_cache.clear()
    _diff_results.clear()
```

> **Key rule:** `invalidate_cache()` is called whenever a new file is loaded. Never call it on tolerance changes — only re-run `compute_diff`.

### 5.3 `operators/pixel_diff.py` — `OT_PixelDiffView`

```python
def execute(self, context):
    wm = context.window_manager
    wm.progress_begin(0, 6)
    addon_key = __package__.split('.')[0]  # 'wtd', not 'wtd.operators'
    prefs = context.preferences.addons[addon_key].preferences
    lib.pixel_diff.run_all(context.scene.wtd.tolerance, prefs.colorblind_mode)
    wm.progress_end()

    # Parity: warn if all angles are >95% changed (web app behavior)
    results = lib.pixel_diff._diff_results
    if results and all(pct > 95 for _, pct in results.values()):
        self.report({'WARNING'},
            "Models appear entirely different. This tool is designed to diff two versions of the same asset.")

    context.scene.wtd.diff_computed = True
    context.scene.wtd.active_mode = 'PIXEL_DIFF'
    return {'FINISHED'}
```

### 5.4 Display diff images in panel

Convert numpy arrays to Blender images for display:
```python
def ndarray_to_blender_image(name: str, arr: np.ndarray) -> bpy.types.Image:
    img = bpy.data.images.get(name) or bpy.data.images.new(name, 1024, 1024)
    img.pixels = arr.flatten().tolist()
    return img
```

In `controls_panel.py` pixel diff section, call `layout.template_image(img, ...)` for the active angle.

### 5.5 All angles mode

Reuses `_diff_results` from pixel diff. Panel layout:
```python
grid = layout.grid_flow(row_major=True, columns=2, even_columns=True)
for angle in ANGLE_NAMES:
    diff_arr, pct = lib.pixel_diff._diff_results.get(angle, (None, 0))
    cell = grid.column()
    if diff_arr is not None:
        img = ndarray_to_blender_image(f"wtd_diff_{angle}", diff_arr)
        cell.template_image(img, img.name, img.colorspace_settings, compact=True)
    cell.label(text=f"{angle}: {pct:.1f}%")
```

**Verify (parity items P9, P10, P11, P12):**
- Pixel diff renders 6 angles, red highlights visible
- Move tolerance slider → **no render pass** (check Blender console: no render output lines)
- Upload a new file → render cache clears, next pixel diff re-renders from scratch
- Switch to All Angles mode → same 6 percentages as individual pixel diff angles
- Focused angle in pixel diff and same angle cell in all angles show identical percentage
- **Normalization test:** Load Fox.glb (origin at ground) as A, and the same Fox.glb with its origin shifted by (2, 0, 0) as B → diff percentage must remain near zero (< 1%). A non-zero result means normalization is broken.

---

## Phase 6 — Turntable + controls polish (1–2 hrs)

### 6.1 `operators/turntable.py` — modal operator

```python
import math, bpy

class OT_TurntableView(bpy.types.Operator):
    bl_idname = "wtd.turntable_view"
    bl_label = "Turntable"
    _timer = None
    _angle = 0.0

    def modal(self, context, event):
        if event.type == 'TIMER':
            speed = context.scene.wtd.turntable_speed
            self._angle += speed
            for name in ("WTD_ModelA", "WTD_ModelB"):
                col = bpy.data.collections.get(name)
                if col:
                    for obj in col.objects:
                        obj.rotation_euler.z = math.radians(self._angle)
            context.area.tag_redraw()
        if event.type in ('ESC', 'RIGHTMOUSE'):
            return self.cancel(context)
        return {'PASS_THROUGH'}   # ← not RUNNING_MODAL — allows other input

    def execute(self, context):
        self._timer = context.window_manager.event_timer_add(1/60, window=context.window)
        context.window_manager.modal_handler_add(self)
        context.scene.wtd.active_mode = 'TURNTABLE'
        return {'RUNNING_MODAL'}

    def cancel(self, context):
        context.window_manager.event_timer_remove(self._timer)
        return {'CANCELLED'}
```

### 6.2 Keyboard shortcuts (P18 — full implementation)

Register in `__init__.py`. All three shortcut groups must be wired:

```python
_keymaps = []

def register_keymaps():
    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if not kc:
        return
    km = kc.keymaps.new(name='3D View', space_type='VIEW_3D')

    # 1–5: mode switching
    for key, mode in [
        ('ONE',   'SIDE_BY_SIDE'), ('TWO',   'GHOST_OVERLAY'),
        ('THREE', 'PIXEL_DIFF'),   ('FOUR',  'TURNTABLE'),
        ('FIVE',  'ALL_ANGLES'),
    ]:
        kmi = km.keymap_items.new('wtd.set_mode', key, 'PRESS')
        kmi.properties.mode = mode
        _keymaps.append((km, kmi))

    # S: toggle camera sync (side-by-side only — operator checks active_mode)
    kmi = km.keymap_items.new('wtd.toggle_sync', 'S', 'PRESS')
    _keymaps.append((km, kmi))

    # ←/→: step through angles in pixel diff mode
    kmi = km.keymap_items.new('wtd.step_angle', 'LEFT_ARROW', 'PRESS')
    kmi.properties.direction = -1
    _keymaps.append((km, kmi))
    kmi = km.keymap_items.new('wtd.step_angle', 'RIGHT_ARROW', 'PRESS')
    kmi.properties.direction = 1
    _keymaps.append((km, kmi))

def unregister_keymaps():
    for km, kmi in _keymaps:
        km.keymap_items.remove(kmi)
    _keymaps.clear()
```

**Additional operators needed (register alongside others in Phase 6):**

- `wtd.toggle_sync` — checks `wtd.active_mode == 'SIDE_BY_SIDE'` before toggling `wtd.sync_cameras`; no-op in other modes
- `wtd.step_angle` — accepts `direction: int` property (+1/-1); only active when `wtd.active_mode == 'PIXEL_DIFF'`; cycles through `ANGLE_NAMES` index stored on `WTD_State` as `active_angle_index: IntProperty(default=0, min=0, max=5)`

### 6.3 Conditional controls per mode

In `controls_panel.py`:
```python
mode = context.scene.wtd.active_mode
if mode in ('PIXEL_DIFF', 'ALL_ANGLES'):
    layout.prop(wtd, "tolerance", slider=True, text="Tolerance")
if mode == 'GHOST_OVERLAY':
    layout.prop(wtd, "opacity", slider=True, text="Opacity")
if mode == 'SIDE_BY_SIDE':
    icon = 'LOCKED' if wtd.sync_cameras else 'UNLOCKED'
    layout.prop(wtd, "sync_cameras", toggle=True, icon=icon)
```

### 6.4 `operators/reset.py` — `OT_ResetDiff`

Calls `lib.cleanup.full_cleanup()`, resets `WTD_State` fields to defaults, unregisters sync handler, cancels turntable modal, restores single viewport.

**Verify:** All 5 modes cycle cleanly. Reset leaves no `WTD_*` objects in outliner.

---

## Phase 7 — Packaging (1 hr)

### 7.1 Build script

```bash
#!/bin/bash
VERSION="1.0.0"
rm -rf dist/ && mkdir -p dist/
cp -r wtd dist/wtd
find dist/ -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find dist/ -name "*.pyc" -delete
cd dist && zip -r "../wtd-blender-v${VERSION}.zip" wtd/
echo "Built: wtd-blender-v${VERSION}.zip"
```

### 7.2 Add-on preferences

> **Note:** Add-on preferences are Blender-specific implementation infrastructure. They do not define parity requirements — the parity table (P1–P20) does. `render_engine` in particular is a Blender-only concept with no web app equivalent.

```python
class WTD_AddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    colorblind_mode: bpy.props.BoolProperty(
        name="Colorblind-Safe Colors (Blue/Orange)",
        description="Switch overlay, pixel diff, stats, and legend to blue/orange (parity item P17)",
        default=False,
    )
    render_engine: bpy.props.EnumProperty(
        name="Pixel Diff Engine",
        description="Blender-only: choose render engine for pixel diff offscreen renders",
        items=[("BLENDER_EEVEE","Eevee (Fast)",""), ("CYCLES","Cycles (HQ)","")],
        default="BLENDER_EEVEE",
    )
```

### 7.3 Final parity regression test checklist

Run against all parity items from the table at the top.

**Install:**
- [ ] Remove dev version from Preferences
- [ ] Install `wtd-blender-v1.0.0.zip` fresh
- [ ] Enable add-on — zero errors in console

**File loading:**
- [ ] Load `.gltf` file → rejected with error message
- [ ] Load DamagedHelmet.glb twice → "No differences found" banner (P16)
- [ ] Load DamagedHelmet.glb + modified copy → banner gone, diff controls appear

**Stats (P13, P14, P15):**
- [ ] Vertex/triangle/bbox/material/object/anim deltas all correct
- [ ] Material-level diff shows which properties changed
- [ ] Stats panel visible in all 5 modes without switching away

**Side-by-side (P3, P4, P5):**
- [ ] Locked: orbit left → right follows
- [ ] Unlocked: orbit left → right stays
- [ ] Re-lock → right snaps to left
- [ ] Sync control only visible in this mode (P19)

**Ghost overlay (P6, P7, P8):**
- [ ] Red v1, green v2, mixed tone on overlap
- [ ] Default opacity exactly 0.50
- [ ] Switch away and back → original materials intact

**Pixel diff (P9, P10, P11):**
- [ ] 6 angles rendered at 1024×1024
- [ ] Tolerance slider → no re-render (console stays quiet)
- [ ] Load new file → cache clears, re-render on next pixel diff

**All angles (P12):**
- [ ] 2×3 grid with per-angle percentages
- [ ] Percentages match pixel diff focused-angle numbers exactly

**Colorblind (P17):**
- [ ] Toggle → blue/orange in overlay, pixel diff, stats, legend
- [ ] Toggle off → back to red/green everywhere

**Cleanup (P20):**
- [ ] Reset → zero `WTD_*` objects in outliner
- [ ] Disable add-on → no stale handlers (no errors on next Blender session open)

---

## Phase summary

| Phase | What you build | Parity items | Est. time |
|---|---|---|---|
| 0 | Env, vendor deps, `wtd/` scaffold | — | 30 min |
| 1 | `__init__.py`, N-panel, `WTD_State`, `lib/colors.py` | P17 foundation | 1–2 hrs |
| 2 | File load, identical-file detection, structural diff, stats panel | P1, P2, P13, P14, P15, P16 | 3–4 hrs |
| 3 | Side-by-side + camera sync lock/unlock | P3, P4, P5 | 2–3 hrs |
| 4 | Ghost overlay + opacity + legend | P6, P7, P8 | 2 hrs |
| 5 | Pixel diff pipeline (5A→5B→5C) + all angles | P9, P10, P11, P12 | 4–5 hrs |
| 6 | Turntable + keymaps + conditional controls + colorblind wiring | P17, P18, P19 | 1–2 hrs |
| 7 | Packaging, prefs, parity regression test | P20 | 1 hr |
| **Total** | | **all P1–P20** | **~15–20 hrs** |

---

## Test models

Download from `https://github.com/KhronosGroup/glTF-Sample-Assets`:
- **DamagedHelmet** — PBR materials baseline
- **Fox** — animations + skinned mesh
- **BoxAnimated** — simple, fast for iteration

Generate controlled A/B pairs:
```bash
npm install -g @gltf-transform/cli
gltf-transform transform DamagedHelmet.glb DamagedHelmet_modified.glb --scale 1.05
gltf-transform metalrough DamagedHelmet.glb DamagedHelmet_rougher.glb --roughness 0.9
```
