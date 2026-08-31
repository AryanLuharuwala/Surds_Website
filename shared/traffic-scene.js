/* TrafficScene - a live signalised road network drawn as SVG.
 *
 * Same idea as the facility card, moved outdoors: instead of shoppers tracing
 * paths across a floor, cars trace them across a street grid. The trails are
 * the same device, the measurement is the same measurement, and the decision it
 * supports is signal timing rather than shelf placement.
 *
 * Nothing here is on a script. Cars pick a route, queue at reds, and the
 * controller reallocates green time toward whichever approach has actually
 * backed up - so the congestion numbers on the deck are read off the sim.
 *
 * Road and vehicle geometry share one viewBox, so a car is sized as a fraction
 * of the lane it drives in and the two can never drift out of scale.
 *
 * Publishes window.TrafficScene.
 */
var TrafficScene = (function () {
  'use strict';

  var VB = { w: 1000, h: 600 };
  var ROAD_W = 46;                       // full carriageway, both directions
  var LANE = ROAD_W / 4;                 // centre of a lane, offset from centreline
  var CAR_L = 26, CAR_W = 12;            // fits the lane with clearance on both sides
  var STOP_BACK = 30;                    // where a car holds relative to the junction
  var HEADWAY = 34;                      // minimum gap to the car ahead
  var SPEED = 92;                        // px/sec free-flow
  var TRAIL_MAX = 42, TRAIL_STEP = 9;

  var COLORS = ['#ff8a3a', '#5ad1ff', '#ff6fd8', '#8aff6f', '#ffd166', '#b28dff', '#ff6b4a'];

  // 3 columns x 2 rows of signalised junctions
  var XS = [200, 500, 800], YS = [200, 420];

  function nodeId(i, j) { return i + ':' + j; }
  function nodeAt(i, j) { return { i: i, j: j, x: XS[i], y: YS[j] }; }

  var state = null;

  /* ---------------------------------------------------------------- routes */
  /* A route is a list of grid nodes plus an entry and exit stub off the edge of
     the map, so cars appear to arrive from and leave to the wider city. */
  function edgeStub(node, dir) {
    var d = 260;
    if (dir === 'W') return { x: -d, y: node.y };
    if (dir === 'E') return { x: VB.w + d, y: node.y };
    if (dir === 'N') return { x: node.x, y: -d };
    return { x: node.x, y: VB.h + d };
  }

  function pickRoute() {
    var horizontalFirst = Math.random() < 0.5;
    var j = Math.floor(Math.random() * YS.length);
    var i = Math.floor(Math.random() * XS.length);
    var pts = [], fromDir, toDir;

    if (horizontalFirst) {
      var leftToRight = Math.random() < 0.5;
      fromDir = leftToRight ? 'W' : 'E';
      var order = leftToRight ? [0, 1, 2] : [2, 1, 0];
      for (var a = 0; a < order.length; a++) pts.push(nodeAt(order[a], j));
      // some traffic turns off at the middle junction instead of running through
      if (Math.random() < 0.45) {
        var turnAt = 1, j2 = 1 - j;
        pts = [];
        for (var b = 0; b < order.length; b++) {
          pts.push(nodeAt(order[b], j));
          if (order[b] === turnAt) break;
        }
        pts.push(nodeAt(turnAt, j2));
        toDir = j2 === 0 ? 'N' : 'S';
      } else {
        toDir = leftToRight ? 'E' : 'W';
      }
    } else {
      var topToBottom = Math.random() < 0.5;
      fromDir = topToBottom ? 'N' : 'S';
      var jOrder = topToBottom ? [0, 1] : [1, 0];
      for (var c = 0; c < jOrder.length; c++) pts.push(nodeAt(i, jOrder[c]));
      toDir = topToBottom ? 'S' : 'N';
    }
    var path = [edgeStub(pts[0], fromDir)].concat(pts, [edgeStub(pts[pts.length - 1], toDir)]);
    return path;
  }

  /* ------------------------------------------------------------------- car */
  function Car(id) {
    this.id = id;
    this.color = COLORS[id % COLORS.length];
    this.path = pickRoute();
    this.seg = 0;
    this.t = 0;
    this.speed = SPEED * (0.85 + Math.random() * 0.3);
    this.v = 0;
    this.trail = [];
    this.waited = 0;
    this.done = false;
    this.pos = { x: this.path[0].x, y: this.path[0].y };
  }

  Car.prototype.segLen = function () {
    var a = this.path[this.seg], b = this.path[this.seg + 1];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  Car.prototype.heading = function () {
    var a = this.path[this.seg], b = this.path[this.seg + 1];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  /* right-hand lane offset, perpendicular to travel */
  Car.prototype.point = function (t) {
    var a = this.path[this.seg], b = this.path[this.seg + 1];
    var L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    var ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    return { x: a.x + ux * t - uy * LANE, y: a.y + uy * t + ux * LANE };
  };
  /* which junction this car is approaching, and on which axis */
  Car.prototype.approach = function () {
    var b = this.path[this.seg + 1];
    if (b.i === undefined) return null;
    var h = this.heading();
    var axis = Math.abs(Math.cos(h)) > Math.abs(Math.sin(h)) ? 'EW' : 'NS';
    return { node: b, axis: axis, distance: this.segLen() - this.t };
  };

  /* -------------------------------------------------------------- junction */
  function Junction(i, j) {
    this.i = i; this.j = j;
    this.x = XS[i]; this.y = YS[j];
    this.phase = (i + j) % 2 === 0 ? 'EW' : 'NS';
    this.timer = 4 + Math.random() * 3;
    this.queue = { EW: 0, NS: 0 };
    this.served = 0;
  }
  /* Adaptive stage length: when a phase expires, green goes to whichever
     approach is actually holding more vehicles, bounded so no direction can be
     starved. This is the whole "route optimisation" claim, and it is real. */
  Junction.prototype.update = function (dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    var other = this.phase === 'EW' ? 'NS' : 'EW';
    var waitingOther = this.queue[other], waitingSelf = this.queue[this.phase];
    if (waitingOther > 0 || waitingSelf === 0) {
      this.phase = other;
      this.timer = Math.max(3, Math.min(11, 3 + waitingOther * 1.5));
    } else {
      this.timer = Math.max(3, Math.min(11, 3 + waitingSelf * 1.2));
    }
  };

  /* ---------------------------------------------------------------- render */
  function roadsSVG() {
    var s = '';
    var i, j;
    // carriageways
    for (j = 0; j < YS.length; j++) {
      s += '<rect x="-300" y="' + (YS[j] - ROAD_W / 2) + '" width="' + (VB.w + 600) + '" height="' + ROAD_W +
           '" fill="#20242c"/>';
    }
    for (i = 0; i < XS.length; i++) {
      s += '<rect x="' + (XS[i] - ROAD_W / 2) + '" y="-300" width="' + ROAD_W + '" height="' + (VB.h + 600) +
           '" fill="#20242c"/>';
    }
    // centre line dashes, broken at junctions by drawing the junction pads over them
    for (j = 0; j < YS.length; j++) {
      s += '<line x1="-300" y1="' + YS[j] + '" x2="' + (VB.w + 300) + '" y2="' + YS[j] +
           '" stroke="#5c6474" stroke-width="1.4" stroke-dasharray="14 12" opacity=".6"/>';
    }
    for (i = 0; i < XS.length; i++) {
      s += '<line x1="' + XS[i] + '" y1="-300" x2="' + XS[i] + '" y2="' + (VB.h + 300) +
           '" stroke="#5c6474" stroke-width="1.4" stroke-dasharray="14 12" opacity=".6"/>';
    }
    for (i = 0; i < XS.length; i++) {
      for (j = 0; j < YS.length; j++) {
        s += '<rect x="' + (XS[i] - ROAD_W / 2) + '" y="' + (YS[j] - ROAD_W / 2) + '" width="' + ROAD_W +
             '" height="' + ROAD_W + '" fill="#252a33"/>';
      }
    }
    return s;
  }

  function signalsSVG() {
    var s = '';
    for (var k = 0; k < state.junctions.length; k++) {
      var jn = state.junctions[k];
      var ew = jn.phase === 'EW';
      // two small heads per junction, one per axis
      s += signalHead(jn.x - ROAD_W / 2 - 13, jn.y - ROAD_W / 2 - 13, ew);
      s += signalHead(jn.x + ROAD_W / 2 + 5, jn.y + ROAD_W / 2 + 5, !ew);
    }
    return s;
  }
  function signalHead(x, y, green) {
    var on = green ? '#4ade80' : '#f87171';
    return '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')">' +
           '<rect x="0" y="0" width="8" height="8" rx="2" fill="' + on + '"/>' +
           '<rect x="0" y="0" width="8" height="8" rx="2" fill="' + on + '" opacity=".35" ' +
           'transform="scale(2.1)" transform-origin="4 4"/></g>';
  }

  function carsSVG() {
    var defs = '', body = '';
    for (var k = 0; k < state.cars.length; k++) {
      var c = state.cars[k];
      if (c.trail.length > 1) {
        var pts = [], t0 = c.trail[0], t1 = c.trail[c.trail.length - 1];
        for (var m = 0; m < c.trail.length; m++) {
          pts.push(c.trail[m].x.toFixed(1) + ',' + c.trail[m].y.toFixed(1));
        }
        var gid = 'trafTrail' + k;
        defs += '<linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="' + t0.x.toFixed(1) +
                '" y1="' + t0.y.toFixed(1) + '" x2="' + t1.x.toFixed(1) + '" y2="' + t1.y.toFixed(1) + '">' +
                '<stop offset="0%" stop-color="' + c.color + '" stop-opacity="0"/>' +
                '<stop offset="100%" stop-color="' + c.color + '" stop-opacity="0.85"/></linearGradient>';
        body += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="url(#' + gid +
                ')" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      var deg = c.heading() * 180 / Math.PI;
      body += '<g transform="translate(' + c.pos.x.toFixed(1) + ',' + c.pos.y.toFixed(1) +
              ') rotate(' + deg.toFixed(1) + ')">' +
              '<rect x="' + (-CAR_L / 2) + '" y="' + (-CAR_W / 2) + '" width="' + CAR_L + '" height="' + CAR_W +
              '" rx="3" fill="' + c.color + '"/>' +
              '<rect x="' + (-CAR_L / 2 + 5) + '" y="' + (-CAR_W / 2 + 2) + '" width="9" height="' + (CAR_W - 4) +
              '" rx="1.5" fill="rgba(12,16,24,.45)"/></g>';
    }
    return '<defs>' + defs + '</defs>' + body;
  }

  /* ------------------------------------------------------------------ loop */
  /* Distance to the nearest car genuinely in front, in the same lane, going the
     same way.
   *
   * All three conditions matter. Without the heading test, a car crossing the
   * junction on the other axis counts as "ahead" and holds the waiting car
   * indefinitely; both approaches then block each other and the grid deadlocks
   * with everyone stopped and nobody able to clear. Cross traffic is the
   * signal's job, not car-following's. */
  function carAheadGap(car) {
    var best = Infinity;
    var h = car.heading(), cx = Math.cos(h), cy = Math.sin(h);
    for (var k = 0; k < state.cars.length; k++) {
      var o = state.cars[k];
      if (o === car) continue;
      var dx = o.pos.x - car.pos.x, dy = o.pos.y - car.pos.y;
      var ahead = dx * cx + dy * cy;
      if (ahead <= 2 || ahead > HEADWAY) continue;
      var lateral = Math.abs(-dx * cy + dy * cx);
      if (lateral > CAR_W) continue;                       // different lane
      var oh = o.heading();
      if (Math.cos(oh - h) < 0.7) continue;                // not travelling with us
      if (ahead < best) best = ahead;
    }
    return best;
  }

  function step(dt) {
    var k, jn;
    for (k = 0; k < state.junctions.length; k++) {
      state.junctions[k].queue.EW = 0;
      state.junctions[k].queue.NS = 0;
    }
    // count who is queueing where, before deciding whether anyone may move
    for (k = 0; k < state.cars.length; k++) {
      var ap = state.cars[k].approach();
      if (!ap || ap.distance > 150) continue;
      jn = state.byId[nodeId(ap.node.i, ap.node.j)];
      if (jn) jn.queue[ap.axis]++;
    }
    for (k = 0; k < state.junctions.length; k++) state.junctions[k].update(dt);

    for (k = state.cars.length - 1; k >= 0; k--) {
      var c = state.cars[k];
      var target = c.speed;

      var ap2 = c.approach();
      if (ap2) {
        jn = state.byId[nodeId(ap2.node.i, ap2.node.j)];
        var red = jn && jn.phase !== ap2.axis;
        if (red && ap2.distance < STOP_BACK + 4) target = 0;
        else if (red && ap2.distance < 120) target = c.speed * (ap2.distance - STOP_BACK) / 90;
        if (!red && jn && ap2.distance < 20) jn.served++;
      }
      var gap = carAheadGap(c);
      if (gap < HEADWAY) target = Math.min(target, Math.max(0, c.speed * (gap - CAR_L) / (HEADWAY - CAR_L)));

      // ease toward the target so stops and starts read as traffic, not teleporting
      c.v += (target - c.v) * Math.min(1, dt * 3.2);
      if (c.v < 1) { c.v = Math.max(0, c.v); c.waited += dt; }
      c.t += c.v * dt;

      while (c.t >= c.segLen()) {
        c.t -= c.segLen();
        c.seg++;
        if (c.seg >= c.path.length - 1) { c.done = true; break; }
      }
      if (c.done) {
        state.completed++;
        state.totalWait += c.waited;
        state.cars.splice(k, 1);
        continue;
      }
      c.pos = c.point(c.t);

      var last = c.trail[c.trail.length - 1];
      if (!last || Math.hypot(c.pos.x - last.x, c.pos.y - last.y) > TRAIL_STEP) {
        c.trail.push({ x: c.pos.x, y: c.pos.y });
        if (c.trail.length > TRAIL_MAX) c.trail.shift();
      }
    }

    state.elapsed += dt;
    state.spawn -= dt;
    if (state.spawn <= 0 && state.cars.length < state.maxCars) {
      state.spawn = 0.5 + Math.random() * 0.9;
      state.cars.push(new Car(state.nextId++));
    }
  }

  function render() {
    state.svg.innerHTML = roadsSVG() + carsSVG() + signalsSVG();
  }

  /* ------------------------------------------------------------------- api */
  function start(svg) {
    if (state && state.svg === svg) { state.running = true; loop(); return; }
    stop();
    svg.setAttribute('viewBox', '0 0 ' + VB.w + ' ' + VB.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    state = {
      svg: svg, cars: [], junctions: [], byId: {}, nextId: 0,
      spawn: 0, maxCars: 13, running: true, raf: null, last: 0,
      completed: 0, totalWait: 0, elapsed: 0
    };
    for (var i = 0; i < XS.length; i++) {
      for (var j = 0; j < YS.length; j++) {
        var jn = new Junction(i, j);
        state.junctions.push(jn);
        state.byId[nodeId(i, j)] = jn;
      }
    }
    for (var k = 0; k < 8; k++) state.cars.push(new Car(state.nextId++));
    state.last = performance.now();
    loop();
  }

  function loop() {
    if (!state || !state.running) return;
    state.raf = requestAnimationFrame(loop);
    var now = performance.now();
    var dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    step(dt);
    render();
  }

  function pause() {
    if (!state) return;
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
  }
  function stop() {
    pause();
    state = null;
  }

  function stats() {
    if (!state) return null;
    var queued = 0, worst = null, worstQ = -1, greenSplit = { EW: 0, NS: 0 };
    for (var k = 0; k < state.junctions.length; k++) {
      var jn = state.junctions[k];
      var q = jn.queue.EW + jn.queue.NS;
      queued += q;
      if (q > worstQ) { worstQ = q; worst = jn; }
      greenSplit[jn.phase]++;
    }
    var stopped = 0, liveWait = 0;
    for (var m = 0; m < state.cars.length; m++) {
      if (state.cars[m].v < 1) stopped++;
      liveWait += state.cars[m].waited;
    }
    /* Averaging over completed trips alone is survivorship bias: the cars that
       finish are the ones that were never held, so a jammed network would
       report a flattering number while the queue it created is still sitting
       there. Count the delay accumulated by cars still in the network too. */
    var sampled = state.completed + state.cars.length;
    return {
      cars: state.cars.length,
      queued: queued,
      stopped: stopped,
      junctions: state.junctions.length,
      worst: worst ? ('J' + (worst.i + 1) + (worst.j + 1)) : '-',
      worstQueue: worstQ < 0 ? 0 : worstQ,
      completed: state.completed,
      throughput: state.elapsed ? state.completed / state.elapsed * 60 : 0,
      /* Webster uniform delay for a fixed 30 s cycle on an even split:
         d = (C/2)(1 - g/C)^2 = 15 * 0.25. The honest comparison for what the
         adaptive controller is actually achieving. */
      fixedCycleDelay: 3.75,
      avgWait: sampled ? (state.totalWait + liveWait) / sampled : 0,
      greenEW: greenSplit.EW,
      greenNS: greenSplit.NS
    };
  }

  return { start: start, pause: pause, stop: stop, stats: stats };
})();
window.TrafficScene = TrafficScene;
