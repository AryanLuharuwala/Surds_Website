/* Surds — shared site interactions (no three.js here) */
(function () {
  'use strict';
  const onReady = (fn) =>
    document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);

  // --- Theme: apply saved/preferred ASAP to avoid a flash ---
  const root = document.documentElement;
  const MOON = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  const SUN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
  const applyTheme = (t) => {
    root.setAttribute('data-theme', t);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.innerHTML = (t === 'light' ? MOON + ' DARK' : SUN + ' LIGHT');
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
  };
  let theme = 'dark';
  try { theme = localStorage.getItem('surds-theme') || 'dark'; } catch (e) {}
  const q = (location.search.match(/theme=(light|dark)/) || [])[1] || (location.hash === '#light' ? 'light' : '');
  if (q) theme = q;
  root.setAttribute('data-theme', theme);

  onReady(() => {
    // Inject theme toggle into the nav
    const navIn = document.querySelector('.nav__in');
    const cta = document.querySelector('.nav__cta');
    if (navIn) {
      const tg = document.createElement('button');
      tg.className = 'theme-toggle';
      tg.setAttribute('aria-label', 'Toggle light / dark');
      tg.innerHTML = theme === 'light' ? MOON + ' DARK' : SUN + ' LIGHT';
      tg.addEventListener('click', () => {
        theme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('surds-theme', theme); } catch (e) {}
        applyTheme(theme);
      });
      if (cta && cta.parentNode === navIn) navIn.insertBefore(tg, cta.nextSibling);
      else navIn.appendChild(tg);
    }

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
