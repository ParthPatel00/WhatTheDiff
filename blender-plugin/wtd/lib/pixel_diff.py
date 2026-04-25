"""
lib/pixel_diff.py — Offscreen render + pixel comparison pipeline.
Renders both models at 6 angles via Eevee offscreen, computes per-pixel diff.

Key parity rules:
  P9  — 6 angles at 1024×1024
  P10 — tolerance change recomputes diff only, never re-renders
  P11 — new file load → invalidate_cache() must be called
  P12 — _diff_results is the single source for both PIXEL_DIFF and ALL_ANGLES modes
"""

import bpy
import os
import math
import tempfile
import numpy as np

from .camera_presets import PRESETS, ANGLE_NAMES
from .model_loader import get_bounds

# ---------------------------------------------------------------------------
# Module-level caches (panels read these directly)
# ---------------------------------------------------------------------------

_render_cache: dict = {}   # {"A": {angle: ndarray[1024,1024,4]}, "B": {angle: ndarray}}
_diff_results: dict = {}   # {angle: (diff_ndarray[1024,1024,4], pct_float)}

# Transform offsets saved during normalization so we can restore after render
_saved_offsets_a: dict = {}
_saved_offsets_b: dict = {}


# ---------------------------------------------------------------------------
# Normalization (called before every render pass)
# ---------------------------------------------------------------------------

def _normalize_transforms(col_a, col_b):
    """
    Center both models at world origin using their bounding box centers.
    Camera distance is based on the LARGER bounding sphere (parity requirement).
    Saves original locations so _restore_transforms() can undo this.
    """
    global _saved_offsets_a, _saved_offsets_b
    _saved_offsets_a.clear()
    _saved_offsets_b.clear()

    center_a, _ = get_bounds(col_a)
    center_b, _ = get_bounds(col_b)

    for obj in col_a.all_objects:
        _saved_offsets_a[obj.name] = obj.location.copy()
        obj.location -= center_a

    for obj in col_b.all_objects:
        _saved_offsets_b[obj.name] = obj.location.copy()
        obj.location -= center_b


def _restore_transforms(col_a, col_b):
    """Restore original object transforms after rendering."""
    for obj in col_a.all_objects:
        if obj.name in _saved_offsets_a:
            obj.location = _saved_offsets_a[obj.name]
    for obj in col_b.all_objects:
        if obj.name in _saved_offsets_b:
            obj.location = _saved_offsets_b[obj.name]
    _saved_offsets_a.clear()
    _saved_offsets_b.clear()


# ---------------------------------------------------------------------------
# Camera positioning
# ---------------------------------------------------------------------------

def _position_render_camera(angle: str, radius: float):
    """
    Move/create the WTD_RenderCam and point it at world origin.
    Camera distance is derived from the model's bounding sphere radius.
    """
    cam_obj = bpy.data.objects.get("WTD_RenderCam")
    if not cam_obj:
        cam_data = bpy.data.cameras.new("WTD_RenderCam")
        cam_obj = bpy.data.objects.new("WTD_RenderCam", cam_data)
        bpy.context.scene.collection.objects.link(cam_obj)

    preset = PRESETS[angle]
    fov_rad = 2 * math.atan(cam_obj.data.sensor_width / (2 * cam_obj.data.lens))
    distance = (radius / math.sin(fov_rad / 2)) * 1.5
    distance = max(distance, 0.5)

    # Scale the preset direction vector to the correct distance
    direction = preset["location"].normalized()
    cam_obj.location = direction * distance
    cam_obj.rotation_euler = preset["rotation"]

    return cam_obj


# ---------------------------------------------------------------------------
# Visibility helpers
# ---------------------------------------------------------------------------

def _set_visibility(col_a, col_b, show_a: bool, show_b: bool):
    for obj in col_a.all_objects:
        obj.hide_render = not show_a
        obj.hide_viewport = not show_a
    for obj in col_b.all_objects:
        obj.hide_render = not show_b
        obj.hide_viewport = not show_b


def _restore_visibility(col_a, col_b):
    for col in (col_a, col_b):
        for obj in col.all_objects:
            obj.hide_render = False
            obj.hide_viewport = False


# ---------------------------------------------------------------------------
# Single-angle render
# ---------------------------------------------------------------------------

