"""
operators/reset.py — OT_ResetDiff
Cleans all WTD state: collections, materials, cameras, images, handlers.
"""

import bpy
from ..lib import cleanup, camera_sync
from ..lib import pixel_diff as _pixel_diff
from . import turntable


class WTD_OT_ResetDiff(bpy.types.Operator):
    bl_idname = "wtd.reset_diff"
    bl_label = "Reset WhatTheDiff"
    bl_description = "Remove all WTD objects from the scene and reset state"

    def execute(self, context):
        # 0. Stop active modal operators
        turntable.stop_running(context)

        # 1. Unregister sync handler
        camera_sync.unregister_sync()

        # 2. Clear pixel diff cache
        _pixel_diff.invalidate_cache()

        # 3. Unhide all WTD objects (Bug #5 fix — side-by-side hides them)
        for col_name in ("WTD_ModelA", "WTD_ModelB"):
            col = bpy.data.collections.get(col_name)
            if col:
                for obj in col.all_objects:
                    obj.hide_viewport = False
                    obj.hide_render = False

        # 4. Remove all WTD scene objects
        cleanup.full_cleanup()

        # 4. Reset state
        wtd = context.scene.wtd
        wtd.model_a_path = ""
        wtd.model_b_path = ""
        wtd.active_mode = "SIDE_BY_SIDE"
        wtd.tolerance = 10
        wtd.opacity = 0.50
        wtd.sync_cameras = True
        wtd.models_loaded = False
        wtd.diff_computed = False
        wtd.no_differences = False
        wtd.turntable_speed = 1.0
        wtd.active_angle_index = 0

        self.report({"INFO"}, "WhatTheDiff reset.")
        return {"FINISHED"}
