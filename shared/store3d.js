/* Store3D - real 3D shoppers walking inside a real GLB.
 *
 * The isometric card already tells the story with SVG walkers on a grid we
 * authored. This does the same thing on an actual scanned/modelled space: the
 * floor plan comes out of tools/extract_scene_nav.py, the shoppers are meshes
 * in the scene rather than overlaid sprites, and the dwell numbers on the
 * panel are measured from where they actually stopped - not scripted.
 *
 * Loaded as a module; publishes window.Store3D.
 */
/* Resolved through the import map in the host page's <head>. GLTFLoader itself
   imports from 'three', so loading it by URL instead would fail. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

var SHOPPER_COLORS = ['#ffa85a', '#5ad1ff', '#ff6fd8', '#8aff6f', '#ffd166', '#b28dff'];
var TRAIL_MAX = 90;          // samples kept per shopper
var TRAIL_STEP = 0.22;       // metres of travel between samples
var WALK_SPEED = 0.95;       // m/s
var BROWSE_MIN = 3.0, BROWSE_MAX = 9.0;   // seconds spent at a fixture

/* ---------------------------------------------------------------- nav grid */

function NavGrid(data) {
  this.cell = data.cell;
  this.cols = data.cols;
  this.rows = data.rows;
  this.originX = data.originX;
  this.originZ = data.originZ;
  this.floorY = data.floorY;
  this.fixtures = data.fixtures;
  this.walk = data.walkable.map(function (row) { return row.split(''); });

  this.open = [];
  for (var r = 0; r < this.rows; r++) {
    for (var c = 0; c < this.cols; c++) {
      if (this.walk[r][c] === '.') this.open.push([c, r]);
    }
  }
}
NavGrid.prototype.walkable = function (c, r) {
  return r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.walk[r][c] === '.';
};
/* grid row/col -> world x/z. The extractor already flipped Blender's Y into
   glTF's -Z, so originZ decreases as the row index grows. */
NavGrid.prototype.toWorld = function (c, r) {
  return { x: this.originX + c * this.cell, z: this.originZ - r * this.cell };
};
NavGrid.prototype.toCell = function (x, z) {
  return { c: Math.round((x - this.originX) / this.cell),
           r: Math.round((this.originZ - z) / this.cell) };
};
NavGrid.prototype.nearestOpen = function (x, z) {
  var best = null, bd = Infinity;
  for (var i = 0; i < this.open.length; i++) {
    var w = this.toWorld(this.open[i][0], this.open[i][1]);
    var d = (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z);
    if (d < bd) { bd = d; best = this.open[i]; }
  }
  return best;
};
/* Breadth-first search. The floor is a few hundred cells, so an exact BFS is
   both cheaper and more predictable than a heuristic search, and it never
   walks a shopper through a rack. */
NavGrid.prototype.path = function (c0, r0, c1, r1) {
  if (!this.walkable(c0, r0) || !this.walkable(c1, r1)) return null;
  var key = function (c, r) { return r * 4096 + c; };
  var prev = {}, seen = {}, q = [[c0, r0]], head = 0;
  seen[key(c0, r0)] = 1;
  var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < q.length) {
    var cur = q[head++], cc = cur[0], cr = cur[1];
    if (cc === c1 && cr === r1) {
      var out = [], k = key(cc, cr), node = [cc, cr];
      while (node) { out.push(node); node = prev[key(node[0], node[1])]; }
      return out.reverse();
    }
    for (var i = 0; i < 4; i++) {
      var nc = cc + D[i][0], nr = cr + D[i][1], nk = key(nc, nr);
      if (seen[nk] || !this.walkable(nc, nr)) continue;
      seen[nk] = 1; prev[nk] = [cc, cr];
      q.push([nc, nr]);
    }
  }
  return null;
};

/* ---------------------------------------------------------------- shoppers */

