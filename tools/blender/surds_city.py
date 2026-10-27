import bpy, bmesh, math, random
from mathutils import Matrix, Vector

random.seed(7)
C = bpy.context
scene = C.scene
NAME = "SURDS_City"

# ---------------------------------------------------------------- reset
old = bpy.data.collections.get(NAME)
if old:
    for o in list(old.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(old)
for cu in [c for c in bpy.data.curves if c.users == 0]:
    bpy.data.curves.remove(cu)
for me in [m for m in bpy.data.meshes if m.users == 0]:
    bpy.data.meshes.remove(me)

park = bpy.data.collections.get("Imported")
if park is None:
    park = bpy.data.collections.new("Imported")
    scene.collection.children.link(park)
for o in list(scene.collection.objects):
    park.objects.link(o)
    scene.collection.objects.unlink(o)
for lc in C.view_layer.layer_collection.children:
    if lc.collection == park:
        lc.exclude = True

col = bpy.data.collections.new(NAME)
scene.collection.children.link(col)
for lc in C.view_layer.layer_collection.children:
    lc.exclude = lc.collection != col

# ---------------------------------------------------------------- materials
def mat(name, base=(0.02, 0.02, 0.02), rough=0.6, emit=None, strength=0.0, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m


def window_mat(name, lit=0.35, bay=2.4, floor=3.6, glass=False, warm=(1.0, 0.82, 0.58)):
    """Facade shader: a brick-texture grid of windows on the walls, a random share lit."""
    m = mat(name, (0.022, 0.023, 0.027), 0.3 if glass else 0.7, metallic=0.4 if glass else 0.0)
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == "BSDF_PRINCIPLED")

    def math_node(op, a=None, bval=None):
        n = N.new("ShaderNodeMath")
        n.operation = op
        if a is not None:
            L.new(a, n.inputs[0])
        if isinstance(bval, (int, float)):
            n.inputs[1].default_value = bval
        elif bval is not None:
            L.new(bval, n.inputs[1])
        return n

    pos = N.new("ShaderNodeNewGeometry")  # world space: a growing wall reveals floors, never squashes them
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(pos.outputs["Position"], sep.inputs[0])
    u = math_node("DIVIDE", math_node("ADD", sep.outputs[0], sep.outputs[1]).outputs[0], bay)
    v = math_node("DIVIDE", sep.outputs[2], floor)
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(u.outputs[0], comb.inputs[0])
    L.new(v.outputs[0], comb.inputs[1])

    br = N.new("ShaderNodeTexBrick")
    br.offset = 0.0
    br.squash = 1.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.34
    br.inputs["Brick Width"].default_value = 1.0
    br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (0, 0, 0, 1)
    br.inputs["Color2"].default_value = (1, 1, 1, 1)
    br.inputs["Mortar"].default_value = (0, 0, 0, 1)
    L.new(comb.outputs[0], br.inputs["Vector"])

    bw = N.new("ShaderNodeRGBToBW")
    L.new(br.outputs["Color"], bw.inputs[0])
    on = math_node("GREATER_THAN", bw.outputs[0], 1.0 - lit)
    pane = math_node("LESS_THAN", br.outputs["Fac"], 0.5)

    geo = N.new("ShaderNodeNewGeometry")
    sn = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Normal"], sn.inputs[0])
    wall = math_node("LESS_THAN", math_node("ABSOLUTE", sn.outputs[2]).outputs[0], 0.5)

    window = math_node("MULTIPLY", pane.outputs[0], wall.outputs[0])
    lit_win = math_node("MULTIPLY", window.outputs[0], on.outputs[0])
    dim = math_node("MULTIPLY", window.outputs[0], 0.035)
    strength = math_node("MULTIPLY_ADD", lit_win.outputs[0], 2.6)
    L.new(dim.outputs[0], strength.inputs[2])

    b.inputs["Emission Color"].default_value = (*warm, 1)
    L.new(strength.outputs[0], b.inputs["Emission Strength"])
    return m


M_ground = mat("City Ground", (0.004, 0.004, 0.005), 0.9)
M_road = mat("City Road", (0.011, 0.011, 0.013), 0.55)
M_block = mat("City Block", (0.017, 0.017, 0.019), 0.8)
M_roof = mat("City Roof", (0.03, 0.03, 0.034), 0.7)
M_tree = mat("City Tree", (0.035, 0.04, 0.037), 0.9)
M_dash = mat("City Lane", (0, 0, 0), 1, emit=(0.8, 0.85, 1.0), strength=0.4)
M_edge = mat("City Edge", (0, 0, 0), 1, emit=(0.85, 0.9, 1.0), strength=1.6)
M_edge_dim = mat("City Edge Dim", (0, 0, 0), 1, emit=(0.7, 0.75, 0.85), strength=0.3)
M_edge_faint = mat("City Edge Faint", (0, 0, 0), 1, emit=(0.6, 0.65, 0.75), strength=0.1)
M_cross = mat("City Cross", (0, 0, 0), 1, emit=(1, 1, 1), strength=5)
M_amber = mat("SURDS Amber", (0, 0, 0), 1, emit=(1.0, 0.42, 0.08), strength=12)
M_node = mat("SURDS Node", (0, 0, 0), 1, emit=(1.0, 0.62, 0.28), strength=25)

W_glass = window_mat("Glass Tower Windows", 0.6, bay=1.5, floor=3.4, glass=True)
W_office = window_mat("Office Windows", 0.5, bay=1.8, floor=3.6)
W_dc = window_mat("Data Center Windows", 0.6, bay=1.2, floor=4.5)
W_plant = window_mat("Plant Windows", 0.4, bay=2.2, floor=4.0)
W_dark = window_mat("Background Windows", 0.2, bay=1.8, floor=3.6)

# ---------------------------------------------------------------- geometry helpers
footprints = []
GROUPS = []      # one entry per thing that gets built: solid, edge cage, parts that ride on top
LINKS = []       # SURDS network curves, in draw order
NODES = []       # (node object, route index it lights up with)
POWER_LINES = []


def group(name, solid, edges=(), attach=(), x=0.0, y=0.0, w=1.0, d=1.0, h=1.0, hero=False, kind="building"):
    g = dict(name=name, solid=solid, edges=list(edges), attach=list(attach),
             x=x, y=y, w=w, d=d, h=h, hero=hero, kind=kind)
    GROUPS.append(g)
    return g


def frange(a, b, s):
    out, x = [], a
    while x < b - 1e-6:
        out.append(x)
        x += s
    return out


def cube_bm(w, d, h, bm=None, off=(0, 0, 0)):
    bm = bm or bmesh.new()
    bmesh.ops.create_cube(bm, size=1,
                          matrix=Matrix.Translation((off[0], off[1], off[2] + h / 2)) @ Matrix.Diagonal((w, d, h, 1)))
    return bm


def mesh_obj(name, bm, m, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if m:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    o.location = loc
    col.objects.link(o)
    return o


def box(name, x, y, w, d, h, m, z=0.0, solid=True):
    if solid:
        footprints.append((x - w / 2, y - d / 2, x + w / 2, y + d / 2))
    return mesh_obj(name, cube_bm(w, d, h), m, (x, y, z))


def cut(bm, axis, positions):
    for p in positions:
        co, no = [0, 0, 0], [0, 0, 0]
        co[axis], no[axis] = p, 1
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)


def wire(name, x, y, w, d, h, m, dz=3.5, dxy=2.5, z=0.0, thick=0.05, pad=0.06):
    """Glowing edge cage around a building: floor rings and vertical mullions."""
    bm = cube_bm(w + pad, d + pad, h + pad / 2)
    if dz:
        cut(bm, 2, frange(dz, h, dz))
    if dxy:
        cut(bm, 0, frange(-w / 2 + dxy, w / 2, dxy))
        cut(bm, 1, frange(-d / 2 + dxy, d / 2, dxy))
    o = mesh_obj(name, bm, m, (x, y, z))
    mod = o.modifiers.new("Wire", "WIREFRAME")
    mod.thickness = thick
    mod.use_even_offset = True
    return o


def building(name, x, y, w, d, h, wm, edge=M_edge_dim, dz=None, dxy=None, thick=0.04, hero=False):
    s = box(name, x, y, w, d, h, wm)
    r = box(name + " Roof", x, y, w * 0.98, d * 0.98, 0.15, M_roof, z=h, solid=False)
    e = wire(name + " Edges", x, y, w, d, h, edge, dz=dz, dxy=dxy, thick=thick)
    return group(name, s, [e], [r], x, y, w, d, h, hero=hero)


def cylinder(name, x, y, r, h, m, z=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r, depth=h,
                          matrix=Matrix.Translation((0, 0, h / 2)))
    footprints.append((x - r, y - r, x + r, y + r))
    return mesh_obj(name, bm, m, (x, y, z))


def path(name, pts, m=M_amber, bevel=0.12, z=0.14):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, xy in zip(sp.points, pts):
        p.co = (xy[0], xy[1], xy[2] if len(xy) > 2 else z, 1)
    cu.materials.append(m)
    o = bpy.data.objects.new(name, cu)
    col.objects.link(o)
    return o


def node(name, x, y, r=0.35, m=M_node, z=0.14):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=r)
    return mesh_obj(name, bm, m, (x, y, z))


