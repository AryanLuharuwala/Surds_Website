import bpy
import mathutils

print("=== CONVERTING BLEND FILE TO EASY-TO-EDIT STANDALONE MESHES ===")

scene = bpy.context.scene
if "Retro Office Scene" in bpy.data.collections:
    target_col = bpy.data.collections["Retro Office Scene"]
else:
    target_col = bpy.data.collections.new("Retro Office Scene")
    scene.collection.children.link(target_col)

all_mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"Found {len(all_mesh_objs)} mesh objects in blend file.")

for o in all_mesh_objs:
    for c in list(o.users_collection):
        c.objects.unlink(o)
    target_col.objects.link(o)
    o.parent = None

empties = [o for o in bpy.data.objects if o.type == 'EMPTY']
for e in empties:
    bpy.data.objects.remove(e, do_unlink=True)

for col in list(bpy.data.collections):
    if col.name != "Retro Office Scene":
        bpy.data.collections.remove(col)

for o in target_col.objects:
    o.hide_set(False)
    o.hide_select = False

print(f"Cleaned scene: {len(target_col.objects)} standalone mesh objects in collection 'Retro Office Scene'.")

blend_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.blend'
glb_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.glb'

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Saved {blend_path}")

print(f"Exporting clean GLB to {glb_path}...")
bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
print("EXPORT COMPLETE!")
