/* ===== SCROLL ===== */
var sectionEls=document.querySelectorAll('[data-section]');
var legendChips=document.querySelectorAll('.legend-chip');
var activeSection=0,prevSection=-1;
function getActiveSection(){var sy=window.scrollY;for(var i=sectionEls.length-1;i>=0;i--)if(sectionEls[i].offsetTop<=sy+window.innerHeight*.38)return i;return 0}
function onScroll(){
  if(editMode)return;activeSection=getActiveSection();tarV=Object.assign({},VIEWS[activeSection]);
  var sy=window.scrollY,sTop=sectionEls[activeSection].offsetTop,sH=sectionEls[activeSection].offsetHeight;
  var progress=Math.min(1,Math.max(0,(sy-sTop)/(sH*.45)));
  for(var i=0;i<SENSOR_DEFS.length;i++){var sen=SENSOR_DEFS[i],st=sensorStates[i];
    if(sen.sec<activeSection){st.tOp=1;st.tR=1}
    else if(sen.sec===activeSection){st.tOp=.18+progress*.82;st.tR=progress}
    else{st.tOp=0;st.tR=0}}
  if(activeSection!==prevSection){
    for(var j=0;j<legendChips.length;j++)legendChips[j].classList.toggle('show',j<=activeSection-1&&j<5);
    var revs=sectionEls[activeSection].querySelectorAll('.reveal');for(var k=0;k<revs.length;k++)revs[k].classList.add('visible');
    prevSection=activeSection}
}
window.addEventListener('scroll',onScroll,{passive:true});

/* ===== ANIMATION LOOP ===== */
function animate(){
  var sm=.065;curV.x+=(tarV.x-curV.x)*sm;curV.y+=(tarV.y-curV.y)*sm;curV.w+=(tarV.w-curV.w)*sm;curV.h+=(tarV.h-curV.h)*sm;
  canvas.setAttribute('viewBox',curV.x.toFixed(1)+' '+curV.y.toFixed(1)+' '+curV.w.toFixed(1)+' '+curV.h.toFixed(1));
  var needsRender=false;
  for(var i=0;i<sensorStates.length;i++){var st=sensorStates[i],d1=(st.tOp-st.opacity)*.09,dr=(st.tR-st.radius)*.065;if(Math.abs(d1)>.001||Math.abs(dr)>.001){st.opacity+=d1;st.radius+=dr;needsRender=true}}
  updateWalkers();needsRender=true;
  if(needsRender)render();requestAnimationFrame(animate)
}

/* ===== EDIT MODE ===== */
var isoBg=document.getElementById('iso-bg'),contentEl=document.getElementById('content');
var editPanel=document.getElementById('edit-panel'),editBtn=document.getElementById('edit-btn'),editHint=document.getElementById('editHint');
var HOTKEY={'1':'fridge','2':'shelf','3':'produce','4':'counter','5':'deli','6':'bin','7':'glass','8':'wall','9':'shopper','0':'sign'};

function enterEdit(){
  editMode=true;isoBg.classList.add('editing');contentEl.classList.add('dimmed');
  editPanel.classList.add('open');editBtn.classList.add('editing');
  editBtn.innerHTML='<i data-lucide="x" class="w-3.5 h-3.5"></i> Done Editing';
  editHint.classList.add('show');lucide.createIcons();
  tarV={x:VB.x,y:VB.y,w:VB.w,h:VB.h};document.body.style.overflow='hidden';render()
}
function exitEdit(){
  editMode=false;isoBg.classList.remove('editing');contentEl.classList.remove('dimmed');
  editPanel.classList.remove('open');editBtn.classList.remove('editing');
  editBtn.innerHTML='<i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit Layout';
  editHint.classList.remove('show');lucide.createIcons();
  document.body.style.overflow='';onScroll();render()
}
editBtn.onclick=function(){if(editMode)exitEdit();else enterEdit()};

