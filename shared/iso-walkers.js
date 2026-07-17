/* ===== WALKER SYSTEM =====
   Walkers wander the floor via real pathfinding rather than pacing one fixed straight
   line: each one picks a random "browsable" entity, routes to a free cell next to it
   around whatever's in the way, and pauses there for a while before picking a new one.
   w.visiting holds the entity it's currently stopped at (null while still walking) —
   that's the ground truth the movement-intelligence dwell tracker reads directly, so
   "highest visited" reflects real stops, not just incidental proximity while passing. */
var walkers=[];
function walkerAt(gx,gy){return walkers.filter(function(w){return Math.round(w.cx)===gx&&Math.round(w.cy)===gy})[0]||null}
var NON_BROWSABLE={wall:1,fence:1,cwall:1,sign:1,pipe_x:1,pipe_y:1,pipe_cr:1,pipe_cl:1};
function browsablePieces(){return pieces.filter(function(p){return !NON_BROWSABLE[p.type]})}
function findGridPath(sx,sy,tx,ty){
  var sxr=Math.round(sx),syr=Math.round(sy);
  if(sxr===tx&&syr===ty)return[{gx:tx,gy:ty}];
  var visited={},queue=[{gx:sxr,gy:syr,path:[]}],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  visited[sxr+','+syr]=true;
  while(queue.length){
    var cur=queue.shift();
    for(var i=0;i<dirs.length;i++){
      var nx=cur.gx+dirs[i][0],ny=cur.gy+dirs[i][1],k=nx+','+ny;
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS||visited[k])continue;
      if(pieceAt(nx,ny)&&!(nx===tx&&ny===ty))continue;
      visited[k]=true;
      var np=cur.path.concat([{gx:nx,gy:ny}]);
      if(nx===tx&&ny===ty)return np;
      queue.push({gx:nx,gy:ny,path:np});
    }
  }
  return null;
}
function pickNewGoal(w){
  var pool=browsablePieces();
  for(var tries=0;tries<8&&pool.length;tries++){
    var piece=pool[Math.floor(Math.random()*pool.length)];
    var spot=findNearestEmpty(piece.gx,piece.gy);
    var path=findGridPath(w.cx,w.cy,spot.gx,spot.gy);
    if(path&&path.length){w.path=path;w.pathIdx=0;w.state='walking';w.goalPiece=piece;w.visiting=null;return}
  }
  /* no reachable entity found this attempt — amble to a random nearby open cell instead */
  var rx=Math.max(0,Math.min(COLS-1,Math.round(w.cx)+Math.floor(Math.random()*7-3)));
  var ry=Math.max(0,Math.min(ROWS-1,Math.round(w.cy)+Math.floor(Math.random()*7-3)));
  var safe=findNearestEmpty(rx,ry),path2=findGridPath(w.cx,w.cy,safe.gx,safe.gy);
  w.path=path2||[{gx:Math.round(w.cx),gy:Math.round(w.cy)}];w.pathIdx=0;w.state='walking';w.goalPiece=null;w.visiting=null;
}
function spawnWalker(gx,gy,rot){
  var w={id:uid++,cx:gx,cy:gy,path:[],pathIdx:0,state:'walking',goalPiece:null,visiting:null,browseTimer:0,speed:.04+Math.random()*.03,phase:Math.random()*Math.PI*2,rot:rot||0};
  pickNewGoal(w);
  return w;
}
function findNearestEmpty(gx,gy){var visited={},queue=[{gx:gx,gy:gy}];visited[gx+','+gy]=true;while(queue.length){var cur=queue.shift();if((cur.gx!==gx||cur.gy!==gy)&&!pieceAt(cur.gx,cur.gy)&&!walkerAt(cur.gx,cur.gy))return cur;var nb=[[1,0],[-1,0],[0,1],[0,-1]];for(var i=0;i<nb.length;i++){var nx=cur.gx+nb[i][0],ny=cur.gy+nb[i][1],k=nx+','+ny;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&!visited[k]){visited[k]=true;queue.push({gx:nx,gy:ny})}}}return{gx:gx,gy:gy}}
function recalcAllPaths(){walkers.forEach(function(w){pickNewGoal(w)})}
function updateWalkers(){walkers.forEach(function(w){
  if(w.state==='browsing'){
    w.browseTimer--;w.phase+=.02;
    if(w.browseTimer<=0)pickNewGoal(w);
    return;
  }
  var target=w.path[w.pathIdx];
  if(!target){
    if(w.goalPiece){w.state='browsing';w.visiting=w.goalPiece;w.browseTimer=90+Math.random()*180}
    else pickNewGoal(w);
    return;
  }
  var dx=target.gx-w.cx,dy=target.gy-w.cy,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist<w.speed){w.cx=target.gx;w.cy=target.gy;w.pathIdx++}
  else{w.cx+=dx/dist*w.speed;w.cy+=dy/dist*w.speed}
  w.phase+=w.speed*10
})}
function walkerSVG(w){
  var px=isoX(w.cx,w.cy),py=isoY(w.cx,w.cy),walking=w.state==='walking';
  var ls=walking?Math.sin(w.phase)*3.5:0,as=walking?Math.sin(w.phase)*2.8:0,bb=walking?Math.sin(w.phase*2)*1.8:Math.sin(w.phase*.3)*.4;
  var wb=[['#3a5898','#2a4880','#401808','#f0c090'],['#983838','#782020','#602010','#e8b078'],['#2f7d4f','#1f5d37','#241008','#f0c090'],['#c99a2e','#9a7420','#3a2410','#e8b078']];
  var ib=[['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e8c020','#b8a018','#1a1a1a','#f0d0a0'],['#d04020','#a83018','#1a1a1a','#f0d0a0']];
  var bodies=currentTheme==='industrial'?ib:wb;
  var c=bodies[w.rot%bodies.length],x=px,y=py-2+bb;
  var s='<ellipse cx="'+x.toFixed(1)+'" cy="'+(py+13).toFixed(1)+'" rx="7.5" ry="2.8" fill="#000" opacity="0.16"/>';
  s+='<line x1="'+(x-2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x-3-ls).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+c[1]+'" stroke-width="2.5"/>';
  s+='<line x1="'+(x+2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x+3+ls).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+c[1]+'" stroke-width="2.5"/>';
  s+='<ellipse cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="5.5" ry="8.5" fill="'+c[0]+'"/>';
  s+='<line x1="'+(x-5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x-9+as).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+c[1]+'" stroke-width="2.5"/>';
  s+='<line x1="'+(x+5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x+9-as).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+c[1]+'" stroke-width="2.5"/>';
  s+='<circle cx="'+x.toFixed(1)+'" cy="'+(y-12).toFixed(1)+'" r="4.5" fill="'+c[3]+'"/>';
  s+='<ellipse cx="'+x.toFixed(1)+'" cy="'+(y-15).toFixed(1)+'" rx="3.5" ry="2" fill="'+c[2]+'"/>';
  return s
}
walkers.push(spawnWalker(2,6,0),spawnWalker(2,3,1),spawnWalker(1,1,2),spawnWalker(9,2,3));
