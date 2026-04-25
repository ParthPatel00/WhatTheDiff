"""
operators/__init__.py — Register/unregister all operators.
"""

import bpy

from .set_mode import WTD_OT_SetMode
from .toggle_sync import WTD_OT_ToggleSync
from .step_angle import WTD_OT_StepAngle
from .load_models import WTD_OT_LoadModelA, WTD_OT_LoadModelB
from .reset import WTD_OT_ResetDiff
from .side_by_side import WTD_OT_SideBySideView
from .ghost_overlay import WTD_OT_GhostOverlayView
from .pixel_diff import WTD_OT_PixelDiffView
from .all_angles import WTD_OT_AllAnglesView
from .turntable import WTD_OT_TurntableView

_classes = [
    WTD_OT_SetMode,
    WTD_OT_ToggleSync,
    WTD_OT_StepAngle,
    WTD_OT_LoadModelA,
    WTD_OT_LoadModelB,
    WTD_OT_ResetDiff,
    WTD_OT_SideBySideView,
    WTD_OT_GhostOverlayView,
    WTD_OT_PixelDiffView,
    WTD_OT_AllAnglesView,
    WTD_OT_TurntableView,
]


def register():
    for cls in _classes:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(_classes):
        bpy.utils.unregister_class(cls)
