"""Derive a walkable floor grid and a set of fixture anchors from any .glb.

    blender -b --python tools/extract_scene_nav.py -- --in tienda_22.glb \
        --out models/tienda-nav.json [--cell 0.4] [--clearance 0.25] [--wall 1.9]

Why it works this way: the web-optimised GLBs have been through gltfpack, which
merges everything into one mesh split only by material, so there are no
per-prop node names left to anchor to. Instead of naming objects we read the
shape of the room. Every triangle is rasterised into a top-down grid and each
cell becomes one of:

    void      no ground under it - outside the building
    floor     ground with nothing in the body band above it - walkable
    fixture   something standing on the floor: a rack, a shelf, a counter
    wall      geometry running the full height

Two details matter and both were learned the hard way on tienda_22:

* Classify by a *body band* (floor+clearance .. floor+head), never by maximum
  height. Any model with a roof has full-height geometry over every interior
  cell, so a max-height test finds no floor at all.
* Rasterise triangles *exactly*, never by their bounding box. A single large
  slanted triangle - a roof panel, a backdrop - has a bbox covering the whole
  scene and paints every cell as occupied.

Adjacent fixture cells are flood-filled into islands. Each island becomes an
anchor an avatar can walk to and stop at, with its approach cells recorded (the
walkable neighbours it can be browsed from). That yields real dwell targets
without anyone hand-placing a coordinate.

Output coordinates are in glTF space (Y up), matching what three.js sees when it
loads the same file, NOT Blender's Z-up space.
"""
import json
import os
import sys
from collections import deque

import numpy as np

VOID, FLOOR, FIXTURE, WALL = 0, 1, 2, 3


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    a = {'in': None, 'out': None, 'cell': 0.4, 'clearance': 0.25, 'wall': 1.9,
         'head': 1.8, 'ground': 0.35, 'region': 'furnished', 'roi': None}
    for i, tok in enumerate(argv):
        key = tok[2:]
        if tok in ('--in', '--out', '--region'):
            a[key] = argv[i + 1]
        elif tok == '--roi':
            a['roi'] = [float(v) for v in argv[i + 1].split(',')]
        elif tok in ('--cell', '--clearance', '--wall', '--head', '--ground'):
            a[key] = float(argv[i + 1])
    if not a['in'] or not a['out']:
        raise SystemExit('usage: -- --in <model.glb> --out <nav.json>')
    return a


def load_triangles(path, cache):
    """Triangle soup in Blender world space, (N, 3, 3). Cached, because
    importing a 24 MB GLB takes far longer than everything else here."""
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(path):
        tris = np.load(cache)
        print('  %d triangles (from cache)' % len(tris))
        return tris

    import bpy
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    chunks = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        ev = obj.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        mesh.calc_loop_triangles()
        n = len(mesh.vertices)
        co = np.empty(n * 3, dtype=np.float64)
        mesh.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        m = np.array(obj.matrix_world)
        co = co @ m[:3, :3].T + m[:3, 3]
        idx = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
        mesh.loop_triangles.foreach_get('vertices', idx)
        chunks.append(co[idx.reshape(-1, 3)])
        ev.to_mesh_clear()
    tris = np.concatenate(chunks).astype(np.float32)
    np.save(cache, tris)
    print('  %d triangles (cached to %s)' % (len(tris), os.path.basename(cache)))
    return tris


