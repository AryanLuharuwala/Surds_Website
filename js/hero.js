/* Surds hero — real WebGL holographic building twin (three.js).
   Solid grey building -> scan -> green wireframe mesh -> sensors light up. Loops. */
import * as THREE from 'three';

const canvas = document.getElementById('hero-canvas');
const fallback = document.querySelector('.hero__fallback');
const phaseLabel = document.getElementById('hero-phase-label');

function showFallback() { if (canvas) canvas.style.display = 'none'; if (fallback) fallback.style.display = 'grid'; }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { showFallback(); }

if (renderer) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0.2, 0.35, 7.2);
  camera.lookAt(0, 0.1, 0);

  scene.add(new THREE.AmbientLight(0x4a4638, 1.1));
  const key = new THREE.DirectionalLight(0xe8d8c2, 1.4); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc54d2d, 0.7); rim.position.set(-5, 2, -4); scene.add(rim);

  const G = 0xc54d2d, G2 = 0xdb6a3f, AM = 0xe3b24a;
  const W = 2.2, H = 3.6, D = 1.8;
  const building = new THREE.Group();
  scene.add(building);

  // 1) solid stone building (the "before")
  const solidMat = new THREE.MeshStandardMaterial({ color: 0x4b4838, metalness: 0.1, roughness: 0.9, transparent: true, opacity: 1 });
  const solid = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), solidMat);
  building.add(solid);

  // 2) holographic glass tint
  const glassMat = new THREE.MeshBasicMaterial({ color: G, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), glassMat);
  building.add(glass);

  // 3) wireframe shell + floor plates (the "mesh")
  const wireMat = new THREE.LineBasicMaterial({ color: G2, transparent: true, opacity: 0 });
  const floorMat = new THREE.LineBasicMaterial({ color: G, transparent: true, opacity: 0 });
  const wires = new THREE.Group(); building.add(wires);
  wires.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), wireMat));
  const FLOORS = 6;
  for (let i = 1; i < FLOORS; i++) {
    const y = -H / 2 + (H / FLOORS) * i;
    const plate = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.012, D)), floorMat);
    plate.position.y = y; wires.add(plate);
  }
  // vertical mullions
  for (let mx = -1; mx <= 1; mx++) for (let mz = -1; mz <= 1; mz += 2) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx * W / 3, -H / 2, mz * D / 2), new THREE.Vector3(mx * W / 3, H / 2, mz * D / 2)]);
    wires.add(new THREE.Line(g, floorMat));
  }

  // faint additive aura (fake bloom)
  const auraMat = new THREE.MeshBasicMaterial({ color: G, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false });
  const aura = new THREE.Mesh(new THREE.BoxGeometry(W + 0.18, H + 0.2, D + 0.18), auraMat);
  building.add(aura);

  // glow sprite texture for sensors
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,225,1)'); g.addColorStop(0.25, 'rgba(219,106,63,0.9)');
    g.addColorStop(1, 'rgba(197,77,45,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // 4) sensors on the shell
  const sensorDefs = [
    [0, 1.45, D / 2, 0], [0.7, 1.5, D / 2, 0], [-0.6, 0.7, D / 2, 0], [0.55, 0.1, D / 2, 1],
    [-0.4, -0.5, D / 2, 0], [0.3, -1.1, D / 2, 0], [-0.8, -1.4, D / 2, 0], [0.8, -0.6, D / 2, 0],
    [W / 2, 0.9, 0.4, 0], [W / 2, -0.3, -0.5, 0], [-W / 2, 0.4, 0.3, 0], [-W / 2, -0.9, -0.4, 0],
    [0, 1.85, 0, 0], [0.4, 1.0, -D / 2, 0],
  ];
  const sensors = sensorDefs.map(([x, y, z, warn]) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const col = warn ? AM : G2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: col }));
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.set(0.32, 0.32, 0.32);
    grp.add(dot); grp.add(spr); grp.scale.setScalar(0.001);
    building.add(grp); return grp;
  });

  // 5) scan plane
  const scanMat = new THREE.MeshBasicMaterial({ color: G2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, D + 0.5), scanMat);
  scan.rotation.x = -Math.PI / 2; building.add(scan);

  // helpers
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // pointer parallax
  let px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
    ty = (e.clientY / window.innerHeight - 0.5) * 0.3;
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = r.width || canvas.clientWidth || window.innerWidth;
    const h = r.height || canvas.clientHeight || 700;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const LOOP = 11;
  const clock = new THREE.Clock();
  const phases = [[0, 'INITIALISING'], [0.18, 'SCANNING ▸'], [0.37, 'MESHING ▸'], [0.5, 'MAPPING SENSORS ▸'], [0.64, 'HOLOGRAPHIC TWIN · LIVE']];
  let lastPhase = '';

  function frame() {
    const t = clock.getElapsedTime();
    let p = reduce ? 0.72 : (t % LOOP) / LOOP;

    const solidO = Math.max(1 - smooth(0.18, 0.34, p), smooth(0.9, 1.0, p));
    const meshIn = smooth(0.26, 0.42, p) * (1 - smooth(0.9, 1.0, p));
    solidMat.opacity = solidO;
    solid.visible = solidO > 0.02;
    wireMat.opacity = meshIn; floorMat.opacity = meshIn * 0.75;
    glassMat.opacity = meshIn * 0.13; auraMat.opacity = meshIn * 0.1;

    // scan sweep
    const sp = smooth(0.18, 0.4, p);
    scan.position.y = H / 2 - sp * H;
    scanMat.opacity = Math.sin(Math.PI * sp) * 0.85 * (p < 0.45 ? 1 : 0);

    // sensors
    sensors.forEach((s, i) => {
      const rev = smooth(0.5 + i * 0.008, 0.6 + i * 0.008, p) * (1 - smooth(0.9, 1.0, p));
      const pulse = 1 + 0.16 * Math.sin(t * 3 + i * 1.3);
      s.scale.setScalar(rev * pulse);
      s.visible = rev > 0.01;
    });

    // rotation + parallax
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    building.rotation.y = (reduce ? -0.5 : t * 0.16) + px;
    building.rotation.x = -0.04 + py;

    // phase label
    let label = phases[0][1];
    for (const [thr, txt] of phases) if (p >= thr) label = txt;
    if (label !== lastPhase && phaseLabel) { phaseLabel.textContent = label; lastPhase = label; }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
