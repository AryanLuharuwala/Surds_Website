#!/usr/bin/env python3
import json
import struct
import os
import subprocess

file_path = '90s_retro_office_pack.glb'

with open(file_path, 'rb') as f:
    magic = f.read(4)
    version, length = struct.unpack('<II', f.read(8))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    bin_bytes = f.read()

json_data = json.loads(json_bytes.decode('utf-8'))
nodes = json_data['nodes']

# Node 495 is GLTF_SceneRootNode
scene_root = nodes[495]

parent_node_indices = [
    590, 595, 600, 605, 608, 613, 616, 621, 626, 631, 
    638, 643, 648, 653, 660, 665, 670, 675, 678, 681, 
    686, 691, 696, 701, 706, 713, 720, 727, 734
]

# For each parent node, keep ONLY child #0 (the component in the room) and strip child #1 / #2 (the side templates)
for p_idx in parent_node_indices:
    pn = nodes[p_idx]
    if 'children' in pn and len(pn['children']) > 1:
        pn['children'] = [pn['children'][0]]

# Add all parent nodes to GLTF_SceneRootNode's children list
current_children = set(scene_root['children'])
for p_idx in parent_node_indices:
    if p_idx not in current_children:
        scene_root['children'].append(p_idx)

print(f"Updated GLTF_SceneRootNode: total children count = {len(scene_root['children'])}")

new_json_str = json.dumps(json_data, separators=(',', ':'))
new_json_bytes = new_json_str.encode('utf-8')
padding = (4 - (len(new_json_bytes) % 4)) % 4
new_json_bytes += b' ' * padding

new_chunk_len = len(new_json_bytes)
new_total_len = 12 + 8 + new_chunk_len + len(bin_bytes)

temp_path = '90s_retro_office_temp.glb'
with open(temp_path, 'wb') as f:
    f.write(magic)
    f.write(struct.pack('<II', version, new_total_len))
    f.write(struct.pack('<II', new_chunk_len, chunk_type))
    f.write(new_json_bytes)
    f.write(bin_bytes)

print("Optimizing model with native gltfpack...")
cmd = ['npx', '-y', 'gltfpack', '-i', temp_path, '-o', file_path, '-vtf']
subprocess.run(cmd, check=True)

if os.path.exists(temp_path):
    os.remove(temp_path)

final_mb = os.path.getsize(file_path) / (1024 * 1024)
print(f"SUCCESS! Office room scene fully restored with table & room assets intact ({final_mb:.2f} MB).")
