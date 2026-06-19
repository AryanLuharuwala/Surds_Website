/* Surds — one-page sticker wall: pop stickers in one-by-one, light parallax */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onReady = (fn) => document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);

  onReady(() => {
    if (reduce) { document.body.classList.add('no-anim'); document.querySelectorAll('.sticker, .pop').forEach(s => s.classList.add('in')); }

    // scroll progress
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    const prog = () => {
      const h = document.documentElement;
      bar.style.width = Math.min(100, Math.max(0, (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100)) + '%';
    };
    window.addEventListener('scroll', prog, { passive: true }); prog();

    // sticker-by-sticker reveal: when a scene enters, pop its stickers in order
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const stickers = e.target.querySelectorAll('.sticker, .pop');
          stickers.forEach((s, i) => {
            const extra = parseFloat(s.dataset.delay || '0');
            setTimeout(() => s.classList.add('in'), i * 95 + extra);
          });
          io.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('.scene, .foot, .scroll-show').forEach((sc) => io.observe(sc));
      // any stickers outside a scene (e.g. dock) just show
      document.querySelectorAll('.sticker, .pop').forEach((s) => { if (!s.closest('.scene, .foot')) s.classList.add('in'); });
    } else if (!reduce) {
      document.querySelectorAll('.sticker, .pop').forEach((s) => s.classList.add('in'));
    }

    // scroll-show: sticky floor plan, add layers as side steps pass the centre
    const plan = document.querySelector('.plan');
    const steps = document.querySelectorAll('.scroll-show .step');
    if (plan && steps.length) {
      const layers = ['L-thermal', 'L-furniture', 'L-people', 'L-flow', 'L-activity', 'L-hvac', 'L-anomaly', 'L-edge'].map((id) => document.getElementById(id));
      const badge = document.querySelector('.plan-stage');
      const names = ['THE DRAWING', 'THERMAL', 'FURNITURE', 'PEOPLE', 'FLOW', 'ACTIVITY', 'HVAC', 'ANOMALY', 'LIVE TWIN'];
      let cur = -1;
      const setStage = (s) => {
        s = Math.max(0, Math.min(8, s));
        if (s === cur) return; cur = s;
        layers.forEach((el, i) => el && el.classList.toggle('on', i < s));
        plan.classList.toggle('live', s >= 8);
        if (badge) badge.textContent = 'Step 0' + (s + 1) + ' · ' + names[s];
        steps.forEach((st) => st.classList.toggle('active', (+st.dataset.stage || 0) === s));
      };
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setStage(+e.target.dataset.stage || 0); });
      }, { rootMargin: '-48% 0px -48% 0px', threshold: 0 });
      steps.forEach((st) => io2.observe(st));
      setStage(0);
      const forced = (location.search.match(/stage=(\d)/) || [])[1];
      if (forced != null) { io2.disconnect(); setStage(+forced); }
    }

    // light parallax for [data-par] (depth factor)
    const layers = Array.from(document.querySelectorAll('[data-par]'));
    if (layers.length && !reduce && window.matchMedia('(hover: hover)').matches) {
      let ticking = false;
      const move = () => {
        const y = window.scrollY;
        layers.forEach((l) => {
          const d = parseFloat(l.dataset.par || '0.1');
          l.style.transform = `translate3d(0, ${(-y * d).toFixed(1)}px, 0)`;
        });
        ticking = false;
      };
      window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(move); ticking = true; } }, { passive: true });
      move();
    }
  });
})();
