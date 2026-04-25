"""
WhatTheDiff Blender Plugin
Visual diff for GLB 3D model files — full parity with the WhatTheDiff web app.
"""

import sys
import os

# --- Vendor path must be first, before any other imports ---
_vendor_path = os.path.join(os.path.dirname(__file__), "vendor")
if _vendor_path not in sys.path:
    sys.path.insert(0, _vendor_path)

import bpy

bl_info = {
    "name": "WhatTheDiff",
    "author": "WhatTheDiff Team",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > WhatTheDiff",
    "description": "Visual diff for GLB 3D model files",
    "category": "3D View",
}

from .lib.types import WTD_State
from .lib import camera_sync
from . import operators, panels


# ---------------------------------------------------------------------------
# Keymap registry
# ---------------------------------------------------------------------------

_keymaps = []


def register_keymaps():
    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if not kc:
        return
    km = kc.keymaps.new(name="3D View", space_type="VIEW_3D")

    # 1–5: switch view modes
    for key, mode in [
        ("ONE", "SIDE_BY_SIDE"),
        ("TWO", "GHOST_OVERLAY"),
        ("THREE", "PIXEL_DIFF"),
        ("FOUR", "TURNTABLE"),
        ("FIVE", "ALL_ANGLES"),
    ]:
        kmi = km.keymap_items.new("wtd.set_mode", key, "PRESS")
        kmi.properties.mode = mode
        _keymaps.append((km, kmi))

    # S: toggle camera sync (no-op outside side-by-side)
    kmi = km.keymap_items.new("wtd.toggle_sync", "S", "PRESS")
    _keymaps.append((km, kmi))

    # ←/→: step through angles in pixel diff mode
    kmi = km.keymap_items.new("wtd.step_angle", "LEFT_ARROW", "PRESS")
    kmi.properties.direction = -1
    _keymaps.append((km, kmi))

    kmi = km.keymap_items.new("wtd.step_angle", "RIGHT_ARROW", "PRESS")
    kmi.properties.direction = 1
    _keymaps.append((km, kmi))


def unregister_keymaps():
    for km, kmi in _keymaps:
        km.keymap_items.remove(kmi)
    _keymaps.clear()


# ---------------------------------------------------------------------------
# Add-on preferences (Blender-specific infrastructure — not parity items)
# ---------------------------------------------------------------------------

class WTD_AddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    colorblind_mode: bpy.props.BoolProperty(
        name="Colorblind-Safe Colors (Blue/Orange)",
        description="Switch overlay, pixel diff, stats, and legend to blue/orange (parity item P17)",
        default=False,
    )
    render_engine: bpy.props.EnumProperty(
        name="Pixel Diff Engine",
        description="Blender-only: choose render engine for pixel diff offscreen renders",
        items=[
            ("BLENDER_EEVEE", "Eevee (Fast)", ""),
            ("CYCLES", "Cycles (High Quality)", ""),
        ],
        default="BLENDER_EEVEE",
    )

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "colorblind_mode")
        layout.prop(self, "render_engine")


# ---------------------------------------------------------------------------
# Register / Unregister
# ---------------------------------------------------------------------------

_classes = [WTD_AddonPreferences, WTD_State]


def register():
    for cls in _classes:
        bpy.utils.register_class(cls)

    bpy.types.Scene.wtd = bpy.props.PointerProperty(type=WTD_State)

    operators.register()
    panels.register()
    register_keymaps()


def unregister():
    unregister_keymaps()
    camera_sync.unregister_sync()   # must happen before panels/operators
    panels.unregister()
    operators.unregister()

    del bpy.types.Scene.wtd

    for cls in reversed(_classes):
        bpy.utils.unregister_class(cls)
