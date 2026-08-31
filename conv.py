import bpy, os
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath='models/quarry_raw/scene.usdc')

img_dir = os.path.abspath('models/quarry_raw/0')
images = [f for f in os.listdir(img_dir) if f.endswith('.jpg')]

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for slot in obj.material_slots:
            mat = slot.material
            if mat and mat.use_nodes:
                bsdf = mat.node_tree.nodes.get('Principled BSDF')
                if bsdf:
                    # check if base color link exists
                    if not bsdf.inputs['Base Color'].is_linked:
                        tex_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
                        # pick matching image
                        match = [img for img in images if mat.name in img]
                        img_file = match[0] if match else images[0]
                        tex_node.image = bpy.data.images.load(os.path.join(img_dir, img_file))
                        mat.node_tree.links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

bpy.ops.export_scene.gltf(filepath='models/quarry-sand.glb', export_format='GLB', export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=70, export_draco_mesh_compression_enable=True)
print('TEXTURED_GLB_EXPORT_SUCCESS')