def cells_of(tris, origin, cols, rows, cell):
    """Yield (rows, cols, zlo, zhi) per triangle - the cells it actually covers
    and the height range it occupies *within each of those cells*.

    Using the triangle's overall z range instead of its per-cell height is what
    broke tienda_22: its ground plane is one 37 x 34 m quad tilted through
    0.29 m, so its global z range clips the body band and every cell in the
    scene reads as obstructed. A large non-vertical triangle is therefore
    sampled on the plane at each cell centre. Vertical triangles (walls) have no
    meaningful per-cell height, so they keep their full range, which is correct.
    """
    ax, ay, az = tris[:, 0, 0], tris[:, 0, 1], tris[:, 0, 2]
    bx, by = tris[:, 1, 0], tris[:, 1, 1]
    cx, cy = tris[:, 2, 0], tris[:, 2, 1]
    zlo = tris[:, :, 2].min(axis=1)
    zhi = tris[:, :, 2].max(axis=1)

    e1 = tris[:, 1] - tris[:, 0]
    e2 = tris[:, 2] - tris[:, 0]
    nx = e1[:, 1] * e2[:, 2] - e1[:, 2] * e2[:, 1]
    ny = e1[:, 2] * e2[:, 0] - e1[:, 0] * e2[:, 2]
    nz = e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]
    nlen = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-20

    gx = np.stack([ax, bx, cx], axis=1)
    gy = np.stack([ay, by, cy], axis=1)
    c0 = np.clip(np.floor((gx.min(axis=1) - origin[0]) / cell).astype(np.int32), 0, cols - 1)
    c1 = np.clip(np.floor((gx.max(axis=1) - origin[0]) / cell).astype(np.int32), 0, cols - 1)
    r0 = np.clip(np.floor((gy.min(axis=1) - origin[1]) / cell).astype(np.int32), 0, rows - 1)
    r1 = np.clip(np.floor((gy.max(axis=1) - origin[1]) / cell).astype(np.int32), 0, rows - 1)
    span = (c1 - c0 + 1) * (r1 - r0 + 1)

    for i in range(len(tris)):
        cc0, cc1, rr0, rr1 = c0[i], c1[i], r0[i], r1[i]
        if span[i] <= 4:
            rr, cc = np.meshgrid(np.arange(rr0, rr1 + 1), np.arange(cc0, cc1 + 1), indexing='ij')
            yield rr.ravel(), cc.ravel(), zlo[i], zhi[i]
            continue

        xs = origin[0] + (np.arange(cc0, cc1 + 1) + 0.5) * cell
        ys = origin[1] + (np.arange(rr0, rr1 + 1) + 0.5) * cell
        px, py = np.meshgrid(xs, ys)
        d1 = (px - bx[i]) * (ay[i] - by[i]) - (ax[i] - bx[i]) * (py - by[i])
        d2 = (px - cx[i]) * (by[i] - cy[i]) - (bx[i] - cx[i]) * (py - cy[i])
        d3 = (px - ax[i]) * (cy[i] - ay[i]) - (cx[i] - ax[i]) * (py - ay[i])
        inside = ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))
        if not inside.any():
            continue
        ri, ci = np.nonzero(inside)
        rr, cc = ri + rr0, ci + cc0

        if abs(nz[i]) / nlen[i] < 0.02:
            yield rr, cc, zlo[i], zhi[i]          # vertical: spans its full height here
        else:
            z = az[i] - (nx[i] * (px[inside] - ax[i]) + ny[i] * (py[inside] - ay[i])) / nz[i]
            z = np.clip(z, zlo[i], zhi[i]).astype(np.float32)
            yield rr, cc, z, z


def lowest_surface(tris, origin, cols, rows, cell):
    lo = np.full((rows, cols), np.inf, dtype=np.float32)
    for rr, cc, zl, _ in cells_of(tris, origin, cols, rows, cell):
        np.minimum.at(lo, (rr, cc), zl)
    return lo


def dominant_floor(lo):
    """Modal lowest-surface height, to 5 cm. The largest flat level in the
    scene is the floor people stand on - more reliable than the global minimum,
    which is usually a base plate or the surrounding terrain."""
    vals = lo[np.isfinite(lo)]
    if not len(vals):
        return 0.0
    keys = np.round(vals * 20) / 20
    u, counts = np.unique(keys, return_counts=True)
    return float(u[counts.argmax()])


def classify(tris, origin, cols, rows, cell, lo, floor_z, a):
    band_lo, band_hi = floor_z + a['clearance'], floor_z + a['head']
    obstructed = np.zeros((rows, cols), dtype=bool)
    tall = np.zeros((rows, cols), dtype=bool)
    ground = np.zeros((rows, cols), dtype=bool)
    top = np.zeros((rows, cols), dtype=np.float32)

    for rr, cc, zl, zh in cells_of(tris, origin, cols, rows, cell):
        g = zl <= floor_z + a['ground']
        in_band = (zh >= band_lo) & (zl <= band_hi)
        is_tall = zh >= floor_z + a['wall']
        overhead = zl > floor_z + 2.4
        if np.isscalar(g) or getattr(g, 'ndim', 0) == 0:
            if g:
                ground[rr, cc] = True
            if in_band:
                obstructed[rr, cc] = True
                if is_tall:
                    tall[rr, cc] = True
            if not overhead:
                np.maximum.at(top, (rr, cc), zh - floor_z)
        else:
            if g.any():
                ground[rr[g], cc[g]] = True
            m = in_band
            if m.any():
                obstructed[rr[m], cc[m]] = True
                mt = m & is_tall
                if mt.any():
                    tall[rr[mt], cc[mt]] = True
            m = ~overhead
            if m.any():
                np.maximum.at(top, (rr[m], cc[m]), zh[m] - floor_z)

    grid = np.full((rows, cols), VOID, dtype=np.int8)
    standable = ground & np.isfinite(lo)
    grid[standable & ~obstructed] = FLOOR
    grid[standable & obstructed & ~tall] = FIXTURE
    grid[standable & obstructed & tall] = WALL
    return grid, top


