import bpy
from mathutils import Quaternion

bpy.ops.wm.open_mainfile(filepath='H:/zombie/assets-source/blender/skins/plasma-polar.blend')
bpy.context.preferences.filepaths.save_version = 0
material = bpy.data.materials['Polar_Energy']
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Emission Color'].default_value = (1,.35,.12,1)
shader.inputs['Emission Strength'].default_value = .9
bpy.context.scene['finish_workflow'] = 'Blender MCP execute_blender_code'
bpy.ops.wm.save_as_mainfile(filepath='H:/zombie/assets-source/blender/skins/plasma-polar.blend')
window = bpy.context.window_manager.windows[0]
area = next(area for area in window.screen.areas if area.type == 'VIEW_3D')
region = next(region for region in area.regions if region.type == 'WINDOW')
with bpy.context.temp_override(window=window, area=area, region=region):
    bpy.ops.export_scene.gltf(filepath='H:/zombie/public/models/skins/plasma-polar-v1.glb',export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
for area in window.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
        area.spaces.active.overlay.show_overlays = False
        area.spaces.active.region_3d.view_distance = 1.1
        area.spaces.active.region_3d.view_location = (0,0,0)
        area.spaces.active.region_3d.view_rotation = Quaternion((.7,.6,.25,.2)).normalized()
print('MCP finished orange weapon-identification emission and exported the game GLB.')
