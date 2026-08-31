"""Turn a .glb (or an already-imported .blend) into a .blend that is pleasant
to edit by hand, and sort the redundant copies into their own collection.

    blender -b --python tools/make_editable_blend.py -- --in model.glb --out model.blend
    blender -b --python tools/make_editable_blend.py -- --in raw.blend --out clean.blend

What it does and why:

* glTF importers wrap every mesh in a chain of empties. Clearing those parents
  with a plain ``obj.parent = None`` throws away the parent's matrix, so each
  mesh snaps to its raw local transform and the scene explodes. This captures
  every ``matrix_world`` first and restores it after unparenting, which is the
  only safe order.
* Rotation and scale are baked in and each origin is moved onto its own
  geometry, so clicking an object in the viewport selects something whose
  gizmo sits where you expect.
* Objects that share identical topology AND sit at the same world position are
  redundant stacked copies. They go into ``ZZ Overlapping Duplicates`` so you
  can delete the whole collection in one go. Props that repeat at *different*
  positions (four identical chairs) are left alone - those are the model, not
  duplicates.
* Zero-area geometry goes into ``ZZ Degenerate``.
"""
import os
import sys
from collections import defaultdict

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = {'in': None, 'out': None}
    for i, a in enumerate(argv):
        if a == '--in':
            args['in'] = argv[i + 1]
        elif a == '--out':
            args['out'] = argv[i + 1]
    if not args['in'] or not args['out']:
        raise SystemExit('usage: -- --in <model.glb|raw.blend> --out <clean.blend>')
    return args


def load(path):
    if path.lower().endswith('.blend') or path.lower().endswith('.blend1'):
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        bpy.ops.wm.read_homefile(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=path)


def show_everything():
    def walk(lc):
        lc.exclude = False
        lc.hide_viewport = False
        for c in lc.children:
            walk(c)
    walk(bpy.context.view_layer.layer_collection)


def flatten_hierarchy(meshes):
    """Unparent every mesh without moving it, then drop the empties."""
    world = {o: o.matrix_world.copy() for o in meshes}   # all of them, before touching any
    for o in meshes:
        o.parent = None
        o.matrix_world = world[o]
    bpy.context.view_layer.update()
    for e in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(e, do_unlink=True)


def regroup(meshes, name):
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    for o in meshes:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
        o.hide_viewport = o.hide_render = o.hide_select = False
        o.hide_set(False)
    bpy.context.view_layer.update()
    return col


def bake_transforms(meshes):
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.make_single_user(object=False, obdata=True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.update()


def world_center(o):
    c = Vector((0, 0, 0))
    for b in o.bound_box:
        c += o.matrix_world @ Vector(b)
    return c / 8


def world_bounds(meshes):
    mn = Vector((1e30,) * 3)
    mx = Vector((-1e30,) * 3)
    for o in meshes:
        for b in o.bound_box:
            w = o.matrix_world @ Vector(b)
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
    return mn, mx


def classify(meshes):
    """Split into (overlapping duplicates, degenerate, repeated-prop report)."""
    def signature(o):
        d = o.dimensions
        return (len(o.data.vertices), len(o.data.polygons),
                round(d.x, 4), round(d.y, 4), round(d.z, 4))

    by_sig = defaultdict(list)
    for o in meshes:
        by_sig[signature(o)].append(o)

    overlapping = []
    repeats = []
    for sig, group in by_sig.items():
        if len(group) < 2:
            continue
        by_pos = defaultdict(list)
        for o in group:
            c = world_center(o)
            by_pos[(round(c.x, 3), round(c.y, 3), round(c.z, 3))].append(o)
        for same_spot in by_pos.values():
            overlapping.extend(same_spot[1:])        # keep the first, the rest are redundant
        if len(by_pos) > 1:
            repeats.append((sig, sum(len(v) for v in by_pos.values()), len(by_pos)))

    degenerate = [o for o in meshes
                  if len(o.data.polygons) == 0 or max(o.dimensions) < 1e-6]
    return overlapping, degenerate, sorted(repeats, key=lambda r: -r[1])


def park(name, objs):
    if not objs:
        return
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    for o in objs:
        for u in list(o.users_collection):
            u.objects.unlink(o)
        col.objects.link(o)
    print('  parked %d objects in %r' % (len(objs), name))


def set_viewport_defaults():
    """So the file opens looking at the scene instead of into empty space."""
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != 'VIEW_3D':
                continue
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.clip_start = 0.001
                    space.clip_end = 10000.0
                    space.shading.type = 'MATERIAL'


def main():
    args = parse_args()
    src, dst = args['in'], args['out']
    bpy.context.preferences.filepaths.save_version = 0   # never overwrite a .blend1 we read from

    print('loading %s' % src)
    load(src)
    show_everything()

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        raise SystemExit('no mesh objects found in %s' % src)
    print('  %d meshes, %d empties' % (
        len(meshes), len([o for o in bpy.data.objects if o.type == 'EMPTY'])))

    flatten_hierarchy(meshes)
    regroup(meshes, os.path.splitext(os.path.basename(dst))[0])
    bake_transforms(meshes)

    mn, mx = world_bounds(meshes)
    print('  scene is %.2f x %.2f x %.2f m' % (mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]))

    overlapping, degenerate, repeats = classify(meshes)
    print('  exactly-overlapping duplicates : %d' % len(overlapping))
    print('  degenerate (no faces / no size): %d' % len(degenerate))
    print('  props repeated at >1 location  : %d groups (left in place)' % len(repeats))
    for sig, n, spots in repeats[:10]:
        print('     %d copies at %d spots  verts=%d  %.2fx%.2fx%.2f m'
              % (n, spots, sig[0], sig[2], sig[3], sig[4]))

    park('ZZ Overlapping Duplicates', overlapping)
    park('ZZ Degenerate', [o for o in degenerate if o not in set(overlapping)])

    set_viewport_defaults()
    bpy.ops.wm.save_as_mainfile(filepath=dst)
    print('saved %s (%.1f MB)' % (dst, os.path.getsize(dst) / 1048576))


main()
