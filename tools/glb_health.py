#!/usr/bin/env python3
"""Report whether a .glb still has usable geometry.

Run this BEFORE and AFTER any optimisation step. gltfpack quantises positions
into a fixed integer grid sized to the whole scene's bounding box, so if a
scene has a stray object thousands of metres away, every normal-sized prop
collapses to a single point and the geometry is gone for good. That is exactly
what happened to 90s_retro_office_pack.glb.

    python3 tools/glb_health.py model.glb [more.glb ...]
"""
import json
import os
import struct
import sys


def read_gltf_json(path):
    with open(path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            raise ValueError('%s is not a binary glTF' % path)
        f.read(8)
        chunk_len, _ = struct.unpack('<II', f.read(8))
        return json.loads(f.read(chunk_len).decode('utf-8'))


def node_scale_for_mesh(gltf):
    """Map mesh index -> the scale on a node that references it.

    KHR_mesh_quantization stores integer positions and carries the
    dequantisation factor on the node, so raw accessor min/max means nothing
    without it.
    """
    out = {}
    for n in gltf.get('nodes', []):
        if 'mesh' in n and n['mesh'] not in out:
            out[n['mesh']] = [abs(v) for v in n.get('scale', [1, 1, 1])]
    return out


def audit(path):
    gltf = read_gltf_json(path)
    scales = node_scale_for_mesh(gltf)
    accessors = gltf['accessors']

    total = dead = tiny = 0
    extents = []
    scene_min = [1e30] * 3
    scene_max = [-1e30] * 3

    for mi, mesh in enumerate(gltf.get('meshes', [])):
        sc = scales.get(mi, [1, 1, 1])
        for prim in mesh.get('primitives', []):
            pos = prim.get('attributes', {}).get('POSITION')
            if pos is None:
                continue
            acc = accessors[pos]
            lo, hi = acc.get('min'), acc.get('max')
            if not lo or not hi:
                continue
            total += 1
            ext = [(hi[k] - lo[k]) * sc[k] for k in range(3)]
            biggest = max(ext)
            extents.append(biggest)
            if biggest == 0:
                dead += 1
            elif biggest < 0.001:
                tiny += 1
            for k in range(3):
                scene_min[k] = min(scene_min[k], lo[k] * sc[k])
                scene_max[k] = max(scene_max[k], hi[k] * sc[k])

    extents.sort()
    pct = lambda p: extents[int(p / 100 * (len(extents) - 1))] if extents else 0

    print('%s  (%.1f MB)' % (os.path.basename(path), os.path.getsize(path) / 1048576))
    print('  generator   : %s' % gltf.get('asset', {}).get('generator', '?'))
    print('  extensions  : %s' % (gltf.get('extensionsUsed') or 'none'))
    print('  nodes %d   meshes %d   primitives %d' % (
        len(gltf.get('nodes', [])), len(gltf.get('meshes', [])), total))
    print('  scene span  : %.2f x %.2f x %.2f m' % tuple(
        scene_max[k] - scene_min[k] for k in range(3)))
    print('  prim size   : p25 %.4g m   median %.4g m   p75 %.4g m   max %.4g m' % (
        pct(25), pct(50), pct(75), pct(100)))
    print('  COLLAPSED   : %d of %d primitives have zero extent' % (dead, total))
    print('  sub-mm      : %d' % tiny)
    healthy = dead == 0 and tiny == 0
    print('  verdict     : %s' % ('OK' if healthy else 'DAMAGED - geometry is unrecoverable from this file'))
    print()
    return healthy


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    ok = all([audit(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
