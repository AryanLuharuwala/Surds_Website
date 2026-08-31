/* ==================================================
   LIVE MOVEMENT INTELLIGENCE: tracks the scene's own roaming walkers (shoppers /
   workers / technicians depending on theme) to build a genuinely live "which spot
   gets the most attention, which gets the least" narrative. Nothing here is scripted
   content — the trails follow the walkers' real paths, and the dwell figures the deck
   reports are read straight off the simulation already animating the scene.

   Depends on shared/iso-*.js already being loaded (uses canvas, isoX/isoY, pieces,
   walkers, PIECES, currentTheme, findNearestEmpty as globals) and on the host page's
   markup (#facMoveOverlay, #facDeck). The scroll-time narrative is carried by the
   analytics deck in shared/fac-deck.js, not by text overlays.
================================================== */
var FacMove = (function(){
  var MOVEABLE = {
    retail: ['shelf','produce','fridge','bin','deli'],
    industrial: ['rack','panel','tank','coil'],
    chemical: ['storage','drum','pump']
  };
  var SUB_COPY = {
    retail: 'Every shopper who walks this floor traces a path the cameras were already capturing — we just turn it into a decision.',
    industrial: 'Every pass a worker makes across this floor traces a path the sensors were already capturing — we just turn it into a decision.',
    chemical: 'Every round a technician walks through this plant traces a path the sensors were already capturing — we just turn it into a decision.'
  };
  var VISIT_WORD = { retail:'Shoppers', industrial:'Workers', chemical:'Technicians' };
  var SUGGEST_VERB = { retail:'Moving', industrial:'Moving', chemical:'Relocating' };
  /* one distinct color per walker so overlapping trails stay readable as separate paths */
  var WALKER_COLORS = ['#ffa85a', '#5ad1ff', '#ff6fd8', '#8aff6f'];

  var overlay = document.getElementById('facMoveOverlay');
  var facVizEl = document.getElementById('facVizReal');

  var dwell = {}, trails = [], TRAIL_MAX = 50;
  var active = false, lastP = -1, suggestTarget = null;
  /* deck telemetry: arrival events (a walker starting a stop), per-walker time
     actually spent on task, and how long the card has been open - all measured
     off the same simulation, never scripted */
  var arrivals = [], stationSeconds = [], prevVisit = [], elapsed = 0, coolStrength = 0;

  /* Airflow shape, tunable live from air-editor.html. These are the numbers that
     decide whether it reads as air or as plumbing, and they are far easier to
     judge by eye against the scene than to reason about. */
  var AIR = {
    streams: 4,          // supply points, one per busiest cell
    ceilingFrac: 0.44,   // ceiling height as a fraction of the card
    throwMul: 1.15,      // how far along the ceiling before it drops, x ceiling height
    cling: 0.30,         // how late it separates: lower = hugs the ceiling longer
    spread: 30,          // floor sweep distance
    particles: 15,
    speed: 0.13,
    turbulence: 1,
    opacity: 1,
    showLoop: true,      // draw the spent air rising back
    showDiffuser: true,
    forced: -1           // >=0 pins the reveal strength, for the editor
  };

  function reset(){
    dwell = {}; trails = []; suggestTarget = null; lastP = -1;
    arrivals = []; stationSeconds = []; prevVisit = []; elapsed = 0; coolStrength = 0;
  }

  /* ctm/vizRect are forced-layout DOM reads — expensive if repeated per point, so every
     caller in the hot per-tick render path grabs them ONCE and threads them through */
  function svgPtToViz(sx, sy, ctm, vizRect){
    var pt = canvas.createSVGPoint();
    pt.x = sx; pt.y = sy;
    var screenPt = pt.matrixTransform(ctm);
    return { x: screenPt.x - vizRect.left, y: screenPt.y - vizRect.top };
  }
  function pieceScreenPt(p, ctm, vizRect){
    var h = (PIECES[p.type] && PIECES[p.type].h) || 1;
    return svgPtToViz(isoX(p.gx + 0.5, p.gy + 0.5), isoY(p.gx + 0.5, p.gy + 0.5, h * 0.55), ctm, vizRect);
  }
  function bestByDwell(list, want){
    var bestPc = null, bestV = want === 'max' ? -1 : Infinity;
    for (var i = 0; i < list.length; i++){
      var p = list[i], v = dwell[p.id] || 0;
      if ((want === 'max' && v > bestV) || (want === 'min' && v < bestV)){ bestV = v; bestPc = p; }
    }
    return bestPc;
  }

  /* runs every render tick regardless of open state, so dwell data is already
     meaningful by the time a visitor actually opens the card. w.visiting is set by
     the walker's own AI (shared/iso-walkers.js) for exactly as long as it's actually
     stopped at that entity — real dwell, not just incidental walk-by proximity. */
  function tick(dtSec){
    if (!walkers || !walkers.length) return;
    for (var i = 0; i < walkers.length; i++){
      var v = walkers[i].visiting;
      if (v) dwell[v.id] = (dwell[v.id] || 0) + dtSec;
      /* an arrival is the transition into a stop, not the stop itself - that is
         what makes it countable as footfall rather than double-counted dwell */
      var prev = prevVisit[i] || null;
      var now = v ? v.id : null;
      if (now && now !== prev) arrivals.push(Date.now());
      prevVisit[i] = now;
      stationSeconds[i] = (stationSeconds[i] || 0) + (v ? dtSec : 0);
    }
    elapsed += dtSec;
    while (arrivals.length && Date.now() - arrivals[0] > 60000) arrivals.shift();
    if (active){
      /* sample by distance moved, not by tick, per walker — walkers pause for long
         stretches, and a fixed per-tick sample would fill each trail with near-duplicate
         points during a pause, reading as a blob glued to the character instead of a path */
      for (var j = 0; j < walkers.length; j++){
        var wj = walkers[j];
        if (!trails[j]) trails[j] = [];
        var tj = trails[j], last = tj[tj.length - 1];
        if (!last || Math.hypot(wj.cx - last.gx, wj.cy - last.gy) > 0.15){
          tj.push({ gx: wj.cx, gy: wj.cy });
          if (tj.length > TRAIL_MAX) tj.shift();
        }
      }
      renderOverlay();
      if (window.FacDeck) FacDeck.update(lastP < 0 ? 0 : lastP, deckCtx());
    }
  }

  function deckCtx(){
    return {
      theme: currentTheme,
      pieces: pieces,
      walkers: walkers,
      dwell: dwell,
      trails: trails,
      elapsed: elapsed,
      stationSeconds: stationSeconds,
      arrivalsPerMin: arrivals.length,
      dwelling: walkers.filter(function(w){ return w.state === 'browsing'; }).length,
      /* the traffic theme has no walkers of its own; its cards read the
         signalised network sim instead */
      /* the pool theme has no walkers of its own; its cards read the site
         traffic sim instead */
      traffic: (window.PoolCars && PoolCars.stats()) || null
    };
  }

  /* Where the people actually are is where the cooling has to go. Occupancy is
     accumulated from the walkers' own trail samples, the hottest cells win a
     supply column, and each column falls from the ceiling and turns along the
     floor the way real supply air does when it hits a surface. */
  function coolingCells(n){
    var heat = {}, k;
    for (var i = 0; i < trails.length; i++){
      var tr = trails[i] || [];
      for (var j = 0; j < tr.length; j++){
        k = Math.floor(tr[j].gx) + ',' + Math.floor(tr[j].gy);
        heat[k] = (heat[k] || 0) + 1;
      }
    }
    for (var m = 0; m < pieces.length; m++){
      var d = dwell[pieces[m].id] || 0;
      if (d > 0){ k = pieces[m].gx + ',' + pieces[m].gy; heat[k] = (heat[k] || 0) + d * 1.5; }
    }
    var list = [];
    for (k in heat) if (heat.hasOwnProperty(k)){
      var xy = k.split(',');
      list.push({ gx: +xy[0], gy: +xy[1], v: heat[k] });
    }
    list.sort(function(a,b){ return b.v - a.v; });
    return list.slice(0, n);
  }

  /* ---- supply air, as it actually behaves -------------------------------
     The first version drew air falling straight down out of the ceiling. Real
     supply air does close to the opposite: leaving a ceiling diffuser it
     attaches to the ceiling (the Coanda effect - the jet creates a low pressure
     region against the surface and room pressure holds it there), runs
     horizontally for its throw distance while dragging room air along with it,
     and only drops once it has lost enough velocity to lose that cling. The
     spent air then sweeps across the floor and rises back, closing a slow
     circulation loop. Drawing a vertical curtain instead is why it read as
     plumbing rather than air.

     It is drawn as drifting particles rather than dashed strokes for the same
     reason smoke is used in a wind tunnel: a dashed line reads as a pipe, while
     specks that spread and fade as they travel read as a fluid. Each one grows
     and dims downstream, which is the entrainment and velocity decay made
     visible. */
  function bez(p0, c0, c1, p1, t){
    var u = 1 - t, a = u*u*u, b = 3*u*u*t, c = 3*u*t*t, d = t*t*t;
    return { x: a*p0.x + b*c0.x + c*c1.x + d*p1.x,
             y: a*p0.y + b*c0.y + c*c1.y + d*p1.y };
  }
  /* the whole loop as one parameter 0..1: ceiling run, drop, floor sweep, rise */
  function airPoint(g, ceilH, dir, throwLen, spread, s){
    var top = g.y - ceilH;
    var startX = g.x - dir * throwLen;
    if (s < 0.55){
      var t = s / 0.55;
      return bez({x:startX, y:top},
                 {x:startX + dir*throwLen*0.55, y:top},          // glued to the ceiling
                 {x:g.x - dir*throwLen*0.02,   y:top + ceilH*AIR.cling}, // separates late
                 {x:g.x, y:g.y}, t);
    }
    if (s < 0.80){
      var t2 = (s - 0.55) / 0.25;
      return bez({x:g.x, y:g.y},
                 {x:g.x + dir*spread*0.35, y:g.y + 7},
                 {x:g.x + dir*spread*0.80, y:g.y + 9},
                 {x:g.x + dir*spread,      y:g.y + 3}, t2);
    }
    var t3 = (s - 0.80) / 0.20;                                   // spent air returning
    return bez({x:g.x + dir*spread,          y:g.y + 3},
               {x:g.x + dir*spread*1.15,     y:g.y - ceilH*0.35},
               {x:startX + dir*throwLen*1.1, y:top + ceilH*0.25},
               {x:startX, y:top}, t3);
  }

  function coolingSVG(ctm, vizRect, strength){
    var cells = coolingCells(AIR.streams);
    if (!cells.length) return { defs:'', body:'' };
    var t = Date.now() / 1000, defs = '', body = '';
    var maxV = cells[0].v || 1;

    for (var i = 0; i < cells.length; i++){
      var c = cells[i];
      var g = svgPtToViz(isoX(c.gx + 0.5, c.gy + 0.5), isoY(c.gx + 0.5, c.gy + 0.5, 0), ctm, vizRect);
      var ceilH = (vizRect.height * AIR.ceilingFrac) * strength;
      if (ceilH < 8) continue;
      var dir = (i % 2 === 0) ? 1 : -1;
      var throwLen = ceilH * AIR.throwMul;
      var spread = AIR.spread + AIR.spread * 0.6 * (c.v / maxV);
      var top = g.y - ceilH;
      var startX = g.x - dir * throwLen;

      /* the streamline itself, barely there - structure without a hard edge */
      var line = '';
      for (var k = 0; k <= 26; k++){
        var q = airPoint(g, ceilH, dir, throwLen, spread, (k / 26) * (AIR.showLoop ? 0.80 : 0.80));
        line += (k ? 'L' : 'M') + q.x.toFixed(1) + ',' + q.y.toFixed(1);
      }
      body += '<path d="' + line + '" fill="none" stroke="#8fe8ff" stroke-width="1" ' +
              'opacity="' + (0.13 * strength).toFixed(2) + '" stroke-linecap="round"/>';

      /* the diffuser it comes out of */
      if (AIR.showDiffuser) body += '<rect x="' + (startX - 7).toFixed(1) + '" y="' + (top - 2).toFixed(1) +
              '" width="14" height="3.4" rx="1.4" fill="#8fe8ff" opacity="' +
              (0.5 * strength).toFixed(2) + '"/>';

      var N = AIR.particles;
      for (var m = 0; m < N; m++){
        var s = ((m / N) + t * AIR.speed + i * 0.07) % 1;
        if (!AIR.showLoop && s > 0.8) continue;
        var pt = airPoint(g, ceilH, dir, throwLen, spread, s);
        /* turbulence builds downstream as the jet mixes with room air */
        var wob = Math.sin(t * 2.3 + m * 1.7 + s * 7) * (0.6 + s * 3.2) * AIR.turbulence;
        var px = pt.x, py = pt.y + wob * 0.5;
        if (s < 0.55) px += wob * 0.25; else py += wob * 0.3;

        // fade in at the diffuser, fade out as the air is spent
        var fade = Math.min(1, s / 0.08) * (s > 0.8 ? Math.max(0, (1 - s) / 0.2) : 1);
        var r = 1.1 + s * 2.6;                       // spreads as it entrains room air
        var op = strength * fade * (s < 0.55 ? 0.62 : 0.34) * AIR.opacity;
        if (op <= 0.02) continue;
        body += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1) +
                '" fill="#a7ecff" opacity="' + op.toFixed(2) + '"/>';
      }

      /* where the jet lands, air spills outward across the floor */
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + i);
      body += '<ellipse cx="' + g.x.toFixed(1) + '" cy="' + g.y.toFixed(1) +
              '" rx="' + (15 + 7 * pulse).toFixed(1) + '" ry="' + (7 + 3 * pulse).toFixed(1) +
              '" fill="none" stroke="#7ad8ff" stroke-width="1" opacity="' +
              (0.34 * strength * (1 - pulse)).toFixed(2) + '"/>';
    }
    return { defs: defs, body: body };
  }

  function onOpen(){
    active = true; trails = []; lastP = -1; suggestTarget = null;
    overlay.classList.add('show');
    /* the card is still mid-expand here (600ms CSS transition), so its rect isn't
       final yet — paint once now for instant feedback, then again once expanded */
    renderOverlay();
    setTimeout(renderOverlay, 620);
  }
  function onClose(){
    active = false;
    coolStrength = 0;
    if (window.FacDeck) FacDeck.hide();
    overlay.classList.remove('show');
  }

  function onScrollOpen(p){
    if (Math.abs(p - lastP) < 0.004) return;
    lastP = p;

    /* predictive cooling ramps in once the movement story has landed */
    coolStrength = AIR.forced >= 0 ? AIR.forced : (p <= 0.62 ? 0 : Math.min(1, (p - 0.62) / 0.14));

    /* deck first: the 3D themes have no isometric <svg> to measure, so anything
       gated behind getScreenCTM() would never reach them */
    if (window.FacDeck) FacDeck.update(p, deckCtx());

    var ctm = canvas && canvas.getScreenCTM && canvas.getScreenCTM();
    if (!ctm) return;
    var vizRect = facVizEl.getBoundingClientRect();

    /* the suggestion marker is drawn onto the overlay, not written as text */
    var visited = p > 0.5 ? bestByDwell(pieces, 'max') : null;
    if (p > 0.8 && visited){
      var pool = MOVEABLE[currentTheme] || [];
      var moveable = pieces.filter(function(pc){ return pool.indexOf(pc.type) !== -1 && pc.id !== visited.id; });
      var least = bestByDwell(moveable, 'min');
      if (least){
        var spot = findNearestEmpty(visited.gx, visited.gy);
        suggestTarget = { piece: least, gx: spot.gx, gy: spot.gy };
      } else {
        suggestTarget = null;
      }
    } else {
      suggestTarget = null;
    }
  }

  /* Called when the card changes facility: the previous scene's dwell, trails
     and overlay all belong to different pieces and must not carry across. */
  function clear(){
    reset();
    if (overlay) overlay.innerHTML = '';
    if (window.FacDeck) FacDeck.reset();
  }

  function air(o){
    if (!o) return AIR;
    for (var k in o) if (o.hasOwnProperty(k) && AIR.hasOwnProperty(k)) AIR[k] = o[k];
    return AIR;
  }

  return { tick: tick, onOpen: onOpen, onClose: onClose, onScrollOpen: onScrollOpen,
           reset: reset, clear: clear, air: air };
})();
