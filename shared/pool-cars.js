/* PoolCars - traffic driving the real MBKS site.
 *
 * Road graph: models/pool-road.json, built by tools/build_road_graph.py from
 * paths clicked onto this very model in road-editor.html.
 *
 * PLACEMENT - the part that matters:
 *   Every car and every signal is a model-viewer hotspot carrying a
 *   data-position in model coordinates. model-viewer anchors it to the mesh
 *   itself, exactly as it did for the dots while the roads were being drawn.
 *   That is the only way to be certain a car is ON the road: the same code path
 *   that placed the points places the vehicles.
 *
 *   An earlier version projected the cars by hand from
 *   queryHotspot().canvasPosition. That is reported in CANVAS pixels - device
 *   pixels - while the SVG overlay is in CSS pixels, so on any display with a
 *   pixel ratio above 1 everything was drawn at twice its correct offset and
 *   the cars sat off the road entirely. Nothing is hand-projected now except
 *   the trails, and those are fitted from hotspot element rects, which are CSS
 *   pixels by definition and cannot drift.
 *
 * Publishes window.PoolCars.
 */
var PoolCars = (function () {
  'use strict';

  var CARS = 9;
  var SPEED = 900;            // model units/sec (~9 m/s at 100 units per metre)
  var STOP_BACK = 420;        // hold this far short of a controlled junction
  var HEADWAY = 800;          // minimum gap to the car in front
  var TRAIL_MAX = 30, TRAIL_STEP = 260;
  var GREEN_MIN = 2.5, GREEN_MAX = 7.0;
  var MAX_REFS = 6;           // reference pins used to fit the trail projection
  var TARGET_FPS = 20;        // the sim reads well below 60; the rest was waste
  var REFIT_EVERY = 3;        // camera moves slowly, so refit the projection rarely

  var COLORS = ['#ff8a3a', '#5ad1ff', '#ff6fd8', '#8aff6f', '#ffd166', '#b28dff', '#ff6b4a'];

  var S = null;

  /* Live-tunable placement, driven by car-editor.html. Every number here is a
     guess until someone lines a car up against the road by eye, so they are all
     adjustable at runtime rather than baked in. */
  var TUNE = {
    /* Measured by eye in car-editor.html against the model itself, which is the
       only authority here - the road file says where the tarmac is, not where a
       flat HTML box has to sit to look like it is on it. Re-dial in that editor
       if the model or the camera framing changes. */
    laneOffset: -340,      // units off the centreline (-3.40 m)
    dx: 200,               // +2.00 m
    dy: 200,               // +2.00 m; lifts the box so it rests on the road
    dz: -220,              // -2.20 m
    scale: 1.9,            // car graphic size multiplier
    anchorCenter: true,    // centre the graphic on the anchor
    freeze: false          // hold the traffic still while aligning
  };

  /* ----------------------------------------------------------------- graph */
  function buildGraph(nav) {
    var adj = [];
    for (var i = 0; i < nav.nodes.length; i++) adj.push([]);
    nav.edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    return adj;
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  /* ------------------------------------------------------------------- car */
  function Car(i) {
    this.color = COLORS[i % COLORS.length];
    this.from = Math.floor(Math.random() * S.nav.nodes.length);
    var opts = S.adj[this.from];
    this.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : this.from;
    this.t = Math.random() * 0.6;
    this.v = 0;
    this.speed = SPEED * (0.8 + Math.random() * 0.4);
    this.trail = [];
    this.waited = 0;
    this.pos = this.point();
  }
  Car.prototype.edgeLen = function () {
    return Math.max(1, dist(S.nav.nodes[this.from], S.nav.nodes[this.to]));
  };
  /* Right-hand lane offset so opposing traffic does not overlap. Height comes
     from the road nodes themselves, interpolated along the edge. */
  Car.prototype.point = function () {
    var a = S.nav.nodes[this.from], b = S.nav.nodes[this.to];
    var dx = b.x - a.x, dz = b.z - a.z;
    var L = Math.hypot(dx, dz) || 1;
    var ux = dx / L, uz = dz / L;
    var off = TUNE.laneOffset === null
      ? Math.min(S.nav.laneOffset || 0, S.nav.carWidth * 0.6)
      : TUNE.laneOffset;
    return {
      x: a.x + dx * this.t - uz * off + TUNE.dx,
      y: a.y + (b.y - a.y) * this.t + TUNE.dy,
      z: a.z + dz * this.t + ux * off + TUNE.dz,
      ux: ux, uz: uz
    };
  };
  Car.prototype.pickNext = function () {
    var opts = S.adj[this.to];
    if (!opts.length) return this.from;
    if (opts.length === 1) return opts[0];             // dead end: turn around
    var fwd = [];
    for (var i = 0; i < opts.length; i++) if (opts[i] !== this.from) fwd.push(opts[i]);
    if (!fwd.length) return this.from;
    var best = fwd[0], bestLoad = Infinity;
    for (var j = 0; j < fwd.length; j++) {             // prefer the least busy way on
      var load = (S.load[this.to + '>' + fwd[j]] || 0) + Math.random() * 0.6;
      if (load < bestLoad) { bestLoad = load; best = fwd[j]; }
    }
    return best;
  };

  /* -------------------------------------------------------------- junction */
  /* Only one approach is open at a time; the next green goes to whichever is
     holding the most cars, with the stage scaled to that queue and clamped so
     nothing starves. */
  function Junction(node, approaches) {
    this.node = node;
    this.approaches = approaches;
    this.open = approaches[0];
    this.timer = GREEN_MIN + Math.random() * 2;
    this.queue = {};
  }
  /* Demand-led, but round-robin underneath.
   *
   * Choosing "the busiest approach that is not the current one" looks
   * reasonable and is badly broken: with no queues it always falls back to
   * approaches[0], so the stage ping-pongs between the first two arms and every
   * other arm is starved forever. On a five-way junction three approaches never
   * saw a green, and once most cars are sitting at a signal that deadlocks the
   * whole network. Scanning forward from the current arm guarantees each one
   * gets its turn; a queue elsewhere can still jump the order. */
  Junction.prototype.update = function (dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    var n = this.approaches.length;
    var idx = this.approaches.indexOf(this.open);
    var best = null, bestQ = 0;
    for (var i = 1; i <= n; i++) {
      var a = this.approaches[(idx + i) % n];
      var q = this.queue[a] || 0;
      if (q > bestQ) { bestQ = q; best = a; }
    }
    if (best === null) best = this.approaches[(idx + 1) % n];   // nobody waiting: just rotate
    this.open = best;
    this.timer = Math.max(GREEN_MIN, Math.min(GREEN_MAX, GREEN_MIN + bestQ * 1.4));
  };

  /* ------------------------------------------------------------------ step */
  /* Only cars on the same edge and in front count. Treating crossing traffic as
     a leader deadlocks the network - that is the signal's job. */
  function gapAhead(car) {
    var best = Infinity, len = car.edgeLen();
    for (var i = 0; i < S.cars.length; i++) {
      var o = S.cars[i];
      if (o === car || o.from !== car.from || o.to !== car.to) continue;
      if (o.t > car.t) best = Math.min(best, (o.t - car.t) * len);
    }
    return best;
  }

  function step(dt) {
    var i, c, jk;
    S.load = {};
    for (i = 0; i < S.cars.length; i++) {
      c = S.cars[i];
      S.load[c.from + '>' + c.to] = (S.load[c.from + '>' + c.to] || 0) + 1;
    }
    for (jk in S.junctions) if (S.junctions.hasOwnProperty(jk)) S.junctions[jk].queue = {};
    for (i = 0; i < S.cars.length; i++) {
      c = S.cars[i];
      var j = S.junctions[c.to];
      if (j && (1 - c.t) * c.edgeLen() < 2600) j.queue[c.from] = (j.queue[c.from] || 0) + 1;
    }
    for (jk in S.junctions) if (S.junctions.hasOwnProperty(jk)) S.junctions[jk].update(dt);

    S.queued = 0; S.stopped = 0;
    for (i = 0; i < S.cars.length; i++) {
      c = S.cars[i];
      var len = c.edgeLen(), left = (1 - c.t) * len, target = c.speed;
      var jun = S.junctions[c.to], held = jun && jun.open !== c.from;
      if (held) {
        if (left < STOP_BACK) target = 0;
        else if (left < STOP_BACK * 4) target = c.speed * (left - STOP_BACK) / (STOP_BACK * 3);
      }
      var gap = gapAhead(c);
      if (gap < HEADWAY) target = Math.min(target, Math.max(0, c.speed * gap / HEADWAY));

      if (TUNE.freeze) target = 0;
      c.v += (target - c.v) * Math.min(1, dt * 3.5);
      if (c.v < c.speed * 0.08) { c.waited += dt; S.stopped++; if (held) S.queued++; }
      c.t += (c.v * dt) / len;
      if (c.t >= 1) { var n = c.pickNext(); c.from = c.to; c.to = n; c.t = 0; S.trips++; }
      c.pos = c.point();

      var last = c.trail[c.trail.length - 1];
      if (!last || Math.hypot(c.pos.x - last[0], c.pos.z - last[1]) > TRAIL_STEP) {
        c.trail.push([c.pos.x, c.pos.z]);
        if (c.trail.length > TRAIL_MAX) c.trail.shift();
      }
    }
    S.elapsed += dt;
  }

  /* -------------------------------------------------------------- hotspots */
  function posAttr(x, y, z) { return x + 'm ' + y + 'm ' + z + 'm'; }

  function hotspot(slot, pos, html, css) {
    var el = document.createElement('div');
    el.slot = slot;
    el.dataset.position = pos;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'pointer-events:none;' + (css || '');
    if (html) el.innerHTML = html;
    S.viewer.appendChild(el);
    return el;
  }

  function build() {
    /* Built to exactly the same shape as the signal hotspots below, because
       those land correctly and these did not.
     *
     * Two things had to go. The hotspot element must keep whatever transform
     * model-viewer writes on it - that transform IS its placement, so rotating
     * the car there discarded the position every frame. And the outer box must
     * be a normal laid-out box, not the zero-size one used before: model-viewer
     * places a hotspot against its layout, and a collapsed box drifts sideways
     * from the anchor. So the outer is a plain fixed box exactly like a signal,
     * and a flex-centred child does the rotating and the distance sizing. */
    S.carEls = S.cars.map(function (c, i) {
      var el = hotspot('hotspot-pcar' + i, posAttr(c.pos.x, c.pos.y, c.pos.z),
        '<div class="pc-body" style="position:relative;width:22px;height:9px;' +
        'will-change:transform;">' +
        '<i style="display:block;width:100%;height:100%;border-radius:3px;background:' + c.color +
        ';box-shadow:0 1px 3px rgba(0,0,0,.55), inset 0 -2px 0 rgba(0,0,0,.22);"></i>' +
        '<i style="position:absolute;left:14%;top:18%;width:34%;height:64%;border-radius:2px;' +
        'background:rgba(10,16,24,.5);"></i></div>',
        'position:relative;width:22px;height:9px;display:flex;align-items:center;' +
        'justify-content:center;');
      el._body = el.querySelector('.pc-body');
      return el;
    });

    S.signalEls = [];
    Object.keys(S.junctions).forEach(function (key, i) {
      var nd = S.nav.nodes[S.junctions[key].node];
      var el = hotspot('hotspot-psig' + i, posAttr(nd.x, nd.y, nd.z),
        '<i style="display:block;width:2px;height:22px;margin:0 auto;' +
        'background:linear-gradient(#39424f,#222831);"></i>' +
        '<i style="position:absolute;left:50%;top:-15px;transform:translateX(-50%);' +
        'display:flex;flex-direction:column;gap:1px;padding:2px;border-radius:3px;' +
        'background:#1b222c;border:1px solid #39424f;">' +
        '<b style="display:block;width:5px;height:5px;border-radius:50%;background:#3b1417;"></b>' +
        '<b style="display:block;width:5px;height:5px;border-radius:50%;background:#3a2f12;"></b>' +
        '<b style="display:block;width:5px;height:5px;border-radius:50%;background:#123521;"></b>' +
        '</i>',
        'position:relative;width:14px;height:22px;');
      S.signalEls.push({ el: el, junction: S.junctions[key], lamps: el.querySelectorAll('b') });
    });

    // a spread subset of the signals doubles as the reference set for trails
    var keys = Object.keys(S.junctions);
    var stride = Math.max(1, Math.floor(keys.length / MAX_REFS));
    S.refs = [];
    for (var k = 0; k < keys.length && S.refs.length < MAX_REFS; k += stride) {
      var nd = S.nav.nodes[S.junctions[keys[k]].node];
      S.refs.push({ el: S.signalEls[k].el, x: nd.x, z: nd.z });
    }
  }

  /* Screen position of a hotspot in CSS pixels relative to the viewer - the
     same space the SVG overlay uses. Read from the element's own rect, never
     from canvasPosition, which is device pixels and doubles on a retina panel. */
  function elScreen(el, vr) {
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return [r.left + r.width / 2 - vr.left, r.top + r.height / 2 - vr.top];
  }

  /* Plane homography, used only to draw the trails and to size and turn the car
     graphics. Every solid thing is placed by model-viewer, not by this. */
  function fitPlane(vr) {
    var src = [], dst = [], i, j, k;
    for (i = 0; i < S.refs.length; i++) {
      var p = elScreen(S.refs[i].el, vr);
      if (!p) continue;
      src.push([(S.refs[i].x - S.norm.cx) / S.norm.s, (S.refs[i].z - S.norm.cz) / S.norm.s]);
      dst.push(p);
    }
    if (src.length < 4) return null;
    var N = 8, A = [], b = [];
    for (i = 0; i < N; i++) { A.push(new Array(N).fill(0)); b.push(0); }
    for (k = 0; k < src.length; k++) {
      var X = src[k][0], Y = src[k][1], u = dst[k][0], v = dst[k][1];
      var rows = [[[X, Y, 1, 0, 0, 0, -u * X, -u * Y], u],
                  [[0, 0, 0, X, Y, 1, -v * X, -v * Y], v]];
      for (var r = 0; r < 2; r++) {
        for (i = 0; i < N; i++) {
          b[i] += rows[r][0][i] * rows[r][1];
          for (j = 0; j < N; j++) A[i][j] += rows[r][0][i] * rows[r][0][j];
        }
      }
    }
    for (i = 0; i < N; i++) {
      var piv = i;
      for (k = i + 1; k < N; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      var tA = A[i]; A[i] = A[piv]; A[piv] = tA;
      var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      for (k = 0; k < N; k++) {
        if (k === i) continue;
        var f = A[k][i] / A[i][i];
        if (!f) continue;
        for (j = i; j < N; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    var h = [];
    for (i = 0; i < N; i++) h.push(b[i] / A[i][i]);
    h.push(1);
    return h;
  }
  function planeProject(h, x, z) {
    var X = (x - S.norm.cx) / S.norm.s, Y = (z - S.norm.cz) / S.norm.s;
    var d = h[6] * X + h[7] * Y + h[8];
    if (Math.abs(d) < 1e-9) return null;
    return { x: (h[0] * X + h[1] * Y + h[2]) / d, y: (h[3] * X + h[4] * Y + h[5]) / d };
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    var vr = S.viewer.getBoundingClientRect();
    /* Refitting costs one forced layout per reference pin, so do it every few
       frames and reuse it in between - the camera drifts far too slowly for the
       difference to show. */
    S.fitTick = (S.fitTick + 1) % REFIT_EVERY;
    if (!S.H || S.fitTick === 0) S.H = fitPlane(vr);
    var H = S.H;
    var i;

    for (i = 0; i < S.cars.length; i++) {
      var c = S.cars[i], el = S.carEls[i];
      // this single line is what puts the car on the road; model-viewer does the rest
      var pos = posAttr(c.pos.x, c.pos.y, c.pos.z);
      if (pos !== el._pos) { el.dataset.position = pos; el._pos = pos; }
      if (!H) continue;
      var half = S.nav.carLength / 2;
      var nose = planeProject(H, c.pos.x + c.pos.ux * half, c.pos.z + c.pos.uz * half);
      var tail = planeProject(H, c.pos.x - c.pos.ux * half, c.pos.z - c.pos.uz * half);
      if (!nose || !tail) continue;
      var len = Math.hypot(nose.x - tail.x, nose.y - tail.y);
      var deg = Math.atan2(nose.y - tail.y, nose.x - tail.x) * 180 / Math.PI;
      /* Clamp against the viewport, not fixed pixels. The editor is full
         screen and the card is a small box, so absolute limits that felt right
         in one pinned every car to a floor or ceiling in the other. */
      var lo = Math.max(4, vr.width * 0.006), hi = Math.max(lo + 1, vr.width * 0.10);
      var w = Math.max(lo, Math.min(hi, len * TUNE.scale));
      var body = el._body;
      if (!body) continue;
      // only touch the style when it actually changed - each write costs a repaint
      var wpx = w.toFixed(1) + 'px';
      if (wpx !== body._w) {
        body.style.width = wpx;
        body.style.height = Math.max(3, w * (S.nav.carWidth / S.nav.carLength)).toFixed(1) + 'px';
        body._w = wpx;
      }
      var tf = (TUNE.anchorCenter ? '' : 'translate(50%,50%) ') +
               'rotate(' + deg.toFixed(0) + 'deg)';
      if (tf !== body._tf) { body.style.transform = tf; body._tf = tf; }
    }

    for (var k = 0; k < S.signalEls.length; k++) {
      var sg = S.signalEls[k], jn = sg.junction, held = 0;
      for (var q in jn.queue) if (jn.queue.hasOwnProperty(q) && +q !== jn.open) held += jn.queue[q];
      var on = held > 1 ? 0 : (held > 0 ? 1 : 2);
      if (sg.on !== on) {
        var lit = ['#f87171', '#fbbf24', '#4ade80'];
        var dim = ['#3b1417', '#3a2f12', '#123521'];
        for (var m = 0; m < 3; m++) {
          sg.lamps[m].style.background = m === on ? lit[m] : dim[m];
          sg.lamps[m].style.boxShadow = m === on ? '0 0 5px ' + lit[m] : 'none';
        }
        sg.on = on;
      }
    }

    var svg = S.overlay;
    if (!H) { svg.innerHTML = ''; return; }
    svg.setAttribute('viewBox', '0 0 ' + vr.width + ' ' + vr.height);

    var defs = '', body = '';
    /* 93 static edges reprojected every frame was most of the string building.
       They only change when the projection is refitted. */
    if (S.fitTick === 0 || S.roadPath === undefined) {
      var road = '';
      for (i = 0; i < S.nav.edges.length; i++) {
        var na = S.nav.nodes[S.nav.edges[i][0]], nb = S.nav.nodes[S.nav.edges[i][1]];
        var pa = planeProject(H, na.x, na.z), pb = planeProject(H, nb.x, nb.z);
        if (!pa || !pb) continue;
        road += 'M' + pa.x.toFixed(1) + ',' + pa.y.toFixed(1) + 'L' + pb.x.toFixed(1) + ',' + pb.y.toFixed(1);
      }
      S.roadPath = road ? '<path d="' + road + '" fill="none" stroke="#7ad8ff" stroke-width="1" opacity=".16"/>' : '';
    }
    body += S.roadPath;

    for (i = 0; i < S.cars.length; i++) {
      var cc = S.cars[i];
      if (cc.trail.length < 2) continue;
      var pts = [], ok = true;
      for (var t = 0; t < cc.trail.length; t++) {
        var p = planeProject(H, cc.trail[t][0], cc.trail[t][1]);
        if (!p) { ok = false; break; }
        pts.push(p);
      }
      if (!ok) continue;
      var g = 'pcT' + i, a0 = pts[0], a1 = pts[pts.length - 1];
      defs += '<linearGradient id="' + g + '" gradientUnits="userSpaceOnUse" x1="' + a0.x.toFixed(1) +
              '" y1="' + a0.y.toFixed(1) + '" x2="' + a1.x.toFixed(1) + '" y2="' + a1.y.toFixed(1) + '">' +
              '<stop offset="0%" stop-color="' + cc.color + '" stop-opacity="0"/>' +
              '<stop offset="100%" stop-color="' + cc.color + '" stop-opacity="0.85"/></linearGradient>';
      body += '<polyline points="' + pts.map(function (o) {
        return o.x.toFixed(1) + ',' + o.y.toFixed(1);
      }).join(' ') + '" fill="none" stroke="url(#' + g + ')" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>';
    }
    svg.innerHTML = '<defs>' + defs + '</defs>' + body;
  }

  /* ------------------------------------------------------------------- api */
  function show(on) {
    if (!S) return;
    var v = on ? '' : 'none';
    (S.carEls || []).forEach(function (e) { e.style.display = v; });
    (S.signalEls || []).forEach(function (s) { s.el.style.display = v; });
  }

  function start(opts) {
    if (S && S.viewer === opts.viewer) {
      S.running = true; S.last = performance.now(); show(true); loop(); return;
    }
    stop();
    if (!opts.viewer || !opts.overlay) return;
    fetch(opts.nav).then(function (r) { return r.json(); }).then(function (nav) {
      S = { nav: nav, viewer: opts.viewer, overlay: opts.overlay, adj: buildGraph(nav),
            cars: [], junctions: {}, load: {}, running: true, raf: null,
            last: performance.now(), elapsed: 0, trips: 0, queued: 0, stopped: 0,
            frameMs: 1000 / (opts.fps || TARGET_FPS), fitTick: 0, H: null };
      var xs = nav.nodes.map(function (n) { return n.x; });
      var zs = nav.nodes.map(function (n) { return n.z; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
      S.norm = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, s: Math.max(x1 - x0, z1 - z0) / 2 || 1 };
      (nav.junctions || []).forEach(function (n) { S.junctions[n] = new Junction(n, S.adj[n]); });
      for (var i = 0; i < CARS; i++) S.cars.push(new Car(i));
      // model-viewer fades hotspots it thinks are occluded; these must stay lit
      opts.viewer.style.setProperty('--min-hotspot-opacity', '1');
      build();
      loop();
    }).catch(function (e) { console.error('[PoolCars] ' + e); });
  }

  /* Traffic at 60 fps is invisible effort: each frame did eight forced layout
     reads for the projection fit, nine hotspot writes that make model-viewer
     re-place them, and a full SVG rebuild. Capping the work at TARGET_FPS keeps
     the motion smooth while cutting roughly two thirds of it. requestAnimation-
     Frame still drives the timing, so the tab throttles properly in background
     and dt stays honest. */
  function loop() {
    if (!S || !S.running) return;
    S.raf = requestAnimationFrame(loop);
    var now = performance.now();
    var elapsed = now - S.last;
    if (elapsed < S.frameMs) return;
    var dt = Math.min(0.12, elapsed / 1000);
    S.last = now;
    step(dt);
    render();
  }

  function pause() {
    if (!S) return;
    S.running = false;
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = null;
    if (S.overlay) S.overlay.innerHTML = '';
    show(false);
  }
  function stop() {
    if (!S) return;
    pause();
    [].slice.call(S.viewer.querySelectorAll('[slot^="hotspot-pcar"],[slot^="hotspot-psig"]'))
      .forEach(function (n) { n.remove(); });
    S = null;
  }

  function stats() {
    if (!S) return null;
    var wait = 0;
    for (var i = 0; i < S.cars.length; i++) wait += S.cars[i].waited;
    return {
      cars: S.cars.length,
      junctions: Object.keys(S.junctions).length,
      queued: S.queued, stopped: S.stopped, trips: S.trips,
      throughput: S.elapsed ? S.trips / S.elapsed * 60 : 0,
      /* delay per junction crossing, not a running total - these cars never
         leave, so a cumulative figure would only ever climb */
      avgWait: S.trips ? wait / S.trips : 0,
      fixedCycleDelay: 3.75      // Webster uniform delay, 30 s cycle, even split
    };
  }

  function tune(o) {
    if (!o) return TUNE;
    for (var k in o) if (o.hasOwnProperty(k) && TUNE.hasOwnProperty(k)) TUNE[k] = o[k];
    if (S) { S.H = null; S.roadPath = undefined; }   // force a refit next frame
    return TUNE;
  }

  /* Drop one car exactly onto a junction node - the same point a signal is
     pinned to. If the two do not coincide on screen the fault is in how the car
     element is anchored, not in where the road says the car is. */
  function calibrate(on) {
    if (!S) return;
    S.calibrate = !!on;
    if (on && S.cars.length) {
      var nd = S.nav.junctions && S.nav.junctions.length ? S.nav.junctions[0] : 0;
      var c = S.cars[0];
      c.from = nd;
      c.to = S.adj[nd][0];
      c.t = 0;
      c.v = 0;
      c.pos = c.point();
    }
  }

  return { start: start, pause: pause, stop: stop, stats: stats,
           tune: tune, calibrate: calibrate, state: function () { return S; } };
})();
window.PoolCars = PoolCars;
