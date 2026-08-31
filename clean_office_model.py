#!/usr/bin/env python3
import json
import struct
import os
import subprocess

file_path = '90s_retro_office_pack.glb'
print(f"Reading {file_path}...")

with open(file_path, 'rb') as f:
    magic = f.read(4)
    version, length = struct.unpack('<II', f.read(8))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    bin_bytes = f.read()

json_data = json.loads(json_bytes.decode('utf-8'))

# Node 136 is GLTF_SceneRootNode
scene_root = json_data['nodes'][136]
orig_children = scene_root['children']
scene_root['children'] = orig_children[:39]

print(f"Pruned template nodes: reduced children count from {len(orig_children)} to {len(scene_root['children'])}.")

new_json_str = json.dumps(json_data, separators=(',', ':'))
new_json_bytes = new_json_str.encode('utf-8')
padding = (4 - (len(new_json_bytes) % 4)) % 4
new_json_bytes += b' ' * padding

new_chunk_len = len(new_json_bytes)
new_total_len = 12 + 8 + new_chunk_len + len(bin_bytes)

temp_path = '90s_retro_office_pack_clean.glb'
with open(temp_path, 'wb') as f:
    f.write(magic)
    f.write(struct.pack('<II', version, new_total_len))
    f.write(struct.pack('<II', new_chunk_len, chunk_type))
    f.write(new_json_bytes)
    f.write(bin_bytes)

print(f"Saved temporary GLB {temp_path}. Running gltfpack optimization...")

cmd = ['npx', '-y', 'gltfpack', '-i', temp_path, '-o', file_path, '-cc', '-vtf']
subprocess.run(cmd, check=True)

if os.path.exists(temp_path):
    os.remove(temp_path)

final_mb = os.path.getsize(file_path) / (1024 * 1024)
print(f"SUCCESS! Cleaned 90s Retro Office model saved as {file_path} ({final_mb:.2f} MB).")
