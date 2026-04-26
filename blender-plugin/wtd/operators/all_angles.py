"""
operators/all_angles.py — OT_AllAnglesView
Switches to ALL_ANGLES mode. Reuses the same _diff_results as PIXEL_DIFF (parity item P12).
Runs the pipeline if the cache is empty.
"""

import bpy
from ..lib import pixel_diff as _pd
from .side_by_side import restore_default_viewport_state

def _get_prefs(context):
    addon_key = __package__.split(".")[0]
    return context.preferences.addons[addon_key].preferences


class WTD_OT_AllAnglesView(bpy.types.Operator):
    bl_idname = "wtd.all_angles_view"
    bl_label = "All Angles"
    bl_description = "Show 2×3 grid of all 6 angles with per-angle change percentages"

    def execute(self, context):
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        # --- Ensure viewport is clean and not split ---
        restore_default_viewport_state(context)

        prefs = _get_prefs(context)

        # Run diff only if cache is empty — same cache as pixel diff (P12)
        if not _pd._diff_results:
            wm = context.window_manager
            wm.progress_begin(0, 100)
            try:
                _pd.run_all(wtd.tolerance, prefs.colorblind_mode)
                from ..lib.camera_presets import ANGLE_NAMES
                for angle in ANGLE_NAMES:
                    _pd.get_diff_image(angle)
            except Exception as e:
                self.report({"ERROR"}, f"All-angles render failed: {e}")
                wm.progress_end()
                return {"CANCELLED"}
            wm.progress_end()
            wtd.diff_computed = True

        wtd.active_mode = "ALL_ANGLES"
        return {"FINISHED"}
