"""
lib/model_loader.py — GLB import helpers.
Handles collection management and bounding box computation.
"""

import bpy
from mathutils import Vector


def ensure_collection(name: str) -> bpy.types.Collection:
    """Return named collection, creating and linking to scene master if needed."""
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def move_to_collection(objects: list, target: bpy.types.Collection):
    """Move objects into target collection, removing from all others."""
    for obj in objects:
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        target.objects.link(obj)


def get_bounds(collection: bpy.types.Collection) -> tuple[Vector, float]:
    """
    Returns (center, radius) for all mesh objects in the collection.
    Uses evaluated (post-modifier) bounding boxes.
    Returns (Vector(0,0,0), 1.0) as fallback if collection is empty.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    all_points = []

    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue
        obj_eval = obj.evaluated_get(depsgraph)
        world_bbox = [obj_eval.matrix_world @ Vector(corner) for corner in obj_eval.bound_box]
        all_points.extend(world_bbox)

    if not all_points:
        return Vector((0.0, 0.0, 0.0)), 1.0

    min_co = Vector((min(p.x for p in all_points), min(p.y for p in all_points), min(p.z for p in all_points)))
    max_co = Vector((max(p.x for p in all_points), max(p.y for p in all_points), max(p.z for p in all_points)))
    center = (min_co + max_co) / 2.0
    radius = max((p - center).length for p in all_points)
    radius = max(radius, 0.01)  # guard against zero-size models

    return center, radius
