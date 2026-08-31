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
    "models/quarry-sand.glb",
    "models/swimming-pool.glb",
]

total_orig = 0
total_new = 0

print("=== STARTING BATCH GLB COMPRESSION ===")

for m in models:
    if not os.path.exists(m):
        print(f"Skipping {m} (file not found)")
        continue
    orig_bytes = os.path.getsize(m)
    orig_mb = orig_bytes / (1024 * 1024)
    total_orig += orig_mb
    out_file = m.replace(".glb", "_compressed.glb")
    print(f"\nCompressing {m} ({orig_mb:.2f} MB)...")
    
    cmd = ["npx", "-y", "gltfpack", "-i", m, "-o", out_file, "-cc", "-vtf"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(out_file) and os.path.getsize(out_file) > 0:
        new_bytes = os.path.getsize(out_file)
        new_mb = new_bytes / (1024 * 1024)
        total_new += new_mb
        pct = (1 - (new_bytes / orig_bytes)) * 100
        print(f"SUCCESS: {m}: {orig_mb:.2f} MB -> {new_mb:.2f} MB (-{pct:.1f}%)")
        os.replace(out_file, m)
    else:
        print(f"FAILED: {m}")
        if res.stderr:
            print(f"Error output: {res.stderr}")
        total_new += orig_mb

if os.path.exists("tienda_22_opt.glb"):
    os.remove("tienda_22_opt.glb")

print("\n=== COMPRESSION COMPLETE ===")
print(f"Total Size Before: {total_orig:.2f} MB")
print(f"Total Size After:  {total_new:.2f} MB")
print(f"Total Savings:     {total_orig - total_new:.2f} MB (-{((1 - total_new/total_orig)*100):.1f}%)")
