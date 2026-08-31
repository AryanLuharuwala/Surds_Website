import bpy, os

bpy.ops.wm.read_factory_settings(use_empty=True)
print("Importing 221MB gippsland_quarry_sand.glb...")
bpy.ops.import_scene.gltf(filepath="gippsland_quarry_sand.glb")

print("Downsampling textures...")
for img in bpy.data.images:
    if img.has_data:
        # Resize large 4K/8K maps to 2048px max
        w, h = img.size[0], img.size[1]
        if w > 2048 or h > 2048:
            new_w = min(w, 2048)
            new_h = min(h, 2048)
            img.scale(new_w, new_h)

print("Exporting optimized GLB...")
bpy.ops.export_scene.gltf(
    filepath="models/quarry-sand.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=65,
    export_draco_mesh_compression_enable=True
)
print("SAND_COMPRESSION_2_SUCCESS")
