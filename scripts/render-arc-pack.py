"""Render an inspection sheet in a separate Blender process."""
import bpy
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
for x, name in [(-3, 'arc-rifle'), (0, 'armored-infected'), (3, 'arc-tower')]:
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(root / 'public/models/arc-pack' / (name + '.glb')))
    objects = set(bpy.data.objects) - previous
    group = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(group)
    for obj in objects:
        if obj.parent is None:
            obj.parent = group
    group.location.x = x
    if name == 'arc-rifle':
        group.scale = (1.5, 1.5, 1.5)
        group.location.z = .9
bpy.ops.object.camera_add(location=(6, -12, 8))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,1)) - camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'; camera.data.ortho_scale = 10
scene = bpy.context.scene; scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.background_type = 'WORLD'
scene.world = bpy.data.worlds.new('Review background')
scene.world.color = (.035,.045,.055)
scene.render.resolution_x = 1500; scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.filepath = str(root / 'artifacts/arc-pack-models.png')
bpy.ops.render.render(write_still=True)
