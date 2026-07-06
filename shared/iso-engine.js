/* ===== ISO ENGINE ===== */
var S=34,COLS=12,ROWS=9;
var OX=ROWS*S+46,OY=66;
var floorColor='',gridColor='';
function isoX(gx,gy){return OX+gx*S-gy*S}
function isoY(gx,gy,gz){if(gz===undefined)gz=0;return OY+gx*S/2+gy*S/2-gz*S}
var VB=(function(){var xs=[isoX(0,0),isoX(COLS,0),isoX(COLS,ROWS),isoX(0,ROWS)],mn=Math.min.apply(null,xs)-30,mx=Math.max.apply(null,xs)+30;return{x:mn,y:isoY(0,0,3.4)-24,w:mx-mn,h:isoY(COLS,ROWS,0)-isoY(0,0,3.4)+54}})();
function P(x,y){return(+x).toFixed(1)+','+(+y).toFixed(1)}
function poly(pts,fill,ex){if(!ex)ex='';return'<polygon points="'+pts.map(function(p){return P(p[0],p[1])}).join(' ')+'" fill="'+fill+'" '+ex+'/>'}
function ln(a,b,s,w,ex){if(w===undefined)w=1;if(!ex)ex='';return'<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'" stroke="'+s+'" stroke-width="'+w+'" '+ex+'/>'}
function bil(q,t,u){var A=q[0],B=q[1],D=q[3];return[A[0]+(B[0]-A[0])*t+(D[0]-A[0])*u,A[1]+(B[1]-A[1])*t+(D[1]-A[1])*u]}
function boxFaces(a,b,h){var B0=[isoX(a,b),isoY(a,b,0)],B1=[isoX(a+1,b),isoY(a+1,b,0)],B2=[isoX(a+1,b+1),isoY(a+1,b+1,0)],B3=[isoX(a,b+1),isoY(a,b+1,0)],T0=[isoX(a,b),isoY(a,b,h)],T1=[isoX(a+1,b),isoY(a+1,b,h)],T2=[isoX(a+1,b+1),isoY(a+1,b+1,h)],T3=[isoX(a,b+1),isoY(a,b+1,h)];return{top:[T0,T1,T2,T3],xp:[B1,B2,T2,T1],yp:[B3,B2,T2,T3],xm:[B0,B3,T3,T0],ym:[B0,B1,T1,T0],right:[B1,B2,T2,T1],left:[B0,B3,T3,T0]}}
function box4(a,b,h,pal,rot,doorFn,closedFn){var f=boxFaces(a,b,h),side={0:'yp',1:'xp',2:'xm',3:'ym'}[((rot%4)+4)%4],isF=function(k){return k==='xp'||k==='yp'};var draw=function(k){var face=f[k];if(k===side)return doorFn(face);var o=poly(face,isF(k)?pal.front:pal.side,'stroke="'+pal.stroke+'" stroke-width="0.5"');if(isF(k)&&closedFn)o+=closedFn(face);return o};return draw('xm')+draw('ym')+poly(f.top,pal.top,'stroke="'+pal.stroke+'" stroke-width="0.5"')+draw('xp')+draw('yp')}
var PRD=[["#e8544e","#f0a030","#4a90d9","#54b06a"],["#5a8fd8","#e8c14a","#d94f6c","#4ab0a0"],["#e07a3a","#6ab04a","#4a70d0","#e8b840"],["#d84f8a","#4ab0c0","#e8a030","#7050c8"]];
function stockFace(q,rows,cols,pal,op){if(op===undefined)op=.92;var s='';for(var r=0;r<rows;r++){var u0=.08+r*(.84/rows),u1=u0+(.84/rows)*.72;for(var c=0;c<cols;c++){var t0=.06+c*(.88/cols),t1=t0+(.88/cols)*.8;s+=poly([bil(q,t0,u0),bil(q,t1,u0),bil(q,t1,u1),bil(q,t0,u1)],pal[(c+r)%pal.length],'opacity="'+op+'"')}s+=ln(bil(q,.04,u1+.02),bil(q,.96,u1+.02),'#00000030',1.4)}return s}

/* ===== PIECES ===== */
var PIECES={
fridge:{name:'Fridge',h:3,rots:4,gen:function(a,b,rot){var door=function(f){var g=[bil(f,.12,.06),bil(f,.88,.06),bil(f,.88,.94),bil(f,.12,.94)];return poly(g,'#16303f')+stockFace(g,4,4,PRD[(a+b)%PRD.length])+poly(g,'#cfeaf5','opacity="0.15" stroke="#8fb8cc" stroke-width="1"')+ln(bil(f,.2,.1),bil(f,.55,.9),'#ffffff',2,'opacity="0.18"')+ln(f[2],f[3],'#00d4ff',2.2,'opacity="0.65"')};var closed=function(f){return ln(bil(f,.5,.06),bil(f,.5,.94),'#8f9aa4',1,'opacity="0.55"')+ln(bil(f,.68,.2),bil(f,.68,.8),'#5f6a74',2.4,'opacity="0.85" stroke-linecap="round"')};return box4(a,b,3,{front:'#a4aeb8',side:'#9aa4ae',top:'#b8c2cc',stroke:'#8d97a1'},rot,door,closed)}},
shelf:{name:'Shelf',h:2.2,rots:4,gen:function(a,b,rot){var open=function(fc){var g=[bil(fc,.06,.04),bil(fc,.94,.04),bil(fc,.94,.98),bil(fc,.06,.98)];return poly(g,'#7a4e20')+stockFace(g,3,4,PRD[(a+b+1)%PRD.length],.95)};return box4(a,b,2.2,{front:'#c8944a',side:'#b07a36',top:'#d4a050',stroke:'#b88438'},rot,open,null)}},
produce:{name:'Produce',h:.55,gen:function(a,b){var f=boxFaces(a,b,.55),cols=[['#74b030','#88c840','#609020'],['#d4b430','#e8c840','#c0a020'],['#d44830','#e86040','#c03020']],c=cols[(a+b)%3];var s=poly(f.right,c[0],'stroke="'+c[2]+'" stroke-width="0.5"')+poly(f.left,c[2],'stroke="'+c[2]+'" stroke-width="0.5"')+poly(f.top,c[1],'stroke="'+c[0]+'" stroke-width="0.5"');var bl=['#c82020','#e05010','#f0a018','#48c048','#e0b0c0'];for(var i=0;i<5;i++){var p=bil(f.top,.22+(i%3)*.28,.28+Math.floor(i/3)*.34);s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4.4" fill="'+bl[(i+a)%bl.length]+'" opacity="0.95"/>'}return s}},
counter:{name:'Checkout',h:1.15,gen:function(a,b){var f=boxFaces(a,b,1.15);var s=poly(f.left,'#3a9990','stroke="#2a8980" stroke-width="0.5"')+poly(f.right,'#4aada3','stroke="#3a9d93" stroke-width="0.5"')+poly(f.top,'#5bbfb5','stroke="#4bafa5" stroke-width="0.5"');var belt=[bil(f.top,.16,.18),bil(f.top,.86,.18),bil(f.top,.86,.6),bil(f.top,.16,.6)];s+=poly(belt,'#2f6f68','opacity="0.9"');var bs=bil(f.top,.16,.8);s+=poly([[bs[0]-1,bs[1]-3],[bs[0]+10,bs[1]+2.5],[bs[0]+10,bs[1]-10.5],[bs[0]-1,bs[1]-16]],'#1a2a3a');s+=poly([[bs[0]+.6,bs[1]-4.6],[bs[0]+8.6,bs[1]-.7],[bs[0]+8.6,bs[1]-9.3],[bs[0]+.6,bs[1]-13.2]],'#2f62c8');return s}},
deli:{name:'Deli',h:1.4,rots:4,gen:function(a,b,rot){var gl=function(fc){var g=[bil(fc,.1,.28),bil(fc,.9,.28),bil(fc,.9,.86),bil(fc,.1,.86)];return poly(g,'#cfe0e8','opacity="0.5"')+stockFace(g,2,3,['#e05a5a','#e8c14a','#48b06a','#d98f5a'],.9)};return box4(a,b,1.4,{front:'#d08a3a',side:'#a86828',top:'#e0a24a',stroke:'#b8792e'},rot,gl,null)}},
bin:{name:'Freezer',h:.8,gen:function(a,b){var f=boxFaces(a,b,.8);var s=poly(f.right,'#b8ccdc','stroke="#a8bccc" stroke-width="0.5"')+poly(f.left,'#8aaec4','stroke="#7a9eb4" stroke-width="0.5"')+poly(f.top,'#c8dce8','stroke="#b8ccd8" stroke-width="0.5"');var inn=[bil(f.top,.12,.12),bil(f.top,.88,.12),bil(f.top,.88,.88),bil(f.top,.12,.88)];s+=poly(inn,'#d8ecf8','opacity="0.6"');var cs=['#e84040','#4080e0','#20a040','#e0a020'];for(var i=0;i<3;i++){var p=bil(f.top,.28+i*.22,.4);s+='<rect x="'+(p[0]-6).toFixed(1)+'" y="'+(p[1]-4).toFixed(1)+'" width="12" height="8" rx="1.5" fill="'+cs[(i+a)%4]+'" opacity="0.85"/>'}return s}},
wall:{name:'Wall',h:3,gen:function(a,b,rot){var f=boxFaces(a,b,3),face=rot%2?f.right:f.left,other=rot%2?f.left:f.right;return poly(other,'#bab0a4','stroke="#aaa094" stroke-width="0.4"')+poly(face,'#c8beb2','stroke="#b8ae9e" stroke-width="0.4"')+poly(f.top,'#d8d0c0','stroke="#c8c0b0" stroke-width="0.4"')}},
glass:{name:'Glass',h:2.6,rots:4,gen:function(a,b,rot){var f=boxFaces(a,b,2.6),face={0:f.yp,1:f.xp,2:f.xm,3:f.ym}[((rot%4)+4)%4];return poly(face,'#c8eef8','opacity="0.5" stroke="#90c8dc" stroke-width="0.8"')+ln(face[0],face[3],'#70a8c0',2,'opacity="0.85"')+ln(face[1],face[2],'#70a8c0',2,'opacity="0.85"')+ln(bil(face,.15,.05),bil(face,.15,.95),'#ffffff',2,'opacity="0.25"')}},
sign:{name:'Sign',h:0,gen:function(a,b,rot,text){var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,2.6)],t=(text||'AISLE').toUpperCase(),w=Math.max(46,t.length*7.4+18);return'<g transform="translate('+c[0].toFixed(1)+','+c[1].toFixed(1)+')"><line x1="0" y1="-2" x2="0" y2="10" stroke="#909090" stroke-width="1" opacity="0.5"/><rect x="'+(-w/2).toFixed(1)+'" y="-13" width="'+w.toFixed(1)+'" height="22" rx="4" fill="#0e3a5e" opacity="0.94"/><text x="0" y="2.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#90e4ff" letter-spacing="0.5">'+t+'</text></g>'}},
shopper:{name:'Shopper',h:0,isWalker:true,gen:function(a,b,rot){var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5)],bodies=[['#3a5898','#2a4880','#401808','#f0c090'],['#983838','#782020','#602010','#e8b078'],['#2f7d4f','#1f5d37','#241008','#f0c090'],['#c99a2e','#9a7420','#3a2410','#e8b078']],col=bodies[(a*3+b+(rot||0))%bodies.length],x=c[0],y=c[1]-2;return'<g><ellipse cx="'+x.toFixed(1)+'" cy="'+(y+15).toFixed(1)+'" rx="7.5" ry="2.8" fill="#000" opacity="0.16"/><ellipse cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="5.5" ry="8.5" fill="'+col[0]+'"/><circle cx="'+x.toFixed(1)+'" cy="'+(y-12).toFixed(1)+'" r="4.5" fill="'+col[3]+'"/><ellipse cx="'+x.toFixed(1)+'" cy="'+(y-15).toFixed(1)+'" rx="3.5" ry="2" fill="'+col[2]+'"/><line x1="'+(x-5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x-9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[1]+'" stroke-width="2.5"/><line x1="'+(x+5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x+9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[1]+'" stroke-width="2.5"/><line x1="'+(x-2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x-3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[1]+'" stroke-width="2.5"/><line x1="'+(x+2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x+3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[1]+'" stroke-width="2.5"/></g>'}}
};
var ORDER=['fridge','shelf','produce','counter','deli','bin','glass','wall','shopper','sign'];

/* ===== FACILITY STATE ===== */
var pieces=[],uid=100;
function pieceAt(gx,gy){return pieces.filter(function(p){return p.gx===gx&&p.gy===gy})[0]||null}
function loadDefault(){
  var d=[{type:'sign',gx:5,gy:6,rot:0,text:'ZONE A'},{type:'fridge',gx:3,gy:0,rot:0},{type:'fridge',gx:4,gy:0,rot:0},{type:'fridge',gx:5,gy:0,rot:0},{type:'fridge',gx:6,gy:0,rot:0},{type:'fridge',gx:7,gy:0,rot:0},{type:'shelf',gx:0,gy:1,rot:1},{type:'shelf',gx:0,gy:2,rot:1},{type:'glass',gx:7,gy:8,rot:0},{type:'glass',gx:8,gy:8,rot:0},{type:'glass',gx:9,gy:8,rot:0},{type:'bin',gx:3,gy:5,rot:0},{type:'bin',gx:4,gy:5,rot:0},{type:'bin',gx:5,gy:5,rot:0},{type:'bin',gx:6,gy:5,rot:0},{type:'counter',gx:4,gy:2,rot:0},{type:'counter',gx:5,gy:2,rot:0},{type:'counter',gx:6,gy:2,rot:0},{type:'counter',gx:7,gy:2,rot:0},{type:'counter',gx:3,gy:2,rot:0},{type:'bin',gx:7,gy:5,rot:0},{type:'shelf',gx:0,gy:3,rot:1},{type:'shelf',gx:0,gy:4,rot:1},{type:'produce',gx:11,gy:0,rot:0},{type:'produce',gx:11,gy:2,rot:0},{type:'produce',gx:11,gy:4,rot:0},{type:'produce',gx:11,gy:6,rot:0},{type:'produce',gx:11,gy:8,rot:0},{type:'produce',gx:0,gy:8,rot:0},{type:'produce',gx:2,gy:8,rot:0},{type:'produce',gx:0,gy:6,rot:0}];
  pieces=d.map(function(p){return Object.assign({},p,{id:uid++})})
}
loadDefault();

/* ===== THEME SYSTEM ===== */
var HOTKEY={};
var currentTheme='retail';
var PIECES_RETAIL=PIECES,ORDER_RETAIL=ORDER.slice();
var HOTKEY_RETAIL=Object.assign({},HOTKEY);
var PIECES_ENTERPRISE=PIECES,ORDER_ENTERPRISE=ORDER.slice();
var HOTKEY_ENTERPRISE=Object.assign({},HOTKEY);

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
panel:{name:'Ctrl Panel',h:1.3,gen:function(a,b){
  var f=boxFaces(a,b,1.3);
  var s=poly(f.left,'#2a3a2a','stroke="#1a2a1a" stroke-width="0.5"')+
    poly(f.right,'#3a4a3a','stroke="#2a3a2a" stroke-width="0.5"')+
    poly(f.top,'#4a5a4a','stroke="#3a4a3a" stroke-width="0.5"');
  var sc=bil(f.top,.5,.5);
  s+='<circle cx="'+(sc[0]-8).toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="#22c55e" opacity="0.9"/>';
  s+='<circle cx="'+sc[0].toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="#22c55e" opacity="0.9"/>';
  s+='<circle cx="'+(sc[0]+8).toFixed(1)+'" cy="'+sc[1].toFixed(1)+'" r="2.5" fill="#ef4444" opacity="0.7"/>';
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
fence:{name:'Safety Fence',h:2.2,rots:4,gen:function(a,b,rot){
  var f=boxFaces(a,b,2.2),face={0:f.yp,1:f.xp,2:f.xm,3:f.ym}[((rot%4)+4)%4];
  var s=poly(face,'#e8c020','opacity="0.4" stroke="#c0a018" stroke-width="0.8"');
  for(var i=0;i<4;i++){var p1=bil(face,.15+i*.22,.05),p2=bil(face,.15+i*.22,.95);s+=ln(p1,p2,'#333',2,'opacity="0.7"')}
  s+=ln(face[0],face[3],'#333',2.5,'opacity="0.8"');
  s+=ln(face[1],face[2],'#333',2.5,'opacity="0.8"');
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


var PIECES_CHEM={
pipe_x:{name:'Pipe H',h:0.8,gen:function(a,b){
  var ph=0.7,t=(Date.now()/600)%1,do2=9*(1-t);
  var p1=[isoX(a,b+0.5),isoY(a,b+0.5,ph)],p2=[isoX(a+1,b+0.5),isoY(a+1,b+0.5,ph)];
  var s=ln(p1,p2,'#2a2a2a',7)+ln(p1,p2,'#4a4a4a',5);
  s+='<line x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  var f1=[isoX(a,b+0.5),isoY(a,b+0.5,0)],f2=[isoX(a+1,b+0.5),isoY(a+1,b+0.5,0)];
  s+=ln(f1,p1,'#666',1.2)+ln(f2,p2,'#666',1.2);
  return s}},
pipe_y:{name:'Pipe V',h:0.8,gen:function(a,b){
  var ph=0.7,t=(Date.now()/600)%1,do2=9*(1-t);
  var p1=[isoX(a+0.5,b),isoY(a+0.5,b,ph)],p2=[isoX(a+0.5,b+1),isoY(a+0.5,b+1,ph)];
  var s=ln(p1,p2,'#2a2a2a',7)+ln(p1,p2,'#4a4a4a',5);
  s+='<line x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  var f1=[isoX(a+0.5,b),isoY(a+0.5,b,0)],f2=[isoX(a+0.5,b+1),isoY(a+0.5,b+1,0)];
  s+=ln(f1,p1,'#666',1.2)+ln(f2,p2,'#666',1.2);
  return s}},
pipe_cr:{name:'Corner R',h:0.8,gen:function(a,b){
  var ph=0.7,t=(Date.now()/600)%1,do2=9*(1-t);
  var p1=[isoX(a,b+0.5),isoY(a,b+0.5,ph)],pc=[isoX(a+0.5,b+0.5),isoY(a+0.5,b+0.5,ph)],p2=[isoX(a+0.5,b+1),isoY(a+0.5,b+1,ph)];
  var s=ln(p1,pc,'#2a2a2a',7)+ln(pc,p2,'#2a2a2a',7)+ln(p1,pc,'#4a4a4a',5)+ln(pc,p2,'#4a4a4a',5);
  s+='<line x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+pc[0].toFixed(1)+'" y2="'+pc[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  s+='<line x1="'+pc[0].toFixed(1)+'" y1="'+pc[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  var fpc=[isoX(a+0.5,b+0.5),isoY(a+0.5,b+0.5,0)];
  s+=ln(fpc,pc,'#666',1.2);
  return s}},
pipe_cl:{name:'Corner L',h:0.8,gen:function(a,b){
  var ph=0.7,t=(Date.now()/600)%1,do2=9*(1-t);
  var p1=[isoX(a+0.5,b),isoY(a+0.5,b,ph)],pc=[isoX(a+0.5,b+0.5),isoY(a+0.5,b+0.5,ph)],p2=[isoX(a+1,b+0.5),isoY(a+1,b+0.5,ph)];
  var s=ln(p1,pc,'#2a2a2a',7)+ln(pc,p2,'#2a2a2a',7)+ln(p1,pc,'#4a4a4a',5)+ln(pc,p2,'#4a4a4a',5);
  s+='<line x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+pc[0].toFixed(1)+'" y2="'+pc[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  s+='<line x1="'+pc[0].toFixed(1)+'" y1="'+pc[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  var fpc=[isoX(a+0.5,b+0.5),isoY(a+0.5,b+0.5,0)];
  s+=ln(fpc,pc,'#666',1.2);
  return s}},
reactor:{name:'Reactor',h:3.5,gen:function(a,b){
  var f=boxFaces(a,b,3.5);
  var s=poly(f.left,'#2a4a6a','stroke="#1a3a5a" stroke-width="0.5"')+poly(f.right,'#3a5a7a','stroke="#2a4a6a" stroke-width="0.5"')+poly(f.top,'#4a6a8a','stroke="#3a5a7a" stroke-width="0.5"');
  var mc=bil(f.top,.5,.5);
  s+='<rect x="'+(mc[0]-4).toFixed(1)+'" y="'+(mc[1]-8).toFixed(1)+'" width="8" height="8" rx="2" fill="#555" stroke="#444" stroke-width=".8" opacity="0.8"/>';
  var gc=bil(f.left,.5,.35);
  s+='<circle cx="'+gc[0].toFixed(1)+'" cy="'+gc[1].toFixed(1)+'" r="3.5" fill="#0a1a2a" stroke="#3b82f6" stroke-width="1" opacity="0.8"/>';
  s+='<circle cx="'+gc[0].toFixed(1)+'" cy="'+gc[1].toFixed(1)+'" r="1.5" fill="#3b82f6" opacity="0.6"><animate attributeName="r" values="1.5;2.5;1.5" dur="2s" repeatCount="indefinite"/></circle>';
  var gc2=bil(f.left,.5,.65);
  s+='<circle cx="'+gc2[0].toFixed(1)+'" cy="'+gc2[1].toFixed(1)+'" r="2" fill="#ef4444" opacity="0.7"/>';
  s+='<circle cx="'+gc2[0].toFixed(1)+'" cy="'+gc2[1].toFixed(1)+'" r="2" fill="none" stroke="#ef4444" stroke-width=".5" opacity="0.4"><animate attributeName="r" from="2" to="5" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/></circle>';
  return s}},
mixer:{name:'Mixer',h:2.2,gen:function(a,b){
  var f=boxFaces(a,b,2.2);
  var s=poly(f.left,'#1a4a3a','stroke="#0a3a2a" stroke-width="0.5"')+poly(f.right,'#2a5a4a','stroke="#1a4a3a" stroke-width="0.5"')+poly(f.top,'#3a6a5a','stroke="#2a5a4a" stroke-width="0.5"');
  var mc=bil(f.top,.5,.5);
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+mc[1].toFixed(1)+'" r="6" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.6"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+mc[1]+'" to="360 '+mc[0]+' '+mc[1]+'" dur="3s" repeatCount="indefinite"/></circle>';
  s+='<line x1="'+mc[0].toFixed(1)+'" y1="'+(mc[1]-6).toFixed(1)+'" x2="'+mc[0].toFixed(1)+'" y2="'+(mc[1]+6).toFixed(1)+'" stroke="#22c55e" stroke-width="1" opacity="0.4"/>';
  s+='<circle cx="'+(mc[0]-6).toFixed(1)+'" cy="'+(mc[1]+3).toFixed(1)+'" r="2" fill="#22c55e" opacity="0.9"/>';
  s+='<circle cx="'+(mc[0]+6).toFixed(1)+'" cy="'+(mc[1]+3).toFixed(1)+'" r="2" fill="#22c55e" opacity="0.9"/>';
  return s}},
vat_mixer:{name:'Vat Mixer',h:2.2,gen:function(a,b){
  var h=2.2,bg=5,f=boxFaces(a,b,h),s='';
  /* curved barrel body — bottom edge bows outward */
  var lB0=f.left[0],lB3=f.left[3],lT3=f.left[2],lT0=f.left[1];
  var lC=[(lB0[0]+lB3[0])/2-bg,(lB0[1]+lB3[1])/2+3];
  s+='<path d="M'+P(lB0[0],lB0[1])+' Q'+P(lC[0],lC[1])+' '+P(lB3[0],lB3[1])+' L'+P(lT3[0],lT3[1])+' L'+P(lT0[0],lT0[1])+' Z" fill="#1a4a3a" stroke="#0a3a2a" stroke-width="0.5"/>';
  var rB1=f.right[0],rB2=f.right[1],rT2=f.right[2],rT1=f.right[3];
  var rC=[(rB1[0]+rB2[0])/2+bg,(rB1[1]+rB2[1])/2+3];
  s+='<path d="M'+P(rB1[0],rB1[1])+' Q'+P(rC[0],rC[1])+' '+P(rB2[0],rB2[1])+' L'+P(rT2[0],rT2[1])+' L'+P(rT1[0],rT1[1])+' Z" fill="#2a5a4a" stroke="#1a4a3a" stroke-width="0.5"/>';
  /* top face — open vat rim */
  s+=poly(f.top,'#3a6a5a','stroke="#2a5a4a" stroke-width="0.5"');
  /* inner liquid visible from top */
  var inn=[bil(f.top,.12,.12),bil(f.top,.88,.12),bil(f.top,.88,.88),bil(f.top,.12,.88)];
  s+=poly(inn,'#0a2a4a','opacity="0.85"');
  s+=poly(inn,'#3b82f6','opacity="0.2"');
  /* liquid swirl */
  var mc=bil(f.top,.5,.5);
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+mc[1].toFixed(1)+'" r="5" fill="#3b82f6" opacity="0.15"><animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.15;0.3;0.15" dur="2s" repeatCount="indefinite"/></circle>';
  /* motor housing on top */
  s+='<rect x="'+(mc[0]-3.5).toFixed(1)+'" y="'+(mc[1]-7).toFixed(1)+'" width="7" height="7" rx="2" fill="#555" stroke="#444" stroke-width=".8" opacity="0.85"/>';
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+(mc[1]-3.5).toFixed(1)+'" r="1.5" fill="#22c55e" opacity="0.8"/>';
  /* shaft down into the vat */
  var sb=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,.8)];
  s+=ln(mc,sb,'#999',1.5,'opacity="0.7"');
  /* rotating fin — two crossed blades with paddle tips */
  var fr=7;
  s+='<g>';
  s+='<line x1="'+(mc[0]-fr).toFixed(1)+'" y1="'+sb[1].toFixed(1)+'" x2="'+(mc[0]+fr).toFixed(1)+'" y2="'+sb[1].toFixed(1)+'" stroke="#ddd" stroke-width="2.5" stroke-linecap="round" opacity="0.85"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></line>';
  s+='<line x1="'+mc[0].toFixed(1)+'" y1="'+(sb[1]-fr).toFixed(1)+'" x2="'+mc[0].toFixed(1)+'" y2="'+(sb[1]+fr).toFixed(1)+'" stroke="#ddd" stroke-width="2.5" stroke-linecap="round" opacity="0.85"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></line>';
  s+='<rect x="'+(mc[0]-fr-2.5).toFixed(1)+'" y="'+(sb[1]-2).toFixed(1)+'" width="5" height="4" rx="1" fill="#bbb" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></rect>';
  s+='<rect x="'+(mc[0]+fr-2.5).toFixed(1)+'" y="'+(sb[1]-2).toFixed(1)+'" width="5" height="4" rx="1" fill="#bbb" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></rect>';
  s+='<rect x="'+(mc[0]-2).toFixed(1)+'" y="'+(sb[1]-fr-2.5).toFixed(1)+'" width="4" height="5" rx="1" fill="#bbb" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></rect>';
  s+='<rect x="'+(mc[0]-2).toFixed(1)+'" y="'+(sb[1]+fr-2.5).toFixed(1)+'" width="4" height="5" rx="1" fill="#bbb" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+sb[1]+'" to="360 '+mc[0]+' '+sb[1]+'" dur="1.8s" repeatCount="indefinite"/></rect>';
  s+='</g>';
  /* pipe connection stubs — 4 directions at pipe height */
  var ph=0.7,t=(Date.now()/600)%1,do2=9*(1-t);
  var stubs=[
    [[isoX(a,b+.5),isoY(a,b+.5,ph)],[isoX(a+.22,b+.5),isoY(a+.22,b+.5,ph)]],
    [[isoX(a+1,b+.5),isoY(a+1,b+.5,ph)],[isoX(a+.78,b+.5),isoY(a+.78,b+.5,ph)]],
    [[isoX(a+.5,b),isoY(a+.5,b,ph)],[isoX(a+.5,b+.22),isoY(a+.5,b+.22,ph)]],
    [[isoX(a+.5,b+1),isoY(a+.5,b+1,ph)],[isoX(a+.5,b+.78),isoY(a+.5,b+.78,ph)]]
  ];
  for(var si=0;si<stubs.length;si++){
    var p1=stubs[si][0],p2=stubs[si][1];
    s+=ln(p1,p2,'#2a2a2a',7)+ln(p1,p2,'#4a4a4a',5);
    s+='<line x1="'+p1[0].toFixed(1)+'" y1="'+p1[1].toFixed(1)+'" x2="'+p2[0].toFixed(1)+'" y2="'+p2[1].toFixed(1)+'" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6 3" stroke-linecap="round" stroke-dashoffset="'+do2.toFixed(1)+'"/>';
  }
  /* support legs at corners */
  var lps=[[a+.12,b+.12],[a+.88,b+.12],[a+.12,b+.88],[a+.88,b+.88]];
  for(var li=0;li<4;li++){
    var lp=[isoX(lps[li][0],lps[li][1]),isoY(lps[li][0],lps[li][1],0)];
    s+='<rect x="'+(lp[0]-1.5).toFixed(1)+'" y="'+lp[1].toFixed(1)+'" width="3" height="5" rx=".5" fill="#3a3a3a" opacity="0.6"/>';
  }
  return s}},
ctower:{name:'Cool Tower',h:4.2,gen:function(a,b){
  var f=boxFaces(a,b,4.2);
  var s=poly(f.left,'#5a6a7a','stroke="#4a5a6a" stroke-width="0.5"')+poly(f.right,'#6a7a8a','stroke="#5a6a7a" stroke-width="0.5"')+poly(f.top,'#7a8a9a','stroke="#6a7a8a" stroke-width="0.5"');
  for(var bi=0;bi<3;bi++){var bp=bil(f.left,.05+bi*.32,.5);s+=ln([bp[0]-2,bp[1]],[bp[0]+2,bp[1]],'#4a5a6a',1.5,'opacity="0.5"');}
  var tc=bil(f.top,.5,.5);
  s+='<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+(tc[1]-5).toFixed(1)+'" rx="9" ry="4" fill="#aaccee" opacity="0.06"><animate attributeName="ry" values="4;7;4" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.06;0.14;0.06" dur="3s" repeatCount="indefinite"/></ellipse>';
  s+='<ellipse cx="'+tc[0].toFixed(1)+'" cy="'+(tc[1]-10).toFixed(1)+'" rx="6" ry="3" fill="#aaccee" opacity="0.04"><animate attributeName="ry" values="3;5;3" dur="4s" begin="1s" repeatCount="indefinite"/></ellipse>';
  s+='<ellipse cx="'+(tc[0]+3).toFixed(1)+'" cy="'+(tc[1]-14).toFixed(1)+'" rx="4" ry="2" fill="#aaccee" opacity="0.03"><animate attributeName="ry" values="2;4;2" dur="5s" begin="2s" repeatCount="indefinite"/></ellipse>';
  return s}},
storage:{name:'Storage',h:2.8,gen:function(a,b){
  var f=boxFaces(a,b,2.8);
  var s=poly(f.left,'#2a5a2a','stroke="#1a4a1a" stroke-width="0.5"')+poly(f.right,'#3a6a3a','stroke="#2a5a2a" stroke-width="0.5"')+poly(f.top,'#4a7a4a','stroke="#3a6a3a" stroke-width="0.5"');
  var lc=bil(f.left,.5,.35);
  s+='<rect x="'+(lc[0]-2).toFixed(1)+'" y="'+(lc[1]-6).toFixed(1)+'" width="4" height="12" rx="1" fill="#1a3a1a" stroke="#22c55e" stroke-width=".5" opacity="0.8"/>';
  s+='<rect x="'+(lc[0]-1.5).toFixed(1)+'" y="'+(lc[1]-2).toFixed(1)+'" width="3" height="7" rx=".5" fill="#22c55e" opacity="0.5"><animate attributeName="y" values="'+(lc[1]-2).toFixed(1)+';'+(lc[1]-5).toFixed(1)+';'+(lc[1]-2).toFixed(1)+'" dur="6s" repeatCount="indefinite"/><animate attributeName="height" values="7;3;7" dur="6s" repeatCount="indefinite"/></rect>';
  return s}},
pump:{name:'Pump',h:0.9,gen:function(a,b){
  var f=boxFaces(a,b,0.9);
  var s=poly(f.left,'#5a5a5a','stroke="#4a4a4a" stroke-width="0.5"')+poly(f.right,'#6a6a6a','stroke="#5a5a5a" stroke-width="0.5"')+poly(f.top,'#7a7a7a','stroke="#6a6a6a" stroke-width="0.5"');
  var mc=bil(f.top,.5,.5);
  s+='<circle cx="'+mc[0].toFixed(1)+'" cy="'+(mc[1]-3).toFixed(1)+'" r="5" fill="#444" stroke="#333" stroke-width="1" opacity="0.8"/>';
  s+='<line x1="'+(mc[0]-3).toFixed(1)+'" y1="'+(mc[1]-3).toFixed(1)+'" x2="'+(mc[0]+3).toFixed(1)+'" y2="'+(mc[1]-3).toFixed(1)+'" stroke="#f97316" stroke-width="1.5" opacity="0.8"><animateTransform attributeName="transform" type="rotate" from="0 '+mc[0]+' '+(mc[1]-3).toFixed(1)+'" to="360 '+mc[0]+' '+(mc[1]-3).toFixed(1)+'" dur="0.5s" repeatCount="indefinite"/></line>';
  s+='<circle cx="'+(mc[0]+5).toFixed(1)+'" cy="'+(mc[1]-1).toFixed(1)+'" r="1.5" fill="#22c55e" opacity="0.8"/>';
  return s}},
drum:{name:'Drum',h:1.3,gen:function(a,b){
  var f=boxFaces(a,b,1.3);
  var cols=[['#2a6a9a','#3a7aaa','#4a8aba'],['#9a6a2a','#aa7a3a','#ba8a4a'],['#6a2a6a','#7a3a7a','#8a4a8a'],['#2a6a4a','#3a7a5a','#4a8a6a']];
  var c=cols[(a+b)%cols.length];
  var s=poly(f.left,c[0],'stroke="'+c[0]+'" stroke-width="0.5"')+poly(f.right,c[1],'stroke="'+c[1]+'" stroke-width="0.5"')+poly(f.top,c[2],'stroke="'+c[2]+'" stroke-width="0.5"');
  var sc=bil(f.left,.5,.5);
  s+=ln([sc[0],sc[1]-5],[sc[0],sc[1]+5],'#f0c020',2.5,'opacity="0.6"');
  s+=ln([sc[0],sc[1]-2],[sc[0],sc[1]+2],'#222',1.5,'opacity="0.3"');
  return s}},
worker:{name:'Worker',h:0,isWalker:true,gen:function(a,b,rot){
  var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5)];
  var wb=[['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e85a00','#c04800','#1a1a1a','#f0d0a0'],['#e8c020','#b8a018','#1a1a1a','#f0d0a0'],['#d04020','#a83018','#1a1a1a','#f0d0a0']];
  var col=wb[(a*3+b+(rot||0))%wb.length],x=c[0],y=c[1]-2;
  return'<g><ellipse cx="'+x.toFixed(1)+'" cy="'+(y+15).toFixed(1)+'" rx="7.5" ry="2.8" fill="#000" opacity="0.16"/>'+'<ellipse cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="5.5" ry="8.5" fill="'+col[0]+'"/>'+'<circle cx="'+x.toFixed(1)+'" cy="'+(y-12).toFixed(1)+'" r="4.5" fill="'+col[3]+'"/>'+'<ellipse cx="'+x.toFixed(1)+'" cy="'+(y-15).toFixed(1)+'" rx="5" ry="2.5" fill="'+col[1]+'"/>'+'<line x1="'+(x-5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x-9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+'<line x1="'+(x+5.5).toFixed(1)+'" y1="'+(y-2).toFixed(1)+'" x2="'+(x+9).toFixed(1)+'" y2="'+(y+3).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+'<line x1="'+(x-2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x-3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/>'+'<line x1="'+(x+2.5).toFixed(1)+'" y1="'+(y+7).toFixed(1)+'" x2="'+(x+3).toFixed(1)+'" y2="'+(y+15).toFixed(1)+'" stroke="'+col[2]+'" stroke-width="2.5"/></g>'}},
sign:{name:'Sign',h:0,gen:function(a,b,rot,text){
  var c=[isoX(a+.5,b+.5),isoY(a+.5,b+.5,2.6)],t=(text||'BAY').toUpperCase(),w=Math.max(46,t.length*7.4+18);
  return'<g transform="translate('+c[0].toFixed(1)+','+c[1].toFixed(1)+')"><line x1="0" y1="-2" x2="0" y2="10" stroke="#909090" stroke-width="1" opacity="0.5"/>'+'<rect x="'+(-w/2).toFixed(1)+'" y="-13" width="'+w.toFixed(1)+'" height="22" rx="4" fill="#0a2a3a" opacity="0.94"/>'+'<text x="0" y="2.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#22c55e" letter-spacing="0.5">'+t+'</text></g>'}}
};
var ORDER_CHEM=['pipe_x','pipe_y','pipe_cr','pipe_cl','reactor','mixer','vat_mixer','ctower','storage','pump','drum','worker','sign'];
var HOTKEY_CHEM={'1':'pipe_x','2':'pipe_y','3':'pipe_cr','4':'reactor','5':'mixer','6':'vat_mixer','7':'ctower','8':'storage','9':'pump'};

function loadChemical(){
  var d=[
    {type:'sign',gx:6,gy:8,rot:0,text:'PLANT C'},
    /* === TOP ROW: REACTORS (left) & COOLING TOWERS (right) === */
    {type:'reactor',gx:0,gy:0},{type:'reactor',gx:1,gy:0},{type:'reactor',gx:2,gy:0},
    {type:'ctower',gx:9,gy:0},{type:'ctower',gx:10,gy:0},{type:'ctower',gx:11,gy:0},
    /* === VERTICAL PIPES DOWN FROM TOP EQUIPMENT === */
    {type:'pipe_y',gx:0,gy:1},{type:'pipe_y',gx:1,gy:1},{type:'pipe_y',gx:2,gy:1},
    {type:'pipe_y',gx:9,gy:1},{type:'pipe_y',gx:10,gy:1},{type:'pipe_y',gx:11,gy:1},
    /* === FIRST HORIZONTAL PIPE RUN — vat_mixers at crossings (gx 3,6,9) === */
    {type:'pipe_x',gx:0,gy:2},{type:'pipe_x',gx:1,gy:2},{type:'pipe_x',gx:2,gy:2},
    {type:'vat_mixer',gx:3,gy:2},
    {type:'pipe_x',gx:4,gy:2},{type:'pipe_x',gx:5,gy:2},
    {type:'vat_mixer',gx:6,gy:2},
    {type:'pipe_x',gx:7,gy:2},{type:'pipe_x',gx:8,gy:2},
    {type:'vat_mixer',gx:9,gy:2},
    {type:'pipe_x',gx:10,gy:2},{type:'pipe_x',gx:11,gy:2},
    /* === VERTICAL PIPES BETWEEN ROWS === */
    {type:'pipe_y',gx:3,gy:3},{type:'pipe_y',gx:6,gy:3},{type:'pipe_y',gx:9,gy:3},
    /* === PUMPS ALONG THE MID-RIB === */
    {type:'pump',gx:4,gy:3},{type:'pump',gx:8,gy:3},
    /* === MORE VERTICAL PIPES === */
    {type:'pipe_y',gx:3,gy:4},{type:'pipe_y',gx:6,gy:4},{type:'pipe_y',gx:9,gy:4},
    /* === SECOND HORIZONTAL PIPE RUN — vat_mixers at crossings (gx 3,6,9) === */
    {type:'pipe_x',gx:0,gy:5},{type:'pipe_x',gx:1,gy:5},{type:'pipe_x',gx:2,gy:5},
    {type:'vat_mixer',gx:3,gy:5},
    {type:'pipe_x',gx:4,gy:5},{type:'pipe_x',gx:5,gy:5},
    {type:'vat_mixer',gx:6,gy:5},
    {type:'pipe_x',gx:7,gy:5},{type:'pipe_x',gx:8,gy:5},
    {type:'vat_mixer',gx:9,gy:5},
    {type:'pipe_x',gx:10,gy:5},{type:'pipe_x',gx:11,gy:5},
    /* === VERTICAL PIPES DOWN TO STORAGE === */
    {type:'pipe_y',gx:3,gy:6},{type:'pipe_y',gx:6,gy:6},{type:'pipe_y',gx:9,gy:6},
    /* === STORAGE TANKS === */
    {type:'storage',gx:1,gy:7},{type:'storage',gx:5,gy:7},{type:'storage',gx:10,gy:7},
    /* === DRUMS === */
    {type:'drum',gx:0,gy:8},{type:'drum',gx:3,gy:8},{type:'drum',gx:6,gy:8},{type:'drum',gx:9,gy:8},
    /* === WORKERS === */
    {type:'worker',gx:2,gy:3,rot:0},{type:'worker',gx:8,gy:7,rot:1}
  ];
  pieces=d.map(function(p){return Object.assign({},p,{id:uid++})});
}

function switchLayout(theme){
  currentTheme=theme;
  if(theme==='industrial'){
    PIECES=PIECES_IND;ORDER=ORDER_IND;HOTKEY=HOTKEY_IND;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-industrial').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-industrial').trim();
    loadIndustrial();
  }else if(theme==='chemical'){
    PIECES=PIECES_CHEM;ORDER=ORDER_CHEM;HOTKEY=HOTKEY_CHEM;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-chemical').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-chemical').trim();
    loadChemical();
  }else{
    PIECES=PIECES_RETAIL;ORDER=ORDER_RETAIL;HOTKEY=HOTKEY_RETAIL;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-retail').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-retail').trim();
    loadDefault();
  }
  walkers=[];
  walkers.push(spawnWalker(2,6,0),spawnWalker(2,3,1),spawnWalker(1,1,2),spawnWalker(9,2,3));
  sensorStates=SENSOR_DEFS.map(function(){return{opacity:0,radius:0,tOp:0,tR:0}});
  document.querySelectorAll('.layout-tab').forEach(function(t){t.classList.toggle('active',t.dataset.theme===theme)});
  document.documentElement.setAttribute('data-facility',theme);
  if(editMode){buildPalette()}
  lucide.createIcons();
  onScroll();render();
}

/* ===== WALKER SYSTEM ===== */
var walkers=[];
function walkerAt(gx,gy){return walkers.filter(function(w){return Math.round(w.cx)===gx&&Math.round(w.cy)===gy})[0]||null}
function scanPath(gx,gy){
  var dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}],best=null,bestLen=0;
  for(var di=0;di<dirs.length;di++){var d=dirs[di],path=[],cx=gx,cy=gy;while(cx>=0&&cy>=0&&cx<COLS&&cy<ROWS&&!pieceAt(cx,cy)&&!walkerAt(cx,cy)){path.push({gx:cx,gy:cy});cx+=d.dx;cy+=d.dy}if(path.length>bestLen){bestLen=path.length;best=path}}
  return best||[{gx:gx,gy:gy}]
}
function spawnWalker(gx,gy,rot){var path=scanPath(gx,gy);return{id:uid++,cx:path[0].gx,cy:path[0].gy,path:path,pathIdx:0,dir:1,speed:.008+Math.random()*.006,pauseTimer:40+Math.random()*60,phase:Math.random()*Math.PI*2,rot:rot||0}}
function findNearestEmpty(gx,gy){var visited={},queue=[{gx:gx,gy:gy}];visited[gx+','+gy]=true;while(queue.length){var cur=queue.shift();if((cur.gx!==gx||cur.gy!==gy)&&!pieceAt(cur.gx,cur.gy)&&!walkerAt(cur.gx,cur.gy))return cur;var nb=[[1,0],[-1,0],[0,1],[0,-1]];for(var i=0;i<nb.length;i++){var nx=cur.gx+nb[i][0],ny=cur.gy+nb[i][1],k=nx+','+ny;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&!visited[k]){visited[k]=true;queue.push({gx:nx,gy:ny})}}}return{gx:gx,gy:gy}}
function recalcAllPaths(){walkers.forEach(function(w){var rgx=Math.round(w.cx),rgy=Math.round(w.cy),safe=findNearestEmpty(rgx,rgy),np=scanPath(safe.gx,safe.gy);w.path=np;w.pathIdx=0;w.cx=np[0].gx;w.cy=np[0].gy;w.dir=1;w.pauseTimer=30+Math.random()*40})}
function updateWalkers(){walkers.forEach(function(w){if(w.pauseTimer>0){w.pauseTimer--;w.phase+=.02;return}var target=w.path[w.pathIdx];if(!target){w.dir*=-1;w.pathIdx+=w.dir;if(w.pathIdx<0||w.pathIdx>=w.path.length)w.pathIdx=w.dir>0?w.path.length-1:0;w.pauseTimer=50+Math.random()*100;return}var dx=target.gx-w.cx,dy=target.gy-w.cy,dist=Math.sqrt(dx*dx+dy*dy);if(dist<w.speed){w.cx=target.gx;w.cy=target.gy;w.pathIdx+=w.dir}else{w.cx+=dx/dist*w.speed;w.cy+=dy/dist*w.speed}w.phase+=w.speed*10})}
function walkerSVG(w){
  var px=isoX(w.cx,w.cy),py=isoY(w.cx,w.cy),walking=w.pauseTimer<=0;
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

/* ===== SENSOR CONE SYSTEM ===== */
var SENSOR_DEFS=[
  {sec:1,gx:4,gy:0,gz:3,sR:120,dir:90,spread:85,color:'#f97316',label:'T-01'},
  {sec:1,gx:6.5,gy:0,gz:3,sR:110,dir:90,spread:80,color:'#f97316',label:'H-01'},
  {sec:1,gx:0,gy:2,gz:3,sR:95,dir:90,spread:70,color:'#fb923c',label:'T-02'},
  {sec:2,gx:4.5,gy:2,gz:3,sR:100,dir:90,spread:75,color:'#3b82f6',label:'C-01'},
  {sec:2,gx:6.5,gy:2,gz:3,sR:95,dir:90,spread:70,color:'#3b82f6',label:'C-02'},
  {sec:2,gx:3.2,gy:2,gz:3,sR:85,dir:90,spread:60,color:'#60a5fa',label:'C-03'},
  {sec:3,gx:0,gy:1,gz:3,sR:90,dir:90,spread:90,color:'#a855f7',label:'V-01'},
  {sec:3,gx:0,gy:3.5,gz:3,sR:85,dir:90,spread:85,color:'#a855f7',label:'V-02'},
  {sec:3,gx:0,gy:5,gz:3,sR:80,dir:90,spread:75,color:'#c084fc',label:'V-03'},
  {sec:4,gx:5.5,gy:4.2,gz:3,sR:140,dir:90,spread:120,color:'#ef4444',label:'AQ-01'},
  {sec:4,gx:2,gy:7,gz:3,sR:100,dir:90,spread:90,color:'#ef4444',label:'TH-01'},
  {sec:4,gx:5,gy:5.5,gz:3,sR:85,dir:90,spread:80,color:'#f87171',label:'TH-02'},
  {sec:5,gx:5.5,gy:4.5,gz:3,sR:300,dir:0,spread:360,color:'#22c55e',label:'ESG',isGlow:true}
];
var sensorStates=SENSOR_DEFS.map(function(){return{opacity:0,radius:0,tOp:0,tR:0}});

function coneScreen(cx,cy,screenR,dirDeg,spreadDeg,rScale){
  var r=Math.max(.1,screenR*rScale),pts=[[cx,cy]],steps=30;
  var sa=(dirDeg-spreadDeg/2)*Math.PI/180,ea=(dirDeg+spreadDeg/2)*Math.PI/180;
  for(var i=0;i<=steps;i++){var a=sa+(ea-sa)*(i/steps);pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}
  return pts
}
function gradientDefs(){
  var s='';for(var i=0;i<SENSOR_DEFS.length;i++){var sen=SENSOR_DEFS[i],cx=isoX(sen.gx,sen.gy),cy=isoY(sen.gx,sen.gy,sen.gz||0),r=sen.sR*1.15;
  if(sen.isGlow)s+='<radialGradient id="cg'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="'+sen.color+'" stop-opacity="0.22"/><stop offset="50%" stop-color="'+sen.color+'" stop-opacity="0.08"/><stop offset="100%" stop-color="'+sen.color+'" stop-opacity="0"/></radialGradient>';
  else s+='<radialGradient id="cg'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="'+sen.color+'" stop-opacity="0.55"/><stop offset="50%" stop-color="'+sen.color+'" stop-opacity="0.15"/><stop offset="100%" stop-color="'+sen.color+'" stop-opacity="0"/></radialGradient>'}
  return s
}
function sensorsSVG(){
  var s='';for(var i=0;i<SENSOR_DEFS.length;i++){var sen=SENSOR_DEFS[i],st=sensorStates[i];if(st.opacity<.008)continue;
  var cx=isoX(sen.gx,sen.gy),cy=isoY(sen.gx,sen.gy,sen.gz||0);
  s+='<g opacity="'+st.opacity.toFixed(3)+'">';
  if(sen.isGlow){s+=poly(coneScreen(cx,cy,sen.sR,0,360,st.radius),'url(#cg'+i+')')}
  else{var pts=coneScreen(cx,cy,sen.sR,sen.dir,sen.spread,st.radius);s+=poly(pts,'url(#cg'+i+')');
  s+=ln(pts[0],[pts[1][0],pts[1][1]],sen.color,1.5,'opacity="0.45" stroke-dasharray="4 3"');
  s+=ln(pts[0],[pts[pts.length-1][0],pts[pts.length-1][1]],sen.color,1.5,'opacity="0.45" stroke-dasharray="4 3"');
  var arc='';for(var j=1;j<pts.length;j++){if(j>1)arc+=' ';arc+=pts[j][0].toFixed(1)+','+pts[j][1].toFixed(1)}
  s+='<polyline points="'+arc+'" fill="none" stroke="'+sen.color+'" stroke-width=".8" opacity="0.25" stroke-dasharray="2 5"/>';
  var sa2=(sen.dir-sen.spread/2)*Math.PI/180,endX=cx+sen.sR*st.radius*Math.cos(sa2),endY=cy+sen.sR*st.radius*Math.sin(sa2);
  s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+endX.toFixed(1)+'" y2="'+endY.toFixed(1)+'" stroke="'+sen.color+'" stroke-width="1.8" opacity="0.5" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="'+(sen.dir-sen.spread/2).toFixed(1)+' '+cx+' '+cy+'" to="'+(sen.dir+sen.spread/2).toFixed(1)+' '+cx+' '+cy+'" dur="3s" repeatCount="indefinite"/></line>'}
  /* ceiling mount indicator: bracket on ceiling + drop line to sensor */
  var ceilY=cy-8;
  s+='<line x1="'+(cx-6).toFixed(1)+'" y1="'+ceilY.toFixed(1)+'" x2="'+(cx+6).toFixed(1)+'" y2="'+ceilY.toFixed(1)+'" stroke="'+sen.color+'" stroke-width="2" opacity="0.6" stroke-linecap="round"/>';
  s+='<line x1="'+cx.toFixed(1)+'" y1="'+ceilY.toFixed(1)+'" x2="'+cx.toFixed(1)+'" y2="'+cy.toFixed(1)+'" stroke="'+sen.color+'" stroke-width="1" opacity="0.35" stroke-dasharray="2 2"/>';
  /* sensor dot + pulse rings */
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="4.5" fill="'+sen.color+'"/>';
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="4.5" fill="none" stroke="'+sen.color+'" stroke-width="1.5"><animate attributeName="r" from="4.5" to="18" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.65" to="0" dur="2.2s" repeatCount="indefinite"/></circle>';
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="4.5" fill="none" stroke="'+sen.color+'" stroke-width="1"><animate attributeName="r" from="4.5" to="13" dur="2.2s" begin="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.4" to="0" dur="2.2s" begin="1.1s" repeatCount="indefinite"/></circle>';
  s+='<text x="'+cx+'" y="'+(ceilY-6)+'" text-anchor="middle" font-family="Space Mono,monospace" font-size="7.5" font-weight="bold" fill="'+sen.color+'" opacity="0.9">'+sen.label+'</text>';
  s+='</g>'}return s
}

/* ===== CAMERA ===== */
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
function entitiesSVG(){
  var items=[];
  for(var i=0;i<pieces.length;i++){var p=pieces[i];items.push({sortKey:p.gx+p.gy,svg:'<g data-id="'+p.id+'">'+PIECES[p.type].gen(p.gx,p.gy,p.rot,p.text)+'</g>'})}
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
function render(){canvas.innerHTML='<defs>'+gradientDefs()+'</defs>'+floorSVG()+entitiesSVG()+sensorsSVG()+hoverSVG()}