def render_angle(col_a, col_b, col_name: str, label: str, angle: str, radius: float) -> np.ndarray:
    """
    Render one model at one angle. Returns a (1024, 1024, 4) float32 ndarray.
    Cleans up the Blender image immediately to prevent memory leaks.
    """
    scene = bpy.context.scene

    # Show only the target collection
    show_a = (col_name == "WTD_ModelA")
    _set_visibility(col_a, col_b, show_a=show_a, show_b=not show_a)

    # Position camera
    cam_obj = _position_render_camera(angle, radius)
    scene.camera = cam_obj

    # Render settings — respect the render_engine addon preference (Bug #7 fix)
    try:
        addon_key = __package__.split(".")[0] if __package__ else "wtd"
        prefs = bpy.context.preferences.addons[addon_key].preferences
        engine = prefs.render_engine
    except (KeyError, AttributeError):
        engine = "BLENDER_EEVEE"

    scene.render.engine = engine
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # Render to temp file
    tmp_path = os.path.join(tempfile.gettempdir(), f"wtd_{label}_{angle}.png")
    scene.render.filepath = tmp_path
    bpy.ops.render.render(write_still=True)

    # Read pixels into numpy array
    img = bpy.data.images.load(tmp_path)
    pixels = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, 4).copy()
    bpy.data.images.remove(img)   # ← critical: prevent Blender memory leak

    return pixels


# ---------------------------------------------------------------------------
# Pixel diff computation
# ---------------------------------------------------------------------------

def compute_diff(px_a: np.ndarray, px_b: np.ndarray, tolerance: int, colorblind: bool = False):
    """
    Compare two (1024, 1024, 4) arrays. Returns (diff_image, pct_changed).
    Tolerance slider changes only this function — never triggers a re-render (P10).
    Diff highlight color comes from lib/colors.py (P17).
    """
    from .colors import get_colors
    colors = get_colors(colorblind)
    r, g, b = colors["diff_px"]

    # Per-pixel sum of absolute RGB differences
    diff = np.abs(px_a[:, :, :3].astype(np.float32) - px_b[:, :, :3].astype(np.float32))
    changed = diff.sum(axis=2) > (tolerance * 3 / 255.0)

    result = px_a.copy()
    result[changed]     = [r, g, b, 0.78]   # colorblind-aware highlight, 78% opacity
    result[~changed, 3] = 0.31              # unchanged pixels faded

    pct = float(changed.sum()) / (1024 * 1024) * 100.0
    return result, pct


# ---------------------------------------------------------------------------
# Full pipeline (called by OT_PixelDiffView and OT_AllAnglesView)
# ---------------------------------------------------------------------------

def run_all(tolerance: int, colorblind: bool = False):
    """
    If render cache is empty: render all 6 angles for A and B.
    Then compute diff for each angle (fast pass, no render).
    Tolerance-only changes skip straight to the comparison pass (P10).
    """
    global _diff_results

    col_a = bpy.data.collections.get("WTD_ModelA")
    col_b = bpy.data.collections.get("WTD_ModelB")
    if not col_a or not col_b:
        return

    if not _render_cache:
        # --- Full render pass ---
        _normalize_transforms(col_a, col_b)

        # Use the larger of the two bounding spheres for camera distance
        _, radius_a = get_bounds(col_a)
        _, radius_b = get_bounds(col_b)
        radius = max(radius_a, radius_b)

        try:
            for label, col_name in (("A", "WTD_ModelA"), ("B", "WTD_ModelB")):
                _render_cache[label] = {}
                for angle in ANGLE_NAMES:
                    _render_cache[label][angle] = render_angle(
                        col_a, col_b, col_name, label, angle, radius
                    )
        finally:
            _restore_visibility(col_a, col_b)
            _restore_transforms(col_a, col_b)

    # --- Comparison pass (fast, no render) ---
    for angle in ANGLE_NAMES:
        _diff_results[angle] = compute_diff(
            _render_cache["A"][angle],
            _render_cache["B"][angle],
            tolerance,
            colorblind,
        )


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------

def invalidate_cache():
    """Called whenever a new file is loaded (parity item P11). Never on tolerance changes."""
    _render_cache.clear()
    _diff_results.clear()
    _saved_offsets_a.clear()
    _saved_offsets_b.clear()


def get_diff_image(angle: str) -> bpy.types.Image | None:
    """
    Convert cached diff ndarray to a Blender image for display in the panel.
    Reuses existing image data-block by name to avoid creating duplicates.
    """
    diff_data = _diff_results.get(angle)
    if diff_data is None:
        return None
    arr, _ = diff_data
    img_name = f"wtd_diff_{angle}"
    img = bpy.data.images.get(img_name)
    if img is None:
        img = bpy.data.images.new(img_name, width=1024, height=1024, alpha=True)
    img.pixels = arr.flatten().tolist()
    img.update()
    return img