function buildAvatar(color) {
  var g = new THREE.Group();
  var skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55, metalness: 0.05 });
  var dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.45), roughness: 0.8 });

  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.38, 4, 10), skin);
  torso.position.y = 1.02; g.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skin);
  head.position.y = 1.42; g.add(head);

  g.userData.limbs = [];
  [[-0.075, 'leg'], [0.075, 'leg']].forEach(function (spec, i) {
    var pivot = new THREE.Group();
    pivot.position.set(spec[0], 0.72, 0);
    var limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.44, 3, 8), dark);
    limb.position.y = -0.26;
    pivot.add(limb); g.add(pivot);
    g.userData.limbs.push({ pivot: pivot, phase: i * Math.PI });
  });
  [[-0.2, 'arm'], [0.2, 'arm']].forEach(function (spec, i) {
    var pivot = new THREE.Group();
    pivot.position.set(spec[0], 1.2, 0);
    var limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 3, 8), skin);
    limb.position.y = -0.2;
    pivot.add(limb); g.add(pivot);
    g.userData.limbs.push({ pivot: pivot, phase: i * Math.PI + Math.PI });
  });
  return g;
}

function Shopper(index, nav, scene) {
  this.id = 'S' + (index + 1);
  this.color = SHOPPER_COLORS[index % SHOPPER_COLORS.length];
  this.nav = nav;
  this.mesh = buildAvatar(this.color);
  scene.add(this.mesh);

  var start = nav.open[Math.floor(Math.random() * nav.open.length)];
  var w = nav.toWorld(start[0], start[1]);
  this.x = w.x; this.z = w.z;
  this.heading = Math.random() * Math.PI * 2;
  this.state = 'walking';
  this.path = null; this.step = 0;
  this.goal = null; this.visiting = null;
  this.browse = 0;
  this.stride = Math.random() * Math.PI * 2;
  this.trail = [];

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 4), 4));
  geo.setDrawRange(0, 0);
  this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false
  }));
  this.line.renderOrder = 3;
  scene.add(this.line);

  this.pickGoal();
}

Shopper.prototype.pickGoal = function () {
  var nav = this.nav;
  var here = nav.toCell(this.x, this.z);
  if (!nav.walkable(here.c, here.r)) {
    var o = nav.nearestOpen(this.x, this.z);
    if (!o) return;
    here = { c: o[0], r: o[1] };
  }
  for (var attempt = 0; attempt < 12; attempt++) {
    var fx = nav.fixtures[Math.floor(Math.random() * nav.fixtures.length)];
    if (!fx || !fx.approach.length) continue;
    if (fx === this.visiting) continue;              // don't re-browse what we just left
    var ap = fx.approach[Math.floor(Math.random() * fx.approach.length)];
    var target = nav.toCell(ap.x, ap.z);
    var p = nav.path(here.c, here.r, target.c, target.r);
    if (p && p.length) {
      this.path = p; this.step = 0; this.goal = fx; this.state = 'walking';
      return;
    }
  }
  this.state = 'walking'; this.path = null; this.goal = null;
};

