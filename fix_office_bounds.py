#!/usr/bin/env python3
import json
import struct
import os

file_path = '90s_retro_office_pack.glb'

with open(file_path, 'rb') as f:
    magic = f.read(4)
    version, length = struct.unpack('<II', f.read(8))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    bin_bytes = f.read()

json_data = json.loads(json_bytes.decode('utf-8'))
nodes = json_data['nodes']
meshes = json_data['meshes']
accessors = json_data['accessors']

nodes_to_remove = set()
for idx, n in enumerate(nodes):
    m_idx = n.get('mesh', None)
    if m_idx is not None and m_idx < len(meshes):
        for p in meshes[m_idx].get('primitives', []):
            pos_idx = p.get('attributes', {}).get('POSITION', None)
            if pos_idx is not None:
                acc = accessors[pos_idx]
                mx = acc.get('max', [0,0,0])
                if any(v > 100 for v in mx):
                    nodes_to_remove.add(idx)
                    print(f"Removing outlier node [{idx}] (max position = {mx})")

for scene in json_data.get('scenes', []):
    scene['nodes'] = [idx for idx in scene.get('nodes', []) if idx not in nodes_to_remove]

for n in nodes:
    if 'children' in n:
        n['children'] = [idx for idx in n['children'] if idx not in nodes_to_remove]

for idx in nodes_to_remove:
    nodes[idx].pop('mesh', None)
    nodes[idx].pop('children', None)

new_json_str = json.dumps(json_data, separators=(',', ':'))
new_json_bytes = new_json_str.encode('utf-8')
padding = (4 - (len(new_json_bytes) % 4)) % 4
new_json_bytes += b' ' * padding

new_chunk_len = len(new_json_bytes)
new_total_len = 12 + 8 + new_chunk_len + len(bin_bytes)

with open(file_path, 'wb') as f:
    f.write(magic)
    f.write(struct.pack('<II', version, new_total_len))
    f.write(struct.pack('<II', new_chunk_len, chunk_type))
    f.write(new_json_bytes)
    f.write(bin_bytes)

print("SUCCESS! Outlier nodes removed from 90s_retro_office_pack.glb.")