def pick_walkable_region(grid, mode='furnished'):
    """Keep a single connected floor area and discard the rest.

    Isolated pockets behind a wall would hand the pathfinder goals it can never
    reach. 'largest' is the obvious choice but the wrong one here: these models
    sit on a big ground plane, so the largest floor region is the car park
    outside. 'furnished' instead picks the region touching the most fixtures,
    which is reliably the room someone actually shops in.
    """
    rows, cols = grid.shape
    seen = np.zeros((rows, cols), dtype=bool)
    regions = []
    for r in range(rows):
        for c in range(cols):
            if grid[r, c] != FLOOR or seen[r, c]:
                continue
            region, q = [], deque([(r, c)])
            seen[r, c] = True
            touching = set()
            while q:
                cr, cc = q.popleft()
                region.append((cr, cc))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if not (0 <= nr < rows and 0 <= nc < cols):
                        continue
                    if grid[nr, nc] == FIXTURE:
                        touching.add((nr, nc))
                    elif grid[nr, nc] == FLOOR and not seen[nr, nc]:
                        seen[nr, nc] = True
                        q.append((nr, nc))
            regions.append((region, len(touching)))
    if not regions:
        return 0, 0
    key = (lambda t: len(t[0])) if mode == 'largest' else (lambda t: (t[1], len(t[0])))
    best, fixtures_touched = max(regions, key=key)
    keep = np.zeros((rows, cols), dtype=bool)
    for r, c in best:
        keep[r, c] = True
    grid[(grid == FLOOR) & ~keep] = VOID
    print('  %d floor regions; kept the one touching %d fixture cells' % (len(regions), fixtures_touched))
    return len(best), fixtures_touched


def find_fixtures(grid, min_cells):
    """Flood-fill fixture cells into islands, each with its approach cells."""
    rows, cols = grid.shape
    seen = np.zeros_like(grid, dtype=bool)
    islands = []
    for r in range(rows):
        for c in range(cols):
            if grid[r, c] != FIXTURE or seen[r, c]:
                continue
            cells, q = [], deque([(r, c)])
            seen[r, c] = True
            while q:
                cr, cc = q.popleft()
                cells.append((cr, cc))
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        nr, nc = cr + dr, cc + dc
                        if (0 <= nr < rows and 0 <= nc < cols and not seen[nr, nc]
                                and grid[nr, nc] == FIXTURE):
                            seen[nr, nc] = True
                            q.append((nr, nc))
            if len(cells) < min_cells:
                continue
            approach = set()
            for cr, cc in cells:
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr, nc] == FLOOR:
                        approach.add((int(nr), int(nc)))
            if not approach:
                continue        # unreachable, so useless as a dwell target
            islands.append({'cells': cells, 'approach': sorted(approach)})
    return islands


