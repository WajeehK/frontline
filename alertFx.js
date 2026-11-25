// Frontline alert animations: code-drawn, top-down ISR-feed look over real satellite imagery.
// Symbolic and illustrative only. No video or footage assets.
const TAU = Math.PI * 2;
const cl = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const sg = (u, a, b) => cl((u - a) / (b - a));
const ez = t => (t = cl(t), t * t * (3 - 2 * t));
const eo = t => (t = cl(t), 1 - (1 - t) ** 3);
const ei = t => (t = cl(t), t * t);
const lp = (a, b, t) => a + (b - a) * t;
const bz = (a, c, b, t) => { const m = 1 - t; return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]; };
const bzA = (a, c, b, t) => { const m = 1 - t; return Math.atan2(2 * m * (c[1] - a[1]) + 2 * t * (b[1] - c[1]), 2 * m * (c[0] - a[0]) + 2 * t * (b[0] - c[0])); };
const hdg = a => Math.round(((a * 180 / Math.PI + 90) % 360 + 360) % 360);
const R = (F, a, b) => a + (b - a) * F.rnd();

// ---------------------------------------------------------------- sprites
let SPR = null;
function sprite(sz, stops, lumps) {
  const c = document.createElement('canvas'); c.width = c.height = sz; const g = c.getContext('2d'), r = sz / 2;
  const blob = (x, y, rr) => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, sz, sz); };
  if (lumps) { g.globalAlpha = .55; for (let i = 0; i < lumps; i++) { const a = Math.random() * TAU, d = Math.random() * r * .32; blob(r + Math.cos(a) * d, r + Math.sin(a) * d, r * (.5 + Math.random() * .18)); } }
  else blob(r, r, r);
  return c;
}
function sprites() {
  if (SPR) return SPR;
  SPR = {
    smoke: [0, 1, 2].map(() => sprite(96, [[0, 'rgba(52,50,48,1)'], [.5, 'rgba(46,45,44,.6)'], [1, 'rgba(40,40,40,0)']], 7)),
    dust: [0, 1, 2].map(() => sprite(96, [[0, 'rgba(204,190,166,1)'], [.55, 'rgba(178,165,145,.5)'], [1, 'rgba(150,140,120,0)']], 6)),
    steam: [0, 1, 2].map(() => sprite(64, [[0, 'rgba(240,244,248,1)'], [.55, 'rgba(225,232,238,.45)'], [1, 'rgba(220,228,235,0)']], 5)),
    fire: sprite(64, [[0, 'rgba(255,252,232,1)'], [.22, 'rgba(255,214,110,.95)'], [.5, 'rgba(255,110,30,.5)'], [1, 'rgba(140,30,0,0)']]),
    glow: sprite(128, [[0, 'rgba(255,255,255,1)'], [.14, 'rgba(255,246,214,.92)'], [.42, 'rgba(255,170,70,.35)'], [1, 'rgba(255,110,30,0)']]),
    cyan: sprite(64, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(170,240,255,.75)'], [1, 'rgba(80,200,255,0)']]),
    foam: sprite(48, [[0, 'rgba(255,255,255,.95)'], [.5, 'rgba(240,248,255,.45)'], [1, 'rgba(240,248,255,0)']]),
    scorch: sprite(96, [[0, 'rgba(14,11,9,.95)'], [.55, 'rgba(22,17,13,.6)'], [1, 'rgba(22,17,13,0)']], 5),
  };
  return SPR;
}

// ---------------------------------------------------------------- particle engine
export function makeFx(seed) {
  let x = (seed | 0) || 7;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  return { P: [], on: {}, rnd, shake: 0, wind: [22, -10], track: null, locks: [], phase: '', white: 0, glitch: 0, st: {}, water: false };
}
function add(F, p) { p.age = -(p.delay || 0); if (p.L == null) p.L = 1; if (p.a == null) p.a = 1; p.v = (F.rnd() * 3) | 0; if (F.P.length > 1100) F.P.splice(0, 60); F.P.push(p); return p; }
const once = (F, k) => F.on[k] ? false : (F.on[k] = 1, true);
const emitN = (F, r) => { let n = r | 0; if (F.rnd() < r - n) n++; return n; };
function step(F, dt) {
  const P = F.P, w = F.wind;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; p.age += dt; if (p.age < 0) continue;
    if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
    if (p.k === 'smoke' || p.k === 'dust' || p.k === 'steam') { p.vx = (p.vx || 0) + w[0] * .45 * dt; p.vy = (p.vy || 0) + w[1] * .45 * dt; }
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.s += (p.gs || 0) * dt; if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
    if (p.trail && F.rnd() < dt * p.trail) add(F, { k: 'smoke', x: p.x, y: p.y, s: p.s * 1.5, gs: 9, life: 2.2, a: .6, L: 1 });
    if (p.hot && F.rnd() < dt * 30 && p.age < p.life * .6) add(F, { k: 'fire', x: p.x, y: p.y, s: p.s * 1.6, life: .3, L: 2 });
  }
  F.P = P.filter(p => p.age < p.life);
}
function drawP(g, F, L) {
  const S = sprites();
  for (const p of F.P) {
    if (p.L !== L || p.age < 0) continue;
    const t = p.age / p.life; let a;
    switch (p.k) {
      case 'smoke': case 'dust': case 'steam': {
        a = p.a * Math.min(1, p.age / .22) * (1 - t) ** 1.2; if (a < .01) break;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = a; g.drawImage(S[p.k][p.v], p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); break;
      }
      case 'fire': { a = p.a * (1 - t) ** 1.4; const s = p.s * (1 - .45 * t); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(S.fire, p.x - s, p.y - s, s * 2, s * 2); break; }
      case 'glow': { a = p.a * (1 - t) ** 2; const s = p.s * (.55 + .7 * eo(t)); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(p.c === 'c' ? S.cyan : S.glow, p.x - s, p.y - s, s * 2, s * 2); break; }
      case 'spark': case 'tracer': {
        a = p.a * (1 - t); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
        g.strokeStyle = p.k === 'tracer' ? `rgba(255,230,140,${a})` : `rgba(255,${(190 + 60 * (1 - t)) | 0},${(140 * (1 - t)) | 0},${a})`;
        g.lineWidth = p.s; g.beginPath(); const q = p.k === 'tracer' ? .03 : .045; g.moveTo(p.x - p.vx * q, p.y - p.vy * q); g.lineTo(p.x, p.y); g.stroke(); break;
      }
      case 'debris': {
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, (1 - t) * 3);
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot || 0); const s = p.s * (1 - .4 * t);
        g.fillStyle = '#1b1917'; g.beginPath(); g.moveTo(s, 0); g.lineTo(s * .2, s * .8); g.lineTo(-s, s * .3); g.lineTo(-s * .6, -s * .7); g.lineTo(s * .4, -s * .6); g.closePath(); g.fill(); g.restore(); break;
      }
      case 'ring': {
        a = p.a * (1 - t) ** 1.5; const r = p.r0 + (p.r1 - p.r0) * eo(t);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.strokeStyle = `rgba(${p.c},${a})`; g.lineWidth = p.w * (1 - .6 * t);
        g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke(); break;
      }
      case 'scorch': { g.globalCompositeOperation = 'source-over'; g.globalAlpha = p.a * Math.min(1, p.age / .3); g.drawImage(S.scorch, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); break; }
      case 'foam': { a = p.a * (1 - t) ** 1.3 * Math.min(1, p.age / .15); g.globalCompositeOperation = 'source-over'; g.globalAlpha = a; g.drawImage(S.foam, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); break; }
      case 'slick': {
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = p.a * Math.min(1, p.age / 1.2);
        const s = Math.min(p.s, p.max || 140); g.save(); g.translate(p.x, p.y); g.rotate(p.rot || 0); g.scale(1, .55);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, 'rgba(8,10,14,.85)'); gr.addColorStop(.6, 'rgba(30,26,40,.55)'); gr.addColorStop(.85, 'rgba(90,70,120,.18)'); gr.addColorStop(1, 'rgba(10,12,16,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill(); g.restore(); break;
      }
    }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- emitters
function boom(F, x, y, sc = 1, o = {}) {
  const r = (a, b) => R(F, a, b);
  add(F, { k: 'glow', x, y, s: 120 * sc, life: .55, L: 2 });
  add(F, { k: 'glow', x, y, s: 55 * sc, life: 1.2, a: .85, L: 2 });
  for (let i = 0; i < 20; i++) { const a = r(0, TAU), v = r(15, 90) * sc; add(F, { k: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, s: r(12, 26) * sc, gs: 16 * sc, life: r(.5, 1.4), L: 2 }); }
  for (let i = 0; i < 36; i++) { const a = r(0, TAU), v = r(120, 320) * sc; add(F, { k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.6, s: r(.8, 1.9), life: r(.4, 1.1), L: 2 }); }
  for (let i = 0; i < (o.deb ?? 10); i++) { const a = r(0, TAU), v = r(50, 160) * sc; add(F, { k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.4, s: r(2, 5) * sc, life: r(1, 2.3), rot: r(0, 6), vr: r(-9, 9), trail: 16, hot: 1, L: 2 }); }
  add(F, { k: 'ring', x, y, r0: 6 * sc, r1: 160 * sc, w: 3.5 * sc, life: .6, c: '255,244,225', a: .95, L: 2 });
  if (!o.air) add(F, { k: 'ring', x, y, r0: 10 * sc, r1: 95 * sc, w: 14 * sc, life: 1.9, c: o.water ? '235,245,255' : '205,190,165', a: .3, L: 1 });
  if (o.water) {
    for (let i = 0; i < 26; i++) { const a = r(0, TAU), v = r(20, 75) * sc; add(F, { k: 'foam', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.2, s: r(6, 13) * sc, gs: 6, life: r(2, 4.5), a: .9, L: 0 }); }
    for (let i = 0; i < 6; i++) add(F, { k: 'steam', x: x + r(-8, 8) * sc, y: y + r(-8, 8) * sc, vx: r(-10, 10), vy: r(-10, 10), s: 22 * sc, gs: 22 * sc, life: r(2.5, 4), a: .75, L: 1 });
  } else if (!o.air) add(F, { k: 'scorch', x, y, s: 36 * sc, life: 999, a: .8, L: 1 });
  for (let i = 0; i < (o.air ? 7 : 16); i++) { const a = r(0, TAU), v = r(8, 45) * sc; add(F, { k: o.dust ? 'dust' : 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .8, delay: r(.05, .45), s: r(14, 28) * sc * (o.air ? .7 : 1), gs: 15 * sc * (o.air ? .6 : 1), life: r(3.5, 6.5), a: o.air ? .45 : .85, L: 1 }); }
  if (!o.air && !o.water) for (let i = 0; i < 8; i++) { const a = r(0, TAU), v = r(40, 90) * sc; add(F, { k: 'dust', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, s: r(10, 18) * sc, gs: 12 * sc, life: r(2, 3.5), a: .5, L: 1 }); }
  F.shake = Math.min(16, F.shake + 7 * sc);
}
function burn(F, x, y, k, dt, spread = 6) {
  if (k <= 0) return;
  const n = emitN(F, 34 * k * dt);
  for (let i = 0; i < n; i++) add(F, { k: 'fire', x: x + R(F, -spread, spread), y: y + R(F, -spread, spread), vx: R(F, -8, 8), vy: R(F, -8, 8), s: R(F, 6, 13) * Math.sqrt(k), gs: 6, life: R(F, .35, .8), a: .9, L: 2 });
  const m = emitN(F, 9 * k * dt);
  for (let i = 0; i < m; i++) add(F, { k: 'smoke', x: x + R(F, -spread, spread), y: y + R(F, -spread, spread), vx: R(F, -6, 6), vy: R(F, -6, 6), s: R(F, 10, 18) * Math.sqrt(k), gs: 15 * Math.sqrt(k), life: R(F, 4, 7), a: .8, L: 1 });
  if (F.rnd() < dt * 5) add(F, { k: 'glow', x, y, s: 34 * k, life: .4, a: .45, L: 2 });
}
function trailSeg(F, id, x, y, dt, o = {}) {
  const pr = F.st['tr' + id] || [x, y]; F.st['tr' + id] = [x, y];
  const d = Math.hypot(x - pr[0], y - pr[1]); const n = Math.min(40, emitN(F, Math.max((o.rate ?? 40) * dt, d / (o.gap || 3))));
  for (let i = 0; i < n; i++) { const f = F.rnd(); add(F, { k: o.k || 'steam', x: lp(pr[0], x, f) + R(F, -1, 1), y: lp(pr[1], y, f) + R(F, -1, 1), vx: R(F, -3, 3), vy: R(F, -3, 3), s: (o.s || 3.5) * R(F, .8, 1.25), gs: o.gs ?? 8, life: R(F, (o.life || 2.4) * .7, o.life || 2.4), a: o.a || .5, L: o.L ?? 1 }); }
}
function wake(F, x, y, ang, len, dt, spd = 1) {
  if (spd <= .02) return;
  const c = Math.cos(ang), s = Math.sin(ang), sx = x - c * len * .5, sy = y - s * len * .5;
  const n = emitN(F, 46 * spd * dt);
  for (let i = 0; i < n; i++) { const sd = F.rnd() < .5 ? -1 : 1, lat = R(F, 5, 13) * spd; add(F, { k: 'foam', x: sx + R(F, -2, 2), y: sy + R(F, -2, 2), vx: -s * sd * lat - c * 5, vy: c * sd * lat - s * 5, drag: .45, s: R(F, 3, 6) * len / 120, gs: 1.8, life: R(F, 3, 5.5), a: .75, L: 0 }); }
  if (F.rnd() < dt * 26 * spd) for (const sd of [-1, 1]) add(F, { k: 'foam', x: x + c * len * .47, y: y + s * len * .47, vx: -s * sd * 9 - c * 3, vy: c * sd * 9 - s * 3, drag: .6, s: len / 40, gs: 2, life: 2.2, a: .6, L: 0 });
}