canvas.addEventListener('pointermove',function(e){if(!editMode)return;var svg=clientToSvg(e.clientX,e.clientY),cell=svgToCell(svg.x,svg.y);if(!hover||hover.gx!==cell.gx||hover.gy!==cell.gy){hover=cell;render()}});
canvas.addEventListener('pointerleave',function(){hover=null;if(editMode)render()});
canvas.addEventListener('pointerdown',function(e){
  if(!editMode||e.button===2)return;var svg=clientToSvg(e.clientX,e.clientY),cell=svgToCell(svg.x,svg.y),gx=cell.gx,gy=cell.gy;
  if(gx<0||gy<0||gx>=COLS||gy>=ROWS)return;
  if(editTool==='eraser'){var removed=false;var pp=pieceAt(gx,gy);if(pp){pieces=pieces.filter(function(x){return x!==pp});removed=true}var ww=walkerAt(gx,gy);if(ww){walkers=walkers.filter(function(x){return x!==ww});removed=true}if(removed){recalcAllPaths();render()}return}
  var ex=pieceAt(gx,gy);if(ex)pieces=pieces.filter(function(x){return x!==ex});
  var ew=walkerAt(gx,gy);if(ew)walkers=walkers.filter(function(x){return x!==ew});
  if(PIECES[editTool]&&PIECES[editTool].isWalker){if(pieceAt(gx,gy))return;walkers.push(spawnWalker(gx,gy,Math.floor(Math.random()*4)))}
  else{var text;if(PIECES[editTool].gen.toString().indexOf('text')!==-1){text=prompt('Label:','ZONE');if(text===null)return}pieces.push({id:uid++,type:editTool,gx:gx,gy:gy,rot:0,text:text});recalcAllPaths()}
  render()
});
canvas.addEventListener('contextmenu',function(e){
  if(!editMode)return;e.preventDefault();var svg=clientToSvg(e.clientX,e.clientY),cell=svgToCell(svg.x,svg.y);
  var pp=pieceAt(cell.gx,cell.gy);if(pp){pieces=pieces.filter(function(x){return x!==pp});recalcAllPaths()}
  var ww=walkerAt(cell.gx,cell.gy);if(ww)walkers=walkers.filter(function(x){return x!==ww});render()
});
window.addEventListener('keydown',function(e){
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')return;
  if(e.key.toLowerCase()==='escape'){if(editMode)exitEdit();return}
  if(!editMode)return;if(HOTKEY[e.key])setEditTool(HOTKEY[e.key])
});

