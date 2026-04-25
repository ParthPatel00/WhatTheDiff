"""
operators/step_angle.py — OT_StepAngle
Steps through the 6 pixel diff angles. No-op outside PIXEL_DIFF mode.
Triggered by LEFT_ARROW (direction=-1) and RIGHT_ARROW (direction=+1).
"""

import bpy
from ..lib.camera_presets import ANGLE_NAMES


class WTD_OT_StepAngle(bpy.types.Operator):
    bl_idname = "wtd.step_angle"
    bl_label = "Step Diff Angle"
    bl_description = "Step through the 6 camera angles in Pixel Diff mode"

    direction: bpy.props.IntProperty(default=1)  # +1 or -1

    def execute(self, context):
        wtd = context.scene.wtd
        if wtd.active_mode != "PIXEL_DIFF":
            return {"PASS_THROUGH"}

        total = len(ANGLE_NAMES)
        wtd.active_angle_index = (wtd.active_angle_index + self.direction) % total
        return {"FINISHED"}
