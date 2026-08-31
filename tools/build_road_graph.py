#!/usr/bin/env python3
"""Turn hand-clicked road points into a drivable road graph.

    python3 tools/build_road_graph.py road-points.json models/pool-road.json

The editor records clicks in order. Someone marking a site draws one road, then
jumps to the start of the next - so the click sequence is a set of strokes, and
the jump between strokes is much longer than the step along one. That structure
is the whole topology and it must not be thrown away:

1. Split the click order into strokes wherever the gap jumps (> 3x the typical
   step). Each stroke is one road, in the order it was drawn.
2. Drop points sitting well off the road plane - clicks that landed on a roof.
3. Find where strokes genuinely cross, and insert a shared node there. Join a
   stroke end that stops close to another road as a T-junction.
4. Junctions are then nodes where three or more ways actually meet.

An earlier version skipped straight to a minimum spanning tree over the raw
point cloud. That connects whatever is nearest regardless of which road it
belongs to, so it invented a junction every time two separate roads happened to
pass near each other - 22 of them on a site drawn as 7 roads, none of which
lined up with a real intersection on the model.
"""
import json
import math
import sys

UNITS_PER_METRE = 100.0      # the site scan is in centimetres
HEIGHT_TOLERANCE = 250.0     # units off the median road height before discarding
STROKE_BREAK = 3.0           # gap multiple that starts a new stroke
JOIN_TOLERANCE = 900.0       # a stroke end this close to another road is a T-junction
MIN_STROKE_POINTS = 2
MERGE_RADIUS = 150.0         # nodes closer than 1.5 m are the same junction
REVERSE_ANGLE = 135.0        # a turn sharper than this is a pen jump, not a bend


def d2(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def split_strokes(points):
    """Break the click order wherever the step jumps."""
    if len(points) < 2:
        return [points]
    steps = [d2(points[i], points[i + 1]) for i in range(len(points) - 1)]
    typical = sorted(steps)[len(steps) // 2]
    strokes, cur = [], [points[0]]
    for i, s in enumerate(steps):
        if s > STROKE_BREAK * typical:
            strokes.append(cur)
            cur = []
        cur.append(points[i + 1])
    strokes.append(cur)
    return [s for s in strokes if len(s) >= MIN_STROKE_POINTS], typical


def split_doublebacks(strokes):
    """Cut a stroke where the pen jumped back instead of carrying on.

    Continuing an existing road appends to its end, so resuming at the far end
    leaves one long segment running back across the site - a road nobody drew.
    Length alone cannot catch it, because some real roads are long and sparsely
    clicked. The giveaway is direction: the pen reverses through nearly 180
    degrees and then travels a long way.
    """
    out, cuts = [], 0
    for st in strokes:
        if len(st) < 3:
            out.append(st)
            continue
        piece = [st[0], st[1]]
        for i in range(1, len(st) - 1):
            ax, ay = st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]
            bx, by = st[i + 1][0] - st[i][0], st[i + 1][1] - st[i][1]
            la, lb = math.hypot(ax, ay), math.hypot(bx, by)
            reversed_ = False
            if la > 1 and lb > 1:
                cos = max(-1.0, min(1.0, (ax * bx + ay * by) / (la * lb)))
                if math.degrees(math.acos(cos)) > REVERSE_ANGLE and lb > 3000:
                    reversed_ = True
            if reversed_:
                out.append(piece)
                piece = [st[i + 1]]
                cuts += 1
            else:
                piece.append(st[i + 1])
        if len(piece) >= MIN_STROKE_POINTS:
            out.append(piece)
    return [p for p in out if len(p) >= MIN_STROKE_POINTS], cuts


def seg_intersect(p1, p2, p3, p4):
    """Proper crossing point of two 2D segments, or None."""
    x1, y1 = p1[0], p1[1]
    x2, y2 = p2[0], p2[1]
    x3, y3 = p3[0], p3[1]
    x4, y4 = p4[0], p4[1]
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-9:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den
    if not (0.0 <= t <= 1.0 and 0.0 <= u <= 1.0):
        return None
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1), t)


