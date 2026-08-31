import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
print("Importing 221MB gippsland_quarry_sand.glb...")
bpy.ops.import_scene.gltf(filepath="gippsland_quarry_sand.glb")

print("Exporting compressed GLB with Draco compression...")
bpy.ops.export_scene.gltf(
    filepath="models/quarry-sand.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=75,
    export_draco_mesh_compression_enable=True
)
print("SAND_COMPRESSION_SUCCESS")
