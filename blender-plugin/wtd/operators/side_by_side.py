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
    # Remove stale camera
    existing = bpy.data.objects.get(name)
    if existing:
        bpy.data.objects.remove(existing, do_unlink=True)

    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = 50  # 50mm — matches web app FOV approximately

    cam_obj = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    # Position: pull back from center along Y axis at calculated distance
    fov_rad = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
    distance = (radius / math.sin(fov_rad / 2)) * 1.5   # 1.5× for comfortable framing
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
    Isolate a VIEW_3D area by hiding the unwanted collection's objects
    from the viewport on a per-object basis, then entering local view
    for only the objects belonging to show_col_name.

    Strategy (Blender-5.x reliable approach):
      1. Set hide_viewport = True on all objects of hide_col_name.
      2. Set hide_viewport = False on all objects of show_col_name.
      3. In the area's context, select only show_col_name objects and enter local view.
      4. Immediately restore hide_viewport flags after local view is entered —
         local view captures its own set, so restoring flags has no further effect.
    """
    col_show = bpy.data.collections.get(show_col_name)
    col_hide = bpy.data.collections.get(hide_col_name)
    if not col_show:
        return

    # Step 1 & 2: Adjust global hide_viewport temporarily
    show_objects = list(col_show.all_objects)
    hide_objects = list(col_hide.all_objects) if col_hide else []

    for obj in hide_objects:
        obj.hide_viewport = True
    for obj in show_objects:
        obj.hide_viewport = False

    # Step 3: Enter local view inside this specific area
    region = _get_window_region(area)
    if region:
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

    # Step 4: Restore hide_viewport — local view already has its own captured set
    for obj in hide_objects:
        obj.hide_viewport = False


def _restore_single_viewport(screen):
    """
    Collapse to a single VIEW_3D area if multiple exist.
    """
    areas = _get_view3d_areas(screen)
    if len(areas) <= 1:
        return
    # Close all but the first VIEW_3D area
    for area in areas[1:]:
        override = {"area": area}
        try:
            bpy.ops.screen.area_close(override)
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
        _restore_single_viewport(context.screen)

        # --- 2. Find the primary VIEW_3D area ---
        areas = _get_view3d_areas(context.screen)
        if not areas:
            self.report({"ERROR"}, "No 3D Viewport found.")
            return {"CANCELLED"}
        primary_area = areas[0]

        # --- 3. Split vertically 50/50 ---
        with context.temp_override(area=primary_area):
            bpy.ops.screen.area_split(direction="VERTICAL", factor=0.5)

        # --- 4. Identify left and right VIEW_3D areas after split ---
        areas_after = _get_view3d_areas(context.screen)
        if len(areas_after) < 2:
            self.report({"ERROR"}, "Area split failed.")
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

        # --- 7. Isolate collections per viewport FIRST (local view locks in the set),
        #         then assign cameras so the perspective is respected.
        #         Order matters: isolate → assign camera.
        _isolate_area_via_hide(left_area,  show_col_name="WTD_ModelA", hide_col_name="WTD_ModelB")
        _isolate_area_via_hide(right_area, show_col_name="WTD_ModelB", hide_col_name="WTD_ModelA")

        # Camera assignment AFTER local view — localview() resets view_perspective
        # to PERSP, so we must re-set it afterwards.
        _set_area_camera(left_area,  cam_a)
        _set_area_camera(right_area, cam_b)

        # --- 8. Ensure sync lock is on and register handler ---
        wtd.sync_cameras = True
        camera_sync.register_sync()

        # --- 9. Set mode ---
        wtd.active_mode = "SIDE_BY_SIDE"

        self.report({"INFO"}, "Side-by-side view ready.")
        return {"FINISHED"}
