"""
lib/material_tint.py — Ghost overlay material tinting.
Clones materials before tinting so originals are never mutated (parity item P8).
Restoring swaps cloned materials back out and removes WTD tint copies.
"""

import bpy


# ---------------------------------------------------------------------------
# Tint application
# ---------------------------------------------------------------------------

def tint_collection(collection: bpy.types.Collection, color_rgb: tuple, opacity: float):
    """
    Clone every material on every mesh in the collection, apply tint color + opacity.
    Originals are stored in obj["_wtd_orig_mats"] for restore.
    """
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue

        orig_mats = []
        tinted_mats = []

        if len(obj.material_slots) == 0:
            clone = bpy.data.materials.new("WTD_base_tint")
            _build_tint_nodes(clone, color_rgb, opacity)
            tinted_mats.append(clone)
            orig_mats.append(None)
        else:
            for slot in obj.material_slots:
                original = slot.material
                orig_mats.append(original)

                if original:
                    clone = original.copy()
                    clone.name = f"{original.name}_WTD_tint"
                else:
                    clone = bpy.data.materials.new("WTD_base_tint")

                _build_tint_nodes(clone, color_rgb, opacity)
                tinted_mats.append(clone)

        # Store originals for restore
        obj["_wtd_orig_mats"] = [m.name if m else "" for m in orig_mats]

        # Apply tinted clones
        obj.data.materials.clear()
        for mat in tinted_mats:
            obj.data.materials.append(mat)


def _build_tint_nodes(mat: bpy.types.Material, color_rgb: tuple, opacity: float):
    """Replace node tree with a single transparent Principled BSDF at the given tint color."""
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    mat.show_transparent_back = False

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out  = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    r, g, b = color_rgb
    
    # Viewport display color for Solid mode (crucial for Blender viewport parity)
    mat.diffuse_color = (r, g, b, opacity)
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Alpha"].default_value = opacity
    bsdf.inputs["Roughness"].default_value = 0.6

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # Layout
    bsdf.location = (-300, 0)
    out.location  = (0, 0)


# ---------------------------------------------------------------------------
# Tint restoration
# ---------------------------------------------------------------------------

def restore_collection(collection: bpy.types.Collection):
    """
    Restore original materials on all objects in the collection.
    Removes WTD tint material copies.
    """
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue

        orig_names = obj.get("_wtd_orig_mats")
        if orig_names is None:
            continue

        # Remove tint clones
        current_mats = list(obj.material_slots)
        obj.data.materials.clear()

        # Re-link original materials
        for name in orig_names:
            mat = bpy.data.materials.get(name) if name else None
            obj.data.materials.append(mat)

        # Clean up tint materials
        for slot in current_mats:
            if slot.material and "_WTD_tint" in slot.material.name:
                bpy.data.materials.remove(slot.material)

        del obj["_wtd_orig_mats"]
