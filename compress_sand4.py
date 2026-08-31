import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
print("Importing 221MB gippsland_quarry_sand.glb...")
bpy.ops.import_scene.gltf(filepath="gippsland_quarry_sand.glb")

print("Applying mesh decimation modifier to all objects...")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
        mod.ratio = 0.25 # Keep 25% of geometry for web speed

print("Exporting compressed GLB with Draco...")
bpy.ops.export_scene.gltf(
    filepath="models/quarry-sand.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_apply=True,
    export_draco_mesh_compression_enable=True
)
print("SAND_COMPRESSION_4_SUCCESS")
