import bpy
import os

print("=== REMOVING ONLY THE SINGLE CARDBOARD BOX FROM 90s RETRO OFFICE ===")

blend_backup = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.blend1'
blend_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.blend'
glb_path = '/home/boom/Desktop/SideProjs/Websites/Surds.hvac/90s_retro_office_pack.glb'

if os.path.exists(blend_backup):
    bpy.ops.wm.open_mainfile(filepath=blend_backup)

to_delete = []
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        if 'Mesh_39' in obj.name or 'cardboard' in obj.name.lower():
            to_delete.append(obj)
            print(f"Deleting cardboard box object: \"{obj.name}\"")

for obj in to_delete:
    bpy.data.objects.remove(obj, do_unlink=True)

print(f"\nRemoved {len(to_delete)} cardboard box objects. Room scene (table, chairs, cubicles) intact.")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Saved {blend_path}")

print(f"Exporting to {glb_path}...")
bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
print("EXPORT COMPLETE!")