/* ===== PALETTE ===== */
function iconFor(type){var g=PIECES[type],body=g.gen(0,0,0,type==='sign'?'Z1':undefined),mn=isoX(0,1)-6,mx=isoX(1,0)+6,my=isoY(0,0,(g.h||0)+.4)-6,xy=isoY(1,1,0)+8;return'<svg viewBox="'+mn+' '+my+' '+(mx-mn)+' '+(xy-my)+'" preserveAspectRatio="xMidYMid meet"><polygon points="'+P(isoX(0,0),isoY(0,0))+' '+P(isoX(1,0),isoY(1,0))+' '+P(isoX(1,1),isoY(1,1))+' '+P(isoX(0,1),isoY(0,1))+'" fill="'+floorColor+'"/>'+body+'</svg>'}
function buildPalette(){
  var el=document.getElementById('palette-inner'),h='<h4>Place</h4>';
  h+='<div class="ep-tool'+(editTool==='eraser'?' active':'')+'" data-t="eraser"><svg viewBox="0 0 32 28"><rect x="8" y="10" width="16" height="9" rx="2" transform="rotate(-18 16 14)" fill="#db5e3d"/></svg><span>Eraser</span></div>';
  for(var i=0;i<ORDER.length;i++){var t=ORDER[i];h+='<div class="ep-tool'+(editTool===t?' active':'')+'" data-t="'+t+'">'+iconFor(t)+'<span style="font-size:9px">'+PIECES[t].name+'</span></div>'}
  h+='<h4 style="margin-top:8px">View</h4>';
  h+='<div class="ep-tool" data-t="grid"><svg viewBox="0 0 32 28"><line x1="4" y1="4" x2="28" y2="4" stroke="#f4ead0" stroke-width="1"/><line x1="4" y1="12" x2="28" y2="12" stroke="#f4ead0" stroke-width="1"/><line x1="4" y1="20" x2="28" y2="20" stroke="#f4ead0" stroke-width="1"/><line x1="10" y1="2" x2="10" y2="26" stroke="#f4ead0" stroke-width="1"/><line x1="20" y1="2" x2="20" y2="26" stroke="#f4ead0" stroke-width="1"/></svg><span>'+(showGrid?'Hide':'Show')+' Grid</span></div>';
  h+='<div class="ep-tool" data-t="clear"><svg viewBox="0 0 32 28"><line x1="8" y1="8" x2="24" y2="20" stroke="#db5e3d" stroke-width="2"/><line x1="24" y1="8" x2="8" y2="20" stroke="#db5e3d" stroke-width="2"/></svg><span>Clear All</span></div>';
  el.innerHTML=h;
  var tools=el.querySelectorAll('.ep-tool');for(var j=0;j<tools.length;j++){(function(tool){tool.addEventListener('click',function(){var v=tool.dataset.t;if(v==='grid'){showGrid=!showGrid;buildPalette();render();return}if(v==='clear'){if((pieces.length||walkers.length)&&confirm('Clear everything?')){pieces=[];walkers=[];render()}return}setEditTool(v)})})(tools[j])}
}
function setEditTool(t){editTool=t;buildPalette()}

/* ===== FORM ===== */
function handleSubmit(e){e.preventDefault();var b=document.getElementById('submit-btn');b.innerHTML='<svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Sending...';b.disabled=true;setTimeout(function(){b.innerHTML='<span>Request Free Assessment</span><i data-lucide="send" class="w-4 h-4"></i>';b.disabled=false;lucide.createIcons();e.target.reset();showToast('Assessment request sent!')},1500)}
function showToast(m){var t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove()},400)},3500)}
var revObs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.15,rootMargin:'0px 0px -40px 0px'});
var revEls=document.querySelectorAll('.reveal');for(var ri=0;ri<revEls.length;ri++)revObs.observe(revEls[ri]);

/* ===== LIGHT / DARK MODE TOGGLE ===== */
function toggleMode(){
  var html=document.documentElement;
  var isLight=html.getAttribute('data-mode')==='light';
  var next=isLight?'dark':'light';
  html.setAttribute('data-mode',next);
  localStorage.setItem('surds-mode',next);
  /* Update toggle label */
  var lbl=document.querySelector('#mode-toggle .mt-label');
  if(lbl)lbl.textContent=next==='dark'?'Dark':'Light';
  /* Re-apply floor/grid colors for current theme */
  if(typeof switchLayout==='function'&&typeof currentTheme!=='undefined'){
    var t=currentTheme;
    if(t==='retail'){floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-retail').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-retail').trim()}
    else if(t==='industrial'){floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-industrial').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-industrial').trim()}
    else if(t==='chemical'){floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-chemical').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-chemical').trim()}
    render();
  }
}
/* Restore saved mode */
(function(){
  var saved=localStorage.getItem('surds-mode');
  if(saved){document.documentElement.setAttribute('data-mode',saved);
    var lbl=document.querySelector('#mode-toggle .mt-label');
    if(lbl)lbl.textContent=saved==='dark'?'Dark':'Light';
  }
})();
/* ===== INIT ===== */
/* Resolve initial floor/grid colors from CSS vars */
(function(){var cs=getComputedStyle(document.documentElement);floorColor=cs.getPropertyValue('--m-floor-retail').trim();gridColor=cs.getPropertyValue('--m-grid-retail').trim()})();
buildPalette();render();animate();setTimeout(onScroll,100);

