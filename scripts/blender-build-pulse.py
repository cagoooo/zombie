"""Run with Blender --background --python scripts/blender-build-pulse.py."""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets-source' / 'blender'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models/blaster-a.glb'))
original = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(c) for o in original for c in o.bound_box]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
# Blender Y is the barrel axis; glTF exports it as -Z. Keep the source rig/origin.
energy = bpy.data.materials.new('DEADZONE_Energy_Lime')
energy.use_nodes = True
shader = energy.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (.68, .88, .15, 1)
shader.inputs['Emission Color'].default_value = (.68, .88, .15, 1)
shader.inputs['Emission Strength'].default_value = 1.7
shader.inputs['Metallic'].default_value = .35
shader.inputs['Roughness'].default_value = .35
for side in [-1, 1]:
    for i in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(side * .094, -.08 + i * .065, .015))
        cell = bpy.context.object
        cell.name = f'Energy_Cell_{side}_{i}'
        cell.dimensions = (.012, .035, .055)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        cell.data.materials.append(energy)
bpy.ops.object.select_all(action='DESELECT')
cells = [o for o in bpy.context.scene.objects if o.name.startswith('Energy_Cell_')]
for cell in cells:
    cell.select_set(True)
bpy.context.view_layer.objects.active = cells[0]
bpy.ops.object.join()
bpy.context.object.name = 'Energy_Cells'
bpy.ops.object.empty_add(type='ARROWS', location=(0, lo.y - .01, .03))
bpy.context.object.name = 'Muzzle'
bpy.context.object['purpose'] = 'Local muzzle anchor for runtime effects; not a projectile collider'
for image in bpy.data.images:
    if image.source == 'FILE':
        image.pack()
scene = bpy.context.scene
scene['asset_license'] = 'Kenney CC0-1.0; energy detail additions by DEADZONE project'
scene['source'] = 'public/models/blaster-a.glb'
scene['export_note'] = 'Export glTF 2.0 / GLB, Y up; keep Muzzle node'
scene['gameplay_note'] = 'Damage, cooldown, collision and heat are controlled in JavaScript'
blend = OUT / 'pulse-mk2.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb = ROOT / 'public/models/pulse-mk2.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_extras=True, export_animations=False, export_cameras=False, export_lights=False)
triangles = 0
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
report = {'blender': bpy.app.version_string, 'source': 'public/models/blaster-a.glb', 'blend': str(blend.relative_to(ROOT)), 'glb': str(glb.relative_to(ROOT)), 'bytes': glb.stat().st_size, 'sha256': hashlib.sha256(glb.read_bytes()).hexdigest(), 'triangles': triangles, 'meshes': len([o for o in scene.objects if o.type == 'MESH']), 'muzzle': True, 'embedded_textures': True}
(ROOT / 'artifacts/blender-build-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
