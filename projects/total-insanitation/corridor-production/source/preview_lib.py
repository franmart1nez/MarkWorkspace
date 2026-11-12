"""Native Blender preview renders for the corridor production pass."""
import bpy
import math
import os
import json
from mathutils import Vector


def _bounds(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def _fit_camera(cam, scene, center, direction, corners, margin=1.16):
    from bpy_extras.object_utils import world_to_camera_view
    d = Vector(direction).normalized()
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    dist = 2.0
    for _ in range(4):
        cam.location = center + d * dist
        bpy.context.view_layer.update()
        extent = 0.0
        for p in corners:
            co = world_to_camera_view(scene, cam, p)
            extent = max(extent, abs(co.x - 0.5), abs(co.y - 0.5))
        if extent <= 1e-6:
            break
        target = 0.5 / margin
        dist *= extent / target
    cam.location = center + d * dist
    bpy.context.view_layer.update()


def _setup_scene():
    scene = bpy.context.scene
    saved = {
        'engine': scene.render.engine,
        'res_x': scene.render.resolution_x,
        'res_y': scene.render.resolution_y,
        'pct': scene.render.resolution_percentage,
        'film_transparent': scene.render.film_transparent,
        'filepath': scene.render.filepath,
        'camera': scene.camera,
        'light': scene.display.shading.light,
        'color_type': scene.display.shading.color_type,
        'show_shadows': scene.display.shading.show_shadows,
        'show_cavity': scene.display.shading.show_cavity,
        'cavity_type': scene.display.shading.cavity_type,
        'show_specular': scene.display.shading.show_specular_highlight,
        'background_type': scene.display.shading.background_type,
        'background_color': tuple(scene.display.shading.background_color),
        'render_aa': scene.display.render_aa,
        'view_transform': scene.view_settings.view_transform,
        'look': scene.view_settings.look,
        'image_settings': scene.render.image_settings.file_format,
        'color_mode': scene.render.image_settings.color_mode,
    }
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = False
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.curvature_ridge_factor = 1.0
    scene.display.shading.curvature_valley_factor = 1.0
    scene.display.shading.show_specular_highlight = False
    scene.display.shading.background_type = 'VIEWPORT'
    scene.display.shading.background_color = (0.235, 0.245, 0.255)
    scene.display.render_aa = '16'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    return saved


def _restore_scene(saved):
    scene = bpy.context.scene
    scene.render.engine = saved['engine']
    scene.render.resolution_x = saved['res_x']
    scene.render.resolution_y = saved['res_y']
    scene.render.resolution_percentage = saved['pct']
    scene.render.film_transparent = saved['film_transparent']
    scene.render.filepath = saved['filepath']
    scene.camera = saved['camera']
    scene.display.shading.light = saved['light']
    scene.display.shading.color_type = saved['color_type']
    scene.display.shading.show_shadows = saved['show_shadows']
    scene.display.shading.show_cavity = saved['show_cavity']
    scene.display.shading.cavity_type = saved['cavity_type']
    scene.display.shading.show_specular_highlight = saved['show_specular']
    scene.display.shading.background_type = saved['background_type']
    scene.display.shading.background_color = saved['background_color']
    scene.display.render_aa = saved['render_aa']
    scene.view_settings.view_transform = saved['view_transform']
    scene.view_settings.look = saved['look']
    scene.render.image_settings.file_format = saved['image_settings']
    scene.render.image_settings.color_mode = saved['color_mode']


def render_views(objs, out_dir, prefix, views=None, res=(1400, 900), extra_objs=None,
                 ortho=False, distance_factor=2.6, hide_others=()):
    """views: list of (label, direction_vector, up_hint)."""
    os.makedirs(out_dir, exist_ok=True)
    saved = _setup_scene()
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = res
    cam_data = bpy.data.cameras.new('PreviewCam_TMP')
    cam_data.type = 'PERSP'
    cam_data.lens = 55.0
    cam_data.sensor_fit = 'HORIZONTAL'
    cam = bpy.data.objects.new('PreviewCam_TMP', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    bpy.context.view_layer.objects.active = cam
    outputs = []
    hidden = []
    try:
        keep = set(objs) | set(extra_objs or [])
        for other in hide_others:
            if other not in keep and not other.hide_render:
                other.hide_render = True
                other.hide_set(True)
                hidden.append(other)
        all_objs = list(objs) + list(extra_objs or [])
        mn, mx = _bounds(all_objs)
        center = (mn + mx) * 0.5
        if views is None:
            views = [
                ('front', (0.0, 1.0, 0.06), 'Y'),
                ('side', (1.0, 0.55, 0.06), 'X'),
                ('detail', (0.55, 1.0, 0.30), 'D'),
            ]
        corners = []
        for o in all_objs:
            for c in o.bound_box:
                p = o.matrix_world @ Vector(c)
                corners.append(p)
        for label, direction, up in views:
            d = Vector(direction).normalized()
            _fit_camera(cam, scene, center, d, corners, margin=1.16)
            path = os.path.join(out_dir, f'{prefix}_{label}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            outputs.append(path)
    finally:
        for other in hidden:
            other.hide_set(False)
            other.hide_render = False
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cam_data)
        _restore_scene(saved)
    return outputs


def build_context_wall(material_wall, material_floor, x0=-1.0, width=6.0, height=4.0, name_prefix='PreviewCtx_TMP'):
    """Temporary wall + floor used only for the assembly preview render."""
    created = []
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(x0 + width * 0.5, 0.0, height * 0.5))
    wall = bpy.context.active_object
    wall.name = name_prefix + '_Wall'
    wall.scale = (width, 1.0, height)
    wall.rotation_euler = (math.radians(90), 0, 0)
    wall.data.materials.append(material_wall)
    created.append(wall)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(x0 + width * 0.5, 2.5, 0.0))
    floor = bpy.context.active_object
    floor.name = name_prefix + '_Floor'
    floor.scale = (width, 5.0, 1.0)
    floor.data.materials.append(material_floor)
    created.append(floor)
    return created