def pylon(name, x, y, h=15.0, m=M_edge_dim):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=4, radius1=1.5, radius2=0.35, depth=h,
                          matrix=Matrix.Translation((0, 0, h / 2)) @ Matrix.Rotation(math.pi / 4, 4, "Z"))
    cut(bm, 2, frange(h / 6, h, h / 6))
    cube_bm(6.0, 0.25, 0.25, bm, off=(0, 0, h * 0.82))
    cube_bm(4.4, 0.25, 0.25, bm, off=(0, 0, h * 0.62))
    o = mesh_obj(name, bm, m, (x, y, 0))
    mod = o.modifiers.new("Wire", "WIREFRAME")
    mod.thickness = 0.07
    return o


# ---------------------------------------------------------------- ground, roads, blocks
ROADS = [-30, -10, 10, 30]
box("Ground", 0, 0, 104, 104, 0.1, M_ground, z=-0.1, solid=False)

bm = bmesh.new()
for r in ROADS:
    cube_bm(5, 104, 0.02, bm, off=(r, 0, 0))
    cube_bm(104, 5, 0.02, bm, off=(0, r, 0))
mesh_obj("Roads", bm, M_road)

bm = bmesh.new()
for r in ROADS:
    for side in (-1.3, 1.3):
        for t in frange(-50, 50, 4.0):
            if any(abs(t + 0.8 - o) < 3.2 for o in ROADS):
                continue
            cube_bm(0.12, 1.6, 0.01, bm, off=(r + side, t + 0.8, 0.02))
            cube_bm(1.6, 0.12, 0.01, bm, off=(t + 0.8, r + side, 0.02))
