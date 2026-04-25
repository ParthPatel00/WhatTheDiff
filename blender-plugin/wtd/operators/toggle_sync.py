"""
operators/toggle_sync.py — OT_ToggleSync
Toggles camera sync lock in side-by-side mode. No-op in other modes.
Triggered by S key.
"""

import bpy
from ..lib import camera_sync


class WTD_OT_ToggleSync(bpy.types.Operator):
    bl_idname = "wtd.toggle_sync"
    bl_label = "Toggle Camera Sync"
    bl_description = "Lock or unlock camera sync between the two viewports (Side-by-Side mode only)"

    def execute(self, context):
        wtd = context.scene.wtd
        if wtd.active_mode != "SIDE_BY_SIDE":
            return {"PASS_THROUGH"}

        wtd.sync_cameras = not wtd.sync_cameras

        if wtd.sync_cameras:
            camera_sync.register_sync()
        else:
            camera_sync.unregister_sync()

        return {"FINISHED"}
