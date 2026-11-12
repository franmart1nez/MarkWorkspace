"""Material-aware EEVEE previews for the corridor production pass."""
import bpy
import math
import os
from mathutils import Vector

from preview_lib import _bounds, _fit_camera


def _temp_material(name, color, roughness=0.9, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    lin = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in color)
    bsdf.inputs['Base Color'].default_value = (*lin, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


def render_eevee(objs, out_dir, prefix, views=None, res=(1200, 1000), hide_others=(),
                 wall=True, floor=True, world_color=(0.035, 0.038, 0.042), margin=1.22):
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    saved = {
        'engine': scene.render.engine,
        'res_x': scene.render.resolution_x,
        'res_y': scene.render.resolution_y,
        'film_transparent': scene.render.film_transparent,
        'filepath': scene.render.filepath,
        'camera': scene.camera,
        'view_transform': scene.view_settings.view_transform,
        'look': scene.view_settings.look,
        'exposure': scene.view_settings.exposure,
    }
    world = scene.world
    saved_world = world.use_nodes if world else None
    saved_bg = None
    if world and world.use_nodes:
        bg = world.node_tree.nodes.get('Background')
        if bg:
            saved_bg = tuple(bg.inputs['Color'].default_value), bg.inputs['Strength'].default_value

    temp_objects = []
    hidden = []
    cam_data = bpy.data.cameras.new('EeveeCam_TMP')
    cam_data.lens = 58.0
    cam_data.sensor_fit = 'HORIZONTAL'
    cam = bpy.data.objects.new('EeveeCam_TMP', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    try:
        scene.render.engine = 'BLENDER_EEVEE'
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGB'
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
        scene.view_settings.exposure = 0.0
        if world is None:
            world = bpy.data.worlds.new('CorridorPreviewWorld_TMP')
            scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (*world_color, 1)
        bg.inputs['Strength'].default_value = 0.30

        keep = set(objs)
        for other in hide_others:
            if other not in keep and not other.hide_render:
                other.hide_render = True
                other.hide_set(True)
                hidden.append(other)

        mn, mx = _bounds(objs)
        center = (mn + mx) * 0.5
        width = max(mx.x - mn.x, 0.6)
        wall_mat = _temp_material('CorridorPreviewWall_TMP', (0.36, 0.345, 0.295), roughness=0.95)
        floor_mat = _temp_material('CorridorPreviewFloor_TMP', (0.20, 0.20, 0.195), roughness=0.9)
        floor_z = 0.0 if mn.z >= -0.05 else mn.z
        if wall:
            bpy.ops.mesh.primitive_plane_add(size=1.0, location=(center.x, mn.y - 0.01, floor_z + 1.9))
            w = bpy.context.active_object
            w.name = 'CorridorPreviewWall_TMP'
            w.scale = (width + 2.4, 3.8, 1.0)
            w.rotation_euler = (math.radians(90), 0, 0)
            w.data.materials.append(wall_mat)
            temp_objects.append(w)
        if floor:
            bpy.ops.mesh.primitive_plane_add(size=1.0, location=(center.x, mn.y + 1.9, floor_z - 0.005))
            fl = bpy.context.active_object
            fl.name = 'CorridorPreviewFloor_TMP'
            fl.scale = (width + 2.4, 3.6, 1.0)
            fl.data.materials.append(floor_mat)
            temp_objects.append(fl)

        # three-point-ish studio light for material response
        lights = []
        diag = (mx - mn).length
        k = max(1.0, diag / 1.7)
        for name, dx, dy, dz, energy, size in (
                ('key', -1.9, 2.2, 2.6, 300, 2.2),
                ('fill', 2.4, 2.6, 1.4, 120, 2.6),
                ('rim', 0.5, 4.0, 2.8, 180, 1.6)):
            ld = bpy.data.lights.new('CorridorPreviewLight_%s_TMP' % name, type='AREA')
            ld.energy = energy * k * k
            ld.size = size * k
            lo = bpy.data.objects.new('CorridorPreviewLight_%s_TMP' % name, ld)
            scene.collection.objects.link(lo)
            lo.location = (center.x + dx * k, mn.y + dy * k, floor_z + dz * k)
            direction = (Vector((center.x, mn.y, center.z)) - lo.location).normalized()
            lo.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            lights.append((lo, ld))

        corners = []
        for o in objs:
            for c in o.bound_box:
                corners.append(o.matrix_world @ Vector(c))

        if views is None:
            views = [('front', (0.0, 1.0, 0.12)), ('threequarter', (0.62, 1.0, 0.34))]
        outputs = []
        for label, direction in views:
            if isinstance(direction, tuple) and len(direction) == 2 and hasattr(direction[0], '__len__'):
                loc, target = direction
                cam.location = loc
                cam.rotation_euler = (Vector(target) - Vector(loc)).normalized().to_track_quat('-Z', 'Y').to_euler()
                bpy.context.view_layer.update()
            else:
                _fit_camera(cam, scene, center, direction, corners, margin=margin)
            path = os.path.join(out_dir, '%s_%s.png' % (prefix, label))
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            outputs.append(path)
        return outputs
    finally:
        for other in hidden:
            other.hide_set(False)
            other.hide_render = False
        for lo, ld in lights:
            bpy.data.objects.remove(lo, do_unlink=True)
            bpy.data.lights.remove(ld)
        for o in temp_objects:
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cam_data)
        scene.render.engine = saved['engine']
        scene.render.resolution_x = saved['res_x']
        scene.render.resolution_y = saved['res_y']
        scene.render.film_transparent = saved['film_transparent']
        scene.render.filepath = saved['filepath']
        scene.camera = saved['camera']
        scene.view_settings.view_transform = saved['view_transform']
        scene.view_settings.look = saved['look']
        scene.view_settings.exposure = saved['exposure']
        if saved_bg:
            bg.inputs['Color'].default_value = saved_bg[0]
            bg.inputs['Strength'].default_value = saved_bg[1]

