"""
lib/types.py — WTD_State PropertyGroup
Single source of truth for all plugin session state.
Stored on bpy.types.Scene.wtd — access via context.scene.wtd.
"""

import bpy


def _update_opacity(self, context):
    if self.active_mode == "GHOST_OVERLAY":
        # Dynamically update alpha on all tint materials
        for mat in bpy.data.materials:
            if "_WTD_tint" in mat.name or "WTD_base_tint" in mat.name:
                if mat.use_nodes:
                    # Find Principled BSDF node
                    for node in mat.node_tree.nodes:
                        if node.type == 'BSDF_PRINCIPLED':
                            node.inputs["Alpha"].default_value = self.opacity
                            break
                # Update Solid mode display color
                c = mat.diffuse_color
                mat.diffuse_color = (c[0], c[1], c[2], self.opacity)

class WTD_State(bpy.types.PropertyGroup):

    # --- File paths ---
    model_a_path: bpy.props.StringProperty(
        name="Model A Path",
        description="Path to the original GLB file",
    )
    model_b_path: bpy.props.StringProperty(
        name="Model B Path",
        description="Path to the modified GLB file",
    )

    # --- Active view mode ---
    active_mode: bpy.props.EnumProperty(
        name="View Mode",
        items=[
            ("SIDE_BY_SIDE",  "Side-by-Side",  "Two synced viewports"),
            ("GHOST_OVERLAY", "Ghost Overlay",  "Both models composited, red/green tinted"),
            ("PIXEL_DIFF",    "Pixel Diff",     "Rendered pixel comparison with red highlights"),
            ("TURNTABLE",     "Turntable",      "Auto-rotating side-by-side"),
            ("ALL_ANGLES",    "All Angles",     "2x3 grid of all 6 angles with per-angle percentages"),
        ],
        default="SIDE_BY_SIDE",
    )

    # --- Diff controls ---
    tolerance: bpy.props.IntProperty(
        name="Tolerance",
        description="Pixel difference tolerance (0 = exact match required, 50 = very lenient)",
        default=10,
        min=0,
        max=50,
    )

    opacity: bpy.props.FloatProperty(
        name="Opacity",
        description="Ghost overlay opacity (default 0.50 matches web app)",
        default=0.50,
        min=0.20,
        max=0.90,
        update=_update_opacity,
    )

    # --- Camera sync (side-by-side mode) ---
    sync_cameras: bpy.props.BoolProperty(
        name="Sync Cameras",
        description="Lock both viewports to orbit together (default: locked)",
        default=True,
    )

    # --- Plugin state flags ---
    models_loaded: bpy.props.BoolProperty(
        name="Models Loaded",
        default=False,
    )
    diff_computed: bpy.props.BoolProperty(
        name="Diff Computed",
        default=False,
    )
    no_differences: bpy.props.BoolProperty(
        name="No Differences",
        description="Set when both models are structurally and visually identical",
        default=False,
    )

    # --- Turntable speed (session state, resets with scene) ---
    turntable_speed: bpy.props.FloatProperty(
        name="Speed (°/frame)",
        description="Turntable rotation speed in degrees per frame",
        default=1.0,
        min=0.1,
        max=10.0,
    )

    # --- Pixel diff angle navigation ---
    active_angle_index: bpy.props.IntProperty(
        name="Active Angle",
        description="Currently focused angle in pixel diff mode (0=front … 5=3/4)",
        default=0,
        min=0,
        max=5,
    )
