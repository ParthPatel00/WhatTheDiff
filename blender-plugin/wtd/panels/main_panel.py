"""
panels/main_panel.py — WTD N-panel sidebar (primary entry point in 3D viewport).
Shows file load buttons, mode selector, and no-difference banner.
"""

import bpy
from bpy.types import Panel


class WTD_PT_MainPanel(Panel):
    bl_label = "WhatTheDiff"
    bl_idname = "WTD_PT_main_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WhatTheDiff"
    bl_order = 0

    def draw(self, context):
        layout = self.layout
        wtd = context.scene.wtd

        # --- File load section ---
        box = layout.box()
        box.label(text="Load Models", icon="FILE_FOLDER")

        row = box.row(align=True)
        row.scale_y = 1.3
        row.operator("wtd.load_model_a", text="Load Model A", icon="IMPORT")

        if wtd.model_a_path:
            box.label(text=wtd.model_a_path.split("/")[-1], icon="CHECKMARK")
        else:
            box.label(text="No file loaded", icon="RADIOBUT_OFF")

        row = box.row(align=True)
        row.scale_y = 1.3
        row.operator("wtd.load_model_b", text="Load Model B", icon="IMPORT")

        if wtd.model_b_path:
            box.label(text=wtd.model_b_path.split("/")[-1], icon="CHECKMARK")
        else:
            box.label(text="No file loaded", icon="RADIOBUT_OFF")

        layout.separator()

        # --- No-difference banner ---
        if wtd.no_differences:
            banner = layout.box()
            banner.label(text="✓ No differences found", icon="CHECKMARK")
            banner.label(text="Both models are identical.")
            return

        # --- Mode selector (only when both models loaded) ---
        if not wtd.models_loaded:
            layout.label(text="Load both models to begin.", icon="INFO")
            return

        layout.label(text="View Mode", icon="VIEWZOOM")
        col = layout.column(align=True)
        col.scale_y = 1.2

        modes = [
            ("SIDE_BY_SIDE",  "Side-by-Side",  "WINDOW",                  "wtd.side_by_side_view"),
            ("GHOST_OVERLAY", "Ghost Overlay",  "GHOST_ENABLED",                "wtd.ghost_overlay_view"),
            ("PIXEL_DIFF",    "Pixel Diff",     "IMAGE_ALPHA",                  "wtd.pixel_diff_view"),
            ("TURNTABLE",     "Turntable",      "DRIVER_ROTATIONAL_DIFFERENCE", "wtd.turntable_view"),
            ("ALL_ANGLES",    "All Angles",     "GRID",                         "wtd.all_angles_view"),
        ]

        for mode_id, label, icon, op_id in modes:
            is_active = wtd.active_mode == mode_id
            col.operator(op_id, text=label, icon=icon, depress=is_active)

        layout.separator()

        # --- Reset ---
        layout.operator("wtd.reset_diff", text="Reset", icon="X")
