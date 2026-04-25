"""
lib/cleanup.py — Scene cleanup utilities.
Removes all WTD_* objects, collections, materials, cameras, and images.
Called by OT_ResetDiff and add-on unregister().
"""

import bpy


def remove_collection(name: str):
    """Remove a named collection and all its objects from the scene."""
    col = bpy.data.collections.get(name)
    if not col:
        return
    for obj in list(col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(col)


def full_cleanup():
    """Remove everything WTD added to the scene."""

    # Remove WTD collections (and their objects)
    for name in ("WTD_ModelA", "WTD_ModelB"):
        remove_collection(name)

    # Remove any remaining WTD_* objects (cameras, lights, etc.)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("WTD_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    # Remove tinted materials
    for mat in list(bpy.data.materials):
        if "_WTD_tint" in mat.name:
            bpy.data.materials.remove(mat)

    # Remove temporary render images
    for img in list(bpy.data.images):
        if img.name.startswith("wtd_"):
            bpy.data.images.remove(img)

    # Remove WTD collections that may have been left empty
    for col in list(bpy.data.collections):
        if col.name.startswith("WTD_"):
            bpy.data.collections.remove(col)
