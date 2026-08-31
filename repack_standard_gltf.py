#!/usr/bin/env python3
import os
import subprocess

models = [
    "tienda_22.glb",
    "90s_retro_office_pack.glb",
    "appartement.glb",
    "living_room_interior_free.glb",
    "gippsland_quarry_sand.glb",
    "models/iramk4.glb",
    "models/swimming-pool.glb",
]

print("=== RE-PACKING TO STANDARD COMPLIANT GLTF 2.0 (NO EXT_meshopt REQUIRED) ===")

for m in models:
    if not os.path.exists(m):
        continue
    out_file = m.replace(".glb", "_std.glb")
    orig_mb = os.path.getsize(m) / (1024 * 1024)
    print(f"\nProcessing {m} ({orig_mb:.2f} MB)...")
    
    # Using gltfpack -c -vtf produces standard GLTF 2.0 with geometry quantization, fully supported natively
    cmd = ["npx", "-y", "gltfpack", "-i", m, "-o", out_file, "-c", "-vtf"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(out_file) and os.path.getsize(out_file) > 0:
        new_mb = os.path.getsize(out_file) / (1024 * 1024)
        print(f"SUCCESS: {m}: {orig_mb:.2f} MB -> {new_mb:.2f} MB")
        os.replace(out_file, m)
    else:
        print(f"FAILED: {m}: {res.stderr}")

if os.path.exists("tienda_22_std.glb"):
    os.remove("tienda_22_std.glb")

print("\n=== RE-PACKING COMPLETE ===")
