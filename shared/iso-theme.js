/* ===== THEME SYSTEM =====
   Aliases each theme's piece set under a _RETAIL/_IND/_CHEM suffix (so switchLayout can
   swap the active PIECES/ORDER/HOTKEY globals), plus the theme switcher itself. Must
   load after iso-pieces-retail.js (aliases PIECES as PIECES_RETAIL) and after the
   industrial/chemical piece files (switchLayout references PIECES_IND/PIECES_CHEM). */
var HOTKEY={};
var currentTheme='retail';
document.documentElement.setAttribute('data-facility',currentTheme);
var PIECES_RETAIL=PIECES,ORDER_RETAIL=ORDER.slice();
var HOTKEY_RETAIL=Object.assign({},HOTKEY);
var PIECES_ENTERPRISE=PIECES,ORDER_ENTERPRISE=ORDER.slice();
var HOTKEY_ENTERPRISE=Object.assign({},HOTKEY);

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
