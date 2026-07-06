var cardView=document.getElementById('card-view');
var cardOverlay=document.getElementById('card-overlay');

var _cvIo=null,_cvStickerIo=null;
function initCardView(){
  if(!cardView)return;
  /* scroll-show layer logic for card view */
  var cvPlan=document.getElementById('cv-plan');
  var cvLayers=['cv-L-thermal','cv-L-furniture','cv-L-people','cv-L-flow','cv-L-activity','cv-L-hvac','cv-L-anomaly','cv-L-edge'].map(function(id){return document.getElementById(id)});
  var cvBadge=document.getElementById('cv-plan-stage');
  var cvNames=['THE DRAWING','THERMAL','FURNITURE','PEOPLE','FLOW','ACTIVITY','HVAC','ANOMALY','LIVE TWIN'];
  var curCv=-1;
  function getCvSteps(){return cardView.querySelectorAll('.step')}
  function setCvStage(s){
    s=Math.max(0,Math.min(8,s));
    if(s===curCv)return;curCv=s;
    cvLayers.forEach(function(el,i){if(el)el.classList.toggle('on',i<s)});
    if(cvPlan)cvPlan.classList.toggle('live',s>=8);
    if(cvBadge)cvBadge.textContent='Step 0'+(s+1)+' · '+cvNames[s];
    getCvSteps().forEach(function(st){st.classList.toggle('active',(+st.dataset.stage||0)===s)});
    /* toggle overlay stickers per step */
    var overlays=document.getElementById('cv-overlays');
    if(overlays){
      var allPo=overlays.querySelectorAll('.po');
      for(var oi=0;oi<allPo.length;oi++){
        var el=allPo[oi],match=false;
        for(var si=0;si<=8;si++){if(el.classList.contains('po--s'+si)&&si===s)match=true;}
        el.classList.toggle('vis',match);
      }
    }
  }
  /* Re-observable step IO — can be disconnected & re-created on tab switch */
  function observeSteps(){
    if(_cvIo)_cvIo.disconnect();
    var steps=getCvSteps();
    if(!steps.length)return;
    function pickCurrent(){
      var mid=cardView.getBoundingClientRect().top+cardView.clientHeight/2,best=0,bestDist=Infinity;
      steps.forEach(function(st){
        var r=st.getBoundingClientRect(),center=(r.top+r.bottom)/2,d=Math.abs(center-mid);
        if(d<bestDist){bestDist=d;best=+st.dataset.stage||0}
      });
      setCvStage(best);
    }
    /* IntersectionObserver only tells us something crossed the band; pickCurrent()
       decides which step is authoritative by proximity to the viewport center,
       avoiding "last entry in the batch wins" when two steps briefly overlap. */
    _cvIo=new IntersectionObserver(function(){pickCurrent()},{root:cardView,rootMargin:'-40% 0px -40% 0px',threshold:0});
    steps.forEach(function(st){_cvIo.observe(st)});
    pickCurrent();
  }
  observeSteps();
  /* sticker pop-in for card view */
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function observeStickers(){
    if(_cvStickerIo)_cvStickerIo.disconnect();
    if(reduce||!('IntersectionObserver' in window))return;
    _cvStickerIo=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting)return;
        var stickers=e.target.querySelectorAll('.sticker:not(.po), .pop:not(.po)');
        stickers.forEach(function(s,i){
          var extra=parseFloat(s.dataset.delay||'0');
          setTimeout(function(){s.classList.add('in')},i*95+extra);
        });
        _cvStickerIo.unobserve(e.target);
      });
    },{root:cardView,threshold:0.12,rootMargin:'0px 0px -8% 0px'});
    cardView.querySelectorAll('.scene, .scroll-show').forEach(function(sc){_cvStickerIo.observe(sc)});
  }
  observeStickers();
  /* Expose reinit for tab switch */
  window.reinitCardIO=function(){curCv=-1;observeSteps();observeStickers();}
  /* scroll progress bar — listen on card-view's own scroll */
  var cvProg=cardView.querySelector('.card-scroll-progress');
  if(cvProg){
    cardView.addEventListener('scroll',function(){
      if(!cardOverlay||cardOverlay.style.display==='none')return;
      cvProg.style.width=Math.min(100,Math.max(0,(cardView.scrollTop/(cardView.scrollHeight-cardView.clientHeight||1))*100))+'%';
    },{passive:true});
  }
}

/* Restore saved dark/light mode so #card-close and .cv-backdrop match the Main page */
(function(){
  var saved=localStorage.getItem('surds-mode');
  if(saved)document.documentElement.setAttribute('data-mode',saved);
})();

initCardView();
