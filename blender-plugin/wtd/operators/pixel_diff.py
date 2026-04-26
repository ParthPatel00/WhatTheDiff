"""
operators/pixel_diff.py — OT_PixelDiffView
Triggers the full pixel diff pipeline. Shows progress. Warns if >95% changed.
"""

import bpy
from ..lib import pixel_diff as _pd


from .side_by_side import restore_default_viewport_state


def _get_prefs(context):
    addon_key = __package__.split(".")[0]
    return context.preferences.addons[addon_key].preferences


class WTD_OT_PixelDiffView(bpy.types.Operator):
    bl_idname = "wtd.pixel_diff_view"
    bl_label = "Pixel Diff"
    bl_description = "Render both models at 6 angles and highlight changed pixels"

    def execute(self, context):
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        # --- Ensure viewport is clean and not split ---
        restore_default_viewport_state(context)

        prefs = _get_prefs(context)
        wm = context.window_manager
        wm.progress_begin(0, 100)
        wm.progress_update(10)

        try:
            _pd.run_all(wtd.tolerance, prefs.colorblind_mode)
        except Exception as e:
            self.report({"ERROR"}, f"Pixel diff failed: {e}")
            wm.progress_end()
            return {"CANCELLED"}

        wm.progress_update(90)

        # P16 variant: warn if all angles are >95% changed (web app behavior)
        results = _pd._diff_results
        if results and all(pct > 95 for _, pct in results.values()):
            self.report(
                {"WARNING"},
                "Models appear entirely different. "
                "This tool is designed to diff two versions of the same asset.",
            )

        wtd.diff_computed = True
        wtd.active_mode = "PIXEL_DIFF"
        wm.progress_end()

        # Pre-build Blender images for all angles so the panel can display them
        from ..lib.camera_presets import ANGLE_NAMES
        for angle in ANGLE_NAMES:
            _pd.get_diff_image(angle)

        return {"FINISHED"}
