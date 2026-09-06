"""Generate the first cosmetic set with Blender; preserves source files and rigs."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/skins'
MASTERS = ROOT / 'assets-source/blender/skins'
OUT.mkdir(parents=True, exist_ok=True)
MASTERS.mkdir(parents=True, exist_ok=True)
REPORT = []

def material(name, color, metal=0, rough=.65, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = glow
    return mat

for target, source, author, accent in [
    ('guard', 'Characters_Sam_SingleWeapon.gltf', 'Quaternius', (.12,.7,.95)),
    ('pulse', 'pulse-mk2.glb', 'Kenney / DEADZONE', (.68,.88,.15)),
    ('plasma', 'blaster-j.glb', 'Kenney', (1,.35,.12)),
    ('cryo', 'blaster-o.glb', 'Kenney', (.1,.65,.95)),
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Generated masters are reproducible; avoid collisions with Blender's numbered backups.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models' / source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Pistol']
    armor = material('Polar_Armor', (.67,.76,.81), .35, .42)
    graphite = material('Polar_Graphite', (.035,.07,.09), .45, .55)
    energy = material('Polar_Energy', accent, .25, .3, .8)
    for obj in meshes:
        base = len(obj.data.materials)
        for mat in [armor, graphite, energy]: obj.data.materials.append(mat)
        points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        lo = Vector([min(p[i] for p in points) for i in range(3)])
        hi = Vector([max(p[i] for p in points) for i in range(3)])
        extent = hi - lo
        for poly in obj.data.polygons:
            center = obj.matrix_world @ poly.center
            z = (center.z - lo.z) / max(extent.z, .001)
            if target == 'guard':
                # Preserve face/skin atlas. Armored torso and boots share the original rig.
                if z > .91: poly.material_index = base
                elif .45 < z < .78: poly.material_index = base if abs(poly.normal.y) > .35 else base + 1
                elif z < .12: poly.material_index = base + 1
            elif obj.name == 'Energy_Cells':
                poly.material_index = base + 2
            else:
                poly.material_index = base if z > .36 else base + 1
                if z > .78 and abs(poly.normal.z) > .5: poly.material_index = base + 2
    if target != 'guard':
        all_points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes: obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        meshes = [bpy.context.object]
        meshes[0].name = target + '_Polar_Body'
        muzzle = bpy.data.objects.get('Muzzle')
        if not muzzle:
            bpy.ops.object.empty_add(type='ARROWS', location=(0, min(p.y for p in all_points)-.01, .03))
            bpy.context.object.name = 'Muzzle'
        bpy.ops.object.empty_add(type='ARROWS', location=(0, 0, 0))
        bpy.context.object.name = 'Grip'
        bpy.context.object['purpose'] = 'Shared source-origin grip; runtime attaches to Middle1.L'
    for image in bpy.data.images:
        if image.source == 'FILE': image.pack()
    scene = bpy.context.scene
    scene['asset_license'] = 'CC0-1.0'
    scene['source'] = source
    scene['cosmetic_only'] = True
    scene['skin_id'] = target + '-polar'
    blend = MASTERS / (target + '-polar.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    glb = OUT / (target + '-polar-v1.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_extras=True,
        export_animations=target=='guard', export_animation_mode='ACTIONS',
        export_cameras=False, export_lights=False)
    triangles=0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    REPORT.append(dict(target=target, author=author, license='CC0-1.0',
        source='public/models/'+source, path=str(glb.relative_to(ROOT)).replace('\\','/'),
        blend=str(blend.relative_to(ROOT)).replace('\\','/'), bytes=glb.stat().st_size,
        triangles=triangles, sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),
        blender=bpy.app.version_string, workflow='Blender background Python (not MCP)'))
(ROOT/'artifacts/blender-skins-report.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print(json.dumps(REPORT,indent=2))
