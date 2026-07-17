/* ===== INDUSTRIAL (STEEL FACTORY) PIECES ===== */
var PIECES_IND={
smelter:{name:'Smelter',h:1.6,gen:function(a,b){
  var f=boxFaces(a,b,1.6);
  var s=poly(f.right,'#4a3a30','stroke="#3a2a20" stroke-width="0.5"')+poly(f.left,'#3a2a20','stroke="#2a1a10" stroke-width="0.5"')+poly(f.top,'#5a4a3a','stroke="#4a3a2a" stroke-width="0.5"');
  /* bowl interior — elongated depression filled with molten metal */
  var bi=[bil(f.top,.06,.18),bil(f.top,.94,.18),bil(f.top,.88,.82),bil(f.top,.12,.82)];
  s+=poly(bi,'#1a0800','opacity="0.9"');
  s+=poly(bi,'#ff4400','opacity="0.6"');
  s+=poly(bi,'#ff8800','opacity="0.25"');
  /* brighter core running lengthwise */
  var core=[bil(f.top,.15,.35),bil(f.top,.85,.35),bil(f.top,.82,.65),bil(f.top,.18,.65)];
  s+=poly(core,'#ffaa00','opacity="0.3"');
  /* heat shimmer / glow above bowl */
  var tc=bil(f.top,.5,.5);
  s+='<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+(tc[1]-2).toFixed(1)+'" rx="12" ry="5" fill="#ff4400" opacity="0.08"/>';
  s+='<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+(tc[1]-3).toFixed(1)+'" rx="8" ry="3" fill="#ff6600" opacity="0.12"/>';
  /* thick refractory rim visible on top face */
  var rimO=[bil(f.top,.04,.12),bil(f.top,.96,.12),bil(f.top,.96,.18),bil(f.top,.04,.18)];
  var rimI=[bil(f.top,.04,.82),bil(f.top,.96,.82),bil(f.top,.96,.88),bil(f.top,.04,.88)];
  s+=poly(rimO,'#6a5a4a','stroke="#5a4a3a" stroke-width="0.4"');
  s+=poly(rimI,'#6a5a4a','stroke="#5a4a3a" stroke-width="0.4"');
  /* side view — thick bowl wall profile on left face */
  var bl=bil(f.left,.5,.15);var bm=bil(f.left,.5,.5);var bb=bil(f.left,.5,.85);
  s+='<path d="M'+bil(f.left,.08,.1)[0].toFixed(1)+','+bil(f.left,.08,.1)[1].toFixed(1)+' Q'+bl[0].toFixed(1)+','+(bl[1]+4).toFixed(1)+' '+bil(f.left,.08,.85)[0].toFixed(1)+','+bil(f.left,.08,.85)[1].toFixed(1)+'" fill="none" stroke="#ff6600" stroke-width="1.5" opacity="0.25"/>';
  /* support legs */
  for(var li=0;li<2;li++){var lp=bil(f.left,.2+li*.6,.1);s+='<rect x="'+(lp[0]-2).toFixed(1)+'" y="'+lp[1].toFixed(1)+'" width="4" height="5" rx="1" fill="#3a3a3a" opacity="0.7"/>';}
  return s}},
trough:{name:'Trough',h:.35,gen:function(a,b){
  var f=boxFaces(a,b,.35);
  var s=poly(f.right,'#4a3a2a','stroke="#3a2a1a" stroke-width="0.5"')+poly(f.left,'#3a2a1a','stroke="#2a1a0a" stroke-width="0.5"')+poly(f.top,'#5a4a3a','stroke="#4a3a2a" stroke-width="0.5"');
  var inner=[bil(f.top,.08,.15),bil(f.top,.92,.15),bil(f.top,.92,.85),bil(f.top,.08,.85)];
  s+=poly(inner,'#ff4400','opacity="0.5"')+poly(inner,'#ff8800','opacity="0.15"');
  var tc=bil(f.top,.5,.5);s+='<circle cx="'+tc[0].toFixed(1)+'" cy="'+(tc[1]-2).toFixed(1)+'" r="5" fill="#ff4400" opacity="0.08"/>';
  return s}},
roller:{name:'Roll Former',h:1.6,gen:function(a,b){
  var f=boxFaces(a,b,1.6);
  var s=poly(f.left,'#4a4a4a','stroke="#333" stroke-width="0.5"')+poly(f.right,'#555','stroke="#3a3a3a" stroke-width="0.5"')+poly(f.top,'#606060','stroke="#505050" stroke-width="0.5"');
  for(var i=0;i<3;i++){var rc=bil(f.top,.18+i*.32,.5);s+='<ellipse cx="'+rc[0].toFixed(1)+'" cy="'+rc[1].toFixed(1)+'" rx="3.5" ry="7.5" fill="#999" stroke="#777" stroke-width="1" opacity="0.85"/>';s+='<ellipse cx="'+rc[0].toFixed(1)+'" cy="'+(rc[1]-.8).toFixed(1)+'" rx="3" ry="6.5" fill="#bbb" stroke="none" opacity="0.3"/>';}
  var ss=bil(f.top,.03,.5),se=bil(f.top,.97,.5);s+=ln(ss,se,'#ccc',2.5,'opacity="0.6"');
  var ge=bil(f.top,.9,.15);s+='<rect x="'+(ge[0]-3).toFixed(1)+'" y="'+(ge[1]-3).toFixed(1)+'" width="6" height="6" rx="1.5" fill="#444" stroke="#333" stroke-width=".6" opacity="0.7"/>';
  return s}},
reeler:{name:'Reeler',h:1.8,gen:function(a,b){
  var f=boxFaces(a,b,1.8);
  var s=poly(f.left,'#4a4a50','stroke="#333" stroke-width="0.5"')+poly(f.right,'#555560','stroke="#3a3a40" stroke-width="0.5"')+poly(f.top,'#606068','stroke="#505058" stroke-width="0.5"');
  var mc=bil(f.top,.4,.5);
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+mc[1].toFixed(1)+'" r="10" fill="#777" stroke="#555" stroke-width="1.5" opacity="0.85"/>';
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+mc[1].toFixed(1)+'" r="7" fill="#999" stroke="#888" stroke-width="1" opacity="0.5"/>';
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+mc[1].toFixed(1)+'" r="12" fill="none" stroke="#aaa" stroke-width="1.5" opacity="0.35" stroke-dasharray="3 2"/>';
  var ge=bil(f.top,.85,.5);s+='<rect x="'+(ge[0]-4).toFixed(1)+'" y="'+(ge[1]-4).toFixed(1)+'" width="8" height="8" rx="2" fill="#555" stroke="#444" stroke-width=".8" opacity="0.7"/>';
  var si=bil(f.top,.05,.5);s+=ln(si,[mc[0]-12,mc[1]],'#bbb',2,'opacity="0.4"');
  return s}},
furnace:{name:'Furnace',h:3.2,rots:4,gen:function(a,b,rot){
  var door=function(f){var g=[bil(f,.12,.06),bil(f,.88,.06),bil(f,.88,.94),bil(f,.12,.94)];
    return poly(g,'#1a0a00')+
      ln(bil(f,.25,.15),bil(f,.25,.85),'#ff4400',1.5,'opacity="0.35"')+
      ln(bil(f,.5,.1),bil(f,.5,.9),'#ff6600',2,'opacity="0.5"')+
      ln(bil(f,.75,.15),bil(f,.75,.85),'#ff4400',1.5,'opacity="0.35"')+
      poly(g,'#ff4400','opacity="0.1"')+
      ln(f[2],f[3],'#ff6600',2.2,'opacity="0.5"')};
  var closed=function(f){
    return ln(bil(f,.5,.06),bil(f,.5,.94),'#666',1,'opacity="0.4"')+
      ln(bil(f,.3,.3),bil(f,.7,.3),'#777',2,'opacity="0.3"')+
      ln(bil(f,.3,.6),bil(f,.7,.6),'#777',2,'opacity="0.3"')};
  return box4(a,b,3.2,{front:'#505050',side:'#404040',top:'#606060',stroke:'#333'},rot,door,closed)}},
rack:{name:'Steel Rack',h:2.5,rots:4,gen:function(a,b,rot){
  var open=function(fc){var g=[bil(fc,.06,.04),bil(fc,.94,.04),bil(fc,.94,.98),bil(fc,.06,.98)];
    return poly(g,'#3a3228')+stockFace(g,3,4,['#8a7a60','#7a6a50','#6a5a40','#8a7a60'],.9)};
  return box4(a,b,2.5,{front:'#706860',side:'#605850',top:'#807870',stroke:'#4a4240'},rot,open,null)}},
coil:{name:'Steel Coil',h:.8,gen:function(a,b){
  var f=boxFaces(a,b,.8);
  var s=poly(f.right,'#6a6a6a','stroke="#555" stroke-width="0.5"')+
    poly(f.left,'#505050','stroke="#444" stroke-width="0.5"')+
    poly(f.top,'#7a7a7a','stroke="#666" stroke-width="0.5"');
  var c=bil(f.top,.5,.5);
  s+='<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="8" fill="#888" stroke="#666" stroke-width="1" opacity="0.9"/>';
  s+='<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="4" fill="#999" stroke="#777" stroke-width=".5" opacity="0.8"/>';
  return s}},
panel:{name:'Ctrl Panel',h:1.3,gen:function(a,b,rot,text,visited){
  var f=boxFaces(a,b,1.3);
  var s=poly(f.left,'#2a3a2a','stroke="#1a2a1a" stroke-width="0.5"')+
    poly(f.right,'#3a4a3a','stroke="#2a3a2a" stroke-width="0.5"')+
    poly(f.top,'#4a5a4a','stroke="#3a4a3a" stroke-width="0.5"');
  var sc=bil(f.top,.5,.5);
  if(visited){var t=Date.now()/1000,pulse=.6+.4*Math.sin(t*3);s+='<rect x="'+(sc[0]-13).toFixed(1)+'" y="'+(sc[1]-6).toFixed(1)+'" width="26" height="12" rx="2" fill="#7cfc9a" opacity="'+(0.14+0.2*pulse).toFixed(2)+'"/>'}
  s+='<circle cx="'+(sc[0]-8).toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="#22c55e" opacity="0.9"/>';
  s+='<circle cx="'+sc[0].toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="#22c55e" opacity="0.9"/>';
  s+='<circle cx="'+(sc[0]+8).toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="'+(visited?'#22c55e':'#ef4444')+'" opacity="'+(visited?0.9:0.7)+'"/>';
  return s}},
weld:{name:'Weld Bay',h:1.5,rots:4,gen:function(a,b,rot){
  var gl=function(fc){var g=[bil(fc,.1,.2),bil(fc,.9,.2),bil(fc,.9,.85),bil(fc,.1,.85)];
    var c=bil(g,.5,.5);
    return poly(g,'#0a1a3a','opacity="0.7"')+
      '<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="6" fill="#4488ff" opacity="0.6"/>'+
      '<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="12" fill="#4488ff" opacity="0.15"/>'+
      '<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="20" fill="#4488ff" opacity="0.05"/>'};
  return box4(a,b,1.5,{front:'#5a5050',side:'#4a4040',top:'#6a6060',stroke:'#333'},rot,gl,null)}},
tank:{name:'Coolant Tank',h:1.1,gen:function(a,b){
  var f=boxFaces(a,b,1.1);
  var s=poly(f.right,'#506050','stroke="#405040" stroke-width="0.5"')+
    poly(f.left,'#405040','stroke="#304030" stroke-width="0.5"')+
    poly(f.top,'#607060','stroke="#506050" stroke-width="0.5"');
  var c=bil(f.top,.5,.5);
  s+='<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="5" fill="#2a4a2a" stroke="#1a3a1a" stroke-width="1" opacity="0.8"/>';
  s+='<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="2" fill="#4488ff" opacity="0.7"/>';
  return s}},
cwall:{name:'Concrete',h:3,gen:function(a,b,rot){
  var f=boxFaces(a,b,3),face=rot%2?f.right:f.left,other=rot%2?f.left:f.right;
  return poly(other,'#6a6a6a','stroke="#5a5a5a" stroke-width="0.4"')+
    poly(face,'#7a7a7a','stroke="#6a6a6a" stroke-width="0.4"')+
    poly(f.top,'#8a8a8a','stroke="#7a7a7a" stroke-width="0.4"')}},
fence:{name:'Safety Fence',h:2.2,rots:4,gen:function(a,b,rot,text,visited){
  var f=boxFaces(a,b,2.2),face={0:f.yp,1:f.xp,2:f.xm,3:f.ym}[((rot%4)+4)%4];
  var s=poly(face,'#e8c020','opacity="'+(visited?0.18:0.4)+'" stroke="#c0a018" stroke-width="0.8"');
  /* open: the middle two posts swing clear, leaving a passage; rails fade since
     they're no longer taut across the gap */
  var bars=visited?[0,3]:[0,1,2,3];
  for(var bi=0;bi<bars.length;bi++){var i=bars[bi];var p1=bil(face,.15+i*.22,.05),p2=bil(face,.15+i*.22,.95);s+=ln(p1,p2,'#333',2,'opacity="0.7"')}
  s+=ln(face[0],face[3],'#333',2.5,'opacity="'+(visited?0.3:0.8)+'"');
  s+=ln(face[1],face[2],'#333',2.5,'opacity="'+(visited?0.3:0.8)+'"');
  if(visited){var c=bil(face,.5,.5),t=Date.now()/1000,pulse=.6+.4*Math.sin(t*2.5);s+='<ellipse cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" rx="14" ry="16" fill="#7cfc9a" opacity="'+(0.1+0.14*pulse).toFixed(2)+'"/>'}
  return s}},
worker:{name:'Worker',h:0,isWalker:true,gen:function(a,b,rot){
  var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5)];
  var wb=[['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e8c020','#b8a018','#1a1a1a','#f0d0a0'],['#d04020','#a83018','#1a1a1a','#f0d0a0']];
  var col=wb[(a*3+b+(rot||0))%wb.length],x=c[0],y=c[1]-2;
  return'<g><ellipse cx="'+x.toFixed(1)+'" cy="'+(y+15).toFixed(1)+'" rx="7.5" ry="2.8" fill="#000" opacity="0.16"/>'+
    '<ellipse cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="5.5" ry="8.5" fill="'+col[0]+'"/>'+
    '<circle cx="'+x.toFixed(1)+'" cy="'+(y-12).toFixed(1)+'" r="4.5" fill="'+col[3]+'"/>'+
    '<ellipse cx="'+x.toFixed(1)+'" cy="'+(y-15).toFixed(1)+'" rx="5" ry="2.5" fill="'+col[1]+'"/>'+
    '<line x1="'+(x-5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x-9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+
    '<line x1="'+(x+5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x+9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+
    '<line x1="'+(x-2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x-3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+
    '<line x1="'+(x+2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x+3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/></g>'}},
sign:{name:'Sign',h:0,gen:function(a,b,rot,text){
  var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,2.6)],t=(text||'BAY').toUpperCase(),w=Math.max(46,t.length*7.4+18);
  return'<g transform="translate('+c[0].toFixed(1)+','+c[1].toFixed(1)+')"><line x1="0" y1="-2" x2="0" y2="10" stroke="#909090" stroke-width="1" opacity="0.5"/>'+
    '<rect x="'+(-w/2).toFixed(1)+'" y="-13" width="'+w.toFixed(1)+'" height="22" rx="4" fill="#1a2a3a" opacity="0.94"/>'+
    '<text x="0" y="2.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#f0c020" letter-spacing="0.5">'+t+'</text></g>'}}
};
var ORDER_IND=['smelter','trough','roller','reeler','coil','furnace','rack','panel','weld','tank','fence','cwall','worker','sign'];
var HOTKEY_IND={'1':'smelter','2':'trough','3':'roller','4':'reeler','5':'coil','6':'furnace','7':'rack','8':'panel','9':'worker','0':'sign'};

function loadIndustrial(){
  var d=[
    {type:'sign',gx:5,gy:7,rot:0,text:'BAY A'},
    /* === SMELTING (back row) === */
    {type:'smelter',gx:1,gy:0,rot:0},{type:'smelter',gx:2,gy:0,rot:0},{type:'smelter',gx:3,gy:0,rot:0},
    /* === HOT METAL TROUGH === */
    {type:'trough',gx:2,gy:1,rot:0},{type:'trough',gx:3,gy:1,rot:0},{type:'trough',gx:4,gy:1,rot:0},
    /* === ROLL FORMING === */
    {type:'roller',gx:5,gy:2,rot:0},{type:'roller',gx:6,gy:2,rot:0},{type:'roller',gx:7,gy:2,rot:0},
    /* === REELER (sheet → coil) === */
    {type:'reeler',gx:8,gy:3,rot:0},
    /* === FINISHED COILS (output) === */
    {type:'coil',gx:10,gy:2,rot:0},{type:'coil',gx:11,gy:2,rot:0},
    {type:'coil',gx:10,gy:3,rot:0},{type:'coil',gx:11,gy:3,rot:0},
    {type:'coil',gx:10,gy:4,rot:0},{type:'coil',gx:11,gy:4,rot:0},
    /* === CONTROL PANELS === */
    {type:'panel',gx:0,gy:2,rot:0},{type:'panel',gx:0,gy:3,rot:0},
    /* === COOLANT TANKS === */
    {type:'tank',gx:5,gy:4,rot:0},{type:'tank',gx:6,gy:4,rot:0},
    /* === SAFETY FENCES (around hot zone) === */
    {type:'fence',gx:0,gy:1,rot:0},{type:'fence',gx:1,gy:1,rot:0},
    {type:'fence',gx:9,gy:2,rot:0},{type:'fence',gx:9,gy:3,rot:0},{type:'fence',gx:9,gy:4,rot:0},
    /* === CONCRETE WALLS === */
    {type:'cwall',gx:0,gy:0,rot:0},{type:'cwall',gx:0,gy:7,rot:0},
    /* === STORAGE RACKS === */
    {type:'rack',gx:11,gy:6,rot:0},{type:'rack',gx:11,gy:7,rot:0},
    /* === EXTRA COILS IN STORAGE === */
    {type:'coil',gx:11,gy:8,rot:0},{type:'coil',gx:5,gy:8,rot:0},{type:'coil',gx:6,gy:8,rot:0}
  ];
  pieces=d.map(function(p){return Object.assign({},p,{id:uid++})});
}
