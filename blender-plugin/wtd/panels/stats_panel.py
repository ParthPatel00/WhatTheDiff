"""
panels/stats_panel.py — Persistent structural diff sidebar.
Always visible across all view modes (parity item P13).
Reads from lib.structural_diff.get() — never recomputes on draw().
"""

import bpy
from bpy.types import Panel
from ..lib import structural_diff
from ..lib.colors import get_stats_icons


def _get_prefs(context):
    addon_key = __package__.split(".")[0]
    return context.preferences.addons[addon_key].preferences


class WTD_PT_StatsPanel(Panel):
    bl_label = "Structural Diff"
    bl_idname = "WTD_PT_stats_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WhatTheDiff"
    bl_order = 1

    @classmethod
    def poll(cls, context):
        return context.scene.wtd.models_loaded

    def draw(self, context):
        layout = self.layout
        prefs = _get_prefs(context)
        icons = get_stats_icons(prefs.colorblind_mode)
        delta = structural_diff.get()

        if delta is None:
            layout.label(text="Loading structural data…", icon="TIME")
            return

        # --- Summary table ---
        def stat_row(label, val_a, val_b, delta_val):
            row = layout.row()
            row.label(text=label)
            row.label(text=str(val_a))
            row.label(text=str(val_b))
            if delta_val > 0:
                row.label(text=f"+{delta_val}", icon=icons["added"])
            elif delta_val < 0:
                row.label(text=str(delta_val), icon=icons["removed"])
            else:
                row.label(text="—", icon=icons["none"])

        # Header
        header = layout.row()
        header.label(text="Property")
        header.label(text="A")
        header.label(text="B")
        header.label(text="Δ")

        layout.separator(factor=0.5)

        stat_row("Vertices",   delta.vertex_a,    delta.vertex_b,    delta.vertex_b - delta.vertex_a)
        stat_row("Triangles",  delta.tri_a,       delta.tri_b,       delta.tri_b - delta.tri_a)
        stat_row("Objects",    delta.obj_count_a, delta.obj_count_b, delta.obj_count_b - delta.obj_count_a)
        stat_row("Animations", delta.anim_count_a,delta.anim_count_b,delta.anim_count_b - delta.anim_count_a)

        layout.separator(factor=0.5)

        # Bounding box
        layout.label(text="Bounding Box", icon="CUBE")
        ba = delta.bbox_a
        bb = delta.bbox_b
        layout.label(text=f"  A: {ba[0]:.2f} × {ba[1]:.2f} × {ba[2]:.2f}")
        layout.label(text=f"  B: {bb[0]:.2f} × {bb[1]:.2f} × {bb[2]:.2f}")

        layout.separator(factor=0.5)

        # Materials summary
        layout.label(text="Materials", icon="MATERIAL")
        if delta.mats_added:
            for m in delta.mats_added:
                layout.label(text=f"  + {m}", icon=icons["added"])
        if delta.mats_removed:
            for m in delta.mats_removed:
                layout.label(text=f"  − {m}", icon=icons["removed"])
        if delta.mats_modified:
            for m in delta.mats_modified:
                layout.label(text=f"  ~ {m}", icon=icons["modified"])
        if not (delta.mats_added or delta.mats_removed or delta.mats_modified):
            layout.label(text="  No material changes", icon=icons["none"])