// ---------------------------------------------------------------- vector assets (facing +x, origin = centre)
function poly(g, pts, sz, mirror) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * sz, y * sz) : g.moveTo(x * sz, y * sz)); if (mirror) for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] * sz, -pts[i][1] * sz); g.closePath(); }
function lin(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
function navLights(g, x, y, r, ms) { const on = ((ms / 450) | 0) % 2; g.fillStyle = on ? '#ff3b30' : '#6a1712'; g.beginPath(); g.arc(x, -y, r, 0, TAU); g.fill(); g.fillStyle = on ? '#3dff70' : '#135526'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function aMQ9(g, sz, sh, ms, o = {}) {
  const L = sz * .55, cr = sz * .075, part = o.part || 'all';
  if (part === 'all' || part === 'wl' || part === 'wr') for (const sd of part === 'all' ? [-1, 1] : part === 'wl' ? [-1] : [1]) {
    g.beginPath(); g.moveTo(L * .12, sd * sz * .03); g.lineTo(L * .07, sd * sz * .5); g.lineTo(L * .07 - cr * .55, sd * sz * .5); g.lineTo(L * .12 - cr, sd * sz * .03); g.closePath();
    if (sh) g.fillStyle = '#000'; else { const gr = g.createLinearGradient(L * .12, 0, L * .12 - cr, 0); gr.addColorStop(0, o.burnt ? '#6a6662' : '#f1f3f5'); gr.addColorStop(1, o.burnt ? '#3a3733' : '#a3aab1'); g.fillStyle = gr; }
    g.fill();
    if (!sh) { g.strokeStyle = 'rgba(40,46,52,.6)'; g.lineWidth = sz * .006; g.stroke(); g.beginPath(); g.moveTo(L * .12 - cr * .78, sd * sz * .22); g.lineTo(L * .07 - cr * .42, sd * sz * .47); g.stroke(); }
  }
  if (!sh && part === 'all') navLights(g, L * .07 - cr * .25, sz * .5, sz * .014, ms);
  if (part === 'all' || part === 'f') {
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-L * .36, sd * sz * .015); g.lineTo(-L * .52, sd * sz * .16); g.lineTo(-L * .6, sd * sz * .16); g.lineTo(-L * .47, sd * sz * .012); g.closePath(); g.fillStyle = sh ? '#000' : (o.burnt ? '#4a4744' : '#8f979e'); g.fill(); }
    g.beginPath(); g.moveTo(L * .5, 0); g.bezierCurveTo(L * .5, -sz * .055, L * .32, -sz * .058, L * .2, -sz * .044); g.lineTo(-L * .48, -sz * .018); g.lineTo(-L * .53, 0); g.lineTo(-L * .48, sz * .018); g.lineTo(L * .2, sz * .044); g.bezierCurveTo(L * .32, sz * .058, L * .5, sz * .055, L * .5, 0); g.closePath();
    g.fillStyle = sh ? '#000' : lin(g, -sz * .05, sz * .05, o.burnt ? ['#3c3936', '#77716b', '#2e2b28'] : ['#a3aab1', '#f6f7f8', '#868d94']); g.fill();
    if (!sh) {
      g.strokeStyle = 'rgba(30,36,42,.55)'; g.lineWidth = sz * .006; g.stroke();
      g.fillStyle = 'rgba(55,60,66,.55)'; g.beginPath(); g.ellipse(-L * .12, 0, sz * .035, sz * .013, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,44,50,.7)'; g.beginPath(); g.ellipse(L * .36, 0, sz * .03, sz * .02, 0, 0, TAU); g.fill();
      g.save(); g.translate(-L * .56, 0); g.fillStyle = 'rgba(30,30,30,.22)'; g.beginPath(); g.ellipse(0, 0, sz * .014, sz * .09, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(20,20,20,.7)'; g.lineWidth = sz * .012; const pa = Math.sin(ms * .07) * sz * .09; g.beginPath(); g.moveTo(0, pa); g.lineTo(0, -pa); g.stroke(); g.restore();
    }
  }
}
function aShahed(g, sz, sh, ms, o = {}) {
  poly(g, [[.5, 0], [.36, .045], [-.3, .5], [-.38, .5], [-.32, .13], [-.43, .07]], sz, true);
  g.fillStyle = sh ? '#000' : lin(g, -sz * .5, sz * .5, ['#8b8677', '#d1cab8', '#8b8677']); g.fill();
  if (sh) return;
  g.strokeStyle = 'rgba(40,38,32,.75)'; g.lineWidth = sz * .012; g.stroke();
  g.fillStyle = '#7a7466'; g.beginPath(); g.ellipse(.02 * sz, 0, sz * .44, sz * .05, 0, 0, TAU); g.fill();
  g.strokeStyle = '#2c2a26'; g.lineWidth = sz * .03; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-.29 * sz, sd * .5 * sz); g.lineTo(-.4 * sz, sd * .5 * sz); g.stroke(); }
  g.fillStyle = 'rgba(25,25,25,.35)'; g.beginPath(); g.ellipse(-.45 * sz, 0, sz * .02, sz * .12, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(.42 * sz, 0, sz * .03, 0, TAU); g.fill();
}
function aMissile(g, sz, sh, ms, o = {}) {
  const w = sz * (o.fat || .085);
  if (!sh && o.plume !== false) {
    const f = .8 + .22 * Math.sin(ms * .09) + .14 * Math.sin(ms * .23), pl = sz * (o.pl || .9) * f;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(-sz * .5, 0, -sz * .5 - pl, 0);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.18, o.blue ? 'rgba(160,235,255,.95)' : 'rgba(255,214,120,.95)'); gr.addColorStop(.6, o.blue ? 'rgba(60,160,255,.35)' : 'rgba(255,110,40,.4)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-sz * .5, -w * .45); g.quadraticCurveTo(-sz * .5 - pl * .45, -w * 1.25, -sz * .5 - pl, 0); g.quadraticCurveTo(-sz * .5 - pl * .45, w * 1.25, -sz * .5, w * .45); g.fill();
    const gs = w * 7; g.drawImage(sprites()[o.blue ? 'cyan' : 'glow'], -sz * .5 - gs / 2, -gs / 2, gs, gs); g.restore();
  }
  g.fillStyle = sh ? '#000' : '#565b61';
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(-sz * .3, sd * w * .5); g.lineTo(-sz * .5, sd * w * 2); g.lineTo(-sz * .5, sd * w * .5); g.fill();
    if (o.cruise) { g.beginPath(); g.moveTo(sz * .06, sd * w * .5); g.lineTo(-sz * .1, sd * w * 4.4); g.lineTo(-sz * .17, sd * w * 4.4); g.lineTo(-sz * .07, sd * w * .5); g.fill(); }
  }
  g.beginPath(); g.moveTo(-sz * .5, -w * .5); g.lineTo(sz * .3, -w * .5); g.quadraticCurveTo(sz * .48, -w * .45, sz * .5, 0); g.quadraticCurveTo(sz * .48, w * .45, sz * .3, w * .5); g.lineTo(-sz * .5, w * .5); g.closePath();
  g.fillStyle = sh ? '#000' : lin(g, -w * .5, w * .5, ['#858c93', o.col || '#f3f4f1', '#6c7278']); g.fill();
  if (!sh) { g.fillStyle = 'rgba(40,40,40,.75)'; g.fillRect(sz * .1, -w * .5, sz * .035, w); g.fillStyle = o.tip || '#3a3f44'; g.beginPath(); g.moveTo(sz * .41, -w * .33); g.quadraticCurveTo(sz * .5, 0, sz * .41, w * .33); g.fill(); }
}
const JET = [[.5, 0], [.36, .045], [.18, .07], [.06, .085], [-.02, .12], [-.2, .4], [-.27, .4], [-.24, .14], [-.31, .13], [-.44, .27], [-.5, .27], [-.47, .08], [-.53, .05], [-.53, 0]];
function aJet(g, sz, sh, ms, o = {}) {
  if (!sh && o.ab) { g.save(); g.globalCompositeOperation = 'lighter'; for (const sd of [-1, 1]) { const pl = sz * (.22 + .05 * Math.sin(ms * .2 + sd)); const gr = g.createLinearGradient(-sz * .53, 0, -sz * .53 - pl, 0); gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(.4, 'rgba(255,150,60,.5)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(-sz * .53 - pl / 2, sd * sz * .028, pl / 2, sz * .022, 0, 0, TAU); g.fill(); } g.restore(); }
  poly(g, JET, sz, true);
  g.fillStyle = sh ? '#000' : lin(g, -sz * .4, sz * .4, o.burnt ? ['#2b2927', '#5e5953', '#2b2927'] : ['#5d646b', '#a7afb6', '#5d646b']); g.fill();
  if (sh) return;
  g.strokeStyle = 'rgba(20,24,28,.75)'; g.lineWidth = sz * .008; g.stroke();
  g.fillStyle = '#4a5057'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-sz * .3, sd * sz * .05); g.lineTo(-sz * .46, sd * sz * .115); g.lineTo(-sz * .48, sd * sz * .095); g.lineTo(-sz * .36, sd * sz * .04); g.fill(); }
  g.strokeStyle = 'rgba(30,34,38,.5)'; g.beginPath(); g.moveTo(sz * .1, 0); g.lineTo(-sz * .45, 0); g.stroke();
  const cg = g.createLinearGradient(sz * .18, 0, sz * .36, 0); cg.addColorStop(0, '#2a2416'); cg.addColorStop(.6, '#b49c4c'); cg.addColorStop(1, '#3b3220');
  g.fillStyle = cg; g.beginPath(); g.ellipse(sz * .27, 0, sz * .09, sz * .03, 0, 0, TAU); g.fill();
  if (!o.clean) { g.fillStyle = '#e8e8e2'; for (const sd of [-1, 1]) g.fillRect(-sz * .2, sd * sz * .26 - sz * .01, sz * .16, sz * .02); }
  navLights(g, -sz * .235, sz * .4, sz * .012, ms);
}
function aB2(g, sz, sh, ms) {
  poly(g, [[.22, 0], [-.14, .5], [-.17, .47], [-.04, .31], [-.14, .19], [-.05, .075], [-.12, 0]], sz, true);
  g.fillStyle = sh ? '#000' : lin(g, -sz * .5, sz * .5, ['#24272b', '#4a4f56', '#24272b']); g.fill();
  if (sh) return;
  g.strokeStyle = 'rgba(190,200,212,.55)'; g.lineWidth = sz * .008; g.stroke();
  const hg = g.createLinearGradient(sz * .2, 0, -sz * .1, 0); hg.addColorStop(0, 'rgba(120,128,138,.5)'); hg.addColorStop(1, 'rgba(120,128,138,0)');
  g.fillStyle = hg; g.beginPath(); g.ellipse(sz * .04, 0, sz * .16, sz * .07, 0, 0, TAU); g.fill();
  for (const sd of [-1, 1]) { g.fillStyle = '#16181b'; g.beginPath(); g.ellipse(sz * .05, sd * sz * .11, sz * .045, sz * .018, sd * -.2, 0, TAU); g.fill(); g.fillStyle = '#7c838b'; g.fillRect(-sz * .09, sd * sz * .11 - sz * .015, sz * .05, sz * .03); }
  g.fillStyle = '#0f1113'; g.fillRect(sz * .14, -sz * .025, sz * .035, sz * .05);
}
function aTanker(g, sz, sh, ms, o = {}) {
  const b = sz * .18;
  g.beginPath(); g.moveTo(-sz * .5, -b / 2); g.lineTo(sz * .3, -b / 2); g.bezierCurveTo(sz * .45, -b / 2, sz * .5, -b * .22, sz * .5, 0); g.bezierCurveTo(sz * .5, b * .22, sz * .45, b / 2, sz * .3, b / 2); g.lineTo(-sz * .5, b / 2); g.quadraticCurveTo(-sz * .53, 0, -sz * .5, -b / 2); g.closePath();
  g.fillStyle = sh ? '#000' : '#26282b'; g.fill(); if (sh) return;
  g.save(); g.scale(.95, .84); g.fillStyle = lin(g, -b / 2, b / 2, o.burnt ? ['#2e2420', '#4c3a31', '#2e2420'] : ['#6b2f24', '#8c4636', '#6b2f24']); g.fill(); g.restore();
  g.strokeStyle = '#d9d2c2'; g.lineWidth = b * .045; g.beginPath(); g.moveTo(-sz * .32, 0); g.lineTo(sz * .4, 0); g.stroke();
  g.lineWidth = b * .03; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * sz * .012, -b * .34); g.lineTo(i * sz * .012, b * .34); g.stroke(); }
  g.fillStyle = '#c9c1ad'; for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) { g.beginPath(); g.arc(-sz * .28 + i * sz * .075, sd * b * .2, b * .055, 0, TAU); g.fill(); }
  g.fillStyle = '#3a5a3c'; g.fillRect(sz * .38, -b * .3, sz * .07, b * .6);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-sz * .455, -b * .36, sz * .13, b * .8);
  g.fillStyle = lin(g, -b * .4, b * .4, ['#cfcac0', '#f6f3ec', '#cfcac0']); g.fillRect(-sz * .47, -b * .42, sz * .13, b * .84);
  g.fillStyle = '#9fb6c4'; g.fillRect(-sz * .35, -b * .42, sz * .01, b * .84);
  g.fillStyle = '#1e1f21'; g.fillRect(-sz * .46, -b * .12, sz * .04, b * .24); g.fillStyle = '#b5332a'; g.fillRect(-sz * .455, -b * .12, sz * .012, b * .24);
}
function aWarship(g, sz, sh, ms, o = {}) {
  const b = sz * .125;
  g.beginPath(); g.moveTo(-sz * .5, -b * .42); g.lineTo(-sz * .47, -b / 2); g.lineTo(sz * .15, -b / 2); g.quadraticCurveTo(sz * .38, -b * .38, sz * .5, 0); g.quadraticCurveTo(sz * .38, b * .38, sz * .15, b / 2); g.lineTo(-sz * .47, b / 2); g.lineTo(-sz * .5, b * .42); g.closePath();
  g.fillStyle = sh ? '#000' : lin(g, -b / 2, b / 2, ['#5b636a', '#8d969e', '#5b636a']); g.fill(); if (sh) return;
  g.strokeStyle = 'rgba(20,24,28,.7)'; g.lineWidth = b * .04; g.stroke();
  g.fillStyle = '#4b5258'; g.beginPath(); g.arc(sz * .32, 0, b * .2, 0, TAU); g.fill(); g.strokeStyle = '#3b4146'; g.lineWidth = b * .06; g.beginPath(); g.moveTo(sz * .32, 0); g.lineTo(sz * .41, 0); g.stroke();
  g.fillStyle = '#3d4449'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(sz * .17 + i * b * .16, -b * .17 + j * b * .19, b * .13, b * .15);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-sz * .06, -b * .32, sz * .2, b * .72);
  g.fillStyle = lin(g, -b * .36, b * .36, ['#a4adb5', '#c9d0d6', '#a4adb5']); g.fillRect(-sz * .08, -b * .36, sz * .2, b * .72);
  g.fillStyle = '#6f7880'; g.fillRect(sz * .07, -b * .3, sz * .03, b * .6);
  g.fillStyle = '#2b3035'; g.fillRect(-sz * .16, -b * .14, sz * .05, b * .28);
  g.fillStyle = '#3d4449'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRect(-sz * .29 + i * b * .16, -b * .17 + j * b * .19, b * .13, b * .15);
  g.fillStyle = '#7d868e'; g.fillRect(-sz * .48, -b * .38, sz * .13, b * .76); g.strokeStyle = 'rgba(240,240,240,.8)'; g.lineWidth = b * .035; g.beginPath(); g.arc(-sz * .415, 0, b * .24, 0, TAU); g.stroke();
}
function aBoat(g, sz, sh) {
  g.beginPath(); g.moveTo(sz * .5, 0); g.quadraticCurveTo(sz * .2, -sz * .2, -sz * .5, -sz * .17); g.lineTo(-sz * .5, sz * .17); g.quadraticCurveTo(sz * .2, sz * .2, sz * .5, 0); g.closePath();
  g.fillStyle = sh ? '#000' : lin(g, -sz * .2, sz * .2, ['#b8bcb6', '#eeefea', '#b8bcb6']); g.fill(); if (sh) return;
  g.strokeStyle = 'rgba(30,30,30,.6)'; g.lineWidth = sz * .02; g.stroke();
  g.fillStyle = '#2f3a40'; g.fillRect(-sz * .1, -sz * .09, sz * .2, sz * .18);
  g.strokeStyle = '#222'; g.lineWidth = sz * .035; g.beginPath(); g.moveTo(sz * .2, 0); g.lineTo(sz * .4, 0); g.stroke();
}
function aHeli(g, sz, sh, ms) {
  g.fillStyle = sh ? '#000' : '#4d5447';
  g.fillRect(-sz * .62, -sz * .025, sz * .45, sz * .05);
  g.beginPath(); g.ellipse(0, 0, sz * .27, sz * .1, 0, 0, TAU); g.fill();
  g.fillRect(-sz * .64, -sz * .09, sz * .04, sz * .18);
  if (sh) return;
  g.fillStyle = lin(g, -sz * .1, sz * .1, ['#3c4238', '#6f7766', '#3c4238']); g.beginPath(); g.ellipse(0, 0, sz * .27, sz * .1, 0, 0, TAU); g.fill();
  g.fillStyle = '#20262a'; g.beginPath(); g.ellipse(sz * .17, 0, sz * .07, sz * .06, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(20,20,20,.18)'; g.beginPath(); g.arc(0, 0, sz * .5, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(25,25,25,.75)'; g.lineWidth = sz * .025; const ra = ms * .045;
  for (let i = 0; i < 4; i++) { const a = ra + i * TAU / 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * sz * .5, Math.sin(a) * sz * .5); g.stroke(); }
  g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, sz * .03, 0, TAU); g.fill();
}
function aTank(g, sz, sh, ms, o = {}) {
  const w = sz * .56;
  g.fillStyle = sh ? '#000' : '#2c2e25'; g.fillRect(-sz * .5, -w / 2, sz, w); if (sh) return;
  g.fillStyle = lin(g, -w * .35, w * .35, o.apc ? ['#6e6a52', '#948f72', '#6e6a52'] : ['#5a6145', '#7f8762', '#5a6145']); g.fillRect(-sz * .46, -w * .35, sz * .92, w * .7);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 8; i++) { g.fillRect(-sz * .48 + i * sz * .125, -w / 2, sz * .05, w * .14); g.fillRect(-sz * .48 + i * sz * .125, w / 2 - w * .14, sz * .05, w * .14); }
  if (o.apc) { g.fillStyle = '#4c4a38'; g.fillRect(-sz * .1, -w * .15, sz * .22, w * .3); g.strokeStyle = '#2a2a22'; g.lineWidth = sz * .03; g.beginPath(); g.moveTo(sz * .1, 0); g.lineTo(sz * .32, 0); g.stroke(); return; }
  g.save(); g.translate(-sz * .05, 0); g.rotate(o.tur || 0);
  g.strokeStyle = '#3e432f'; g.lineWidth = sz * .07; g.beginPath(); g.moveTo(0, 0); g.lineTo(sz * .78, 0); g.stroke();
  g.fillStyle = lin(g, -w * .3, w * .3, ['#4f563c', '#737b58', '#4f563c']); g.beginPath(); g.ellipse(0, 0, sz * .25, w * .3, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = sz * .015; g.stroke();
  g.restore();
}
function aCar(g, sz, sh, ms, o = {}) {
  const w = sz * .46, r = sz * .1;
  g.beginPath(); if (g.roundRect) g.roundRect(-sz / 2, -w / 2, sz, w, r); else g.rect(-sz / 2, -w / 2, sz, w);
  g.fillStyle = sh ? '#000' : (o.burnt ? '#1a1715' : (o.col || '#1f2226')); g.fill(); if (sh || o.burnt) return;
  g.fillStyle = '#5f6e7a'; g.fillRect(sz * .12, -w * .38, sz * .12, w * .76); g.fillRect(-sz * .38, -w * .36, sz * .08, w * .72);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-sz * .26, -w * .34, sz * .34, w * .68);
  if (o.lights) { const on = ((ms / 180) | 0) % 2; g.fillStyle = on ? '#ff2a2a' : '#2a6bff'; g.fillRect(-sz * .02, -w * .35, sz * .06, w * .32); g.fillStyle = on ? '#2a6bff' : '#ff2a2a'; g.fillRect(-sz * .02, w * .03, sz * .06, w * .32); }
  g.fillStyle = '#fff6d0'; g.fillRect(sz * .46, -w * .38, sz * .04, w * .16); g.fillRect(sz * .46, w * .22, sz * .04, w * .16);
}
// aircraft: shadow on the ground offset by altitude, airframe scaled slightly as if nearer the lens
function air(g, fn, x, y, ang, sz, alt, ms, o) {
  if (alt > 0) { g.save(); g.translate(x + alt * .12, y + alt * .18); g.rotate(ang); g.globalAlpha = .3; fn(g, sz, true, ms, o); g.restore(); }
  const s = 1 + alt * .0008; g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); fn(g, sz, false, ms, o); g.restore();
}
function ground(g, fn, x, y, ang, sz, ms, o) { g.save(); g.translate(x + 3, y + 4); g.rotate(ang); g.globalAlpha = .4; fn(g, sz, true, ms, o); g.restore(); g.save(); g.translate(x, y); g.rotate(ang); fn(g, sz, false, ms, o); g.restore(); }
// weapon or interceptor on a curved path with an exhaust trail; returns its state
function fly(F, g, L, u, dt, ms, m) {
  const t = sg(u, m.t0, m.t1); if (t <= 0) return null;
  const tt = m.ease ? m.ease(t) : t, p = bz(m.a, m.c, m.b, tt), an = bzA(m.a, m.c, m.b, Math.min(.999, Math.max(.001, tt))), done = t >= 1;
  if (!done) {
    if (L === 0 && m.trail !== false) trailSeg(F, m.id, p[0] - Math.cos(an) * m.sz * .55, p[1] - Math.sin(an) * m.sz * .55, dt, m.trail || { k: 'steam', s: 3.5, life: 2.8, a: .55 });
    if (L === 1) air(g, m.fn || aMissile, p[0], p[1], an, m.sz, m.alt ?? 50, ms, m.o);
  }
  return { x: p[0], y: p[1], a: an, t, done };
}