mesh_obj("Lane Markings", bm, M_dash)

bm = bmesh.new()
for i in range(-2, 3):
    for j in range(-2, 3):
        cube_bm(15, 15, 0.15, bm, off=(20 * i, 20 * j, 0))
mesh_obj("City Blocks", bm, M_block)

# ---------------------------------------------------------------- the six building types
Z0 = 0.15  # top of block pads

# Commercial tower (back left): glass, gridded edge cage, crown
group("Commercial Tower",
      box("Commercial Tower", -20, 20, 9, 9, 46, W_glass, z=Z0),
      [wire("Commercial Tower Edges", -20, 20, 9, 9, 46, M_edge, dz=3.4, dxy=2.25, z=Z0, thick=0.035)],
      [box("Commercial Tower Crown", -20, 20, 6, 6, 2.5, M_roof, z=Z0 + 46, solid=False),
       wire("Commercial Tower Crown Edges", -20, 20, 6, 6, 2.5, M_edge, dz=None, dxy=None, z=Z0 + 46)],
      -20, 20, 9, 9, 46, hero=True)
building("Commercial Annex", -24.5, 13.5, 5, 4, 6, W_office)

# Commercial low-rise (back centre)
building("Office Block", 0, 21, 13, 8, 7.2, W_office, dz=3.6, hero=True)
building("Office Wing", 4, 15.5, 5, 3, 4, W_office)

