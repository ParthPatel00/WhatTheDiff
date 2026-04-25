"""
lib/structural_diff.py — Structural comparison between two model collections.
Computes StructuralDelta and caches it. Panels read via get().
Never called from draw() — only called when models load.
"""

import bpy
from dataclasses import dataclass, field


@dataclass
class StructuralDelta:
    # Vertex / triangle counts
    vertex_a: int = 0
    vertex_b: int = 0
    tri_a: int = 0
    tri_b: int = 0

    # Object counts
    obj_count_a: int = 0
    obj_count_b: int = 0

    # Animation counts
    anim_count_a: int = 0
    anim_count_b: int = 0

    # Bounding box (width, depth, height)
    bbox_a: tuple = (0.0, 0.0, 0.0)
    bbox_b: tuple = (0.0, 0.0, 0.0)

    # Material diffs
    mat_names_a: list = field(default_factory=list)
    mat_names_b: list = field(default_factory=list)
    mats_added: list = field(default_factory=list)    # in B but not A
    mats_removed: list = field(default_factory=list)  # in A but not B
    mats_modified: list = field(default_factory=list) # same name, different properties


_delta: StructuralDelta | None = None


def get() -> StructuralDelta | None:
    return _delta


def compute(col_a: bpy.types.Collection, col_b: bpy.types.Collection) -> StructuralDelta:
    global _delta

    def count_verts_tris(col):
        verts = tris = 0
        for obj in col.all_objects:
            if obj.type == "MESH" and obj.data:
                verts += len(obj.data.vertices)
                tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)
        return verts, tris

    def get_bbox_dims(col):
        from .model_loader import get_bounds
        from mathutils import Vector
        depsgraph = bpy.context.evaluated_depsgraph_get()
        all_pts = []
        for obj in col.all_objects:
            if obj.type != "MESH":
                continue
            obj_eval = obj.evaluated_get(depsgraph)
            world_bbox = [obj_eval.matrix_world @ Vector(c) for c in obj_eval.bound_box]
            all_pts.extend(world_bbox)
        if not all_pts:
            return (0.0, 0.0, 0.0)
        xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
        return (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

    def get_material_names(col):
        names = set()
        for obj in col.all_objects:
            if obj.type == "MESH":
                for slot in obj.material_slots:
                    if slot.material:
                        names.add(slot.material.name)
        return names

    def get_material_props(col, name):
        """Return a dict of key properties for a named material."""
        for obj in col.all_objects:
            for slot in obj.material_slots:
                m = slot.material
                if m and m.name == name and m.use_nodes:
                    for node in m.node_tree.nodes:
                        if node.type == "BSDF_PRINCIPLED":
                            return {
                                "base_color": tuple(node.inputs["Base Color"].default_value),
                                "roughness":  node.inputs["Roughness"].default_value,
                                "metallic":   node.inputs["Metallic"].default_value,
                            }
        return {}

    va, ta = count_verts_tris(col_a)
    vb, tb = count_verts_tris(col_b)

    mats_a = get_material_names(col_a)
    mats_b = get_material_names(col_b)
    added   = sorted(mats_b - mats_a)
    removed = sorted(mats_a - mats_b)
    shared  = mats_a & mats_b
    modified = []
    for name in sorted(shared):
        props_a = get_material_props(col_a, name)
        props_b = get_material_props(col_b, name)
        if props_a != props_b:
            modified.append(name)

    def _count_animations(col):
        """Count distinct actions used by objects in this collection."""
        actions = set()
        for obj in col.all_objects:
            if obj.animation_data and obj.animation_data.action:
                actions.add(obj.animation_data.action.name)
        return len(actions)

    anim_a = _count_animations(col_a)
    anim_b = _count_animations(col_b)

    _delta = StructuralDelta(
        vertex_a=va, vertex_b=vb,
        tri_a=ta, tri_b=tb,
        obj_count_a=len(list(col_a.all_objects)),
        obj_count_b=len(list(col_b.all_objects)),
        anim_count_a=anim_a,
        anim_count_b=anim_b,
        bbox_a=get_bbox_dims(col_a),
        bbox_b=get_bbox_dims(col_b),
        mat_names_a=sorted(mats_a),
        mat_names_b=sorted(mats_b),
        mats_added=added,
        mats_removed=removed,
        mats_modified=modified,
    )
    return _delta
