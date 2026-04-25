"""
operators/turntable.py — OT_TurntableView
Modal operator: rotates both models continuously.
Uses PASS_THROUGH (not RUNNING_MODAL) so the user can still interact with the viewport.
"""

import bpy
import math


_active_operator = None


def stop_running(context):
    """Stop the active turntable modal operator, if any."""
    global _active_operator
    if _active_operator is not None:
        _active_operator.cancel(context)
        _active_operator = None


class WTD_OT_TurntableView(bpy.types.Operator):
    bl_idname = "wtd.turntable_view"
    bl_label = "Turntable"
    bl_description = "Auto-rotate both models side by side"

    _timer = None
    _angle = 0.0

    def modal(self, context, event):
        if event.type == "ESC" or event.type == "RIGHTMOUSE":
            return self.cancel(context)

        if event.type == "TIMER":
            wtd = context.scene.wtd
            speed = wtd.turntable_speed
            self._angle = (self._angle + speed) % 360.0
            angle_rad = math.radians(self._angle)

            for col_name in ("WTD_ModelA", "WTD_ModelB"):
                col = bpy.data.collections.get(col_name)
                if col:
                    for obj in col.objects:
                        if obj.type == "MESH":
                            obj.rotation_euler.z = angle_rad

            if context.area:
                context.area.tag_redraw()

        # PASS_THROUGH allows normal viewport interaction while modal is running
        return {"PASS_THROUGH"}

    def execute(self, context):
        global _active_operator
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        if _active_operator is not None:
            _active_operator.cancel(context)
            _active_operator = None

        # Register timer at 60fps
        self._timer = context.window_manager.event_timer_add(
            1 / 60, window=context.window
        )
        context.window_manager.modal_handler_add(self)
        _active_operator = self
        wtd.active_mode = "TURNTABLE"

        self.report({"INFO"}, "Turntable running. Press Esc or RMB to stop.")
        return {"RUNNING_MODAL"}

    def cancel(self, context):
        global _active_operator
        if self._timer:
            context.window_manager.event_timer_remove(self._timer)
            self._timer = None
        # Reset rotation
        for col_name in ("WTD_ModelA", "WTD_ModelB"):
            col = bpy.data.collections.get(col_name)
            if col:
                for obj in col.objects:
                    if obj.type == "MESH":
                        obj.rotation_euler.z = 0.0

        if _active_operator is self:
            _active_operator = None
        return {"CANCELLED"}
