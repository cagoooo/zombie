"""Run in a separate background Blender, after native MCP GLB export.
This archives only the three exported assets, never the user's open project.
"""
import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dest = root / 'assets-source/blender/arc-pack'
dest.mkdir(parents=True, exist_ok=True)
for name in ['arc-rifle', 'armored-infected', 'arc-tower']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / 'public/models/arc-pack' / (name + '.glb')))
    bpy.context.scene['provenance'] = 'Geometry authored and exported using native Blender MCP; isolated GLB import archive'
    bpy.ops.wm.save_as_mainfile(filepath=str(dest / (name + '.blend')))