# Data center (back right): long lit halls, rooftop chillers
dc = building("Data Center", 20, 20, 13, 11, 9, W_dc, edge=M_edge_dim, dz=4.5, dxy=None, hero=True)
bm = bmesh.new()
for cx in frange(-4.8, 5, 2.4):
    for cy in frange(-3.6, 4, 2.4):
        cube_bm(1.6, 1.6, 0.9, bm, off=(cx, cy, 0))
dc["attach"].append(mesh_obj("Data Center Chillers", bm, M_roof, (20, 20, Z0 + 9.15)))

# Energy & utilities (right): plant hall + stacks
building("Power Plant", 20, 0, 13, 9, 8, W_plant, edge=M_edge_dim, dz=4.0, dxy=3.25, hero=True)
for k, cx in enumerate((15.5, 18.5, 21.5, 24.5)):
    sh = 18 + (k % 2) * 3
    group(f"Stack {k + 1}",
          cylinder(f"Stack {k + 1}", cx, 3.0, 0.55, sh, M_roof, z=Z0),
          [wire(f"Stack {k + 1} Rings", cx, 3.0, 1.15, 1.15, sh, M_edge_dim, dz=3.0, dxy=None, z=Z0)],
          x=cx, y=3.0, w=1.1, d=1.1, h=sh, kind="stack")

# Clean rooms & pharma (front left): low lab block, gridded roof cage
building("Clean Room Lab", -20, -20, 12, 10, 10, W_office, edge=M_edge, dz=5.0, dxy=2.0, hero=True)
building("Clean Room Annex", -15, -25, 5, 4, 4.5, W_plant)

# Healthcare & labs (front centre): tower with lit cross
hosp = building("Hospital", 0, -20, 8, 8, 15, W_office, edge=M_edge_dim, dz=3.6, hero=True)
building("Hospital Wing", -4.5, -24, 6, 5, 6, W_office)
hosp["attach"] += [box("Hospital Cross V", 0, -24.09, 0.7, 0.1, 3.0, M_cross, z=Z0 + 10.5, solid=False),
                   box("Hospital Cross H", 0, -24.09, 2.4, 0.1, 0.7, M_cross, z=Z0 + 11.65, solid=False)]

# Substation (front right): pad, transformers, pylons
box("Substation Pad", 20, -20, 12, 10, 0.2, M_roof, z=Z0, solid=False)
for k, (cx, cy) in enumerate([(17, -17.5), (21, -17.5), (17, -22), (21, -22)]):
    group(f"Transformer {k + 1}",
          box(f"Transformer {k + 1}", cx, cy, 2.4, 2.0, 2.2, M_roof, z=Z0 + 0.2),
          [wire(f"Transformer {k + 1} Edges", cx, cy, 2.4, 2.0, 2.2, M_edge_dim, dz=None, dxy=None, z=Z0 + 0.2, thick=0.03)],
          x=cx, y=cy, w=2.4, d=2.0, h=2.2, kind="substation")
pylons = [(25, -15), (25, -25), (36, -20), (46, -20)]
for k, (px, py) in enumerate(pylons):
    group(f"Pylon {k + 1}", pylon(f"Pylon {k + 1}", px, py), x=px, y=py, h=15, kind="substation")
for a, b in [(0, 1), (0, 2), (1, 2), (2, 3)]:
    (ax, ay), (bx, by) = pylons[a], pylons[b]
    for s in (-2.9, 2.9):
        POWER_LINES.append(path(f"Power Line {a}-{b}", [(ax + s, ay, 12.4), (bx + s, by, 12.4)], M_edge_dim, bevel=0.02))

# ---------------------------------------------------------------- filler city
def filler_block(cx, cy, wm, density=0.75, hmax=14, edge=M_edge_faint):
    for sx in (-3.6, 3.6):
        for sy in (-3.6, 3.6):
            if random.random() > density:
                continue
            w, d = random.uniform(4.5, 6.5), random.uniform(4.5, 6.5)
            h = random.choice([3.6, 7.2, 7.2, 10.8, hmax])
            h = min(h, hmax)
            building(f"Building {cx}_{cy}_{sx}_{sy}", cx + sx, cy + sy, w, d, h, wm, edge=edge)