// ---------------------------------------------------------------- ground scenery
function compound(F, n = 7, rad = 70) {
  if (F.st.bld) return F.st.bld; const B = [], r0 = R(F, -.4, .4);
  for (let i = 0; i < n; i++) { const a = R(F, 0, TAU), d = i ? R(F, 26, rad) : 0; B.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * .8, w: R(F, 20, 42), h: R(F, 13, 26), r: r0 + R(F, -.06, .06), dmg: 0, s: R(F, 0, 1) }); }
  F.st.bld = B; return B;
}
function drawBld(g, B) {
  for (const b of B) {
    g.save(); g.translate(b.x, b.y); g.rotate(b.r);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(-b.w / 2 + 4, -b.h / 2 + 5, b.w, b.h);
    if (b.dmg) {
      g.fillStyle = '#3b342c'; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.fillStyle = '#1c1916';
      for (let i = 0; i < 7; i++) { const q = (b.s * 997 * (i + 1)) % 1, q2 = (b.s * 571 * (i + 3)) % 1; g.fillRect(-b.w / 2 + q * b.w * .85, -b.h / 2 + q2 * b.h * .8, b.w * .14, b.h * .18); }
    } else {
      g.fillStyle = lin(g, -b.h / 2, b.h / 2, ['#dedbd1', '#c2bfb5', '#a9a69c']); g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.strokeStyle = 'rgba(60,60,55,.65)'; g.lineWidth = .8; g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.beginPath(); g.moveTo(-b.w / 2, 0); g.lineTo(b.w / 2, 0); g.stroke();
      g.fillStyle = '#8c8a83'; g.fillRect(-b.w * .3, -b.h * .35, b.w * .12, b.h * .2); g.fillRect(b.w * .15, b.h * .12, b.w * .1, b.h * .2);
    }
    g.restore();
  }
}
const hitBld = (F, x, y, r) => { for (const b of F.st.bld || []) if (Math.hypot(b.x - x, b.y - y) < r + Math.max(b.w, b.h) / 2) b.dmg = 1; };
function road(g, pts, w, col) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = w + 4; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.lineCap = 'butt'; }
const along = (pts, t) => { const n = pts.length - 1, f = cl(t) * n, i = Math.min(n - 1, f | 0), k = f - i; const a = pts[i], b = pts[i + 1]; return [lp(a[0], b[0], k), lp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])]; };
const shipPt = (x, y, ang, off, lat = 0) => [x + Math.cos(ang) * off - Math.sin(ang) * lat, y + Math.sin(ang) * off + Math.cos(ang) * lat];
const PH = (F, u, list) => { for (const [t, s] of list) if (u < t) { F.phase = s; return; } F.phase = list[list.length - 1][1]; };

