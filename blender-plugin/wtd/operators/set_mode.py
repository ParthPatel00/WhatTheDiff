"""
operators/set_mode.py — OT_SetMode
Sets wtd.active_mode. Triggered by number keys 1–5 and mode buttons.
"""

import bpy
from . import turntable


class WTD_OT_SetMode(bpy.types.Operator):
    bl_idname = "wtd.set_mode"
    bl_label = "Set Diff Mode"
    bl_description = "Switch the active diff view mode"

    mode: bpy.props.EnumProperty(
        items=[
            ("SIDE_BY_SIDE",  "Side-by-Side",  ""),
            ("GHOST_OVERLAY", "Ghost Overlay",  ""),
            ("PIXEL_DIFF",    "Pixel Diff",     ""),
            ("TURNTABLE",     "Turntable",      ""),
            ("ALL_ANGLES",    "All Angles",     ""),
        ]
    )

    def execute(self, context):
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        # If turntable is running, stop it before switching to another mode.
        if wtd.active_mode == "TURNTABLE" and self.mode != "TURNTABLE":
            turntable.stop_running(context)

        mode_ops = {
            "SIDE_BY_SIDE": bpy.ops.wtd.side_by_side_view,
            "GHOST_OVERLAY": bpy.ops.wtd.ghost_overlay_view,
            "PIXEL_DIFF": bpy.ops.wtd.pixel_diff_view,
            "TURNTABLE": bpy.ops.wtd.turntable_view,
            "ALL_ANGLES": bpy.ops.wtd.all_angles_view,
        }

        op = mode_ops.get(self.mode)
        if not op:
            self.report({"ERROR"}, f"Unknown mode: {self.mode}")
            return {"CANCELLED"}

        return op()