Shopper.prototype.update = function (dt, dwell) {
  if (this.state === 'browsing') {
    this.browse -= dt;
    if (this.visiting) dwell[this.visiting.id] = (dwell[this.visiting.id] || 0) + dt;
    // small idle sway so a stopped shopper still reads as alive
    this.mesh.rotation.y = this.heading + Math.sin(performance.now() / 900) * 0.16;
    this.mesh.userData.limbs.forEach(function (l) { l.pivot.rotation.x *= 0.9; });
    if (this.browse <= 0) { this.visiting = null; this.pickGoal(); }
    return;
  }

  if (!this.path || this.step >= this.path.length) {
    if (this.goal) {
      this.state = 'browsing';
      this.visiting = this.goal;
      this.browse = BROWSE_MIN + Math.random() * (BROWSE_MAX - BROWSE_MIN);
      // face the fixture we stopped at
      this.heading = Math.atan2(this.goal.x - this.x, this.goal.z - this.z);
      this.goal = null;
    } else {
      this.pickGoal();
    }
    return;
  }

  var node = this.path[this.step];
  var w = this.nav.toWorld(node[0], node[1]);
  var dx = w.x - this.x, dz = w.z - this.z;
  var dist = Math.hypot(dx, dz);
  if (dist < 0.06) { this.step++; return; }

  var move = Math.min(WALK_SPEED * dt, dist);
  this.x += dx / dist * move;
  this.z += dz / dist * move;

  var want = Math.atan2(dx, dz);
  var diff = ((want - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  this.heading += diff * Math.min(1, dt * 7);
  this.mesh.rotation.y = this.heading;

  this.stride += move * 5.2;
  var swing = Math.sin(this.stride) * 0.55;
  this.mesh.userData.limbs.forEach(function (l) {
    l.pivot.rotation.x = Math.sin(l.phase) >= 0 ? swing : -swing;
  });
  this.mesh.position.y = Math.abs(Math.sin(this.stride)) * 0.03;

  this.sample();
};

Shopper.prototype.sample = function () {
  var last = this.trail[this.trail.length - 1];
  if (last && Math.hypot(this.x - last[0], this.z - last[1]) < TRAIL_STEP) return;
  this.trail.push([this.x, this.z]);
  if (this.trail.length > TRAIL_MAX) this.trail.shift();
  this.redraw();
};

Shopper.prototype.redraw = function () {
  var pos = this.line.geometry.attributes.position.array;
  var col = this.line.geometry.attributes.color.array;
  var base = new THREE.Color(this.color);
  var n = this.trail.length;
  for (var i = 0; i < n; i++) {
    pos[i * 3] = this.trail[i][0];
    pos[i * 3 + 1] = this.nav.floorY + 0.02;
    pos[i * 3 + 2] = this.trail[i][1];
    // oldest sample fully transparent, newest at full strength
    var t = n > 1 ? i / (n - 1) : 1;
    col[i * 4] = base.r; col[i * 4 + 1] = base.g; col[i * 4 + 2] = base.b;
    col[i * 4 + 3] = t * t * 0.85;
  }
  this.line.geometry.setDrawRange(0, n);
  this.line.geometry.attributes.position.needsUpdate = true;
  this.line.geometry.attributes.color.needsUpdate = true;
};

Shopper.prototype.place = function () {
  this.mesh.position.x = this.x;
  this.mesh.position.z = this.z;
};

/* ------------------------------------------------------------------ engine */

var state = null;

/* Extent of the walkable floor, which is the shop itself - not the model's
   bounding box, most of which is the ground plane it was placed on. */
function floorExtent(nav) {
  var b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (var i = 0; i < nav.open.length; i++) {
    var w = nav.toWorld(nav.open[i][0], nav.open[i][1]);
    b.minX = Math.min(b.minX, w.x); b.maxX = Math.max(b.maxX, w.x);
    b.minZ = Math.min(b.minZ, w.z); b.maxZ = Math.max(b.maxZ, w.z);
  }
  return b;
}

function frameCamera(b, nav, camera, target) {
  target.set((b.minX + b.maxX) / 2, nav.floorY + 1.0, (b.minZ + b.maxZ) / 2);
  return Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
}

/* These models are a shop dropped onto a 37 x 34 m ground plane. Rendered as
   authored, that plane runs off in every direction and dominates the frame -
   an untextured grey field with a small shop somewhere on it. Clipping to the
   walkable footprint plus a margin for the walls crops the world to the shop,
   and the same plane set slices the roof off so the camera can see in. */
function cutawayPlanes(b, floorY, margin, headroom) {
  return [
    new THREE.Plane(new THREE.Vector3(0, -1, 0), floorY + headroom),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -(b.minX - margin)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.maxX + margin),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -(b.minZ - margin)),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), b.maxZ + margin)
  ];
}

/* The shops are modelled with a roof on. Looking in from outside you would see
   nothing but the roof, so drop anything sitting entirely above head height.
 *
 * updateWorldMatrix(true, ...) is load-bearing. Box3.setFromObject only walks
 * *down* from the object it is given, so without forcing the ancestors first,
 * the parent Group that GLTFLoader hangs the node transform on still has an
 * identity matrixWorld. Every box then comes back in raw KHR_mesh_quantization
 * integer space, where the Y values are in the thousands, and the test hides
 * the entire shop while leaving the one primitive whose raw minimum is zero -
 * the ground plane. The card renders as a bare floor. */
function stripCeiling(root, floorY) {
  root.updateWorldMatrix(true, true);
  var box = new THREE.Box3();
  var hidden = 0;
  root.traverse(function (o) {
    if (!o.isMesh) return;
    box.setFromObject(o);
    if (box.min.y > floorY + 2.35) { o.visible = false; hidden++; }
  });
  return hidden;
}

