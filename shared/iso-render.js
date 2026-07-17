/* ===== CAMERA =====
   Must load after iso-core.js (needs VB) and after the DOM has parsed the #canvas
   <svg> element the consuming page's markup declares. */
var _PAD=Math.round(VB.w*.35);VB.x-=_PAD;VB.w+=_PAD;
var canvas=document.getElementById('canvas');
canvas.setAttribute('viewBox',VB.x+' '+VB.y+' '+VB.w+' '+VB.h);
var curV={x:VB.x,y:VB.y,w:VB.w,h:VB.h},tarV={x:VB.x,y:VB.y,w:VB.w,h:VB.h};
function viewAt(gx,gy,gz,zoom){var cx=isoX(gx,gy),cy=isoY(gx,gy,gz),w=VB.w*zoom,h=VB.h*zoom;return{x:cx-w/2,y:cy-h/2,w:w,h:h}}
var VIEWS=[{x:VB.x,y:VB.y,w:VB.w,h:VB.h},viewAt(5,.3,1.5,.58),viewAt(5,2.3,.5,.58),viewAt(.5,2.5,1.1,.58),viewAt(5.5,4,.4,.62),{x:VB.x,y:VB.y,w:VB.w,h:VB.h},{x:VB.x,y:VB.y,w:VB.w,h:VB.h},{x:VB.x+40,y:VB.y+20,w:VB.w*.85,h:VB.h*.9}];

/* ===== COORD MAPPING ===== */
function clientToSvg(cx2,cy2){var r=canvas.getBoundingClientRect();return{x:curV.x+(cx2-r.left)/r.width*curV.w,y:curV.y+(cy2-r.top)/r.height*curV.h}}
function svgToCell(sx,sy){var dx=(sx-OX)/S,dy=(sy-OY)/(S/2);return{gx:Math.floor((dx+dy)/2),gy:Math.floor((dy-dx)/2)}}

/* ===== RENDER ===== */
var showGrid=false,editMode=false,editTool='fridge',hover=null;
function floorSVG(){
  var s=poly([[isoX(0,0),isoY(0,0)],[isoX(COLS,0),isoY(COLS,0)],[isoX(COLS,ROWS),isoY(COLS,ROWS)],[isoX(0,ROWS),isoY(0,ROWS)]],floorColor);
  if(showGrid){for(var gx=0;gx<=COLS;gx++)s+=ln([isoX(gx,0),isoY(gx,0)],[isoX(gx,ROWS),isoY(gx,ROWS)],gridColor,.6);for(var gy=0;gy<=ROWS;gy++)s+=ln([isoX(0,gy),isoY(0,gy)],[isoX(COLS,gy),isoY(COLS,gy)],gridColor,.6)}return s
}
/* entities without a bespoke visited-reaction of their own (edited directly into their
   gen() in the theme's pieces file) fall into one of these two generic-but-still-type-
   differentiated families: a warm downlight for product/storage displays, a hot pulsing
   glow for running process equipment. Date.now()-based phase (not SMIL/CSS animation)
   so it stays smooth even though the whole scene's SVG is rebuilt from scratch every
   render tick. */
var VISIT_GLOW_TYPE={
  shelf:'spotlight',produce:'spotlight',deli:'spotlight',rack:'spotlight',coil:'spotlight',storage:'spotlight',drum:'spotlight',
  smelter:'active',furnace:'active',roller:'active',reeler:'active',trough:'active',tank:'active',weld:'active',
  reactor:'active',mixer:'active',vat_mixer:'active',ctower:'active',pump:'active'
};
function isVisited(id){for(var i=0;i<walkers.length;i++){if(walkers[i].visiting&&walkers[i].visiting.id===id)return true}return false}
function visitGlow(type,a,b,h){
  var fam=VISIT_GLOW_TYPE[type];
  if(!fam)return'';
  var t=Date.now()/1000,pulse=.6+.4*Math.sin(t*2.4+a+b);
  var tc=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,h*.5)];
  if(fam==='spotlight'){
    var top=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,h)];
    return '<ellipse cx="'+top[0].toFixed(1)+'" cy="'+(top[1]-14).toFixed(1)+'" rx="10" ry="5" fill="#ffe8b0" opacity="'+(0.12+0.14*pulse).toFixed(2)+'"/>'+
      '<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+tc[1].toFixed(1)+'" rx="17" ry="10" fill="#ffe8b0" opacity="'+(0.1+0.12*pulse).toFixed(2)+'"/>';
  }
  return '<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+tc[1].toFixed(1)+'" rx="16" ry="9" fill="#ff8a3a" opacity="'+(0.12+0.16*pulse).toFixed(2)+'"/>';
}
function entitiesSVG(){
  var items=[];
  for(var i=0;i<pieces.length;i++){
    var p=pieces[i],visited=isVisited(p.id);
    var svg='<g data-id="'+p.id+'">'+PIECES[p.type].gen(p.gx,p.gy,p.rot,p.text,visited)+(visited?visitGlow(p.type,p.gx,p.gy,PIECES[p.type].h||1):'')+'</g>';
    items.push({sortKey:p.gx+p.gy,svg:svg});
  }
  for(var j=0;j<walkers.length;j++){var w=walkers[j];items.push({sortKey:w.cx+w.cy,svg:walkerSVG(w)})}
  items.sort(function(a,b){return a.sortKey-b.sortKey});
  var out='';for(var k=0;k<items.length;k++)out+=items[k].svg;return out
}
function hoverSVG(){
  if(!hover||!editMode)return'';var gx=hover.gx,gy=hover.gy;if(gx<0||gy<0||gx>=COLS||gy>=ROWS)return'';
  var q=[[isoX(gx,gy),isoY(gx,gy)],[isoX(gx+1,gy),isoY(gx+1,gy)],[isoX(gx+1,gy+1),isoY(gx+1,gy+1)],[isoX(gx,gy+1),isoY(gx,gy+1)]];
  var ok=(editTool==='eraser')||((!pieceAt(gx,gy))&&(!walkerAt(gx,gy)));
  return poly(q,ok?'#c2402a':'#00000000','opacity="0.3" stroke="#c2402a" stroke-width="1.5"')
}
function render(){canvas.innerHTML='<defs>'+gradientDefs()+'</defs>'+floorSVG()+entitiesSVG()+sensorsSVG()+processBadgesSVG()+hoverSVG()}
