"""Original CC0 support stations, authored via Blender MCP in isolated scenes."""
import bpy, math
window=bpy.context.window_manager.windows[0]
original=window.scene
def material(name,color,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=.6;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
def box(name,loc,scale,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
dark=material('SupportGraphite',(.07,.11,.15))
steel=material('SupportSteel',(.35,.44,.5))
try:
    for kind in ['shield','repair']:
        scene=bpy.data.scenes.new('DEADZONE_SUPPORT_'+kind);window.scene=scene
        area=next(a for a in window.screen.areas if a.type=='VIEW_3D')
        region=next(r for r in area.regions if r.type=='WINDOW')
        with bpy.context.temp_override(window=window,area=area,region=region):
            glow=material(kind+'Energy',(.1,.55,1) if kind=='shield' else (.1,1,.35),1.2)
            box('Foundation',(0,0,.18),(1.4,1.4,.36),dark)
            box('Housing',(0,0,.85),(.8,.8,1.1),steel)
            for x in [-.48,.48]:
                box('EnergyStrut',(x,0,.95),(.1,.58,1.2),glow)
            if kind=='shield':
                for z in [1.4,1.7]:
                    bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=4,major_radius=.55,minor_radius=.06,location=(0,0,z))
                    bpy.context.object.data.materials.append(glow)
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.25,location=(0,0,1.65));bpy.context.object.data.materials.append(glow)
            else:
                box('MedicalPanel',(0,-.43,1.05),(.64,.08,.64),dark)
                box('CrossVertical',(0,-.49,1.05),(.12,.04,.48),glow)
                box('CrossHorizontal',(0,-.49,1.05),(.48,.04,.12),glow)
                box('Reservoir',(0,0,1.6),(.55,.55,.4),glow)
            scene['license']='CC0-1.0';scene['author']='DEADZONE original procedural geometry via Blender MCP'
            bpy.ops.export_scene.gltf(filepath='H:/zombie/public/models/support-pack/'+kind+'-station.glb',export_format='GLB',use_active_scene=True)
            triangles=0
            for o in scene.objects:
                if o.type=='MESH':
                    o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
            print(kind,triangles)
finally:
    window.scene=original