def point_to_segment(p, a, b):
    ax, ay, bx, by = a[0], a[1], b[0], b[1]
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 < 1e-9:
        return d2(p, a), 0.0
    t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)), t


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'road-points.json'
    dst = sys.argv[2] if len(sys.argv) > 2 else 'models/pool-road.json'
    data = json.load(open(src))

    if 'strokes' in data:
        # the editor now records pen-up explicitly, so there is nothing to infer
        strokes = [[(q['x'], q['z'], q['y']) for q in st['points']]
                   for st in data['strokes'] if len(st.get('points', [])) >= MIN_STROKE_POINTS]
        raw = [p for st in strokes for p in st]
        ys = sorted(p[2] for p in raw)
        median_y = ys[len(ys) // 2]
        print('%d paths drawn explicitly (%d points) - no stroke inference needed'
              % (len(strokes), len(raw)))
    else:
        # older exports are a flat point list in click order; recover the strokes
        raw = [(p['x'], p['z'], p['y']) for p in data['points']]
        ys = sorted(p[2] for p in raw)
        median_y = ys[len(ys) // 2]
        strokes, typical = split_strokes(raw)
        print('clicks %d -> %d strokes inferred from gaps (typical step %.0f units / %.1f m)'
              % (len(raw), len(strokes), typical, typical / UNITS_PER_METRE))

    cleaned, dropped = [], 0
    for st in strokes:
        keep = [p for p in st if abs(p[2] - median_y) <= HEIGHT_TOLERANCE]
        dropped += len(st) - len(keep)
        if len(keep) >= MIN_STROKE_POINTS:
            cleaned.append(keep)
    strokes = cleaned
    strokes, cuts = split_doublebacks(strokes)
    print('dropped %d off-plane clicks; split %d pen double-backs; %d roads remain'
          % (dropped, cuts, len(strokes)))
    for i, st in enumerate(strokes):
        L = sum(d2(st[k], st[k + 1]) for k in range(len(st) - 1))
        print('   road %d: %2d points, %6.0f units (%5.1f m)' % (i + 1, len(st), L, L / UNITS_PER_METRE))

    # --- nodes -------------------------------------------------------------
    nodes = []          # (x, z, y)
    def add_node(p):
        # the editor snaps deliberate junctions to identical coordinates, so an
        # exact-ish match is a real shared node rather than a lucky near miss
        for i, q in enumerate(nodes):
            if d2(p, q) < 1.0:
                return i
        nodes.append((p[0], p[1], p[2]))
        return len(nodes) - 1

    # each stroke becomes an ordered list of (node index, position along stroke)
    chains = []
    for st in strokes:
        chains.append([[add_node(p), float(k), p] for k, p in enumerate(st)])

    # --- real crossings between different roads ----------------------------
    crossings = 0
    for a in range(len(strokes)):
        for b in range(a + 1, len(strokes)):
            sa, sb = strokes[a], strokes[b]
            for i in range(len(sa) - 1):
                for j in range(len(sb) - 1):
                    hit = seg_intersect(sa[i], sa[i + 1], sb[j], sb[j + 1])
                    if not hit:
                        continue
                    x, z, t = hit
                    y = sa[i][2] + (sa[i + 1][2] - sa[i][2]) * t
                    n = add_node((x, z, y))
                    chains[a].append([n, i + t, (x, z, y)])
                    # position along the other stroke
                    dd, u = point_to_segment((x, z), sb[j], sb[j + 1])
                    chains[b].append([n, j + u, (x, z, y)])
                    crossings += 1
    print('crossings between roads: %d' % crossings)

    # --- T-junctions: a road that ends on another road ---------------------
    tees = 0
    for a in range(len(strokes)):
        for end_idx in (0, -1):
            p = strokes[a][end_idx]
            best = None
            for b in range(len(strokes)):
                if b == a:
                    continue
                for j in range(len(strokes[b]) - 1):
                    dd, u = point_to_segment(p, strokes[b][j], strokes[b][j + 1])
                    if dd < JOIN_TOLERANCE and (best is None or dd < best[0]):
                        best = (dd, b, j, u)
            if best:
                dd, b, j, u = best
                q = strokes[b][j]
                r = strokes[b][j + 1]
                x = q[0] + (r[0] - q[0]) * u
                z = q[1] + (r[1] - q[1]) * u
                y = q[2] + (r[2] - q[2]) * u
                n = add_node((x, z, y))
                chains[a].append([n, (-0.5 if end_idx == 0 else len(strokes[a]) - 0.5), (x, z, y)])
                chains[b].append([n, j + u, (x, z, y)])
                tees += 1
    print('T-junctions where a road meets another: %d' % tees)

    # --- edges: consecutive along each road, in order ----------------------
    edge_set = set()
    for ch in chains:
        ch.sort(key=lambda e: e[1])
        for k in range(len(ch) - 1):
            i, j = ch[k][0], ch[k + 1][0]
            if i != j:
                edge_set.add((min(i, j), max(i, j)))
    edges = sorted(edge_set)

    # A crossing that lands almost on top of an existing point leaves a stub
    # far shorter than a car, which makes the junction jitter as vehicles skip
    # across it. Fuse anything inside MERGE_RADIUS into one node.
    parent = list(range(len(nodes)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    merged = 0
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if find(i) == find(j):
                continue
            if d2(nodes[i], nodes[j]) < MERGE_RADIUS:
                parent[find(j)] = find(i)
                merged += 1
    if merged:
        groups = {}
        for i in range(len(nodes)):
            groups.setdefault(find(i), []).append(i)
        remap, kept = {}, []
        for root, members in groups.items():
            xs = sum(nodes[m][0] for m in members) / len(members)
            zs = sum(nodes[m][1] for m in members) / len(members)
            ys = sum(nodes[m][2] for m in members) / len(members)
            for m in members:
                remap[m] = len(kept)
            kept.append((xs, zs, ys))
        nodes = kept
        edges = sorted({(min(remap[a], remap[b]), max(remap[a], remap[b]))
                        for a, b in edges if remap[a] != remap[b]})
        print('merged %d near-coincident nodes -> %d nodes, %d edges'
              % (merged, len(nodes), len(edges)))

    degree = {}
    for a, b in edges:
        degree[a] = degree.get(a, 0) + 1
        degree[b] = degree.get(b, 0) + 1
    junctions = sorted(i for i, d in degree.items() if d >= 3)
    dead_ends = [i for i, d in degree.items() if d == 1]
    print('nodes %d, edges %d, junctions %d, dead ends %d'
          % (len(nodes), len(edges), len(junctions), len(dead_ends)))

    width_m = float(data.get('width', 6))
    road_units = width_m * UNITS_PER_METRE
    out = {
        'model': data.get('model', '/models/swimming-pool.glb'),
        'name': data.get('name', 'main-road'),
        'space': 'model',
        'unitsPerMetre': UNITS_PER_METRE,
        'roadWidth': road_units,
        'lanes': int(data.get('lanes', 1)),
        'laneOffset': road_units / 4,
        'carLength': 4.4 * UNITS_PER_METRE,
        'carWidth': 1.8 * UNITS_PER_METRE,
        'roadY': median_y,
        'roads': len(strokes),
        'nodes': [{'x': round(n[0], 2), 'y': round(n[2], 2), 'z': round(n[1], 2)} for n in nodes],
        'edges': [[a, b] for a, b in edges],
        'junctions': junctions,
    }
    json.dump(out, open(dst, 'w'), separators=(',', ':'))
    print('wrote %s' % dst)

    xs = [n[0] for n in nodes]
    zs = [n[1] for n in nodes]
    W, H = 96, 30
    grid = [[' '] * W for _ in range(H)]
    def cell(n):
        return (int((n[0] - min(xs)) / max(1e-9, max(xs) - min(xs)) * (W - 1)),
                int((n[1] - min(zs)) / max(1e-9, max(zs) - min(zs)) * (H - 1)))
    for a, b in edges:
        (x0, y0), (x1, y1) = cell(nodes[a]), cell(nodes[b])
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            gx = round(x0 + (x1 - x0) * s / steps)
            gy = round(y0 + (y1 - y0) * s / steps)
            if grid[gy][gx] == ' ':
                grid[gy][gx] = '.'
    for i, n in enumerate(nodes):
        x, y = cell(n)
        grid[y][x] = 'X' if i in junctions else 'o'
    print('\ntop-down road network (o node, X junction):')
    for row in grid:
        print('  ' + ''.join(row))


main()
