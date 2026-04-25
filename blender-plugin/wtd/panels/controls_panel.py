"""
panels/controls_panel.py — Mode-conditional diff controls (parity item P19).
Shows only the controls relevant to the active mode:
  SIDE_BY_SIDE:  sync lock/unlock toggle
  GHOST_OVERLAY: opacity slider
  PIXEL_DIFF:    tolerance slider, angle navigation
  TURNTABLE:     speed slider
  ALL_ANGLES:    tolerance slider
"""

import bpy
from bpy.types import Panel
from ..lib import pixel_diff as _pixel_diff
from ..lib.camera_presets import ANGLE_NAMES


def _get_prefs(context):
    addon_key = __package__.split(".")[0]
    return context.preferences.addons[addon_key].preferences


class WTD_PT_ControlsPanel(Panel):
    bl_label = "Diff Controls"
    bl_idname = "WTD_PT_controls_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WhatTheDiff"
    bl_order = 2

    @classmethod
    def poll(cls, context):
        return context.scene.wtd.models_loaded

    def draw(self, context):
        layout = self.layout
        wtd = context.scene.wtd
        mode = wtd.active_mode

        # Mode selector is in main_panel.py

        # ---------------------------------------------------------------
        # SIDE_BY_SIDE — camera sync toggle
        # ---------------------------------------------------------------
        if mode == "SIDE_BY_SIDE":
            row = layout.row()
            icon = "LOCKED" if wtd.sync_cameras else "UNLOCKED"
            row.prop(wtd, "sync_cameras", toggle=True, icon=icon, text="Sync Cameras")

        # ---------------------------------------------------------------
        # GHOST_OVERLAY — opacity slider
        # ---------------------------------------------------------------
        elif mode == "GHOST_OVERLAY":
            layout.prop(wtd, "opacity", slider=True, text="Opacity")

        # ---------------------------------------------------------------
        # PIXEL_DIFF — tolerance + angle navigation + diff image
        # ---------------------------------------------------------------
        elif mode == "PIXEL_DIFF":
            layout.prop(wtd, "tolerance", slider=True, text="Tolerance")
            layout.separator(factor=0.5)

            # Angle navigation
            angle_name = ANGLE_NAMES[wtd.active_angle_index] if ANGLE_NAMES else "—"
            row = layout.row(align=True)
            step_l = row.operator("wtd.step_angle", text="", icon="TRIA_LEFT")
            step_l.direction = -1
            row.label(text=f"Angle: {angle_name}")
            step_r = row.operator("wtd.step_angle", text="", icon="TRIA_RIGHT")
            step_r.direction = 1

            # Show diff image for active angle
            diff_data = _pixel_diff._diff_results.get(angle_name)
            if diff_data is not None:
                _, pct = diff_data
                layout.label(text=f"Changed: {pct:.1f}%", icon="IMAGE_ALPHA")
                img = bpy.data.images.get(f"wtd_diff_{angle_name}")
                if img:
                    # template_image requires a proper ImageUser — use template_preview instead
                    layout.template_preview(img, show_buttons=False)
            else:
                layout.operator("wtd.pixel_diff_view", text="Run Pixel Diff", icon="PLAY")

        # ---------------------------------------------------------------
        # TURNTABLE — speed slider
        # ---------------------------------------------------------------
        elif mode == "TURNTABLE":
            layout.prop(wtd, "turntable_speed", slider=True, text="Speed (°/frame)")

        # ---------------------------------------------------------------
        # ALL_ANGLES — tolerance + 2×3 grid
        # ---------------------------------------------------------------
        elif mode == "ALL_ANGLES":
            layout.prop(wtd, "tolerance", slider=True, text="Tolerance")
            layout.separator(factor=0.5)

            if _pixel_diff._diff_results:
                grid = layout.grid_flow(
                    row_major=True, columns=2, even_columns=True, even_rows=False
                )
                for angle in ANGLE_NAMES:
                    diff_data = _pixel_diff._diff_results.get(angle)
                    cell = grid.column()
                    cell.label(text=angle.capitalize())
                    if diff_data is not None:
                        _, pct = diff_data
                        cell.label(text=f"{pct:.1f}% changed")
                        img = bpy.data.images.get(f"wtd_diff_{angle}")
                        if img:
                            cell.template_preview(img, show_buttons=False)
                    else:
                        cell.label(text="Not computed")
            else:
                layout.operator("wtd.all_angles_view", text="Run All Angles", icon="PLAY")
