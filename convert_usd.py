import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath="models/quarry_raw/scene.usdc")

# Attach images from 0/ folder to materials if needed
for mat in bpy.data.materials:
    if mat.use_nodes:
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            img_node = nodes.new('ShaderNodeTexImage')
            # find corresponding model_baseColor.jpg
            mat_name = mat.name.lower()
            img_path = None
            for f in os.listdir("models/quarry_raw/0"):
                if f.endswith(".jpg") and (mat_name in f or "basecolor" in f):
                    img_path = os.path.join("models/quarry_raw/0", f)
                    break
            if img_path:
                img_node.image = bpy.data.images.load(img_path)
                mat.node_tree.links.new(img_node.outputs['Color'], bsdf.inputs['Base Color'])

bpy.ops.export_scene.gltf(
    filepath="models/quarry-sand.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=75,
    export_draco_mesh_compression_enable=True
)
print("COMPLETED CONVERSION")