function Store3D() {}

Store3D.prototype.start = function (opts) {
  // Re-entering the card should not re-download a 24 MB GLB or spin up a
  // second WebGL context; if the scene is still mounted, just resume it.
  if (state && state.mount === opts.mount) {
    if (!state.running) {
      state.running = true;
      state.last = performance.now();
      if (state.loop) state.loop();
    }
    if (opts.onReady) opts.onReady();
    return;
  }
  this.dispose();

  var mount = opts.mount;
  var w = mount.clientWidth || 800, h = mount.clientHeight || 500;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 400);

  /* Every textured material in this GLB is metallic-roughness. Lit by
     directional lights alone those read flat and washed out - the fabric on
     the racks in particular has nothing to reflect. A PMREM-filtered room
     environment gives the whole shop image-based lighting, which is what makes
     the floor and the clothes look like materials rather than tinted paper. */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20242e, 0.7));
  var key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(6, 12, 8); scene.add(key);
  var fill = new THREE.DirectionalLight(0x89b8ff, 0.35);
  fill.position.set(-8, 6, -6); scene.add(fill);

  state = {
    mount: mount, renderer: renderer, scene: scene, camera: camera,
    running: true, raf: null, last: 0, orbit: 0, spread: 12,
    target: new THREE.Vector3(), shoppers: [], nav: null, dwell: {},
    drag: null, userOrbit: null, labels: opts.labels || null, onStats: opts.onStats || null,
    statTimer: 0
  };

  function resize() {
    if (!state) return;
    var ww = mount.clientWidth || 800, hh = mount.clientHeight || 500;
    camera.aspect = ww / hh; camera.updateProjectionMatrix();
    renderer.setSize(ww, hh);
  }
  state.resize = resize;
  window.addEventListener('resize', resize);

  // drag to orbit, matching the feel of the model-viewer cards around it
  var el = renderer.domElement;
  function down(e) { state.drag = { x: (e.touches ? e.touches[0] : e).clientX, o: state.orbit }; }
  function move(e) {
    if (!state.drag) return;
    var cx = (e.touches ? e.touches[0] : e).clientX;
    state.userOrbit = state.drag.o + (cx - state.drag.x) * 0.006;
    state.orbit = state.userOrbit;
  }
  function up() { state.drag = null; }
  el.addEventListener('mousedown', down); el.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: true });
  window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
  state.teardown = function () {
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('mouseup', up);
    window.removeEventListener('touchend', up);
  };

  Promise.all([
    fetch(opts.nav).then(function (r) { return r.json(); }),
    new Promise(function (res, rej) { new GLTFLoader().load(opts.model, res, null, rej); })
  ]).then(function (out) {
    if (!state) return;
    var nav = new NavGrid(out[0]);
    var gltf = out[1];
    state.nav = nav;
    scene.add(gltf.scene);
    var dropped = stripCeiling(gltf.scene, nav.floorY);

    /* Hiding whole meshes only works when the roof is its own mesh. Some
       primitives here merge the walls and the roof into one object
       (y 0.00 to 3.42), which no per-mesh test can cut, so the clip planes do
       the rest - and crop the ground plane at the same time. */
    var bounds = floorExtent(nav);
    renderer.clippingPlanes = cutawayPlanes(bounds, nav.floorY, opts.margin || 1.4, 2.3);
    console.log('[Store3D] loaded; hid ' + dropped + ' ceiling meshes; floor y=' + nav.floorY +
                '; cropped to x ' + bounds.minX.toFixed(1) + '..' + bounds.maxX.toFixed(1) +
                ' z ' + bounds.minZ.toFixed(1) + '..' + bounds.maxZ.toFixed(1));

    state.spread = frameCamera(bounds, nav, camera, state.target);

    var n = opts.shoppers || 5;
    for (var i = 0; i < n; i++) state.shoppers.push(new Shopper(i, nav, scene));

    if (opts.onReady) opts.onReady();
    state.last = performance.now();
    state.loop();
  }).catch(function (err) {
    console.error('[Store3D] load failed', err);
    if (opts.onReady) opts.onReady(err);
  });

  state.loop = function loop() {
    if (!state || !state.running) return;
    state.raf = requestAnimationFrame(loop);
    var now = performance.now();
    var dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    if (state.nav) {
      for (var i = 0; i < state.shoppers.length; i++) {
        state.shoppers[i].update(dt, state.dwell);
        state.shoppers[i].place();
      }
      if (state.userOrbit === null) state.orbit += dt * 0.09;
      var d = state.spread * 1.55 + 3;
      camera.position.set(
        state.target.x + Math.sin(state.orbit) * d,
        state.target.y + d * 0.82,
        state.target.z + Math.cos(state.orbit) * d
      );
      camera.lookAt(state.target);

      /* Re-pin the flag EVERY frame. Projecting it once a second while the
         camera orbits continuously is what made it drift free of the fixture
         and look like it was floating in mid-air. The stats behind it are
         still only recomputed at 1 Hz - it's the projection that has to keep
         up with the camera, not the arithmetic. */
      positionFlag();
      state.statTimer -= dt;
      if (state.statTimer <= 0) { state.statTimer = 1.0; publishStats(); }
    }
    renderer.render(scene, camera);
  };
};

