/* ==================================================
   LIVE MOVEMENT INTELLIGENCE: tracks the scene's own roaming walkers (shoppers /
   workers / technicians depending on theme) to build a genuinely live "which spot
   gets the most attention, which gets the least" narrative. Nothing here is scripted
   content — the ring/trail follow whichever piece a walker is actually near right
   now, and the two flags lock onto whichever pieces really hold the highest / lowest
   accumulated dwell time, read straight off the simulation already animating the scene.

   Depends on shared/iso-*.js already being loaded (uses canvas, isoX/isoY, pieces,
   walkers, PIECES, currentTheme, findNearestEmpty as globals) and on merge-preview1's
   own markup (#facMoveOverlay, #moveIntelHead, #moveFlagVisited/#moveFlagSuggest, etc).
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
  var head = document.getElementById('moveIntelHead');
  var sub = document.getElementById('moveIntelSub');
  var flagVisited = document.getElementById('moveFlagVisited');
  var flagSuggest = document.getElementById('moveFlagSuggest');
  var mvVisitedText = document.getElementById('mvVisitedText');
  var mvSuggestText = document.getElementById('mvSuggestText');
  var facVizEl = document.getElementById('facVizReal');

  var dwell = {}, trails = [], TRAIL_MAX = 50;
  var active = false, lastP = -1, suggestTarget = null;

  function reset(){ dwell = {}; trails = []; suggestTarget = null; lastP = -1; }

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
    }
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
    }
  }

  function renderOverlay(){
    var ctm = canvas.getScreenCTM();
    if (!ctm) return;
    var w = facVizEl.getBoundingClientRect();
    overlay.setAttribute('viewBox', '0 0 ' + w.width + ' ' + w.height);
    var defs = '', body = '';
    for (var k = 0; k < walkers.length; k++){
      var tr = trails[k];
      if (tr && tr.length > 1){
        var pts = [], screenPts = [];
        for (var i = 0; i < tr.length; i++){
          var t = tr[i], sp = svgPtToViz(isoX(t.gx, t.gy), isoY(t.gx, t.gy), ctm, w);
          screenPts.push(sp);
          pts.push(sp.x.toFixed(1) + ',' + sp.y.toFixed(1));
        }
        /* fade the trail from transparent at the tail (oldest point) to solid at the
           head (current position) via a gradient spanning tail->head in screen space */
        var tail = screenPts[0], headPt = screenPts[screenPts.length - 1];
        var color = WALKER_COLORS[k % WALKER_COLORS.length];
        var gradId = 'facTrailGrad' + k;
        defs += '<linearGradient id="' + gradId + '" gradientUnits="userSpaceOnUse" x1="' + tail.x.toFixed(1) + '" y1="' + tail.y.toFixed(1) + '" x2="' + headPt.x.toFixed(1) + '" y2="' + headPt.y.toFixed(1) + '">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.8"/>' +
          '</linearGradient>';
        body += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="url(#' + gradId + ')" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    }
    if (suggestTarget){
      var sp2 = pieceScreenPt(suggestTarget.piece, ctm, w);
      var tp = svgPtToViz(isoX(suggestTarget.gx + 0.5, suggestTarget.gy + 0.5), isoY(suggestTarget.gx + 0.5, suggestTarget.gy + 0.5, 0.3), ctm, w);
      body += '<line x1="' + sp2.x.toFixed(1) + '" y1="' + sp2.y.toFixed(1) + '" x2="' + tp.x.toFixed(1) + '" y2="' + tp.y.toFixed(1) + '" stroke="#7ad8ff" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.75"/>';
      body += '<circle cx="' + tp.x.toFixed(1) + '" cy="' + tp.y.toFixed(1) + '" r="8" fill="none" stroke="#7ad8ff" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.85"/>';
    }
    overlay.innerHTML = '<defs>' + defs + '</defs>' + body;
  }

  function onOpen(){
    active = true; trails = []; lastP = -1; suggestTarget = null;
    overlay.classList.add('show');
    sub.textContent = SUB_COPY[currentTheme] || SUB_COPY.retail;
    head.classList.remove('show');
    flagVisited.classList.remove('show');
    flagSuggest.classList.remove('show');
    /* the card is still mid-expand here (600ms CSS transition), so its rect isn't
       final yet — paint once now for instant feedback, then again once expanded */
    renderOverlay();
    setTimeout(renderOverlay, 620);
  }
  function onClose(){
    active = false;
    overlay.classList.remove('show');
    head.classList.remove('show');
    flagVisited.classList.remove('show');
    flagSuggest.classList.remove('show');
  }

  function onScrollOpen(p){
    if (Math.abs(p - lastP) < 0.004) return;
    lastP = p;
    head.classList.toggle('show', p > 0.02);
    var ctm = canvas.getScreenCTM();
    var vizRect = facVizEl.getBoundingClientRect();
    if (!ctm) return;

    var visited = p > 0.5 ? bestByDwell(pieces, 'max') : null;
    if (visited){
      var pt = pieceScreenPt(visited, ctm, vizRect);
      flagVisited.style.left = pt.x + 'px';
      flagVisited.style.top = pt.y + 'px';
      var name = ((PIECES[visited.type] && PIECES[visited.type].name) || visited.type).toLowerCase();
      mvVisitedText.textContent = (VISIT_WORD[currentTheme] || 'Visitors') + ' linger here more than anywhere else — the ' + name + ' is the busiest spot in the scene.';
      flagVisited.classList.add('show');
    } else {
      flagVisited.classList.remove('show');
    }

    if (p > 0.8 && visited){
      var pool = MOVEABLE[currentTheme] || [];
      var moveable = pieces.filter(function(pc){ return pool.indexOf(pc.type) !== -1 && pc.id !== visited.id; });
      var least = bestByDwell(moveable, 'min');
      if (least){
        var spot = findNearestEmpty(visited.gx, visited.gy);
        suggestTarget = { piece: least, gx: spot.gx, gy: spot.gy };
        var pt2 = pieceScreenPt(least, ctm, vizRect);
        flagSuggest.style.left = pt2.x + 'px';
        flagSuggest.style.top = pt2.y + 'px';
        var name2 = ((PIECES[least.type] && PIECES[least.type].name) || least.type).toLowerCase();
        mvSuggestText.textContent = (SUGGEST_VERB[currentTheme] || 'Moving') + ' the ' + name2 + ' nearer the busiest spot could put it in front of far more traffic.';
        flagSuggest.classList.add('show');
      } else {
        flagSuggest.classList.remove('show');
        suggestTarget = null;
      }
    } else {
      flagSuggest.classList.remove('show');
      suggestTarget = null;
    }
  }

  return { tick: tick, onOpen: onOpen, onClose: onClose, onScrollOpen: onScrollOpen, reset: reset };
})();
