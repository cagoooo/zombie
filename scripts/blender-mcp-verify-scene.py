import bpy
from mathutils import Quaternion

# A separate review scene preserves the user's game assets and any other scenes.
scene = bpy.data.scenes.new('DEADZONE_C_MCP_Review')
bpy.context.window.scene = scene
scene.blendermcp_use_polyhaven = False
scene.blendermcp_use_sketchfab = False
scene.blendermcp_use_hyper3d = False
scene.blendermcp_use_hunyuan3d = False
scene.blendermcp_use_polypizza = False
bpy.ops.import_scene.gltf(filepath='H:/zombie/public/models/skins/guard-polar-v1.glb')
scene['MCP_verified'] = True
scene['cosmetic_id'] = 'guard-polar'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
        area.spaces.active.region_3d.view_distance = 4.5
        area.spaces.active.region_3d.view_location = (0,0,1)
        area.spaces.active.region_3d.view_rotation = Quaternion((.88,.36,.12,.27)).normalized()
bpy.ops.wm.save_as_mainfile(filepath='H:/zombie/assets-source/blender/skins/mcp-review.blend')
print('MCP scene created, guard GLB imported, review scene saved: ' + scene.name)
