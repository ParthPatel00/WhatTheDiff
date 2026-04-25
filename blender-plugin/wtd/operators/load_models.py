"""
operators/load_models.py — OT_LoadModelA, OT_LoadModelB
File picker operators for loading GLB files.
On load: imports into named collection, runs structural diff, checks for identical files.
"""

import bpy
import os
from bpy.types import Operator
from bpy_extras.io_utils import ImportHelper
from ..lib import model_loader, structural_diff, cleanup
from ..lib import pixel_diff as _pixel_diff


def _get_file_size_mb(filepath: str) -> float:
    try:
        return os.path.getsize(filepath) / (1024 * 1024)
    except OSError:
        return 0.0


def _load_glb(operator, context, filepath: str, collection_name: str, path_prop: str):
    """Shared load logic for both Model A and Model B."""
    wtd = context.scene.wtd

    # --- Validate extension ---
    if not filepath.lower().endswith(".glb"):
        operator.report({"ERROR"}, f"Only .glb files are supported. Got: {os.path.basename(filepath)}")
        return {"CANCELLED"}

    # --- Validate file size ---
    size_mb = _get_file_size_mb(filepath)
    if size_mb > 500:
        operator.report({"ERROR"}, f"File too large ({size_mb:.0f} MB). Maximum is 500 MB.")
        return {"CANCELLED"}
    if size_mb > 50:
        operator.report({"WARNING"}, f"Large file ({size_mb:.0f} MB) — loading may take a moment.")

    # --- Clean up previous collection ---
    cleanup.remove_collection(collection_name)

    # --- Create target collection and make it active ---
    col = model_loader.ensure_collection(collection_name)
    context.view_layer.active_layer_collection = (
        context.view_layer.layer_collection.children.get(collection_name)
        or context.view_layer.layer_collection
    )

    # --- Import GLB ---
    pre_import_names = {obj.name for obj in bpy.data.objects}
    try:
        bpy.ops.import_scene.gltf(filepath=filepath)
    except Exception as e:
        operator.report({"ERROR"}, f"Failed to import GLB: {e}")
        return {"CANCELLED"}

    # --- Move imported objects into our collection ---
    # Selection is not a reliable source after import, so diff object names.
    imported = [obj for obj in bpy.data.objects if obj.name not in pre_import_names]
    if not imported:
        operator.report({"ERROR"}, "Import finished but no new objects were detected.")
        return {"CANCELLED"}

    model_loader.move_to_collection(imported, col)

    # --- Store path ---
    setattr(wtd, path_prop, filepath)

    # --- Post-load: run diff if both models are loaded ---
    if wtd.model_a_path and wtd.model_b_path:
        col_a = bpy.data.collections.get("WTD_ModelA")
        col_b = bpy.data.collections.get("WTD_ModelB")
        if col_a and col_b:
            delta = structural_diff.compute(col_a, col_b)
            wtd.models_loaded = True
            _pixel_diff.invalidate_cache()  # P11: new file = cache cleared

            # P16: identical file detection
            is_identical = (
                delta.vertex_a == delta.vertex_b
                and delta.tri_a == delta.tri_b
                and not delta.mats_added
                and not delta.mats_removed
                and not delta.mats_modified
                and _bbox_equal(delta.bbox_a, delta.bbox_b)
            )
            wtd.no_differences = is_identical
            wtd.diff_computed = False

    return {"FINISHED"}


def _bbox_equal(a, b, epsilon=1e-4):
    return all(abs(a[i] - b[i]) < epsilon for i in range(3))


# ---------------------------------------------------------------------------
# Load Model A
# ---------------------------------------------------------------------------

class WTD_OT_LoadModelA(Operator, ImportHelper):
    bl_idname = "wtd.load_model_a"
    bl_label = "Load Model A"
    bl_description = "Load the original GLB file for comparison"

    filter_glob: bpy.props.StringProperty(default="*.glb", options={"HIDDEN"})
    filename_ext = ".glb"

    def execute(self, context):
        return _load_glb(self, context, self.filepath, "WTD_ModelA", "model_a_path")


# ---------------------------------------------------------------------------
# Load Model B
# ---------------------------------------------------------------------------

class WTD_OT_LoadModelB(Operator, ImportHelper):
    bl_idname = "wtd.load_model_b"
    bl_label = "Load Model B"
    bl_description = "Load the modified GLB file for comparison"

    filter_glob: bpy.props.StringProperty(default="*.glb", options={"HIDDEN"})
    filename_ext = ".glb"

    def execute(self, context):
        return _load_glb(self, context, self.filepath, "WTD_ModelB", "model_b_path")
