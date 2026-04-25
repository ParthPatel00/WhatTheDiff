"""
lib/camera_sync.py — Camera sync handler for side-by-side mode.
Registered as a depsgraph_update_post handler.
Must be unregistered in __init__.unregister() — stale handlers persist across sessions.
"""

import bpy

_syncing = False


def sync_cameras(scene, depsgraph):
    """Copy WTD_CamA matrix to WTD_CamB when sync is enabled."""
    global _syncing
    if not hasattr(scene, "wtd"):
        return
    if not scene.wtd.sync_cameras or _syncing:
        return

    _syncing = True
    try:
        cam_a = bpy.data.objects.get("WTD_CamA")
        cam_b = bpy.data.objects.get("WTD_CamB")
        if cam_a and cam_b:
            cam_b.matrix_world = cam_a.matrix_world.copy()
    finally:
        _syncing = False


def register_sync():
    if sync_cameras not in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.append(sync_cameras)


def unregister_sync():
    if sync_cameras in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.remove(sync_cameras)
