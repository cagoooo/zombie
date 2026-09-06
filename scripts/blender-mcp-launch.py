"""Enable the installed addon and start its local socket without changing the scene."""
import bpy
import addon_utils

addon_utils.enable('blender_mcp', default_set=True, persistent=True)
prefs = bpy.context.preferences.addons['blender_mcp'].preferences
prefs.telemetry_consent = False
for name in ['polyhaven', 'sketchfab', 'hyper3d', 'hunyuan3d', 'polypizza']:
    setattr(bpy.context.scene, 'blendermcp_use_' + name, False)
bpy.context.scene.blendermcp_port = 9876
bpy.ops.wm.save_userpref()
if not getattr(bpy.types, 'blendermcp_server', None):
    bpy.ops.blendermcp.start_server()
print('DEADZONE: Blender MCP ready; localhost:9876; telemetry disabled', flush=True)