// ---------------------------------------------------------------- scenes (u 0..1; L 0 = logic + ground layer, L 1 = airborne layer)
const SCENES = {};
SCENES.drone_capture = (F, g, u, dt, L, ms) => {
  const Hp = [10, -50], A = [-310, -150], tf = sg(u, 0, .46);
  const dp = [lp(A[0], Hp[0], tf), lp(A[1], Hp[1], tf) + Math.sin(tf * 5) * 6], da = Math.atan2(Hp[1] - A[1], Hp[0] - A[0]) + Math.cos(tf * 5) * .07;
  const td = sg(u, .46, .93), ip = fly(F, g, L, u, dt, ms, { id: 'i', a: [210, 330], c: [230, -20], b: Hp, t0: .22, t1: .46, ease: t => t ** 1.4, sz: 30, alt: 100 });
  const pcs = [
    { id: 'f', part: 'f', x: Hp[0] + td * 55 + Math.sin(td * 9) * 14, y: Hp[1] + td * 115, a: da + td * TAU * 2.4, sc: 1 - .55 * td },
    { id: 'wl', part: 'wl', x: Hp[0] - 15 - td * 75, y: Hp[1] + td * 70, a: da - td * 9, sc: 1 - .6 * td },
    { id: 'wr', part: 'wr', x: Hp[0] + 20 + td * 80, y: Hp[1] + td * 45, a: da + td * 12, sc: 1 - .6 * td }];
  if (L === 0) {
    PH(F, u, [[.22, 'UAV TRACKED'], [.46, 'SAM LAUNCH · TRACKING'], [.58, 'INTERCEPT · HIT'], [.9, 'AIRFRAME BREAKUP'], [1.1, 'WRECK IMPACT']]);
    if (u < .46) { F.track = { name: 'MQ-9 REAPER · UAV', alt: 18400 - tf * 900, spd: 190, hdg: hdg(da) }; F.locks.push({ x: dp[0], y: dp[1], w: 100, lab: 'TRK 01 UAV', t: sg(u, .05, .28) }); }
    else F.track = { name: 'MQ-9 REAPER · UAV', alt: Math.max(0, 17500 * (1 - ei(td))), spd: 190 + td * 170, hdg: hdg(da + td * 9), lost: 1 };
    if (u >= .46 && once(F, 'hit')) boom(F, Hp[0], Hp[1], .9, { air: 1 });
    if (u >= .46 && u < .93) for (const p of pcs) { trailSeg(F, p.id, p.x, p.y, dt, { k: 'smoke', s: 4.5 * p.sc, gs: 8, life: 3.2, a: .55, gap: 2.5 }); if (p.id === 'f') burn(F, p.x, p.y, .5 * p.sc, dt, 3); }
    if (u >= .93 && once(F, 'splash')) { const p = pcs[0]; boom(F, p.x, p.y, .6, F.water ? { water: 1, deb: 4 } : { deb: 5 }); }
    if (u >= .93 && !F.water) burn(F, pcs[0].x, pcs[0].y, .6, dt, 5);
  } else {
    if (u < .46) air(g, aMQ9, dp[0], dp[1], da, 100, 150, ms);
    if (u >= .46 && u < .93) for (const p of pcs) air(g, aMQ9, p.x, p.y, p.a, 100 * p.sc, (1 - td) * 150, ms, { part: p.part, burnt: 1 });
    if (ip && !ip.done) F.locks.push({ x: ip.x, y: ip.y, w: 34, lab: 'SAM', t: 1, c: 'g' });
  }
};
SCENES.drone = (F, g, u, dt, L, ms) => {
  const B = compound(F);
  const D = [0, 1, 2, 3].map(i => { const A = [-330 - i * 30, -230 + i * 60], T = [(i - 1.5) * 30, (i % 2) * 18 - 8], t = sg(u, .02 + i * .03, .42 + i * .07), p = [lp(A[0], T[0], t), lp(A[1], T[1], t) + Math.sin(t * 8 + i) * 4]; return { i, T, t, x: p[0], y: p[1], a: Math.atan2(T[1] - A[1], T[0] - A[0]), alt: 120 * (1 - ei(sg(t, .7, 1))) }; });
  const kill = D[1], kt = .36, im = { id: 'int', a: [230, 330], c: [250, 0], b: [kill.x, kill.y], t0: .2, t1: kt, ease: t => t ** 1.3, sz: 26, alt: 90 };
  if (L === 0) {
    drawBld(g, B);
    PH(F, u, [[.24, 'UAV SWARM INBOUND'], [.42, 'AIR DEFENCE ENGAGING'], [.66, 'IMPACTS'], [1.1, 'FIRES ON SITE']]);
    const lead = D[0]; if (lead.t < 1) F.track = { name: 'SHAHED-136 · OWA UAV', alt: lead.alt * 16, spd: 100, hdg: hdg(lead.a) };
    for (const d of D) {
      if (d.i === 1 && u >= kt) continue;
      if (d.t > 0 && d.t < 1) { trailSeg(F, 'd' + d.i, d.x - Math.cos(d.a) * 26, d.y - Math.sin(d.a) * 26, dt, { k: 'steam', s: 2.2, life: 1.4, a: .3 }); F.locks.push({ x: d.x, y: d.y, w: 54, lab: 'UAV 0' + (d.i + 1), t: sg(u, .04 + d.i * .03, .2 + d.i * .03) }); }
      if (d.t >= 1 && once(F, 'h' + d.i)) { boom(F, d.T[0], d.T[1], 1.05); hitBld(F, d.T[0], d.T[1], 18); }
      if (d.t >= 1) burn(F, d.T[0], d.T[1], .8, dt, 7);
    }
    if (u >= kt && once(F, 'kill')) boom(F, kill.x, kill.y, .65, { air: 1 });
    fly(F, g, L, u, dt, ms, im);
  } else {
    fly(F, g, L, u, dt, ms, im);
    for (const d of D) if (d.t > 0 && d.t < 1 && !(d.i === 1 && u >= kt)) air(g, aShahed, d.x, d.y, d.a, 52, d.alt, ms);
  }
};
SCENES.missile = (F, g, u, dt, L, ms) => {
  const B = compound(F), mm = { id: 'm', a: [-340, -240], c: [-140, -230], b: [0, 0], t0: .04, t1: .5, sz: 64, alt: 60, o: { cruise: 1, pl: .8 }, trail: { k: 'steam', s: 4.5, life: 3.4, a: .55 } };
  const m = fly(F, g, L, u, dt, ms, mm);
  if (L === 0) {
    drawBld(g, B);
    PH(F, u, [[.3, 'INBOUND CRUISE MISSILE'], [.5, 'TERMINAL PHASE'], [.62, 'IMPACT'], [.76, 'SECONDARY DETONATIONS'], [1.1, 'BDA · STRUCTURE HIT']]);
    if (u >= .5 && once(F, 'h')) { boom(F, 0, 0, 1.7); hitBld(F, 0, 0, 30); }
    if (u >= .62 && once(F, 'h2')) { boom(F, 30, 20, .9); hitBld(F, 30, 20, 10); }
    if (u >= .71 && once(F, 'h3')) boom(F, -26, 24, .7);
    if (u >= .5) { burn(F, 0, 0, 1.3, dt, 12); if (u >= .62) burn(F, 30, 20, .7, dt); }
    if (u >= .5) F.locks.push({ x: 0, y: 0, w: 120, lab: 'DMPI · BDA', t: 1 });
    if (m && !m.done) { F.track = { name: 'CRUISE MISSILE', alt: m.t < .7 ? 150 : 150 + 1100 * Math.sin(sg(m.t, .7, 1) * Math.PI), spd: 480, hdg: hdg(m.a) }; F.locks.push({ x: m.x, y: m.y, w: 80, lab: 'TRK 01 MSL', t: sg(u, .06, .28) }); }
  }
};
SCENES.air = (F, g, u, dt, L, ms) => {
  const B = compound(F), P = (o, t) => [lp(-300, 330, t) + o * .55, lp(220, -260, t) + o * .8];
  const tj = sg(u, .03, .64), ang = Math.atan2(-480, 630), rel = .27, BT = [[-34, 14], [-12, 4], [12, -6], [34, -16]];
  if (L === 0) {
    drawBld(g, B);
    PH(F, u, [[.27, 'STRIKE PACKAGE INBOUND'], [.44, 'WEAPONS RELEASE'], [.66, 'IMPACTS'], [1.1, 'BDA']]);
    BT.forEach((p, i) => { const ti = .44 + i * .045; if (u >= ti && once(F, 'b' + i)) { boom(F, p[0], p[1], 1.05); hitBld(F, p[0], p[1], 14); } if (u >= ti) burn(F, p[0], p[1], .55, dt, 6); });
    if (tj > 0 && tj < 1) { const p = P(-30, tj); F.track = { name: 'F-35A · 2-SHIP', alt: 22000, spd: 520, hdg: hdg(ang) }; F.locks.push({ x: p[0], y: p[1], w: 90, lab: 'TRK 01 FTR', t: sg(u, .05, .22) }); }
    if (u > .46) F.locks.push({ x: 0, y: 0, w: 110, lab: 'DMPI', t: 1 });
  } else {
    BT.forEach((p, i) => { const ti = .44 + i * .045, t = sg(u, rel, ti); if (t > 0 && t < 1) { const r = P(i < 2 ? -30 : 30, sg(rel, .03, .64)); air(g, aMissile, lp(r[0], p[0], eo(t)), lp(r[1], p[1], eo(t)), ang, 18 * (1 - .3 * t), 160 * (1 - t), ms, { plume: false, fat: .13 }); } });
    if (tj > 0 && tj < 1) for (const o of [-30, 30]) { const p = P(o, tj); air(g, aJet, p[0], p[1], ang, 80, 200, ms, { ab: 1 }); }
  }
};
SCENES.artillery = (F, g, u, dt, L, ms) => {
  const pts = F.st.ap || (F.st.ap = Array.from({ length: 9 }, () => [R(F, -70, 70), R(F, -55, 55)])), dir = [-.85, -.53];
  if (L === 0) {
    PH(F, u, [[.15, 'INCOMING FIRE'], [.82, 'IMPACTS · FIRE FOR EFFECT'], [1.1, 'SPLASH PATTERN · CRATERING']]);
    pts.forEach((p, i) => { const ti = .15 + i * .075; if (u >= ti && once(F, 'a' + i)) boom(F, p[0], p[1], .7, { deb: 6, dust: 1 }); });
    if (u > .15) F.locks.push({ x: 0, y: 0, w: 190, lab: 'IMPACT ZONE', t: 1 });
  } else pts.forEach((p, i) => {
    const ti = .15 + i * .075, t = sg(u, ti - .045, ti); if (t <= 0 || t >= 1) return;
    const hx = p[0] + dir[0] * 320 * (1 - t), hy = p[1] + dir[1] * 320 * (1 - t);
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,220,150,.95)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(hx + dir[0] * 46, hy + dir[1] * 46); g.lineTo(hx, hy); g.stroke(); g.drawImage(sprites().glow, hx - 9, hy - 9, 18, 18); g.restore();
  });
};
SCENES.intercept = (F, g, u, dt, L, ms) => {
  const RV = [0, 1].map(i => ({ i, a: [-70 + i * 130, -420], c: [-50 + i * 110, -250], b: [-20 + i * 60, 40], t0: .02 + i * .05, t1: .62 + i * .05, k: .4 + i * .07 }));
  const pos = r => bz(r.a, r.c, r.b, sg(r.k, r.t0, r.t1));
  if (L === 0) {
    PH(F, u, [[.22, 'BALLISTIC THREAT · 2 TRACKS'], [.4, 'INTERCEPTORS AWAY'], [.6, 'KILL CONFIRMED'], [1.1, 'DEBRIS FALLING']]);
    RV.forEach(r => { if (u >= r.k && once(F, 'k' + r.i)) { const p = pos(r); boom(F, p[0], p[1], 1.1, { air: 1, deb: 16 }); add(F, { k: 'glow', x: p[0], y: p[1], s: 90, life: .8, c: 'c', L: 2 }); } });
  }
  RV.forEach(r => {
    if (u < r.k) {
      const m = fly(F, g, L, u, dt, ms, { id: 'r' + r.i, a: r.a, c: r.c, b: r.b, t0: r.t0, t1: r.t1, sz: 46, alt: 260, o: { fat: .16, pl: 1.3, tip: '#2a2a2a' }, trail: { k: 'steam', s: 6, life: 3.4, a: .7 } });
      if (m && L === 0) { F.locks.push({ x: m.x, y: m.y, w: 70, lab: 'TBM 0' + (r.i + 1), t: sg(u, .04, .2) }); if (r.i === 0) F.track = { name: 'BALLISTIC RV · TBM', alt: 90000 * (1 - .6 * m.t), spd: 3800, hdg: hdg(m.a) }; }
    }
    const p = pos(r), I = fly(F, g, L, u, dt, ms, { id: 'i' + r.i, a: [-150 + r.i * 300, 330], c: [-150 + r.i * 300, 0], b: p, t0: r.k - .2, t1: r.k, ease: t => t ** 1.2, sz: 30, alt: 200, o: { blue: 1 } });
    if (I && !I.done && L === 0) F.locks.push({ x: I.x, y: I.y, w: 36, lab: 'INT', t: 1, c: 'g' });
  });
};
SCENES.barrage = (F, g, u, dt, L, ms) => {
  const B = compound(F, 9, 90);
  const M = F.st.bm || (F.st.bm = Array.from({ length: 10 }, (_, i) => ({ i, a: [-360 - R(F, 0, 80), -300 + R(F, -60, 60)], c: [R(F, -200, -60), R(F, -260, -160)], b: [R(F, -90, 90), R(F, -60, 60)], t0: .02 + i * .035, t1: .4 + i * .04, ki: i % 3 === 1 ? .28 + i * .03 : 0 })));
  if (L === 0) {
    drawBld(g, B);
    PH(F, u, [[.22, 'MASS LAUNCH DETECTED'], [.42, 'SATURATION · DEFENCES ENGAGING'], [.85, 'MULTIPLE IMPACTS'], [1.1, 'AREA ABLAZE']]);
    M.forEach(m => {
      if (m.ki) { if (u >= m.ki && once(F, 'k' + m.i)) { const p = bz(m.a, m.c, m.b, sg(m.ki, m.t0, m.t1)); boom(F, p[0], p[1], .6, { air: 1, deb: 6 }); } return; }
      if (u >= m.t1 && once(F, 'h' + m.i)) { boom(F, m.b[0], m.b[1], 1); hitBld(F, m.b[0], m.b[1], 14); }
      if (u >= m.t1) burn(F, m.b[0], m.b[1], .5, dt, 6);
    });
  }
  let lk = 0;
  M.forEach(m => {
    if (m.ki && u >= m.ki) return;
    const f = fly(F, g, L, u, dt, ms, { id: 'm' + m.i, a: m.a, c: m.c, b: m.b, t0: m.t0, t1: m.t1, sz: 38, alt: 80, trail: { k: 'steam', s: 3, life: 2.6, a: .5 } });
    if (L === 0 && f && !f.done && lk < 4) { lk++; F.locks.push({ x: f.x, y: f.y, w: 44, lab: 'MSL ' + String(m.i + 1).padStart(2, '0'), t: 1 }); if (!F.track) F.track = { name: 'SALVO · ' + M.length + ' TRACKS', alt: 2000, spd: 900, hdg: hdg(f.a) }; }
    if (m.ki) fly(F, g, L, u, dt, ms, { id: 'i' + m.i, a: [120 + m.i * 10, 340], c: [140, 0], b: bz(m.a, m.c, m.b, sg(m.ki, m.t0, m.t1)), t0: m.ki - .16, t1: m.ki, sz: 24, alt: 80, o: { blue: 1 } });
  });
};
SCENES.tanker = (F, g, u, dt, L, ms) => {
  const sp = u < .5 ? 1 : 1 - sg(u, .5, .8), x = -70 + 110 * Math.min(u, .5) + 30 * eo(sg(u, .5, .8)), y = 14, ang = -.12 + .1 * ez(sg(u, .55, 1));
  const hp = shipPt(x, y, ang, 12, -8);
  const m = fly(F, g, L, u, dt, ms, { id: 'm', a: [360, -190], c: [180, -60], b: hp, t0: .28, t1: .5, sz: 48, alt: 12, o: { cruise: 1 }, trail: { k: 'steam', s: 3.5, life: 2.6, a: .5 } });
  if (L !== 0) return;
  wake(F, x, y, ang, 190, dt, sp);
  ground(g, aTanker, x, y, ang, 190, ms, { burnt: u > .7 });
  PH(F, u, [[.3, 'VESSEL UNDER WAY'], [.5, 'INBOUND THREAT'], [.62, 'HIT · MIDSHIPS'], [.82, 'FIRE ON BOARD'], [1.1, 'OIL SLICK SPREADING']]);
  F.track = { name: 'VLCC TANKER', alt: 0, spd: 13 * sp, hdg: hdg(ang) };
  F.locks.push({ x, y, w: 200, lab: 'VSL 01 · TANKER', t: sg(u, .04, .24) });
  if (m && !m.done) F.locks.push({ x: m.x, y: m.y, w: 60, lab: 'ASCM', t: sg(u, .3, .4) });
  if (u >= .5 && once(F, 'h')) boom(F, hp[0], hp[1], 1.3, { deb: 14 });
  if (u >= .5) { burn(F, hp[0], hp[1], 1.4, dt, 12); const p2 = shipPt(x, y, ang, -50, 4); if (u > .64) burn(F, p2[0], p2[1], .6, dt, 6); }
  if (u >= .58 && once(F, 'oil')) add(F, { k: 'slick', x: hp[0] + 10, y: hp[1] + 26, s: 10, gs: 26, max: 150, life: 999, a: .8, rot: ang, L: 0 });
};
SCENES.warship = (F, g, u, dt, L, ms) => {
  const sp = u < .5 ? 1 : 1 - .8 * sg(u, .5, .85), x = -90 + 200 * Math.min(u, .5) + 40 * eo(sg(u, .5, .9)), y = 20 - 40 * Math.min(u, .5), ang = -.2 + .12 * ez(sg(u, .55, 1));
  const hp = shipPt(x, y, ang, 30, -4), ciws = shipPt(x, y, ang, 10, 0);
  const mm = { id: 'm', a: [-360, -120], c: [-160, -150], b: hp, t0: .2, t1: .5, sz: 46, alt: 10, o: { cruise: 1 }, trail: { k: 'steam', s: 3.5, life: 2.6, a: .5 } };
  const m = fly(F, g, L, u, dt, ms, mm);
  if (L !== 0) return;
  wake(F, x, y, ang, 160, dt, sp * 1.5);
  ground(g, aWarship, x, y, ang, 160, ms);
  PH(F, u, [[.26, 'WARSHIP UNDER WAY'], [.38, 'ANTI-SHIP MISSILE INBOUND'], [.5, 'CIWS ENGAGING'], [.64, 'HIT · FORWARD'], [1.1, 'FIRE · DAMAGE CONTROL']]);
  F.track = { name: 'DDG · DESTROYER', alt: 0, spd: 28 * sp, hdg: hdg(ang) };
  F.locks.push({ x, y, w: 170, lab: 'VSL 01 · DDG', t: sg(u, .04, .22) });
  if (m && !m.done) {
    F.locks.push({ x: m.x, y: m.y, w: 56, lab: 'ASCM', t: sg(u, .22, .34) });
    if (u > .38) { const n = emitN(F, 70 * dt); for (let i = 0; i < n; i++) { const dx = m.x - ciws[0] + R(F, -14, 14), dy = m.y - ciws[1] + R(F, -14, 14), d = Math.hypot(dx, dy); add(F, { k: 'tracer', x: ciws[0], y: ciws[1], vx: dx / d * 700, vy: dy / d * 700, s: 1.4, life: d / 700, L: 2 }); } }
  }
  if (u >= .5 && once(F, 'h')) boom(F, hp[0], hp[1], 1.15, { deb: 14 });
  if (u >= .5) burn(F, hp[0], hp[1], 1.1, dt, 8);
};
SCENES.seizure = (F, g, u, dt, L, ms) => {
  const turn = ez(sg(u, .8, 1)), ang = -.25 - .5 * turn, x = 20 * turn, y = -6 * turn;
  const S0 = [[-300, 150], [280, 170], [240, -240]], OFF = [[0, -30], [-30, 30], [40, -26]];
  const boats = S0.map((s, i) => { const t = ez(sg(u, .04 + i * .04, .5 + i * .04)), tg = shipPt(x, y, ang, OFF[i][0], OFF[i][1]); return { i, x: lp(s[0], tg[0], t), y: lp(s[1], tg[1], t), a: t < 1 ? Math.atan2(tg[1] - s[1], tg[0] - s[0]) : ang, sp: t < 1 ? 1.4 : (turn > 0 ? .4 : 0) }; });
  const th = ez(sg(u, .18, .55)), deck = shipPt(x, y, ang, -20, 0), hx = lp(-320, deck[0], th), hy = lp(-280, deck[1] - 6, th);
  if (L === 1) { air(g, aHeli, hx, hy, th < 1 ? Math.atan2(deck[1] + 280, deck[0] + 320) : ang + Math.sin(ms * .001) * .1, 56, 70, ms); return; }
  wake(F, x, y, ang, 175, dt, turn * .5);
  ground(g, aTanker, x, y, ang, 175, ms);
  boats.forEach(b => { wake(F, b.x, b.y, b.a, 30, dt, b.sp); ground(g, aBoat, b.x, b.y, b.a, 30, ms); });
  PH(F, u, [[.22, 'FAST ATTACK CRAFT CLOSING'], [.55, 'HELO INSERTION'], [.8, 'BOARDING · VESSEL STOPPED'], [1.1, 'VESSEL DIVERTED']]);
  F.track = { name: 'TANKER · SEIZED', alt: 0, spd: turn ? 6 * turn : Math.max(0, 9 * (1 - sg(u, 0, .4))), hdg: hdg(ang) };
  F.locks.push({ x, y, w: 190, lab: 'VSL 01 · STOPPED', t: sg(u, .05, .25) });
  if (u < .5) boats.forEach(b => F.locks.push({ x: b.x, y: b.y, w: 34, lab: 'FAC 0' + (b.i + 1), t: 1, c: 'g' }));
  if (th >= 1 && u < .85 && F.rnd() < dt * 18) { const a = R(F, 0, TAU); add(F, { k: 'foam', x: deck[0] + Math.cos(a) * 60, y: deck[1] + Math.sin(a) * 60, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, s: 6, gs: 3, life: 2, a: .5, L: 0 }); }
  if (u > .55) { const n = Math.min(6, ((u - .55) / .04) | 0); g.fillStyle = '#ffd34d'; for (let i = 0; i < n; i++) { const p = shipPt(x, y, ang, -20 + (i % 3) * 9, ((i / 3) | 0) * 9 - 4); g.beginPath(); g.arc(p[0], p[1], 2.4, 0, TAU); g.fill(); } }
};
SCENES.nuclear_site = (F, g, u, dt, L, ms) => {
  const B = compound(F, 9, 85), V = [[-30, -18], [26, 12]];
  const P = (o, t) => [lp(-320, 340, t) + o * .6, lp(250, -250, t) + o * .8], tj = sg(u, .02, .62), ang = Math.atan2(-500, 660), rel = .24;
  if (L === 1) {
    V.forEach(([x, y], i) => { const t = sg(u, rel, .44 + i * .04); if (t > 0 && t < 1) { const r = P(i ? 35 : -35, sg(rel, .02, .62)); air(g, aMissile, lp(r[0], x, eo(t)), lp(r[1], y, eo(t)), ang, 26 * (1 - .35 * t), 240 * (1 - t), ms, { plume: false, fat: .14 }); } });
    if (tj > 0 && tj < 1) for (const o of [-35, 35]) { const p = P(o, tj); air(g, aB2, p[0], p[1], ang, 140, 300, ms); }
    return;
  }
  drawBld(g, B);
  V.forEach(([x, y]) => { g.fillStyle = '#2a2724'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.strokeStyle = '#bdb8ad'; g.lineWidth = 1.5; g.stroke(); });
  g.strokeStyle = '#1d1b19'; g.lineWidth = 6; g.beginPath(); g.arc(-70, 40, 10, Math.PI, TAU); g.stroke(); g.beginPath(); g.arc(70, -46, 10, Math.PI, TAU); g.stroke();
  PH(F, u, [[.24, 'B-2 INGRESS'], [.44, 'GBU-57 RELEASE'], [.53, 'PENETRATION'], [.7, 'INTERNAL DETONATION'], [1.1, 'BDA · VENTING']]);
  V.forEach(([x, y], i) => {
    const ti = .44 + i * .04;
    if (u >= ti && once(F, 'p' + i)) { add(F, { k: 'glow', x, y, s: 30, life: .3, L: 2 }); for (let j = 0; j < 10; j++) { const a = R(F, 0, TAU); add(F, { k: 'dust', x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, drag: 1.5, s: 8, gs: 10, life: 2.5, a: .7, L: 1 }); } }
    if (u >= ti + .1 && once(F, 'd' + i)) { boom(F, x, y, 1.3, { dust: 1, deb: 14 }); hitBld(F, x, y, 26); for (let j = 0; j < 24; j++) { const a = R(F, 0, TAU), v = R(F, 40, 120); add(F, { k: 'dust', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.2, s: R(F, 12, 22), gs: 14, life: R(F, 3, 6), a: .7, L: 1 }); } }
    if (u >= ti + .1) burn(F, x, y, .5, dt, 4);
    if (u > .5) F.locks.push({ x, y, w: 46, lab: 'DMPI ' + (i + 1), t: 1 });
  });
  if (tj > 0 && tj < 1) { const p = P(-35, tj); F.track = { name: 'B-2A SPIRIT · 2-SHIP', alt: 40000, spd: 480, hdg: hdg(ang) }; F.locks.push({ x: p[0], y: p[1], w: 150, lab: 'B-2A', t: 1, c: 'g' }); }
};
SCENES.facility = (F, g, u, dt, L, ms) => {
  const B = compound(F, 8, 75), TK = [[48, 34], [66, 30]];
  const ms2 = [{ id: 'a', a: [-350, -60], c: [-180, -120], b: [0, 0], t0: .1, t1: .42 }, { id: 'b', a: [-120, -400], c: [-60, -220], b: [-24, -16], t0: .18, t1: .52 }].map((m, i) => ({ m, f: fly(F, g, L, u, dt, ms, { ...m, sz: 56, alt: 50, o: { cruise: 1 }, trail: { k: 'steam', s: 4, life: 3, a: .55 } }) }));
  if (L !== 0) return;
  drawBld(g, B);
  TK.forEach(([x, y]) => { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x + 3, y + 4, 9, 0, TAU); g.fill(); g.fillStyle = u >= .62 ? '#2b2622' : '#e6e3da'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.strokeStyle = '#8a877f'; g.lineWidth = 1; g.stroke(); });
  PH(F, u, [[.42, 'INBOUND MISSILES · 2 TRACKS'], [.62, 'IMPACTS'], [.75, 'SECONDARY · FUEL STORAGE'], [1.1, 'FACILITY ABLAZE']]);
  [[0, 0, .42], [-24, -16, .52]].forEach(([x, y, t], i) => { if (u >= t && once(F, 'h' + i)) { boom(F, x, y, 1.3); hitBld(F, x, y, 20); } if (u >= t) burn(F, x, y, .9, dt, 9); });
  if (u >= .62 && once(F, 'tk')) boom(F, 57, 32, 1.5, { deb: 16 });
  if (u >= .62) burn(F, 57, 32, 1.5, dt, 14);
  if (u > .42) F.locks.push({ x: 10, y: 6, w: 150, lab: 'SITE · BDA', t: 1 });
  ms2.forEach(({ m, f }, i) => { if (f && !f.done) { F.locks.push({ x: f.x, y: f.y, w: 66, lab: 'MSL 0' + (i + 1), t: sg(u, m.t0, m.t0 + .12) }); if (!F.track) F.track = { name: 'CRUISE MISSILE', alt: 180, spd: 470, hdg: hdg(f.a) }; } });
};
SCENES.blast = (F, g, u, dt, L, ms) => {
  if (L !== 0) return;
  const B = compound(F, 8, 80), C = [[-300, 60], [300, -40], [40, 300]];
  drawBld(g, B);
  PH(F, u, [[.28, 'DETONATION'], [.5, 'SECONDARY BLASTS'], [.6, 'FIRE SPREADING'], [1.1, 'EMERGENCY RESPONSE']]);
  [[0, 0, .1, 1.6], [24, 18, .3, .85], [-22, 14, .42, .7]].forEach(([x, y, t, s], i) => { if (u >= t && once(F, 'h' + i)) { boom(F, x, y, s); hitBld(F, x, y, 16); } if (u >= t) burn(F, x, y, s * .7, dt, 8); });
  C.forEach((c, i) => { const t = ez(sg(u, .55 + i * .04, .95)); if (t <= 0) return; ground(g, aCar, lp(c[0], c[0] * .3, t), lp(c[1], c[1] * .3, t), Math.atan2(-c[1], -c[0]), 24, ms, { col: '#e9e9e4', lights: 1 }); });
  if (u > .1) F.locks.push({ x: 0, y: 6, w: 130, lab: 'EVENT · CAUSE UNCONFIRMED', t: 1 });
};
SCENES.port = (F, g, u, dt, L, ms) => {
  const Q = 18, cranes = [-70, -10, 50];
  const W3 = [{ id: 'a', a: [-360, -200], c: [-200, -60], b: [-10, 4], t0: .2, t1: .42 }, { id: 'b', a: [-100, -420], c: [-80, -200], b: [-60, -80], t0: .26, t1: .5 }, { id: 'c', a: [380, -200], c: [200, -20], b: [40, Q + 26], t0: .3, t1: .58 }]
    .map((m, i) => fly(F, g, L, u, dt, ms, { ...m, sz: 40, alt: 40, fn: i === 1 ? aShahed : aMissile, o: { cruise: 1 }, trail: i === 1 ? { k: 'steam', s: 2.5, life: 1.6, a: .3 } : undefined }));
  if (L !== 0) return;
  g.fillStyle = 'rgba(150,148,140,.55)'; g.fillRect(-600, -600, 1200, 600 + Q); g.fillStyle = '#d8d4c8'; g.fillRect(-600, Q - 3, 1200, 3);
  const cols = ['#b5402f', '#2f6fa8', '#d1a23a', '#3f8a53', '#e6e3da', '#7a4a8a'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { const x = -160 + c * 32, y = -110 + r * 24; g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 2, y + 3, 26, 16); g.fillStyle = cols[(r * 7 + c * 3) % 6]; g.fillRect(x, y, 26, 16); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(x, y, 26, 16); }
  ground(g, aTanker, 0, Q + 26, 0, 210, ms, { burnt: u > .6 });
  cranes.forEach((cx, i) => { const hit = i === 1 && u >= .42, tilt = hit ? .5 * eo(sg(u, .42, .6)) : 0; g.save(); g.translate(cx, Q - 6); g.rotate(tilt); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-7, -14, 18, 70); g.fillStyle = hit ? '#3a2e28' : '#d24a2b'; g.fillRect(-9, -18, 18, 14); g.fillRect(-3, -18, 6, 72); g.fillStyle = hit ? '#2a2420' : '#e2e2e2'; g.fillRect(-6, 36, 12, 8); g.restore(); });
  PH(F, u, [[.28, 'PORT · CARGO OPERATIONS'], [.42, 'INBOUND · 3 TRACKS'], [.62, 'IMPACTS · TERMINAL'], [1.1, 'FIRES ACROSS PORT']]);
  [[-10, 4, .42, 1.2], [-60, -80, .5, 1], [40, Q + 26, .58, 1.2]].forEach(([x, y, t, s], i) => { if (u >= t && once(F, 'h' + i)) boom(F, x, y, s, { deb: 12 }); if (u >= t) burn(F, x, y, s * .8, dt, 10); });
  W3.forEach((f, i) => { if (f && !f.done) F.locks.push({ x: f.x, y: f.y, w: 50, lab: i === 1 ? 'UAV' : 'MSL', t: 1 }); });
  if (u > .42) F.locks.push({ x: -10, y: -10, w: 200, lab: 'TERMINAL · BDA', t: 1 });
};
SCENES.troop = (F, g, u, dt, L, ms) => {
  const rd = [[-320, 200], [-120, 70], [40, 0], [180, -100], [340, -230]], base = lp(.05, .62, ez(u));
  if (L === 1) { for (const o of [-1, 1]) { const [x, y, a] = along(rd, base + .03); air(g, aHeli, x + o * 60, y - 40 + o * 30, a, 58, 120, ms); } return; }
  road(g, rd, 16, 'rgba(196,178,140,.85)');
  PH(F, u, [[.3, 'ARMOUR COLUMN DETECTED'], [.75, 'ADVANCING'], [1.1, 'FORMING UP']]);
  for (let i = 0; i < 7; i++) {
    const [x, y, a] = along(rd, base - i * .055), apc = i % 3 === 1;
    if (F.rnd() < dt * 26) add(F, { k: 'dust', x: x - Math.cos(a) * 18, y: y - Math.sin(a) * 18, vx: R(F, -8, 8), vy: R(F, -8, 8), s: 7, gs: 12, life: 2.8, a: .55, L: 1 });
    ground(g, aTank, x, y, a, 32, ms, { apc, tur: Math.sin(ms * .0008 + i) * .4 });
    if (i < 3) F.locks.push({ x, y, w: 42, lab: i ? 'VEH 0' + (i + 1) : 'LEAD · MBT', t: sg(u, .05 + i * .05, .2 + i * .05) });
  }
  F.track = { name: 'ARMOUR · 7 VEHICLES', alt: 0, spd: 22, hdg: hdg(along(rd, base)[2]) };
};
SCENES.cyber = (F, g, u, dt, L, ms) => {
  if (L !== 0) return;
  const N = F.st.cn || (F.st.cn = Array.from({ length: 11 }, (_, i) => ({ x: i ? R(F, -160, 160) : 0, y: i ? R(F, -150, 100) : 0 })));
  N.forEach(n => { n.d = Math.hypot(n.x, n.y); });
  const inf = n => sg(u, .25 + n.d / 300, .3 + n.d / 300);
  g.fillStyle = `rgba(0,10,6,${.35 * ez(sg(u, .55, .9))})`; g.fillRect(-700, -700, 1400, 1400);
  N.forEach((n, i) => N.forEach((m, j) => {
    if (j <= i || Math.hypot(n.x - m.x, n.y - m.y) > 140) return; const hot = inf(n) * inf(m) > .5;
    g.strokeStyle = hot ? 'rgba(255,70,60,.8)' : 'rgba(80,255,170,.5)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(m.x, m.y); g.stroke();
    const k = (ms / 900 + i * .37 + j * .21) % 1; g.fillStyle = hot ? '#ff6a55' : '#8affc6'; g.beginPath(); g.arc(lp(n.x, m.x, k), lp(n.y, m.y, k), 2.4, 0, TAU); g.fill();
  }));
  N.forEach((n, i) => {
    const t = inf(n), off = u > .6 + n.d / 600;
    if (off) { g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(n.x, n.y, 34, 0, TAU); g.fill(); }
    else { g.fillStyle = 'rgba(255,214,120,.85)'; for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(n.x + Math.cos(j * 1.7 + i) * 14, n.y + Math.sin(j * 2.3 + i) * 12, 1.5, 0, TAU); g.fill(); } }
    g.fillStyle = t > .5 ? '#ff4b3a' : '#3dffa0'; g.beginPath(); g.arc(n.x, n.y, 5.5, 0, TAU); g.fill();
    if (t > .5) { const p = (ms / 700 + i * .3) % 1; g.strokeStyle = `rgba(255,75,58,${1 - p})`; g.lineWidth = 1.5; g.beginPath(); g.arc(n.x, n.y, 6 + p * 22, 0, TAU); g.stroke(); }
    g.font = '7px ui-monospace,monospace'; g.fillStyle = 'rgba(170,255,210,.85)'; g.fillText((i ? 'NODE ' : 'SCADA ') + (((n.x * 97 + n.y * 31) >>> 0) % 65536).toString(16).toUpperCase(), n.x + 8, n.y - 6);
  });
  PH(F, u, [[.25, 'INTRUSION DETECTED'], [.45, 'LATERAL MOVEMENT'], [.62, 'SCADA COMPROMISED'], [1.1, 'GRID OFFLINE · OUTAGES']]);
  F.locks.push({ x: 0, y: 0, w: 40, lab: 'ENTRY NODE', t: 1 });
  F.glitch = u > .3 && u < .8 && ((ms / 90) | 0) % 6 === 0 ? 1 : 0;
};
SCENES.ceasefire = (F, g, u, dt, L, ms) => {
  if (L === 1) { for (const o of [-1, 1]) { const t = sg(u, .08, .55); if (t > 0 && t < 1) air(g, aJet, o * 40 + o * 60 * t, lp(20, -380, ei(t)), -Math.PI / 2 + o * .25, 72, 200, ms, { clean: 1 }); } return; }
  const k = 1 - sg(u, 0, .45);
  [[-50, 10], [30, -30], [60, 40]].forEach(([x, y]) => { if (once(F, 's' + x)) add(F, { k: 'scorch', x, y, s: 34, life: 999, a: .7, L: 1 }); burn(F, x, y, .8 * k, dt, 6); });
  const t = ez(sg(u, .35, .7));
  if (t > 0) { g.setLineDash([10, 7]); g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-260, -120); g.lineTo(lp(-260, 260, t), lp(-120, 90, t)); g.stroke(); g.setLineDash([]);
    if (t > .6) { g.font = '700 9px ui-monospace,monospace'; g.fillStyle = 'rgba(255,255,255,.92)'; g.save(); g.translate(-60, -42); g.rotate(Math.atan2(210, 520)); g.fillText('LINE OF CONTACT', 0, -6); g.restore(); } }
  [.5, .65, .8].forEach((t0, i) => { if (u >= t0 && once(F, 'r' + i)) add(F, { k: 'ring', x: 0, y: 0, r0: 10, r1: 220, w: 3, life: 2.4, c: '235,248,255', a: .8, L: 2 }); });
  PH(F, u, [[.3, 'GUNS FALL SILENT'], [.5, 'FORCES DISENGAGE'], [.75, 'LINE OF CONTACT AGREED'], [1.1, 'CEASEFIRE IN EFFECT']]);
};
SCENES.aircraft_down = (F, g, u, dt, L, ms) => {
  const Hp = [20, -60], A = [-330, -20], tf = sg(u, 0, .46), ev = sg(u, .28, .46);
  const jp = [lp(A[0], Hp[0], tf), lp(A[1], Hp[1], tf) + Math.sin(ev * 9) * 12 * ev], ja = Math.atan2(Hp[1] - A[1], Hp[0] - A[0]) + Math.sin(ev * 9) * .3 * ev;
  const td = sg(u, .46, .88), wr = [Hp[0] + td * 70 + Math.sin(td * 8) * 16, Hp[1] + td * 120], wa = ja + td * TAU * 2;
  const chute = [Hp[0] - 10 + 40 * sg(u, .5, 1), Hp[1] - 6 - 30 * sg(u, .5, 1)];
  const s = fly(F, g, L, u, dt, ms, { id: 's', a: [150, 340], c: [170, 40], b: Hp, t0: .18, t1: .46, ease: t => t ** 1.25, sz: 34, alt: 120 });
  if (L === 1) {
    if (u < .46) air(g, aJet, jp[0], jp[1], ja, 92, 220, ms, { ab: 1 });
    else if (u < .88) air(g, aJet, wr[0], wr[1], wa, 92 * (1 - .5 * td), 220 * (1 - td), ms, { burnt: 1, clean: 1 });
    if (u > .5) { g.save(); g.translate(chute[0], chute[1]); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f2ee' : '#e0702a'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 9, i * TAU / 8, (i + 1) * TAU / 8); g.fill(); } g.restore(); }
    return;
  }
  PH(F, u, [[.18, 'FIGHTER TRACKED'], [.28, 'SAM LAUNCH'], [.46, 'FLARES · EVADING'], [.52, 'HIT'], [.88, 'EJECTION · WRECK FALLING'], [1.1, 'WRECK IMPACT']]);
  if (u < .46) { F.track = { name: 'FIGHTER JET', alt: 24000, spd: 540, hdg: hdg(ja) }; F.locks.push({ x: jp[0], y: jp[1], w: 96, lab: 'TRK 01 FTR', t: sg(u, .04, .2) }); }
  else F.track = { name: 'FIGHTER JET', alt: Math.max(0, 23000 * (1 - ei(td))), spd: 540 - td * 200, hdg: hdg(wa), lost: 1 };
  if (s && !s.done) F.locks.push({ x: s.x, y: s.y, w: 34, lab: 'SAM', t: 1, c: 'g' });
  if (ev > 0 && ev < 1 && F.rnd() < dt * 22) { const fx = jp[0] - Math.cos(ja) * 30, fy = jp[1] - Math.sin(ja) * 30; add(F, { k: 'glow', x: fx, y: fy, vx: R(F, -60, 60) - Math.cos(ja) * 40, vy: R(F, -60, 60) - Math.sin(ja) * 40, drag: 1.5, s: 12, life: 1.2, a: 1, L: 2, trail: 24 }); }
  if (u >= .46 && once(F, 'hit')) boom(F, Hp[0], Hp[1], 1.1, { air: 1, deb: 16 });
  if (u >= .46 && u < .88) { trailSeg(F, 'w', wr[0], wr[1], dt, { k: 'smoke', s: 7 * (1 - .5 * td), gs: 12, life: 4, a: .8, gap: 2.5 }); burn(F, wr[0], wr[1], .7 * (1 - .4 * td), dt, 4); }
  if (u >= .88 && once(F, 'imp')) boom(F, wr[0], wr[1], 1.2, F.water ? { water: 1 } : {});
  if (u >= .88 && !F.water) burn(F, wr[0], wr[1], .9, dt, 8);
  if (u > .5) F.locks.push({ x: chute[0], y: chute[1], w: 30, lab: 'CHUTE', t: 1, c: 'g' });
};
SCENES.assassination = (F, g, u, dt, L, ms) => {
  const rd = [[-320, 80], [-120, 30], [60, 0], [340, -40]], ct = lp(.05, .46, eo(sg(u, 0, .55)));
  const [cx, cy, ca] = along(rd, ct), [ex, ey, ea] = along(rd, ct - .06), hit = u >= .56;
  const m = fly(F, g, L, u, dt, ms, { id: 'h', a: [-160, -320], c: [-40, -200], b: [cx, cy], t0: .44, t1: .56, ease: t => t ** 1.3, sz: 22, alt: 60, trail: { k: 'steam', s: 2.8, life: 2, a: .5 } });
  if (L === 1) { air(g, aMQ9, lp(-200, 260, u), -150 + 30 * u, .1, 80, 400, ms); return; }
  road(g, rd, 18, 'rgba(70,72,74,.92)'); g.setLineDash([8, 8]); g.strokeStyle = 'rgba(240,230,170,.6)'; g.lineWidth = 1; g.beginPath(); rd.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
  ground(g, aCar, cx, cy, ca, 28, ms, { burnt: hit });
  const k = hit ? sg(u, .56, .7) : 0; ground(g, aCar, ex - 6 * k, ey + 10 * k, ea + .7 * k, 28, ms, { col: '#2b2e33' });
  PH(F, u, [[.28, 'TARGET VEHICLE TRACKED'], [.44, 'PID CONFIRMED'], [.56, 'WEAPON AWAY'], [.7, 'IMPACT'], [1.1, 'BDA · VEHICLE DESTROYED']]);
  F.locks.push({ x: cx, y: cy, w: 46, lab: u < .28 ? 'VEH 01' : 'VEH 01 · PID', t: sg(u, .05, .3) });
  if (m && !m.done) F.locks.push({ x: m.x, y: m.y, w: 28, lab: 'AGM-114', t: 1, c: 'g' });
  if (!hit) F.track = { name: 'VEHICLE · SUV', alt: 0, spd: 38 * (1 - sg(u, .4, .55)), hdg: hdg(ca) };
  if (hit && once(F, 'h')) boom(F, cx, cy, .8, { deb: 10 });
  if (hit) burn(F, cx, cy, .7, dt, 5);
};
SCENES.nuclear_detonation = (F, g, u, dt, L, ms) => {
  const t0 = .12, t = sg(u, t0, 1);
  if (L === 0) {
    PH(F, u, [[t0, 'FLASH SENSORS · ALERT'], [.3, 'FIREBALL'], [.5, 'BLAST WAVE'], [.7, 'THERMAL FIRES'], [1.1, 'MUSHROOM CLOUD · FALLOUT RISK']]);
    if (u >= t0 && once(F, 'f')) {
      F.white = 1; F.shake = 26;
      add(F, { k: 'ring', x: 0, y: 0, r0: 20, r1: 700, w: 7, life: 2.4, c: '255,250,235', a: 1, L: 2 });
      add(F, { k: 'ring', x: 0, y: 0, r0: 30, r1: 520, w: 30, life: 3.6, c: '240,240,240', a: .5, L: 2 });
      add(F, { k: 'ring', x: 0, y: 0, r0: 20, r1: 300, w: 40, life: 5, c: '160,130,100', a: .5, L: 1 });
      F.st.fires = Array.from({ length: 16 }, () => { const a = R(F, 0, TAU), d = R(F, 90, 220); return [Math.cos(a) * d, Math.sin(a) * d * .8]; });
    }
    if (t > 0) {
      g.fillStyle = `rgba(20,10,4,${.55 * eo(t)})`; g.beginPath(); g.arc(0, 0, 150 * eo(sg(u, t0, .6)), 0, TAU); g.fill();
      if (u > .45) for (const [x, y] of F.st.fires) burn(F, x, y, .35, dt, 6);
    }
    return;
  }
  if (t <= 0) return;
  const rf = 18 + 82 * eo(sg(u, t0, .38)), heat = 1 - .75 * sg(u, .2, .7), S = sprites();
  if (u > .3) {
    const rc = rf * (.8 + .35 * sg(u, .3, 1));
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + ms * .00012 * (i % 2 ? 1 : -1), s = 46 + 30 * sg(u, .3, 1); g.globalAlpha = .9 * sg(u, .3, .5); g.drawImage(S.smoke[i % 3], Math.cos(a) * rc - s, Math.sin(a) * rc - s, s * 2, s * 2); }
    g.globalAlpha = .85 * sg(u, .4, .7); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - ms * .0002; g.drawImage(S.dust[i % 3], Math.cos(a) * rf * .4 - 50, Math.sin(a) * rf * .4 - 50, 100, 100); }
    g.globalAlpha = 1;
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rf);
  gr.addColorStop(0, `rgba(255,255,245,${heat})`); gr.addColorStop(.3, `rgba(255,${(200 * heat + 40) | 0},90,${.95 * heat})`); gr.addColorStop(.7, `rgba(220,${(90 * heat) | 0},20,${.75 * heat})`); gr.addColorStop(1, 'rgba(90,20,0,0)');
  g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rf, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
  F.locks.push({ x: 0, y: 0, w: 220, lab: 'GROUND ZERO', t: 1 });
};

