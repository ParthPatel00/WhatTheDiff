"""
panels/__init__.py — Register/unregister all panels.
"""

from .main_panel import WTD_PT_MainPanel
from .stats_panel import WTD_PT_StatsPanel
from .controls_panel import WTD_PT_ControlsPanel

_classes = [
    WTD_PT_MainPanel,
    WTD_PT_StatsPanel,
    WTD_PT_ControlsPanel,
]


def register():
    import bpy
    for cls in _classes:
        bpy.utils.register_class(cls)


def unregister():
    import bpy
    for cls in reversed(_classes):
        bpy.utils.unregister_class(cls)
