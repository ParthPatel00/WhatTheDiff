"""
operators/side_by_side.py — OT_SideBySideView
Splits the active 3D viewport into two vertical halves.
Left shows WTD_ModelA, right shows WTD_ModelB.
Cameras are auto-framed on each model's bounding sphere.
Camera sync is locked by default (parity items P3, P4, P5).
"""

import bpy
import math
from mathutils import Vector, Euler
from ..lib import camera_sync, model_loader


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_view3d_areas(screen):
    return [a for a in screen.areas if a.type == "VIEW_3D"]


def _create_camera(name: str, center: Vector, radius: float) -> bpy.types.Object:
    """Create (or reuse) a named camera auto-framed on the model's bounding sphere."""
    existing = bpy.data.objects.get(name)
    if existing:
        bpy.data.objects.remove(existing, do_unlink=True)

    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = 50  # 50mm

    cam_obj = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    fov_rad = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
    distance = (radius / math.sin(fov_rad / 2)) * 1.5
    distance = max(distance, 0.5)

    cam_obj.location = center + Vector((0.0, -distance, radius * 0.3))
    cam_obj.rotation_euler = Euler((math.radians(75), 0.0, 0.0))

    return cam_obj


def _set_area_camera(area, cam_obj):
    """Point a VIEW_3D area at a specific camera object and enter camera view."""
    for space in area.spaces:
        if space.type == "VIEW_3D":
            space.camera = cam_obj
            space.region_3d.view_perspective = "CAMERA"
            break


def _get_window_region(area):
    for region in area.regions:
        if region.type == "WINDOW":
            return region
    return None


def _isolate_area_via_hide(area, show_col_name: str, hide_col_name: str):
    """
    Isolate a VIEW_3D area by hiding the unwanted collection's objects globally,
    entering local view (which captures the visible objects), and then ALWAYS 
    restoring global visibility via try...finally so the scene isn't broken.
    """
    col_show = bpy.data.collections.get(show_col_name)
    col_hide = bpy.data.collections.get(hide_col_name)
    if not col_show:
        return

    show_objects = list(col_show.all_objects)
    hide_objects = list(col_hide.all_objects) if col_hide else []

    try:
        # 1. Hide unwanted objects globally
        for obj in hide_objects:
            obj.hide_viewport = True
        for obj in show_objects:
            obj.hide_viewport = False

        region = _get_window_region(area)
        if not region:
            return

        with bpy.context.temp_override(area=area, region=region):
            # Exit local view if already active
            for space in area.spaces:
                if space.type == "VIEW_3D" and space.local_view is not None:
                    try:
                        bpy.ops.view3d.localview(frame_selected=False)
                    except Exception:
                        pass
                    break

            # Select only the visible (show) objects
            bpy.ops.object.select_all(action="DESELECT")
            active_obj = None
            for obj in show_objects:
                obj.select_set(True)
                if active_obj is None and obj.type == "MESH":
                    active_obj = obj

            if active_obj:
                bpy.context.view_layer.objects.active = active_obj
            elif show_objects:
                bpy.context.view_layer.objects.active = show_objects[0]

            # Enter local view — this captures exactly the selected objects
            try:
                bpy.ops.view3d.localview(frame_selected=False)
            except Exception:
                pass

    finally:
        # ALWAYS restore global hide_viewport so we don't break the scene!
        for obj in hide_objects:
            obj.hide_viewport = False
        for obj in show_objects:
            obj.hide_viewport = False


def restore_default_viewport_state(context):
    """
    Collapse to a single VIEW_3D area and clear any local view overrides.
    Must loop backwards because area_close invalidates the areas list.
    """
    # 1. Collapse areas
    while True:
        areas = _get_view3d_areas(context.screen)
        if len(areas) <= 1:
            break
        
        area_to_close = areas[-1]
        region = _get_window_region(area_to_close)
        
        override = {
            "window": context.window,
            "screen": context.screen,
            "area": area_to_close,
        }
        if region:
            override["region"] = region
            
        try:
            with context.temp_override(**override):
                bpy.ops.screen.area_close()
        except Exception:
            break

    # 2. Clear local view on remaining areas
    for area in _get_view3d_areas(context.screen):
        for space in area.spaces:
            if space.type == "VIEW_3D" and space.local_view is not None:
                region = _get_window_region(area)
                if region:
                    override = {
                        "window": context.window,
                        "screen": context.screen,
                        "area": area,
                        "region": region
                    }
                    try:
                        with context.temp_override(**override):
                            bpy.ops.view3d.localview(frame_selected=False)
                    except Exception:
                        pass


# ---------------------------------------------------------------------------
# Operator
# ---------------------------------------------------------------------------

class WTD_OT_SideBySideView(bpy.types.Operator):
    bl_idname = "wtd.side_by_side_view"
    bl_label = "Side-by-Side"
    bl_description = "Split viewport into two synced views — Model A (left) and Model B (right)"

    def execute(self, context):
        wtd = context.scene.wtd

        if not wtd.models_loaded:
            self.report({"WARNING"}, "Load both models first.")
            return {"CANCELLED"}

        # --- 1. Ensure single viewport to start clean ---
        restore_default_viewport_state(context)

        # --- 2. Find the primary VIEW_3D area ---
        areas = _get_view3d_areas(context.screen)
        if not areas:
            self.report({"ERROR"}, "No 3D Viewport found.")
            return {"CANCELLED"}
        primary_area = areas[0]

        # --- 3. Split vertically 50/50 ---
        region = _get_window_region(primary_area)
        override = {"area": primary_area}
        if region:
            override["region"] = region
            
        with context.temp_override(**override):
            bpy.ops.screen.area_split(direction="VERTICAL", factor=0.5)

        # --- 4. Identify left and right VIEW_3D areas after split ---
        areas_after = _get_view3d_areas(context.screen)
        if len(areas_after) < 2:
            self.report({"ERROR"}, "Area split failed. Are you in a valid workspace?")
            return {"CANCELLED"}

        # Sort by x position: left area has smaller x
        areas_after.sort(key=lambda a: a.x)
        left_area  = areas_after[0]
        right_area = areas_after[-1]

        # --- 5. Compute bounding info for each model ---
        col_a = bpy.data.collections.get("WTD_ModelA")
        col_b = bpy.data.collections.get("WTD_ModelB")

        center_a, radius_a = model_loader.get_bounds(col_a) if col_a else (Vector(), 1.0)
        center_b, radius_b = model_loader.get_bounds(col_b) if col_b else (Vector(), 1.0)

        # --- 6. Create cameras ---
        cam_a = _create_camera("WTD_CamA", center_a, radius_a)
        cam_b = _create_camera("WTD_CamB", center_b, radius_b)

        # --- 7. Isolate collections per viewport FIRST
        _isolate_area_via_hide(left_area,  show_col_name="WTD_ModelA", hide_col_name="WTD_ModelB")
        _isolate_area_via_hide(right_area, show_col_name="WTD_ModelB", hide_col_name="WTD_ModelA")

        # --- 8. Camera assignment AFTER local view
        _set_area_camera(left_area,  cam_a)
        _set_area_camera(right_area, cam_b)

        # --- 9. Ensure sync lock is on and register handler ---
        wtd.sync_cameras = True
        camera_sync.register_sync()

        # --- 10. Set mode ---
        wtd.active_mode = "SIDE_BY_SIDE"

        self.report({"INFO"}, "Side-by-side view ready.")
        return {"FINISHED"}