filler_block(-20, 0, W_office, density=0.5)
filler_block(0, 0, W_office, density=0.35, hmax=10.8)
for i in range(-2, 3):
    for j in range(-2, 3):
        if abs(i) == 2 or abs(j) == 2:
            if (i, j) == (2, -1):
                continue  # keep the power line corridor clear
            front = i == 2 or j == -2  # between the camera and the hero buildings
            filler_block(20 * i, 20 * j, W_dark, density=0.45 if front else 0.7, hmax=7.2 if front else 18)

# ---------------------------------------------------------------- trees
def free(x, y, r=1.0):
    return not any(a - r < x < c + r and b - r < y < d + r for a, b, c, d in footprints)

bm = bmesh.new()
for i in range(-2, 3):
    for j in range(-2, 3):
        cx, cy = 20 * i, 20 * j
        for t in frange(-6.5, 6.6, 2.6):
            for x, y in [(cx + t, cy - 6.6), (cx + t, cy + 6.6), (cx - 6.6, cy + t), (cx + 6.6, cy + t)]:
                if random.random() < 0.55 and free(x, y):
                    s = random.uniform(0.8, 1.15)
                    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.85 * s,
                                               matrix=Matrix.Translation((x, y, Z0 + 1.4 * s)))
                    cube_bm(0.14, 0.14, 0.7 * s, bm, off=(x, y, Z0))
TREES = mesh_obj("Trees", bm, M_tree)

# ---------------------------------------------------------------- SURDS network
HUB = (10, 10)
routes = {
    "Tower": [HUB, (-10, 10), (-10, 20), (-15.5, 20)],
    "Office": [HUB, (0, 10), (0, 16.8)],
    "Data Center": [HUB, (20, 10), (20, 14.3)],
    "Power Plant": [HUB, (10, 0), (13.3, 0)],
    "Hospital": [HUB, (10, -10), (0, -10), (0, -15.8)],
    "Clean Room": [(0, -10), (-20, -10), (-20, -14.8)],
    "Substation": [(10, -10), (20, -10), (20, -14.8)],
}
seen = set()
for i, (name, pts) in enumerate(routes.items()):
    LINKS.append(path(f"Link {name}", pts))
    for p in pts[1:]:
        if p not in seen:
            seen.add(p)
            NODES.append((node(f"Node {name} {len(seen)}", *p, r=0.32), i))
HUB_NODE = node("Hub", *HUB, r=0.75)

# ---------------------------------------------------------------- camera, light, world, render
cam_data = bpy.data.cameras.new("SURDS Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 150
cam_data.clip_end = 600
cam = bpy.data.objects.new("SURDS Cam", cam_data)
col.objects.link(cam)
d = Vector((1.0, -1.0, 1.45)).normalized()
target = Vector((0, 0, 16))
cam.location = target + d * 180
cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

sun_data = bpy.data.lights.new("Moonlight", "SUN")
sun_data.energy = 0.9
sun_data.color = (0.75, 0.82, 1.0)
sun_data.angle = math.radians(3)
sun = bpy.data.objects.new("Moonlight", sun_data)
sun.rotation_euler = (math.radians(52), 0, math.radians(35))
col.objects.link(sun)

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.0018, 0.002, 0.0028, 1)
bg.inputs[1].default_value = 1.0

for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        pass
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.view_settings.view_transform = "Standard"

scene.use_nodes = True
ct = scene.node_tree
ct.nodes.clear()
rl = ct.nodes.new("CompositorNodeRLayers")
gl = ct.nodes.new("CompositorNodeGlare")
for gt in ("BLOOM", "FOG_GLOW"):
    try:
        gl.glare_type = gt
        break
    except TypeError:
        pass
comp = ct.nodes.new("CompositorNodeComposite")
ct.links.new(rl.outputs["Image"], gl.inputs["Image"])
ct.links.new(gl.outputs["Image"], comp.inputs["Image"])

print("objects:", len(col.objects), "| engine:", scene.render.engine, "| glare:", gl.glare_type)
