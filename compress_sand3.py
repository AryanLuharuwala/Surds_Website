import bpy, os, io
from PIL import Image

bpy.ops.wm.read_factory_settings(use_empty=True)
print("Importing 221MB gippsland_quarry_sand.glb...")
bpy.ops.import_scene.gltf(filepath="gippsland_quarry_sand.glb")

print("Resizing images via PIL...")
for img in bpy.data.images:
    if img.packed_file:
        try:
            buf = io.BytesIO(img.packed_file.data)
            im = Image.open(buf)
            w, h = im.size
            if w > 1024 or h > 1024:
                im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                out_buf = io.BytesIO()
                im.save(out_buf, format="JPEG", quality=75)
                img.packed_file.data = out_buf.getvalue()
                print(f"Resized image {img.name} from {w}x{h} to {im.size[0]}x{im.size[1]}")
        except Exception as e:
            print("Error resizing image:", e)

print("Exporting compressed GLB with Draco...")
bpy.ops.export_scene.gltf(
    filepath="models/quarry-sand.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_draco_mesh_compression_enable=True
)
print("SAND_COMPRESSION_3_SUCCESS")
