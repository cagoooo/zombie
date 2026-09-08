"""Original CC0 factory pack, executed by Blender MCP with isolated scenes."""
import bpy,math,json
window=bpy.context.window_manager.windows[0];original=window.scene
def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);return m
dark=mat('FactoryGraphite',(.06,.1,.14));steel=mat('FactorySteel',(.45,.55,.6));flesh=mat('FactoryInfected',(.3,.5,.24));blue=mat('FactoryIon',(.1,.65,1));orange=mat('FactoryWarning',(1,.23,.05))
def box(name,loc,size,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
report=[]
try:
 for kind in ['rail-rifle','dash-infected','shield-infected','rift-boss']:
  scene=bpy.data.scenes.new('DEADZONE_FACTORY_'+kind);window.scene=scene
  area=next(a for a in window.screen.areas if a.type=='VIEW_3D');region=next(r for r in area.regions if r.type=='WINDOW')
  with bpy.context.temp_override(window=window,area=area,region=region):
   if kind=='rail-rifle':
    box('Receiver',(0,0,.15),(.25,.7,.25),dark);box('Stock',(0,.45,.15),(.2,.3,.32),steel);box('Handle',(0,.1,-.1),(.14,.17,.35),dark)
    for x in [-.14,.14]:
     box('LongRail',(x,-.65,.16),(.08,1.2,.15),steel);box('IonStrip',(x,-.65,.25),(.035,1.15,.03),blue)
    box('Scope',(0,-.1,.37),(.1,.35,.12),orange)
    for name,loc in [('Grip',(0,.1,-.05)),('Muzzle',(0,-1.25,.16))]:
     bpy.ops.object.empty_add(location=loc);bpy.context.object.name=name
   else:
    boss=kind=='rift-boss';shield=kind=='shield-infected'
    box('Chest',(0,0,1.05),(.7 if boss else .48,.35,.65),dark if boss else flesh)
    box('Head',(0,0,1.62),(.4,.38,.4),flesh);box('Eyes',(0,-.2,1.68),(.28,.03,.06),orange)
    box('EnergyCore',(0,-.2,1.15),(.25,.08,.3),blue if shield else orange)
    for x in [-.22,.22]:
     leg=box('AnimatedLeg',(x,0,.4),(.23,.3,.8),dark)
     for frame,angle in [(1,-.25),(13,.25),(25,-.25)]:
      leg.rotation_euler.x=angle*(1 if x>0 else -1);leg.keyframe_insert(data_path='rotation_euler',frame=frame)
     box('Arm',(x*2,0,1),(.2,.25,.7),flesh)
     if boss:box('ShoulderPlate',(x*2,0,1.5),(.45,.55,.3),steel)
    if shield:box('ShieldEmitter',(0,.26,1.1),(.6,.25,.85),blue)
    if kind=='dash-infected':
     for x in [-.3,.3]:box('SprintFin',(x,.3,1.1),(.12,.3,.6),orange)
    scene.frame_end=25;scene.render.fps=24
   scene['license']='CC0-1.0';scene['workflow']='native Blender MCP';scene.frame_set(1)
   bpy.ops.export_scene.gltf(filepath='H:/zombie/public/models/factory-pack/'+kind+'.glb',export_format='GLB',use_active_scene=True,export_extras=True,export_animations=True)
   triangles=0
   for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
   report.append({'name':kind,'triangles':triangles})
finally:window.scene=original
print(json.dumps(report))
