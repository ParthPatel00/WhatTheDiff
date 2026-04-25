"""
operators/ghost_overlay.py — OT_GhostOverlayView
Composites both models in a single viewport with red/green (or blue/orange) tinting.
Restores original materials when leaving this mode (parity item P8).
"""

import bpy
from ..lib.colors import get_colors
from ..lib.material_tint import tint_collection, restore_collection
from ..lib import model_loader, camera_sync
from .side_by_side import _restore_single_viewport


def _get_prefs(context):
    addon_key = __package__.split(".")[0]
    return context.preferences.addons[addon_key].preferences


def _normalize_both(col_a, col_b):
    """
    Temporarily center both models at world origin.
    Returns (offset_a, offset_b) so caller can restore transforms.
    Uses the larger bounding sphere for consistent camera framing.
    """
    center_a, radius_a = model_loader.get_bounds(col_a)
    center_b, radius_b = model_loader.get_bounds(col_b)

    offsets_a = {}
    offsets_b = {}

    for obj in col_a.all_objects:
        offsets_a[obj.name] = obj.location.copy()
        obj.location -= center_a

    for obj in col_b.all_objects:
        offsets_b[obj.name] = obj.location.copy()
        obj.location -= center_b

    return offsets_a, offsets_b, max(radius_a, radius_b)


def _restore_transforms(col_a, col_b, offsets_a, offsets_b):
    for obj in col_a.all_objects:
        if obj.name in offsets_a:
            obj.location = offsets_a[obj.name]
    for obj in col_b.all_objects:
        if obj.name in offsets_b:
            obj.location = offsets_b[obj.name]


class WTD_OT_GhostOverlayView(bpy.types.Operator):
    bl_idname = "wtd.ghost_overlay_view"
    bl_label = "Ghost Overlay"
    bl_description = "Show both models in one viewport with red/green tinting (parity items P6-P8)"

    def execute(self, context):
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        col_a = bpy.data.collections.get("WTD_ModelA")
        col_b = bpy.data.collections.get("WTD_ModelB")
        if not col_a or not col_b:
            self.report({"ERROR"}, "WTD collections missing.")
            return {"CANCELLED"}

        # --- 1. Unregister camera sync (not needed in single viewport) ---
        camera_sync.unregister_sync()

        # --- 2. Restore to single viewport ---
        _restore_single_viewport(context.screen)

        # --- 3. Restore any previous tinting (clean start) ---
        restore_collection(col_a)
        restore_collection(col_b)

        # --- 4. Normalize both models to world origin ---
        offsets_a, offsets_b, _ = _normalize_both(col_a, col_b)

        # --- 5. Get colors from lib/colors.py — never hardcode ---
        prefs = _get_prefs(context)
        colors = get_colors(prefs.colorblind_mode)

        # --- 6. Apply tinting, restore transforms in finally (Bug #3 fix) ---
        try:
            tint_collection(col_a, colors["v1"], wtd.opacity)
            tint_collection(col_b, colors["v2"], wtd.opacity)
        finally:
            # Restore transforms immediately — ghost overlay is material-only,
            # not render-only, so models must stay at their original positions.
            _restore_transforms(col_a, col_b, offsets_a, offsets_b)

        # --- 8. Make sure Eevee is set and viewport uses MATERIAL shading ---
        if hasattr(context.scene, "render"):
            if context.scene.render.engine not in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
                context.scene.render.engine = "BLENDER_EEVEE"

        for area in context.screen.areas:
            if area.type == "VIEW_3D":
                for space in area.spaces:
                    if space.type == "VIEW_3D":
                        space.shading.type = "MATERIAL"

        # --- 9. Set mode ---
        wtd.active_mode = "GHOST_OVERLAY"

        self.report({"INFO"}, "Ghost overlay active. Use Opacity slider to adjust blend.")
        return {"FINISHED"}
