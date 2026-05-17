// Detect coarse pointer (touch device) once, used to skip mouse-only effects
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    // Close menu after tapping a link
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  // System explorer (article interactive)
  const explorer = document.querySelector('.system-explorer');
  if (explorer) {
    const stage = explorer.querySelector('svg');
    const legend = explorer.querySelector('.legend');
    const detail = explorer.querySelector('.detail');
    const data = {
      ahu: {
        name: 'Air-Handling Unit AHU-3',
        sub: 'Roof mechanical penthouse · East stack',
        body: 'Variable-air-volume unit with economizer and energy-recovery wheel. Supplies floors 4–7 of the north wing. Currently in occupied mode; discharge-air setpoint reset on outdoor-air temperature.',
        specs: {
          'Supply CFM': '24,000',
          'Disch. Temp': '55.2 °F',
          'Filter ΔP': '0.41 in. wc',
          'Service date': '2024-08-12',
        },
      },
      chiller: {
        name: 'Chiller CH-1',
        sub: 'Central plant · Subbasement',
        body: 'Water-cooled centrifugal, 600-ton nominal. Lead chiller in a 2N configuration with CH-2. Condenser water reset is enabled. IPLV trending at 0.43 kW/ton — within commissioning spec.',
        specs: {
          'Load': '78%',
          'CHWS': '44.0 °F',
          'CWS': '85.1 °F',
          'kW/ton': '0.49',
        },
      },
      vav: {
        name: 'VAV Zone 5-North',
        sub: 'Floor 5 · Open office',
        body: 'Pressure-independent VAV with hot-water reheat. Zone is currently slightly cool and the damper is at 28% — likely overcooled by adjacent perimeter zone. Flagged for re-balancing.',
        specs: {
          'Zone temp': '69.8 °F',
          'Setpoint': '72.0 °F',
          'Damper': '28%',
          'CO₂': '612 ppm',
        },
      },
      boiler: {
        name: 'Boiler B-1',
        sub: 'Central plant · Subbasement',
        body: 'Condensing modular boiler, natural-gas fired, 2.0 MMBH. Operating in low-fire with outdoor-air reset active. Combustion efficiency last verified 2024-10-04.',
        specs: {
          'Fire rate': '32%',
          'HWS': '142 °F',
          'Stack temp': '156 °F',
          'Efficiency': '96.1%',
        },
      },
      cooling: {
        name: 'Cooling Tower CT-1',
        sub: 'Roof · West deck',
        body: 'Crossflow induced-draft tower, 720 nominal tons. Variable-speed fan tied to condenser-water supply setpoint. Conductivity-based blowdown is active.',
        specs: {
          'Fan speed': '64%',
          'CWR': '95.4 °F',
          'CWS': '85.1 °F',
          'Approach': '7.6 °F',
        },
      },
    };

    function render(key) {
      const d = data[key];
      legend.innerHTML = `${d.name}<small>${d.sub}</small>`;
      const dl = Object.entries(d.specs).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      detail.innerHTML = `<p>${d.body}</p><dl>${dl}</dl>`;
      stage.querySelectorAll('.hot').forEach(h => h.classList.toggle('active', h.dataset.key === key));
    }

    stage.querySelectorAll('.hot').forEach(h => {
      h.addEventListener('click', () => render(h.dataset.key));
    });
    render('ahu');
  }

  // Scroll progress bar (top of page)
  const sp = document.createElement('div');
  sp.className = 'scroll-progress';
  document.body.appendChild(sp);
  const onScroll = () => {
    const h = document.documentElement;
    const pct = h.scrollTop / (h.scrollHeight - h.clientHeight);
    sp.style.width = `${Math.min(100, Math.max(0, pct * 100))}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Display headline: 'in' class triggers underline reveal + ensures words animate
  document.querySelectorAll('.display').forEach(d => {
    requestAnimationFrame(() => d.classList.add('in'));
  });

  // Magnetic buttons — gentle cursor attraction (skip on touch)
  if (!isTouch) document.querySelectorAll('.magnetic').forEach(el => {
    const strength = parseFloat(el.dataset.magnetic || '0.35');
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });

  // Mouse-parallax inside .parallax-stage — each .parallax-layer with data-depth moves
  if (!isTouch) document.querySelectorAll('.parallax-stage').forEach(stage => {
    const layers = stage.querySelectorAll('.parallax-layer');
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(l => {
        const depth = parseFloat(l.dataset.depth || '8');
        l.style.transform = `translate(${-x * depth}px, ${-y * depth}px)`;
      });
    });
    stage.addEventListener('mouseleave', () => {
      layers.forEach(l => { l.style.transform = ''; });
    });
  });

  // SVG draw-on-scroll: compute path length and animate stroke offset
  document.querySelectorAll('.draw-path').forEach(p => {
    try {
      const len = p.getTotalLength();
      p.style.setProperty('--len', len);
    } catch (_) {}
  });
  if ('IntersectionObserver' in window) {
    const drawIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); drawIO.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.draw-path').forEach(p => drawIO.observe(p));
  }

  // Scroll-reveal: fade + lift elements as they enter the viewport
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(el => io.observe(el));
  }

  // Spawn floating particles inside .particles containers
  document.querySelectorAll('.particles').forEach(container => {
    const count = parseInt(container.dataset.count || '14', 10);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 12}s`;
      p.style.animationDuration = `${10 + Math.random() * 8}s`;
      p.style.opacity = `${0.4 + Math.random() * 0.5}`;
      container.appendChild(p);
    }
  });

  // Live ticker: animate value flicker
  const tickerVals = document.querySelectorAll('.ticker-item .val[data-flicker]');
  tickerVals.forEach(v => {
    const base = parseFloat(v.dataset.base || v.textContent);
    const drift = parseFloat(v.dataset.drift || '0.3');
    const unit = v.dataset.unit || '';
    const decimals = parseInt(v.dataset.decimals || '1', 10);
    setInterval(() => {
      const next = base + (Math.random() - 0.5) * drift * 2;
      v.textContent = next.toFixed(decimals) + unit;
    }, 1800 + Math.random() * 1200);
  });

  // Tiny line chart in dashboard mock — render dynamically
  document.querySelectorAll('.chart').forEach(chart => {
    const w = 600, h = 140;
    const points = JSON.parse(chart.dataset.points || '[]');
    if (!points.length) return;
    const max = Math.max(...points), min = Math.min(...points);
    const path = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / (max - min || 1)) * (h - 20) - 10;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    const fill = `${path} L ${w} ${h} L 0 ${h} Z`;
    chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g${chart.dataset.id || ''}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#b87333" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#b87333" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fill}" fill="url(#g${chart.dataset.id || ''})"/>
      <path d="${path}" fill="none" stroke="#d99858" stroke-width="1.5"/>
    </svg>`;
  });
});