def main():
    a = parse_args()
    cell = a['cell']
    print('loading %s' % a['in'])
    tris = load_triangles(a['in'], os.path.splitext(a['out'])[0] + '.tris.npy')

    mn = tris.reshape(-1, 3).min(axis=0)
    mx = tris.reshape(-1, 3).max(axis=0)
    cols = int((mx[0] - mn[0]) / cell) + 1
    rows = int((mx[1] - mn[1]) / cell) + 1
    print('  scene %.2f x %.2f x %.2f m -> grid %d x %d @ %.2f m'
          % (mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], cols, rows, cell))

    lo = lowest_surface(tris, mn, cols, rows, cell)
    floor_z = dominant_floor(lo)
    print('  floor level %.3f  (scene bottom %.3f, top %.3f)' % (floor_z, mn[2], mx[2]))

    grid, top = classify(tris, mn, cols, rows, cell, lo, floor_z, a)
    counts = {n: int((grid == v).sum())
              for n, v in (('void', VOID), ('floor', FLOOR), ('fixture', FIXTURE), ('wall', WALL))}
    print('  cells: %s' % counts)

    if a['roi']:
        # ROI is given in glTF x/z as minX,minZ,maxX,maxZ. These models sit on a
        # large ground plane that is continuous with the interior through the
        # shopfront, so no connectivity heuristic can separate "inside the shop"
        # from "the car park"; naming the box is faster and exact.
        rx0, rz0, rx1, rz1 = a['roi']
        for r in range(rows):
            by = mn[1] + (r + 0.5) * cell
            gz = -by
            for c in range(cols):
                gx = mn[0] + (c + 0.5) * cell
                if not (rx0 <= gx <= rx1 and rz0 <= gz <= rz1):
                    grid[r, c] = VOID
        print('  clipped to ROI x %.2f..%.2f  z %.2f..%.2f' % (rx0, rx1, rz0, rz1))

    walkable, _ = pick_walkable_region(grid, a['region'])
    print('  largest connected walkable region: %d cells (%.1f m2)'
          % (walkable, walkable * cell * cell))
    if walkable == 0:
        raise SystemExit('no walkable floor found - try a larger --clearance or a smaller --cell')

    islands = find_fixtures(grid, max(2, int(round(0.25 / (cell * cell)))))
    print('  fixtures: %d' % len(islands))

    # Blender is Z-up, three.js sees the glTF as Y-up: gltf(x, y, z) = blender(x, z, -y)
    def to_gltf_xz(col, row):
        return (round(float(mn[0] + (col + 0.5) * cell), 4),
                round(float(-(mn[1] + (row + 0.5) * cell)), 4))

    fixtures = []
    for i, isl in enumerate(sorted(islands, key=lambda s: -len(s['cells']))):
        cs = isl['cells']
        gx, gz = to_gltf_xz(sum(c for _, c in cs) / len(cs), sum(r for r, _ in cs) / len(cs))
        fixtures.append({
            'id': 'fx%02d' % i,
            'x': gx, 'z': gz,
            'height': round(float(max(top[r, c] for r, c in cs)), 3),
            'footprint': round(len(cs) * cell * cell, 2),
            'cells': [[int(c), int(r)] for r, c in cs],
            'approach': [dict(zip(('x', 'z'), to_gltf_xz(c, r))) for r, c in isl['approach'][:24]],
        })

    nav = {
        'source': os.path.basename(a['in']),
        'up': 'y',
        'cell': cell,
        'cols': cols,
        'rows': rows,
        # gltf-space position of the centre of grid cell (col 0, row 0)
        'originX': round(float(mn[0] + 0.5 * cell), 4),
        'originZ': round(float(-(mn[1] + 0.5 * cell)), 4),
        'floorY': round(float(floor_z), 4),
        'bounds': {
            'minX': round(float(mn[0]), 4), 'maxX': round(float(mx[0]), 4),
            'minZ': round(float(-mx[1]), 4), 'maxZ': round(float(-mn[1]), 4),
            'minY': round(float(mn[2]), 4), 'maxY': round(float(mx[2]), 4),
        },
        # one string per grid row, '.' walkable and '#' blocked
        'walkable': [''.join('.' if grid[r, c] == FLOOR else '#' for c in range(cols))
                     for r in range(rows)],
        'fixtures': fixtures,
    }
    os.makedirs(os.path.dirname(a['out']) or '.', exist_ok=True)
    with open(a['out'], 'w') as f:
        json.dump(nav, f, separators=(',', ':'))
    print('wrote %s (%.1f KB)' % (a['out'], os.path.getsize(a['out']) / 1024))

    print('\ntop-down map (. walkable, o fixture, # wall):')
    rstep, cstep = max(1, rows // 46), max(1, cols // 112)
    for r in range(0, rows, rstep):
        print('  ' + ''.join('.' if grid[r, c] == FLOOR else
                             'o' if grid[r, c] == FIXTURE else
                             '#' if grid[r, c] == WALL else ' '
                             for c in range(0, cols, cstep)))


main()
