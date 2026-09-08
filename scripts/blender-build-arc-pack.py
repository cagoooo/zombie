"""Execute via Blender MCP in an isolated scene; never replace the open project."""
import bpy, math, json
# Create public/models/arc-pack externally before passing this source to MCP.
out = 'H:/zombie/public/models/arc-pack/'
window = bpy.context.window_manager.windows[0]
original = window.scene
report = []
def material(name, color, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = .5
    bs.inputs['Roughness'].default_value = .4
    bs.inputs['Emission Color'].default_value = (*color, 1)
    bs.inputs['Emission Strength'].default_value = glow
    return m
dark = material('ARC_Graphite', (.055,.075,.11))
steel = material('ARC_Titanium', (.36,.42,.52))
violet = material('ARC_Ion', (.62,.15,1), 1.4)
flesh = material('ARC_Infected', (.24,.42,.22))
orange = material('ARC_Danger', (1,.25,.035), 1)
def box(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    return o
def ring(name, loc, radius, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=12, minor_segments=4, location=loc, major_radius=radius, minor_radius=.035)
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    return o
try:
    for kind in ['arc-rifle','armored-infected','arc-tower']:
        scene=bpy.data.scenes.new('DEADZONE_'+kind)
        window.scene=scene
        area=next(a for a in window.screen.areas if a.type=='VIEW_3D')
        region=next(r for r in area.regions if r.type=='WINDOW')
        with bpy.context.temp_override(window=window, area=area, region=region):
            if kind=='arc-rifle':
                box('Receiver',(0,0,.15),(.25,.72,.24),dark)
                box('Stock',(0,.44,.12),(.2,.28,.3),steel)
                box('GripShell',(0,.15,-.08),(.14,.17,.32),dark)
                for x in [-.17,.17]:
                    box('SplitRail',(x,-.46,.15),(.09,.65,.12),steel)
                    box('IonRail',(x,-.47,.22),(.045,.56,.025),violet)
                for y in [-.1,.04,.18]:
                    r=ring('Coil',(0,y,.17),.17,violet); r.rotation_euler.x=math.pi/2
                for name,loc in [('Grip',(0,.15,-.04)),('Muzzle',(0,-.8,.15))]:
                    bpy.ops.object.empty_add(location=loc); bpy.context.object.name=name
            elif kind=='armored-infected':
                box('Torso',(0,0,1.13),(.64,.36,.62),dark)
                box('ChestPlate',(0,-.24,1.22),(.72,.17,.5),steel)
                box('HazardCore',(0,-.34,1.25),(.2,.045,.2),orange)
                box('InfectedHead',(0,0,1.7),(.37,.35,.38),flesh)
                box('BrokenHelmet',(0,.06,1.91),(.44,.37,.1),steel)
                box('Eyes',(0,-.185,1.74),(.26,.035,.05),orange)
                for x in [-.23,.23]:
                    leg=box('Leg',(x,0,.43),(.23,.28,.82),dark)
                    for frame,angle in [(1,-.18),(13,.18),(25,-.18)]:
                        leg.rotation_euler.x=angle*(1 if x>0 else -1)
                        leg.keyframe_insert(data_path='rotation_euler',frame=frame)
                    boot=box('Boot',(x,-.08,.09),(.29,.46,.18),steel)
                    matrix=boot.matrix_world.copy()
                    boot.parent=leg
                    boot.matrix_world=matrix
                    box('Arm',(x*2, -.1,1.18),(.22,.27,.65),flesh)
                    box('Shoulder',(x*2,0,1.5),(.34,.4,.2),steel)
                scene.frame_end=25; scene.render.fps=24
            else:
                box('Foundation',(0,0,.16),(1.5,1.5,.32),dark)
                box('PowerCabinet',(0,0,.65),(.68,.68,.8),steel)
                for z in [.9,1.2,1.5]: ring('InductionRing',(0,0,z),.42,violet)
                for x in [-.42,.42]:
                    box('Pylon',(x,0,1.2),(.13,.22,1.55),dark)
                    box('Emitter',(x,0,1.98),(.23,.3,.18),violet)
            scene['workflow']='Blender MCP execute_blender_code'
            scene['license']='CC0-1.0; original procedural DEADZONE geometry'
            scene.frame_set(1)
            path=out+kind+'.glb'
            bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_active_scene=True,export_extras=True,export_animations=kind=='armored-infected',export_cameras=False,export_lights=False)
            triangles=0
            for obj in scene.objects:
                if obj.type=='MESH':
                    obj.data.calc_loop_triangles(); triangles+=len(obj.data.loop_triangles)
            report.append({'id':kind,'triangles':triangles,'workflow':scene['workflow']})
finally:
    window.scene=original
print(json.dumps(report))