var _v = new THREE.Vector3();

/* Anchor the flag to the fixture it describes, and keep it inside the card.
   Without the clamp the label runs off the edge as the fixture orbits toward
   the frame boundary, which is what was pushing text outside the card. */
function positionFlag() {
  var flag = state.labels, top = state.topFixture;
  if (!flag) return;
  if (!top) { flag.style.display = 'none'; return; }

  _v.set(top.x, state.nav.floorY + Math.max(top.height, 0.6) + 0.35, top.z);
  _v.project(state.camera);
  if (_v.z >= 1) { flag.style.display = 'none'; return; }

  var el = state.renderer.domElement;
  var w = el.clientWidth || 800, h = el.clientHeight || 500;
  var x = (_v.x * 0.5 + 0.5) * w;
  var y = (-_v.y * 0.5 + 0.5) * h;

  flag.style.display = 'block';
  var fw = flag.offsetWidth || 150, fh = flag.offsetHeight || 44;
  // the flag is translate(-50%,-100%), so its box spans [x-fw/2, x+fw/2] x [y-fh, y]
  var pad = 8;
  x = Math.min(Math.max(x, fw / 2 + pad), w - fw / 2 - pad);
  y = Math.min(Math.max(y, fh + pad), h - pad);
  flag.style.left = x.toFixed(1) + 'px';
  flag.style.top = y.toFixed(1) + 'px';
}

function publishStats() {
  var nav = state.nav, dwell = state.dwell;
  var top = null, topT = 0, total = 0, visited = 0;
  nav.fixtures.forEach(function (f) {
    var t = dwell[f.id] || 0;
    total += t;
    if (t > 0) visited++;
    if (t > topT) { topT = t; top = f; }
  });
  state.topFixture = top;
  state.topDwell = topT;

  var browsing = state.shoppers.filter(function (s) { return s.state === 'browsing'; }).length;
  var val = state.labels && state.labels.querySelector('[data-dwell]');
  if (val) val.textContent = topT.toFixed(0) + 's';

  if (state.onStats) {
    state.onStats({
      shoppers: state.shoppers.length,
      browsing: browsing,
      topFixture: top ? top.id : null,
      topDwell: topT,
      totalDwell: total,
      /* mean seconds a shopper stays at a fixture, across every fixture that
         has actually been visited - not an average over all fixtures, which
         would sag toward zero as the shop grows */
      avgDwell: visited ? total / visited : 0,
      dwell: dwell
    });
  }
}

/* Leaving the card only stops the render loop. The scene, the GLB and the
   shoppers' accumulated dwell all survive, so coming back resumes instantly. */
Store3D.prototype.pause = function () {
  if (!state) return;
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
};

Store3D.prototype.dispose = function () {
  if (!state) return;
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  if (state.teardown) state.teardown();
  state.renderer.dispose();
  if (state.renderer.domElement.parentNode) {
    state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
  }
  state = null;
};

Store3D.prototype.stats = function () {
  return state ? { dwell: state.dwell, shoppers: state.shoppers.length } : null;
};

window.Store3D = new Store3D();
