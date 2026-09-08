"""Archive isolated final MCP assets in a separate Blender process."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1];dest=root/'assets-source/blender/factory-pack';dest.mkdir(parents=True,exist_ok=True)
for name in ['rail-rifle','dash-infected','shield-infected','rift-boss']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'public/models/factory-pack'/(name+'.glb')))
 bpy.context.scene['license']='CC0-1.0'
 bpy.ops.wm.save_as_mainfile(filepath=str(dest/(name+'.blend')))
