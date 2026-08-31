import bpy
import mathutils
import os

print("=== CLEANING JOINED CARDBOARD BOX & SIDE TEMPLATE OBJECTS IN BLENDER ===")

view_layer_objs = [o for o in bpy.context.view_layer.objects if o.type == 'MESH']

for obj in view_layer_objs:
    try:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.separate(type='LOOSE')
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception as e:
        if bpy.ops.object.mode_set.poll():
            bpy.ops.object.mode_set(mode='OBJECT')

def get_center(o):
    bbox = [o.matrix_world @ mathutils.Vector(corner) for corner in o.bound_box]
    return [sum(v[i] for v in bbox) / 8.0 for i in range(3)]

to_delete = []
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH':
        ctr = get_center(obj)
        if ctr[0] > 3.8 or ctr[1] < -2.8 or ctr[0] < -3.5:
            to_delete.append(obj)
            print(f"Deleting far-off object \"{obj.name}\" at center {[round(c, 2) for c in ctr]}")

for obj in to_delete:
    bpy.data.objects.remove(obj, do_unlink=True)

print(f"\nRemoved {len(to_delete)} far-off template objects.")

blend_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.blend'
glb_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.glb'

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Saved {blend_path}")

print(f"Exporting to {glb_path}...")
bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
print("EXPORT COMPLETE!")
