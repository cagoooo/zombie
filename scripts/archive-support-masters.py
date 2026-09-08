"""Archive only isolated MCP-exported GLBs, never the open Blender project."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dest=root/'assets-source/blender/support-pack'
dest.mkdir(parents=True,exist_ok=True)
for name in ['shield-station','repair-station']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root/'public/models/support-pack'/(name+'.glb')))
    bpy.context.scene['license']='CC0-1.0'
    bpy.ops.wm.save_as_mainfile(filepath=str(dest/(name+'.blend')))
