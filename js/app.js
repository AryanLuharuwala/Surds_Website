/* Surds — shared site interactions (no three.js here) */
(function () {
  'use strict';
  const onReady = (fn) =>
    document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);

  onReady(() => {
    // Mobile nav
    const toggle = document.querySelector('.nav__toggle');
    const links = document.querySelector('.nav__links');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
      links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));
    }

    // Scroll progress
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    const onScroll = () => {
      const h = document.documentElement;
      const pct = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
      bar.style.width = Math.min(100, Math.max(0, pct * 100)) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Scroll reveal
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
        { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
      );
      document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }

    // Live value flicker
    document.querySelectorAll('[data-flicker]').forEach((v) => {
      const base = parseFloat(v.dataset.base || v.textContent);
      const drift = parseFloat(v.dataset.drift || '0.3');
      const unit = v.dataset.unit || '';
      const dec = parseInt(v.dataset.decimals || '1', 10);
      if (Number.isNaN(base)) return;
      setInterval(() => {
        const next = base + (Math.random() - 0.5) * drift * 2;
        v.textContent = next.toFixed(dec) + unit;
      }, 1700 + Math.random() * 1300);
    });

    // Magnetic buttons (precise pointers only)
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) document.querySelectorAll('.magnetic').forEach((el) => {
      const s = parseFloat(el.dataset.magnetic || '0.25');
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * s}px, ${(e.clientY - r.top - r.height / 2) * s}px)`;
      });
      el.addEventListener('mouseleave', () => (el.style.transform = ''));
    });
  });
})();
