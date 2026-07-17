/* ===== ISO ENGINE CORE =====
   Grid math and SVG drawing primitives shared by every theme's piece set. Load this
   first — everything else (pieces, walkers, render) depends on it. */
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

/* ===== FACILITY STATE ===== */
var pieces=[],uid=100;
function pieceAt(gx,gy){return pieces.filter(function(p){return p.gx===gx&&p.gy===gy})[0]||null}