// ---------------------------------------------------------------- frame
function corners(g, x, y, w, h, l) { g.beginPath(); g.moveTo(x, y + l); g.lineTo(x, y); g.lineTo(x + l, y); g.moveTo(x + w - l, y); g.lineTo(x + w, y); g.lineTo(x + w, y + l); g.moveTo(x + w, y + h - l); g.lineTo(x + w, y + h); g.lineTo(x + w - l, y + h); g.moveTo(x + l, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - l); g.stroke(); }
const fmtN = n => Math.round(Math.max(0, n)).toLocaleString('en-GB');
export const ALERT_KINDS = Object.keys(SCENES);
export function renderAlert(cv, st) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight;
  if (cv.width !== (W * dpr | 0) || cv.height !== (H * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  const g = cv.getContext('2d'), F = st.F, u = st.u, dt = Math.min(.05, Math.max(0, st.dt)), ms = st.ms;
  F.locks = []; F.track = null; F.glitch = 0; F.water = !!(st.map && st.map.water);
  F.shake *= Math.exp(-dt * 4);
  const S0 = Math.min(W, H * .62) / 400, z = 1 + .24 * ez(u), sc = S0 * z, cx = W / 2, cy = H * .45;
  const sx = (F.rnd() - .5) * F.shake * S0, sy = (F.rnd() - .5) * F.shake * S0;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#1a2630'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(cx + sx, cy + sy); g.scale(sc, sc); g.rotate(.03 * ez(u));
  const mp = st.map;
  if (mp) {
    const ext = Math.max(W / 2, cy, H - cy) / sc * 1.12, mm = Math.min(mp.ox, mp.width - mp.ox, mp.oy, mp.height - mp.oy), k = Math.max(1, ext / mm);
    g.imageSmoothingQuality = 'high'; g.drawImage(mp, -mp.ox * k, -mp.oy * k, mp.width * k, mp.height * k);
  } else { g.strokeStyle = 'rgba(140,180,190,.14)'; g.lineWidth = 1; for (let v = -600; v <= 600; v += 40) { g.beginPath(); g.moveTo(v, -600); g.lineTo(v, 600); g.moveTo(-600, v); g.lineTo(600, v); g.stroke(); } }
  const fn = SCENES[st.kind] || SCENES.blast;
  step(F, dt);
  drawP(g, F, 0); fn(F, g, u, dt, 0, ms); drawP(g, F, 1); fn(F, g, u, dt, 1, ms); drawP(g, F, 2);
  const m = g.getTransform(); g.restore();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (F.white > 0) { g.fillStyle = `rgba(255,250,240,${F.white})`; g.fillRect(0, 0, W, H); F.white = Math.max(0, F.white - dt * .7); }
  if (F.glitch) for (let i = 0; i < 4; i++) { const y = F.rnd() * H, h = 6 + F.rnd() * 26; g.drawImage(cv, 0, y * dpr, cv.width, h * dpr, (F.rnd() - .5) * 40, y, W, h); }
  if (st.flir) { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'soft-light'; g.fillStyle = '#404040'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * .35, cx, cy, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,.05)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  // ---- HUD
  const mono = (s, w = 500) => `${w} ${s}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const top = H * .26, bot = H * .6, hc = st.flir ? 'rgba(235,235,235,' : 'rgba(205,240,215,';
  g.strokeStyle = hc + '.5)'; g.lineWidth = 1.5; corners(g, 12, top, W - 24, bot - top, 18);
  g.strokeStyle = hc + '.75)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.moveTo(cx - 30, cy); g.lineTo(cx - 9, cy); g.moveTo(cx + 9, cy); g.lineTo(cx + 30, cy); g.moveTo(cx, cy - 30); g.lineTo(cx, cy - 9); g.moveTo(cx, cy + 9); g.lineTo(cx, cy + 30); g.stroke();
  for (const k of F.locks) {
    const p = m.transformPoint(new DOMPoint(k.x, k.y)), x = p.x / dpr, y = p.y / dpr, s = Math.hypot(m.a, m.b) / dpr;
    const t = ez(k.t), w = Math.max(22, k.w * s) * (1 + (1 - t) * 1.3) / 2, locked = k.t >= 1;
    const col = k.c === 'g' ? 'rgba(120,255,170,' : locked ? 'rgba(255,72,52,' : 'rgba(255,205,90,';
    g.strokeStyle = col + '.95)'; g.lineWidth = locked ? 2 : 1.5; corners(g, x - w, y - w, w * 2, w * 2, Math.max(6, w * .35));
    if (locked && k.c !== 'g') { g.lineWidth = 1; g.beginPath(); g.moveTo(x - w - 6, y); g.lineTo(x - w + 4, y); g.moveTo(x + w - 4, y); g.lineTo(x + w + 6, y); g.stroke(); }
    g.font = mono(10, 700); g.fillStyle = col + '.95)'; g.textAlign = 'left';
    g.fillText(k.lab + (k.c === 'g' ? '' : locked ? (((ms / 400) | 0) % 2 ? '  ◆ LOCK' : '  ◇ LOCK') : '  ACQ…'), x - w, y - w - 5);
  }
  g.textAlign = 'left';
  if (F.track) {
    const tr = F.track, rows = [tr.name, 'ALT  ' + fmtN(tr.alt) + ' FT', 'SPD  ' + fmtN(tr.spd) + ' KT', 'HDG  ' + String(tr.hdg).padStart(3, '0') + '°'];
    if (tr.lost) rows.push('SIG  LOST');
    g.font = mono(10, 800); const bw = Math.max(140, g.measureText(tr.name).width + 16);
    const by = bot - 38 - rows.length * 14;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(18, by, bw, rows.length * 14 + 8);
    rows.forEach((r, i) => { g.font = mono(i ? 10.5 : 10, i ? 500 : 800); g.fillStyle = i === 4 ? 'rgba(255,90,70,.95)' : i ? hc + '.95)' : 'rgba(255,205,90,.95)'; g.fillText(r, 25, by + 14 + i * 14); });
  }
  if (F.phase) {
    g.font = mono(11, 800); const tx = '▶ ' + F.phase, tw = g.measureText(tx).width;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W - 18 - tw - 12, bot - 30, tw + 12, 20); g.fillStyle = 'rgba(255,205,90,.98)'; g.textAlign = 'right'; g.fillText(tx, W - 24, bot - 16);
  }
  g.textAlign = 'left'; g.font = mono(9.5); g.fillStyle = hc + '.85)';
  const sec = Math.floor(ms / 1000), fr = Math.floor((ms % 1000) / (1000 / 24));
  g.fillText((st.flir ? 'FLIR · WHT' : 'EO · DAY'), 22, bot - 16);
  g.fillText('● REC  T+' + String(sec).padStart(2, '0') + ':' + String(fr).padStart(2, '0') + '   ' + (st.coord || 'NO FIX'), 22, top - 8);
  if (!mp) { g.textAlign = 'center'; g.fillText('ACQUIRING IMAGERY…', cx, cy + 46); g.textAlign = 'left'; }
}
