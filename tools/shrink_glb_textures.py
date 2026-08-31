#!/usr/bin/env python3
"""Downscale the textures inside a .glb without touching its geometry.

    python3 tools/shrink_glb_textures.py in.glb out.glb [max_px] [quality]

Why this rather than gltfpack: the quarry model's geometry is already
Draco-compressed, which gltfpack cannot read without Draco support, and
re-exporting through Blender would decompress the meshes and lose more than it
saved. But the geometry was never the problem - 87% of that file is JPEG. So
this rewrites only the image bufferViews and copies every other byte through
untouched, leaving the Draco payload exactly as it was.

Every bufferView offset has to be recomputed as a result, since shrinking an
image shifts everything after it in the binary chunk. Accessor byteStride and
all non-image views are preserved verbatim.
"""
import io
import json
import os
import struct
import sys

from PIL import Image


def read_glb(path):
    with open(path, 'rb') as f:
        magic, version, _ = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF':
            raise SystemExit('%s is not a binary glTF' % path)
        json_len, json_type = struct.unpack('<II', f.read(8))
        gltf = json.loads(f.read(json_len).decode('utf-8'))
        bin_len, bin_type = struct.unpack('<II', f.read(8))
        blob = f.read(bin_len)
    return gltf, blob


def pad4(b):
    return b + b'\x00' * ((4 - len(b) % 4) % 4)


def main():
    src = sys.argv[1]
    dst = sys.argv[2]
    max_px = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    quality = int(sys.argv[4]) if len(sys.argv) > 4 else 82

    gltf, blob = read_glb(src)
    views = gltf['bufferViews']
    images = gltf.get('images', [])

    # which bufferViews hold images, and what the replacement bytes are
    replacement = {}
    saved = 0
    for i, im in enumerate(images):
        vi = im.get('bufferView')
        if vi is None:
            continue
        v = views[vi]
        off = v.get('byteOffset', 0)
        raw = blob[off:off + v['byteLength']]
        try:
            img = Image.open(io.BytesIO(raw))
            img.load()
        except Exception as e:
            print('  image%-3d skipped (%s)' % (i, e))
            continue
        w, h = img.size
        scale = min(1.0, float(max_px) / max(w, h))
        if scale >= 1.0 and img.format == 'JPEG':
            continue                      # already small enough, leave it alone
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        if scale < 1.0:
            img = img.resize((nw, nh), Image.LANCZOS)
        buf = io.BytesIO()
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        img.save(buf, format='JPEG', quality=quality, optimize=True, progressive=True)
        new = buf.getvalue()
        if len(new) >= len(raw):
            continue                      # re-encoding made it worse; keep the original
        replacement[vi] = new
        im['mimeType'] = 'image/jpeg'
        saved += len(raw) - len(new)
        print('  image%-3d %5dx%-5d -> %4dx%-4d  %6.1f MB -> %5.1f MB'
              % (i, w, h, nw, nh, len(raw) / 1048576, len(new) / 1048576))

    if not replacement:
        print('nothing to shrink')
        return

    # rebuild the binary chunk; every offset after a shrunk image moves
    out = bytearray()
    for vi, v in enumerate(views):
        off = v.get('byteOffset', 0)
        data = replacement.get(vi, blob[off:off + v['byteLength']])
        while len(out) % 4:
            out.append(0)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(data)
        out += data
    gltf['buffers'][0]['byteLength'] = len(out)
    if 'uri' in gltf['buffers'][0]:
        del gltf['buffers'][0]['uri']

    json_bytes = pad4(json.dumps(gltf, separators=(',', ':')).encode('utf-8'))
    bin_bytes = pad4(bytes(out))
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack('<II', len(bin_bytes), 0x004E4942))
        f.write(bin_bytes)

    a, b = os.path.getsize(src), os.path.getsize(dst)
    print('\n%s  %.1f MB  ->  %s  %.1f MB   (%.0f%% smaller)'
          % (os.path.basename(src), a / 1048576, os.path.basename(dst), b / 1048576,
             (1 - b / a) * 100))


main()
