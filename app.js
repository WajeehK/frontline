// Frontline — live conflict tracker. Data: data/*.json written by GitHub Actions (scripts/fetch.py). No AI anywhere.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
const DESK = matchMedia('(min-width: 900px)');
const KIN = new Set(['missile', 'drone', 'air', 'naval', 'ground']);
const HALF = new Set(['deploy', 'threat', 'cyber', 'sanctions']);
const W5 = [0, 1, 2, 4, 8, 16];
const TY = {
  missile: ['MISSILE', '🚀', '#ff6a2b'], drone: ['DRONE', '🛩️', '#ff9a3c'], air: ['AIRSTRIKE', '✈️', '#ff5a3a'], naval: ['NAVAL', '⚓', '#4fd1ff'],
  ground: ['GROUND', '💥', '#ff7b54'], cyber: ['CYBER', '🖥️', '#3dff9a'], deploy: ['DEPLOYMENT', '🛫', '#8fb8ff'], sanctions: ['SANCTIONS', '💲', '#ffd166'],
  threat: ['THREAT', '⚠️', '#ffc04d'], statement: ['STATEMENT', '🗣️', '#c9ced6'], diplomacy: ['DIPLOMACY', '🕊️', '#ffffff'],
};
const GLY = { air: '✈', naval: '⚓', nuclear: '☢', capital: '★', base: '■', oil: '◆', area: '●', city: '●' };
const ago = ts => { const m = Math.round((Date.now() / 1000 - ts) / 60); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const hm = ts => new Date(ts * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const bust = () => '?t=' + Math.floor(Date.now() / 60000);
async function getJSON(u) { const r = await fetch(u + bust(), { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }

// ---------------------------------------------------------------- state
const S = { TH: null, tid: null, th: null, geo: null, events: [], clusters: [], index: null, mode: 'loop', T: null, seen: new Set(), queue: [], qi: 0, nextAt: 0, filter: 'all', speed: 1, playing: false, userAt: -1e9, focus: null };

// ---------------------------------------------------------------- three setup
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, DESK.matches ? 2 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.028);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
controls.minDistance = 2.5; controls.maxDistance = 30; controls.maxPolarAngle = 1.25; controls.minPolarAngle = 0.12;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.addEventListener('start', () => { S.userAt = performance.now(); });
const world = new THREE.Group(); scene.add(world);

function tex(draw, n = 64) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const GLOW = tex((g, n) => { const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
const SMOKE = tex((g, n) => { for (let i = 0; i < 9; i++) { const x = n / 2 + (Math.random() - .5) * n * .35, y = n / 2 + (Math.random() - .5) * n * .35, rr = n * (.18 + Math.random() * .2); const r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(200,200,205,.35)'); r.addColorStop(1, 'rgba(200,200,205,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); } }, 128);
const DOVE = tex((g, n) => { // simple vector dove (white)
  g.translate(n / 2, n / 2); g.scale(n / 128, n / 128); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath();
  g.moveTo(-40, 6); g.quadraticCurveTo(-10, -2, 6, 4); g.quadraticCurveTo(-6, -38, 30, -46); g.quadraticCurveTo(18, -20, 22, 0); g.quadraticCurveTo(36, 2, 46, -6);
  g.quadraticCurveTo(44, 8, 30, 12); g.quadraticCurveTo(14, 26, -8, 22); g.lineTo(-30, 30); g.lineTo(-24, 18); g.closePath(); g.fill();
}, 128);
const FLAG = tex((g, n) => { g.fillStyle = '#ddd'; g.fillRect(n * .18, n * .1, n * .05, n * .8); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.beginPath(); g.moveTo(n * .23, n * .12); g.quadraticCurveTo(n * .5, n * .05, n * .82, n * .16); g.lineTo(n * .82, n * .46); g.quadraticCurveTo(n * .5, n * .36, n * .23, n * .44); g.fill(); }, 128);
const sprite = (map, color, size, add = true) => { const m = new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); const s = new THREE.Sprite(m); s.scale.setScalar(size); return s; };

// ---------------------------------------------------------------- terrain
let terrain = null, heights = null, GW = 0, GH = 0, MW = 20, MH = 20, K = 1, LATC = 0, LONC = 0, BB = null;
const proj = (lat, lon) => new THREE.Vector3((lon - LONC) * Math.cos(LATC * Math.PI / 180) * K, 0, -(lat - (BB[1] + BB[3]) / 2) * K);
function hAt(x, z) {
  if (!heights) return 0;
  const u = (x + MW / 2) / MW * (GW - 1), v = (z + MH / 2) / MH * (GH - 1);
  const i = Math.max(0, Math.min(GW - 2, Math.floor(u))), j = Math.max(0, Math.min(GH - 2, Math.floor(v)));
  const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
  const a = heights[j * GW + i], b = heights[j * GW + i + 1], c = heights[(j + 1) * GW + i], d = heights[(j + 1) * GW + i + 1];
  return Math.max(0, (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv);
}
const ground = (lat, lon, lift = 0) => { const p = proj(lat, lon); p.y = hAt(p.x, p.z) + lift; return p; };
const inMap = (lat, lon) => lon >= BB[0] && lon <= BB[2] && lat >= BB[1] && lat <= BB[3];
const TERR_V = `attribute float elev; varying float vE; varying vec3 vN; varying vec2 vUv; varying vec3 vW; varying float vFog;
void main(){ vE=elev; vN=normalize(normalMatrix*normal); vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vFog=-mv.z; gl_Position=projectionMatrix*mv; }`;
const TERR_F = `uniform float uTime; uniform float uFog; uniform vec3 uLight; varying float vE; varying vec3 vN; varying vec2 vUv; varying vec3 vW; varying float vFog;
void main(){
 float land=smoothstep(-2.,2.,vE);
 float h=clamp(vE/3200.,0.,1.);
 vec3 lc=mix(vec3(.030,.032,.037),vec3(.13,.125,.12),pow(h,.75));
 float lam=.28+.8*max(dot(normalize(vN),normalize(uLight)),0.);
 lc*=lam;
 float ce=vE/220.; float cl=abs(fract(ce)-.5); float cw=fwidth(ce); float con=1.-smoothstep(0.,cw*1.2,cl-.5+cw);
 con=(1.-smoothstep(.0,cw*1.5,abs(fract(ce+.5)-.5)))*step(40.,vE);
 lc+=vec3(.9,.55,.25)*con*.07*(.4+h);
 float d=clamp(-vE/3000.,0.,1.);
 vec3 sc=mix(vec3(.010,.025,.045),vec3(.0,.006,.014),pow(d,.5));
 vec2 g=vW.xz/0.55; vec2 gl=abs(fract(g-.5)-.5)/fwidth(g); float grid=1.-min(min(gl.x,gl.y),1.);
 sc+=vec3(.05,.12,.2)*grid*.35;
 float sh=sin(vW.x*3.+uTime*.6)*sin(vW.z*2.3-uTime*.4); sc+=vec3(.02,.05,.08)*smoothstep(.85,1.,sh)*(1.-d);
 vec3 col=mix(sc,lc,land);
 float coast=1.-smoothstep(0.,1.6,abs(vE)/max(fwidth(vE),1.));
 col+=vec3(.35,.6,.8)*coast*.55;
 float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); col*=smoothstep(0.,.07,e);
 col*=exp(-pow(vFog*uFog,2.));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const terrMat = new THREE.ShaderMaterial({ vertexShader: TERR_V, fragmentShader: TERR_F, uniforms: { uTime: { value: 0 }, uFog: { value: 0.028 }, uLight: { value: new THREE.Vector3(-0.5, 0.8, 0.35) } } });

async function loadImage(src) { const im = new Image(); im.src = src; await im.decode(); return im; }
async function buildTerrain(tid, th) {
  BB = th.bbox; LATC = (BB[1] + BB[3]) / 2; LONC = (BB[0] + BB[2]) / 2;
  const kx = Math.cos(LATC * Math.PI / 180);
  K = 20 / ((BB[2] - BB[0]) * kx); MW = 20; MH = (BB[3] - BB[1]) * K;
  const [im, gj] = await Promise.all([loadImage('geo/' + tid + '.png'), getJSON('geo/' + tid + '.json')]);
  GW = im.width; GH = im.height;
  const c = document.createElement('canvas'); c.width = GW; c.height = GH; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const px = g.getImageData(0, 0, GW, GH).data;
  const geo = new THREE.PlaneGeometry(MW, MH, GW - 1, GH - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, elev = new Float32Array(GW * GH); heights = new Float32Array(GW * GH);
  const vx = MW / 20;
  for (let k = 0; k < GW * GH; k++) {
    const r = px[k * 4], gg = px[k * 4 + 1], b = px[k * 4 + 2];
    let e, y;
    if (gg > 127) { e = Math.max(1, (r / 3.6) ** 2); y = 0.02 + Math.pow(e / 5000, 0.85) * 0.8 * vx; }
    else { e = -Math.max(1, (b / 3.6) ** 2); y = -0.03 - Math.min(1, -e / 4000) * 0.12; }
    elev[k] = e; heights[k] = y; pos.setY(k, y);
  }
  geo.setAttribute('elev', new THREE.BufferAttribute(elev, 1)); geo.computeVertexNormals();
  terrain = new THREE.Mesh(geo, terrMat); world.add(terrain);
  // borders
  const pts = [];
  for (const L of gj.borders) for (let i = 0; i + 3 < L.length; i += 2) {
    const a = ground(L[i + 1], L[i], .012), b = ground(L[i + 3], L[i + 2], .012); pts.push(a, b);
  }
  const bl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .32, depthWrite: false }));
  world.add(bl);
}

// ---------------------------------------------------------------- labels (HTML, projected)
const labelsEl = $('#labels'); let labels = [];
function addLabel(html, cls, p, pri, extra = {}) { const el = document.createElement('span'); el.className = cls; el.innerHTML = html; labelsEl.appendChild(el); const L = { el, p, pri, w: 0, h: 0, ...extra }; labels.push(L); return L; }
const _v = new THREE.Vector3();
function placeLabels() {
  const W = innerWidth, H = innerHeight, placed = []; const hudB = $('#hud .meters').getBoundingClientRect().bottom;
  const camD = camera.position.distanceTo(controls.target);
  const sorted = labels.slice().sort((a, b) => b.pri - a.pri);
  for (const L of sorted) {
    if (L.dead) continue;
    _v.copy(L.p).project(camera);
    let show = _v.z < 1 && _v.x > -1.1 && _v.x < 1.1 && _v.y > -1.1 && _v.y < 1.1 && (!L.maxD || camD < L.maxD);
    if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    let x = (_v.x * .5 + .5) * W - (L.ax ?? .5) * L.w, y = (-_v.y * .5 + .5) * H - (L.ay ?? .5) * L.h;
    if (L.force) { x = Math.max(8, Math.min(W - L.w - 8, x)); y = Math.max(hudB + 6, y); }
    else if (x < 2 || x + L.w > W - 2) show = false;
    if (show && !L.force) for (const r of placed) if (x < r[2] && x + L.w > r[0] && y < r[3] && y + L.h > r[1]) { show = false; break; }
    if (show) { placed.push([x - 3, y - 2, x + L.w + 3, y + L.h + 2]); L.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; }
    const op = show ? (L.op ?? 1) : 0; if (L._op !== op) { L.el.style.opacity = op; L._op = op; }
  }
}

// ---------------------------------------------------------------- markers
const markers = new THREE.Group(); world.add(markers);
const pinGroup = new THREE.Group(); world.add(pinGroup);
const BEAM = new THREE.CylinderGeometry(.008, .008, 1, 6); BEAM.translate(0, .5, 0);
const RING = new THREE.RingGeometry(.86, 1, 48); RING.rotateX(-Math.PI / 2);
const DISC = new THREE.CircleGeometry(1, 32); DISC.rotateX(-Math.PI / 2);
let assets = [];
function buildMarkers(th) {
  assets = [];
  for (const [side, name, kind, lat, lon] of th.assets) {
    if (!inMap(lat, lon)) continue;
    const col = new THREE.Color(side === 'A' ? th.sides[0].color : th.sides[1].color);
    const p = ground(lat, lon);
    const hgt = kind === 'capital' ? .42 : kind === 'nuclear' ? .34 : .26;
    const beam = new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.copy(p); beam.scale.y = hgt; markers.add(beam);
    const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.copy(p).y += .01; ring.scale.setScalar(.09); markers.add(ring);
    const gl = sprite(GLOW, col, .16); gl.position.copy(p).y += hgt; markers.add(gl);
    const a = { side, name, kind, lat, lon, p, ring, gl, phase: Math.random() * 6 };
    assets.push(a);
    addLabel(`<i>${GLY[kind] || '●'}</i>${esc(name)}`, 'as ' + side, p.clone().setY(p.y + hgt + .06), kind === 'capital' ? 6 : kind === 'nuclear' ? 5 : 4, { ay: 1, op: .85, maxD: kind === 'capital' ? 99 : 23 });
  }
  for (const [t, lat, lon] of th.labels) {
    const sea = /[a-z]/.test(t);
    addLabel(esc(t), sea ? 'sea' : 'cty', ground(lat, lon, .02), sea ? 1 : 2);
  }
}

// ---------------------------------------------------------------- effects
const fx = [];
let shake = 0;
const add = o => { world.add(o); return o; };
function fade(obj, mat, dur, update) { const st = performance.now(); fx.push(now => { const t = (now - st) / dur; if (t >= 1) { world.remove(obj); mat.dispose?.(); return false; } update(t); return true; }); }
function explosion(p, sev, color = 0xff7a1a) {
  const s = .1 + sev * .07;
  const fl = add(sprite(GLOW, new THREE.Color(0xfff2d0), s * 6)); fl.position.copy(p).y += s * .4;
  fade(fl, fl.material, 600, t => { fl.material.opacity = 1 - t; fl.scale.setScalar(s * (6 + 4 * t)); });
  const fb = add(sprite(GLOW, new THREE.Color(color), s * 2)); fb.position.copy(p).y += s * .5;
  fade(fb, fb.material, 1400, t => { fb.material.opacity = (1 - t) ** 1.5; fb.scale.setScalar(s * (2 + 5 * Math.sqrt(t))); fb.position.y = p.y + s * (.5 + t * 1.2); });
  const rm = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = add(new THREE.Mesh(RING, rm)); ring.position.copy(p).y += .02;
  fade(ring, rm, 1100, t => { ring.scale.setScalar(s * (1 + 9 * Math.sqrt(t))); rm.opacity = (1 - t) * .9; });
  const nS = 3 + sev * 2;
  for (let i = 0; i < nS; i++) {
    const sm = add(sprite(SMOKE, new THREE.Color(0x6a6560), s * 2, false)); const dx = (Math.random() - .5) * s * 2, dz = (Math.random() - .5) * s * 2, d0 = Math.random() * .25;
    sm.position.set(p.x + dx, p.y, p.z + dz); sm.material.opacity = 0;
    fade(sm, sm.material, 4200 + sev * 500, t => { const u = Math.max(0, (t - d0) / (1 - d0)); sm.material.opacity = Math.sin(Math.min(1, u) * Math.PI) * .55; sm.position.y = p.y + u * s * 5; sm.scale.setScalar(s * (1.5 + u * 4)); });
  }
  for (let i = 0; i < 6 + sev * 3; i++) {
    const sp = add(sprite(GLOW, new THREE.Color(0xffb060), .05)); const v = new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 2 + .6, (Math.random() - .5) * 2).multiplyScalar(s * 2.2);
    fade(sp, sp.material, 900, t => { sp.position.set(p.x + v.x * t, p.y + v.y * t - 2.2 * t * t * s, p.z + v.z * t); sp.material.opacity = 1 - t; });
  }
  shake = Math.min(1.2, shake + .04 * sev ** 1.6);
}
function arcPath(a, b, hmul = .35) { const mid = a.clone().lerp(b, .5); mid.y += Math.max(.6, a.distanceTo(b) * hmul); return new THREE.QuadraticBezierCurve3(a, mid, b); }
function projectile(curve, { color = 0xff8a3a, dur = 1600, delay = 0, size = .09, trail = 28, onHit } = {}) {
  const head = add(sprite(GLOW, new THREE.Color(color), size)); head.visible = false;
  const tg = new THREE.BufferGeometry(); const tp = new Float32Array(trail * 3), tc = new Float32Array(trail * 3);
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  const tm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const line = add(new THREE.Line(tg, tm)); const hist = []; let lastPuff = 0; const st = performance.now() + delay; const cc = new THREE.Color(color); let hit = false;
  fx.push(now => {
    const t = (now - st) / dur; if (t < 0) return true;
    if (t < 1) { const e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; const q = curve.getPoint(.15 * t + .85 * e); head.visible = true; head.position.copy(q); hist.unshift(q.clone());
      if (now - (lastPuff || 0) > 45) { lastPuff = now; const pf = add(sprite(GLOW, cc, size * 1.3)); pf.position.copy(q); const ps = add(sprite(SMOKE, new THREE.Color(0x8a8580), size * 1.2, false)); ps.position.copy(q);
        fade(pf, pf.material, 700, u => { pf.material.opacity = (1 - u) * .7; pf.scale.setScalar(size * (1.3 - u)); });
        fade(ps, ps.material, 1600, u => { ps.material.opacity = (1 - u) * .35; ps.scale.setScalar(size * (1.2 + u * 2.5)); ps.position.y = q.y + u * .08; }); } }
    else { if (!hit) { hit = true; head.visible = false; onHit && onHit(); } hist.pop(); }
    if (hist.length > trail) hist.pop();
    for (let i = 0; i < trail; i++) { const q = hist[Math.min(i, hist.length - 1)] || head.position; tp.set([q.x, q.y, q.z], i * 3); const f = (1 - i / trail) ** 1.5; tc.set([cc.r * f, cc.g * f, cc.b * f], i * 3); }
    tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true; tg.setDrawRange(0, Math.max(0, hist.length));
    if (hit && hist.length === 0) { world.remove(head); world.remove(line); tg.dispose(); tm.dispose(); head.material.dispose(); return false; }
    return true;
  });
}
function ringPulse(p, color, size, dur = 2200, n = 3, gap = 600) {
  for (let i = 0; i < n; i++) setTimeout(() => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const r = add(new THREE.Mesh(RING, m)); r.position.copy(p).y += .03;
    fade(r, m, dur, t => { r.scale.setScalar(size * (.15 + t)); m.opacity = (1 - t) * .85; });
  }, i * gap);
}
function beamUp(p, color, dur = 3000, hgt = 2) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const b = add(new THREE.Mesh(BEAM, m)); b.position.copy(p); b.scale.set(3, hgt, 3);
  fade(b, m, dur, t => { m.opacity = Math.sin(t * Math.PI) * .6; b.scale.y = hgt * (.3 + t); });
}
function floatIcon(map, p, color, size = .5, dur = 3600) {
  const s = add(sprite(map, new THREE.Color(color), size, false)); s.position.copy(p);
  fade(s, s.material, dur, t => { s.material.opacity = Math.sin(Math.min(1, t * 1.3) * Math.PI) * .95; s.position.y = p.y + .25 + t * .7; s.position.x = p.x + Math.sin(t * 6) * .05; });
}
function jetMesh(color) { const sh = new THREE.Shape(); sh.moveTo(0, .14); sh.lineTo(.07, -.08); sh.lineTo(0, -.04); sh.lineTo(-.07, -.08); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true })); }
function jets(from, to, color, sev, onHit) {
  const dir = to.clone().sub(from).setY(0).normalize(); const alt = 1.1; const n = sev >= 4 ? 3 : 2; const start = to.clone().addScaledVector(dir, -6), end = to.clone().addScaledVector(dir, 5);
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let k = 0; k < n; k++) {
    const j = add(jetMesh(color)); const off = side.clone().multiplyScalar((k - (n - 1) / 2) * .22); const st = performance.now() + k * 140; const dur = 2600; let dropped = false;
    j.lookAt(j.position.clone().add(dir)); j.rotation.order = 'YXZ'; j.rotation.y = Math.atan2(dir.x, dir.z);
    const gl = add(sprite(GLOW, new THREE.Color(color), .18));
    fx.push(now => {
      const t = (now - st) / dur; if (t < 0) return true; if (t > 1) { world.remove(j); world.remove(gl); return false; }
      const q = start.clone().lerp(end, t).add(off); q.y = to.y + alt; j.position.copy(q); gl.position.copy(q);
      if (!dropped && t > 6 / 11 - .03) { dropped = true; const tgt = to.clone().add(off.clone().multiplyScalar(.6)).addScaledVector(dir, (Math.random() - .3) * .3); tgt.y = hAt(tgt.x, tgt.z);
        projectile(new THREE.QuadraticBezierCurve3(q.clone(), q.clone().addScaledVector(dir, .4).setY(q.y - .2), tgt), { color: 0xffcc88, dur: 700, size: .06, trail: 10, onHit: () => { explosion(tgt, Math.max(2, sev - (k ? 1 : 0))); if (k === 0) onHit && onHit(); } }); }
      return true;
    });
  }
}
function swarm(from, to, sev, color, onHit) {
  const n = 3 + sev * 2;
  for (let i = 0; i < n; i++) {
    const jit = new THREE.Vector3((Math.random() - .5) * .5, 0, (Math.random() - .5) * .5); const tgt = to.clone().add(jit.clone().multiplyScalar(.6)); tgt.y = hAt(tgt.x, tgt.z);
    const a = from.clone().add(jit); a.y += .1;
    const c = arcPath(a, tgt, .08);
    projectile(c, { color, dur: 2600 + Math.random() * 900, delay: i * 120, size: .05, trail: 16, onHit: () => { explosion(tgt, Math.max(1, sev - 2)); if (i === 0) onHit && onHit(); } });
  }
}
function ships(p, color, sev) {
  const n = Math.min(3, 1 + Math.floor(sev / 2));
  for (let k = 0; k < n; k++) {
    const g = new THREE.BoxGeometry(.05, .03, .2); const m = new THREE.MeshBasicMaterial({ color, transparent: true });
    const s = add(new THREE.Mesh(g, m)); const ang = Math.random() * 6.28; const r = .45 + k * .2; const st = performance.now();
    const wm = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    fx.push(now => {
      const t = (now - st) / 6000; if (t > 1) { world.remove(s); g.dispose(); m.dispose(); return false; }
      const a = ang + t * 1.4; s.position.set(p.x + Math.cos(a) * r, 0.0, p.z + Math.sin(a) * r); s.rotation.y = -a; m.opacity = Math.sin(t * Math.PI);
      if (Math.random() < .05) { const fl = add(sprite(GLOW, new THREE.Color(0xfff0c0), .12)); fl.position.copy(s.position).y += .05; fade(fl, fl.material, 300, u => fl.material.opacity = 1 - u); }
      if (Math.random() < .15) { const w = add(new THREE.Mesh(RING, wm.clone())); w.position.copy(s.position); fade(w, w.material, 1500, u => { w.scale.setScalar(.03 + u * .12); w.material.opacity = (1 - u) * .4; }); }
      return true;
    });
  }
  ringPulse(p, 0x4fd1ff, 1.2, 2400, 2, 900);
}
function artillery(p, sev) {
  const n = 4 + sev * 2;
  for (let i = 0; i < n; i++) setTimeout(() => { const q = p.clone().add(new THREE.Vector3((Math.random() - .5) * .7, 0, (Math.random() - .5) * .7)); q.y = hAt(q.x, q.z); explosion(q, Math.max(1, sev - 2), 0xff8040); }, i * 260 + Math.random() * 200);
}
function originFor(side, to) {
  let best = null, bd = 1e9;
  for (const a of assets) if (a.side === side) { const d = a.p.distanceTo(to); if (d > .8 && d < bd) { bd = d; best = a; } }
  return best ? best.p.clone() : null;
}

// ---------------------------------------------------------------- event placement + playback
function evPos(e) {
  if (e.loc && inMap(e.loc.lat, e.loc.lon)) {
    const p = ground(e.loc.lat, e.loc.lon);
    if (e.loc.kind === 'country' || e.loc.kind === 'metro') { // approximate: spread deterministically so stacked reports stay readable
      let h = 0; for (const c of e.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; const a = (h % 360) * Math.PI / 180, r = e.loc.kind === 'country' ? .25 + (h % 50) / 100 : .12;
      p.x += Math.cos(a) * r; p.z += Math.sin(a) * r; p.y = hAt(p.x, p.z);
    }
    return { p, where: e.loc.name, approx: e.loc.kind === 'country' };
  }
  if (e.loc) { // off-map: clamp toward edge
    const lat = Math.min(BB[3] - .6, Math.max(BB[1] + .6, e.loc.lat)), lon = Math.min(BB[2] - .6, Math.max(BB[0] + .6, e.loc.lon));
    return { p: ground(lat, lon), where: e.loc.name, off: true };
  }
  const c = S.th.focus; return { p: ground(c[0], c[1]), where: null, unk: true };
}
const cap = s => s.replace(/\b\w/g, c => c.toUpperCase());
function callout(e, P) {
  const [nm, , col] = TY[e.type];
  const where = P.off ? `<span class="off">↗ ${esc(cap(P.where))} (off-map)</span>` : P.unk ? 'location not stated' : esc(cap(P.where)) + (P.approx ? ' (country-level)' : '');
  const L = addLabel(`<b class="tg" style="color:${col}">${nm}</b>${esc(e.title.length > 90 ? e.title.slice(0, 88) + '…' : e.title)}<small>${esc(e.outlet)} · ${where}</small>`, 'co', P.p.clone().setY(P.p.y + .35), 10, { ay: 1, force: true });
  const kill = () => { if (L.dead) return; L.op = 0; setTimeout(() => { L.dead = true; L.el.remove(); labels = labels.filter(x => x !== L); }, 450); };
  if (S.lastCo) S.lastCo(); S.lastCo = kill; setTimeout(kill, 5200);
}
function play(e, { fly = true } = {}) {
  if (!S.th) return;
  const P = evPos(e), to = P.p; const sides = S.th.sides; const sc = e.actor === 'A' ? sides[0].color : e.actor === 'B' ? sides[1].color : '#ffb35c';
  const col = new THREE.Color(sc).getHex();
  if (fly) flyTo(to);
  callout(e, P); ticker(e);
  let from = e.actor ? originFor(e.actor, to) : null;
  const sky = to.clone().add(new THREE.Vector3(-2.2, 3.2, -1.5));
  switch (e.type) {
    case 'missile': { const n = Math.max(1, e.sev - 1); for (let i = 0; i < n; i++) { const tgt = to.clone().add(new THREE.Vector3((Math.random() - .5) * .3 * i, 0, (Math.random() - .5) * .3 * i)); tgt.y = hAt(tgt.x, tgt.z);
      projectile(from ? arcPath(from, tgt) : new THREE.QuadraticBezierCurve3(sky, sky.clone().lerp(tgt, .5).setY(sky.y), tgt), { color: col, dur: 1500 + (from ? from.distanceTo(tgt) * 90 : 600), delay: i * 220, onHit: () => explosion(tgt, e.sev) }); } break; }
    case 'drone': swarm(from || to.clone().add(new THREE.Vector3(-2.5, .3, -1.2)), to, e.sev, col, null); break;
    case 'air': jets(from || to.clone().add(new THREE.Vector3(-3, 0, 1)), to, col, e.sev); break;
    case 'naval': ships(to, col, e.sev); if (e.sev >= 3) setTimeout(() => explosion(to, e.sev - 1, 0xff9050), 1600); break;
    case 'ground': artillery(to, e.sev); break;
    case 'cyber': ringPulse(to, 0x3dff9a, 1.6, 1800, 4, 350); beamUp(to, 0x3dff9a, 2400, 1.2); break;
    case 'deploy': { const o = from || to; const d = o.clone().add(new THREE.Vector3(1.6, 0, -1.2)); d.y = hAt(d.x, d.z); projectile(arcPath(o, d, .2), { color: col, dur: 2600, size: .07 }); ringPulse(o, col, 1.2, 2000, 2); break; }
    case 'sanctions': ringPulse(to, 0xffd166, 2.2, 3000, 3, 700); break;
    case 'threat': ringPulse(to, 0xffc04d, 1.8, 1800, 4, 450); beamUp(to, 0xffc04d, 2400, 1); break;
    case 'diplomacy': ringPulse(to, 0xffffff, 2.6, 4200, 3, 1100); beamUp(to, 0xffffff, 4200, 2.2); floatIcon(e.title.match(/ceasefire|truce/i) ? FLAG : DOVE, to.clone().setY(to.y + .2), 0xffffff, .55, 4200); break;
    default: ringPulse(to, 0xc9ced6, 1.4, 2000, 2, 600);
  }
  dropPin(e, P);
}
const pins = new Map();
function dropPin(e, P) {
  if (pins.has(e.id)) return;
  const col = new THREE.Color(TY[e.type][2]);
  const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
  const d = new THREE.Mesh(DISC, m); d.position.copy(P.p).y += .015; d.scale.setScalar(.03 + e.sev * .012); pinGroup.add(d); pins.set(e.id, { mesh: d, e });
}
function pinsAt(T) { // show only reports from the 24h before T, fading by age
  for (const [id, o] of pins) { const age = T - o.e.ts; const vis = age >= 0 && age < 86400; o.mesh.visible = vis; if (vis) o.mesh.material.opacity = .65 * (1 - age / 86400) + .1; }
}

// ---------------------------------------------------------------- camera
const camGoal = { target: null, dist: null };
function flyTo(p, dist) { if (performance.now() - S.userAt < 15000) return; camGoal.target = p.clone(); camGoal.dist = dist ?? (DESK.matches ? 11 : 12.5); }
function homeCam() {
  const f = S.th.focus; const p = ground(f[0], f[1]); p.y = 0;
  const asp = innerWidth / innerHeight; const d = asp < 1 ? 19 / Math.max(.45, asp) * .42 : 15;
  controls.target.copy(p); camera.position.set(p.x, p.y + d * .78, p.z + d * .62); controls.update();
  camGoal.target = p.clone(); camGoal.dist = d; S.home = { p: p.clone(), d };
}

// ---------------------------------------------------------------- metrics (fixed rules, same as scripts/fetch.py)
function clustersIn(t0, t1) { const m = new Map(); for (const e of S.events) if (e.ts > t0 && e.ts <= t1 && !m.has(e.cid)) m.set(e.cid, e); return [...m.values()]; }
const score = es => es.reduce((s, e) => s + W5[e.sev] * (KIN.has(e.type) ? 1 : HALF.has(e.type) ? .5 : 0), 0);
const escOf = s => Math.round(100 * (1 - Math.exp(-s / 30)));
const LV = [[15, 'CALM', '#3ccf7e'], [35, 'TENSE', '#c9b52e'], [60, 'ELEVATED', '#ff9a2b'], [80, 'HIGH', '#ff4b3e'], [101, 'SEVERE', '#ff2050']];
function metrics(T) {
  const d1 = clustersIn(T - 86400, T), d7 = clustersIn(T - 7 * 86400, T);
  const e24 = escOf(score(d1)), e7 = escOf(score(d7) / 7);
  const pa = d7.filter(e => KIN.has(e.type) && e.actor === 'A'), pb = d7.filter(e => KIN.has(e.type) && e.actor === 'B');
  const PA = score(pa), PB = score(pb);
  const front = 50 + 40 * (PA - PB) / (PA + PB + 5);
  const lv = LV.find(l => e24 < l[0]);
  $('#escN').textContent = e24; $('#escL').textContent = lv[1]; $('#escL').style.color = lv[2];
  $('#escSub').textContent = `7d avg ${e7} ${e24 > e7 + 5 ? '↑' : e24 < e7 - 5 ? '↓' : '→'} · ${d1.length} reports`;
  $('#escBar').style.left = `calc(${e24}% - 1.5px)`;
  $('#tugA').style.width = front + '%'; $('#tugB').style.width = (100 - front) + '%'; $('#tugM').style.left = `calc(${front}% - 1px)`;
  $('#pA').textContent = `${pa.length} kinetic`; $('#pB').textContent = `${pb.length} kinetic`;
}

// ---------------------------------------------------------------- ticker + feed
function ticker(e) {
  const [nm, ic, col] = TY[e.type];
  const side = e.actor ? S.th.sides[e.actor === 'A' ? 0 : 1] : null;
  $('#ticker').innerHTML = `<div class="ic" style="box-shadow:inset 0 0 0 1px ${col}55">${ic}</div><div class="tx"><a class="tt" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
   <div class="mt"><span class="tag" style="color:${col}">${nm}</span>${side ? `<span style="color:${side.color}">${esc(side.short)} ▸</span>` : ''}<span>${esc(e.outlet)}</span><span>${hm(e.ts)} · ${ago(e.ts)}</span></div></div>`;
  $('#ticker').classList.remove('hide');
}
function groupClusters() { const m = new Map(); for (const e of S.events) { if (!m.has(e.cid)) m.set(e.cid, { lead: e, more: [] }); else m.get(e.cid).more.push(e); } return [...m.values()]; }
function renderFeed() {
  const f = S.filter; const T = S.mode === 'scrub' ? S.T : Infinity;
  const list = S.clusters.filter(c => c.lead.ts <= T).filter(c => f === 'all' || (f === 'kin' ? KIN.has(c.lead.type) : f === 'dip' ? c.lead.type === 'diplomacy' : !KIN.has(c.lead.type) && c.lead.type !== 'diplomacy'));
  $('#feedList').innerHTML = list.length ? list.slice(0, 150).map(c => { const e = c.lead; const [nm, ic, col] = TY[e.type]; const side = e.actor ? S.th.sides[e.actor === 'A' ? 0 : 1] : null;
    return `<div class="ev"><div class="h"><span class="tag" style="color:${col}">${ic} ${nm}</span><span class="sev" style="color:${col}">${'●'.repeat(e.sev)}${'○'.repeat(5 - e.sev)}</span>${side ? `<span style="color:${side.color};font-weight:700">${esc(side.short)} ▸</span>` : ''}${e.loc ? `<span>📍 ${esc(cap(e.loc.name))}</span>` : ''}</div>
    <a class="t" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
    <div class="m"><span>${esc(e.outlet)}${e.via === 'GDELT' ? ' (via GDELT)' : ''} · ${hm(e.ts)} · ${ago(e.ts)}</span><button data-id="${e.id}">Show on map ▸</button></div>
    ${c.more.length ? `<details><summary>+${c.more.length} more report${c.more.length > 1 ? 's' : ''} of this</summary>${c.more.map(m => `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.outlet)} · ${esc(m.title)} ↗</a>`).join('')}</details>` : ''}</div>`; }).join('')
    : `<div class="empty">No reports in this filter yet. Data refreshes every ~15 minutes.</div>`;
}
$('#feedList').addEventListener('click', ev => { const b = ev.target.closest('button[data-id]'); if (!b) return; const e = S.events.find(x => x.id === b.dataset.id); if (!e) return; S.userAt = -1e9; if (!DESK.matches) go(0); setTimeout(() => play(e), 250); });
document.querySelectorAll('.filters button').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; document.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x === b)); renderFeed(); }));

// ---------------------------------------------------------------- sequencing: loop recent reports, animate new ones live
function setMode(m) {
  S.mode = m; const mc = $('#mode');
  if (m === 'live') { mc.textContent = 'LIVE · NEW REPORT'; mc.className = 'modechip live'; }
  else if (m === 'loop') { mc.textContent = `REPLAYING LAST ${S.loopH}H · ${S.queue.length} REPORTS`; mc.className = 'modechip'; }
  else { mc.textContent = 'TIMELINE · ' + hm(S.T); mc.className = 'modechip'; }
  $('#liveTag').textContent = m === 'scrub' ? '● REPLAY' : '● LIVE'; $('#liveTag').classList.toggle('replay', m === 'scrub');
}
function buildQueue() {
  const now = Date.now() / 1000; let H = 24;
  let q = S.clusters.map(c => c.lead).filter(e => e.ts > now - H * 3600);
  while (q.length < 8 && H < 168) { H *= 2; q = S.clusters.map(c => c.lead).filter(e => e.ts > now - H * 3600); }
  S.loopH = H; S.queue = q.slice(0, 24).reverse(); S.qi = 0;
}
function tick(now) {
  if (S.mode === 'scrub') { if (S.playing) { const step = (now - (S.lastT || now)) / 1000 * 3600 * (S.speed === 1 ? 1.5 : 6); const T0 = S.T; S.T = Math.min(Date.now() / 1000, S.T + step); for (const e of S.clusters.map(c => c.lead)) if (e.ts > T0 && e.ts <= S.T) play(e); scrubUI(); if (S.T >= Date.now() / 1000 - 60) togglePlay(false); } S.lastT = now; return; }
  if (S.live && S.live.length) { if (now > S.nextAt) { setMode('live'); play(S.live.shift()); S.nextAt = now + 5200; } return; }
  if (S.mode === 'live' && now > S.nextAt) setMode('loop');
  if (S.queue.length && now > S.nextAt) { const e = S.queue[S.qi % S.queue.length]; S.qi++; play(e); S.nextAt = now + (KIN.has(e.type) ? 4600 : 3600); if (S.qi % S.queue.length === 0) S.nextAt += 2500; }
  if (!S.queue.length && now > S.nextAt) { $('#ticker').innerHTML = '<div class="tx"><span class="tt">No reports in the last 7 days for this theatre.</span></div>'; S.nextAt = now + 1e9; }
}

// ---------------------------------------------------------------- timeline scrubber
const slider = $('#rSlider');
function span() { const now = Date.now() / 1000; const t0 = Math.max(now - 7 * 86400, Math.min(...S.events.map(e => e.ts), now - 86400)); return [t0, now]; }
function scrubUI() { const [a, b] = span(); slider.value = Math.round((S.T - a) / (b - a) * 1000); $('#rWhen').textContent = new Date(S.T * 1000).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); const n = clustersIn(S.T - 86400, S.T).length; $('#rInfo').textContent = `${n} report${n === 1 ? '' : 's'} in the 24h before this point`; metrics(S.T); pinsAt(S.T); setMode('scrub'); }
function drawHist() {
  const c = $('#hist'), r = c.getBoundingClientRect(), d = devicePixelRatio || 1; c.width = r.width * d; c.height = r.height * d; const g = c.getContext('2d'); g.scale(d, d);
  const [a, b] = span(); const N = 56, bins = Array.from({ length: N }, () => [0, 0, 0]);
  for (const c2 of S.clusters) { const e = c2.lead; const i = Math.min(N - 1, Math.floor((e.ts - a) / (b - a) * N)); if (i < 0) continue; bins[i][KIN.has(e.type) ? 0 : e.type === 'diplomacy' ? 2 : 1] += W5[e.sev]; }
  const mx = Math.max(4, ...bins.map(x => x[0] + x[1] + x[2])); const bw = r.width / N;
  bins.forEach((x, i) => { let y = r.height; [[0, '#ff5a3a'], [1, '#ffc04d'], [2, '#ffffff']].forEach(([k, col]) => { const h = x[k] / mx * (r.height - 4); g.fillStyle = col; g.globalAlpha = .75; g.fillRect(i * bw + 1, y - h, bw - 2, h); y -= h; }); });
  $('#rStart').textContent = new Date(a * 1000).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
slider.addEventListener('input', () => { const [a, b] = span(); S.T = a + (b - a) * slider.value / 1000; scrubUI(); renderFeed(); });
function togglePlay(on) { S.playing = on ?? !S.playing; S.lastT = 0; $('#rPlay').innerHTML = S.playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'; if (S.playing && S.mode !== 'scrub') { S.T = span()[0]; scrubUI(); } }
$('#rPlay').addEventListener('click', () => { if (S.mode !== 'scrub' || S.T >= Date.now() / 1000 - 120) { S.T = span()[0]; scrubUI(); } togglePlay(); });
$('#rSpeed').addEventListener('click', () => { S.speed = S.speed === 1 ? 4 : 1; $('#rSpeed').textContent = S.speed + '×'; });
$('#rLive').addEventListener('click', goLive);
function goLive() { togglePlay(false); S.T = null; buildQueue(); setMode('loop'); metrics(Date.now() / 1000); pinsAt(Date.now() / 1000); renderFeed(); slider.value = 1000; S.nextAt = 0; }

// ---------------------------------------------------------------- dock (liquid-glass spring pill, ported from Revise Shorts)
const ICON = {
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  feed: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
};
const DOCK_T = [['map', 'Map'], ['feed', 'Feed'], ['replay', 'Replay'], ['info', 'About']];
const vib = n => { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(n) } catch (_) { } };
let dock, bub, jel, tbs = [], dockI = 0, bw = 0, press = 1, ddrag = null, moved = 0;
function spring(o) { const s = { x: 0, v: 0, target: 0, k: o.k, c: o.c, on: o.on, raf: 0, set(t, instant) { s.target = t; if (instant || RMQ.matches) { if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0 } s.x = t; s.v = 0; s.on(s.x, 0); return }
  if (!s.raf) { let last = performance.now(); const f = now => { const dt = Math.min(.032, (now - last) / 1000); last = now; const a = -s.k * (s.x - s.target) - s.c * s.v; s.v += a * dt; s.x += s.v * dt; s.on(s.x, s.v);
    if (Math.abs(s.v) < 2 && Math.abs(s.x - s.target) < .3) { s.x = s.target; s.v = 0; s.on(s.x, 0); s.raf = 0; if (s.settle) s.settle(); return } s.raf = requestAnimationFrame(f) }; s.raf = requestAnimationFrame(f) } } }; return s }
const slotX = i => tbs[i] ? tbs[i].offsetLeft : 0;
function dpaint(x, v) { const st = RMQ.matches ? 0 : Math.min(.34, Math.abs(v) / 2400); moved = Math.max(moved, Math.abs(v));
  bub.style.transform = `translate3d(${x.toFixed(2)}px,0,0) scale(${((1 + st) * press).toFixed(3)},${((1 - st * .42) * press).toFixed(3)})`;
  const c = x + bw / 2; tbs.forEach(b => b.classList.toggle('on', c >= b.offsetLeft && c < b.offsetLeft + b.offsetWidth)) }
const bs = spring({ k: 380, c: 26, on: (x, v) => dpaint(x, v) });
bs.settle = () => { if (moved > 600 && !RMQ.matches && !ddrag) { jel.classList.remove('jelly'); void jel.offsetWidth; jel.classList.add('jelly') } moved = 0 };
function sizeBubble() { bw = tbs[0].offsetWidth; bub.style.width = bw + 'px'; bs.set(slotX(dockI), true) }
const rubber = x => { const a = slotX(0), b = slotX(tbs.length - 1); return x < a ? a - Math.pow(a - x, .7) : x > b ? b + Math.pow(x - b, .7) : x };
const nearest = x => { let best = 0, d = 1e9; tbs.forEach((b, i) => { const dd = Math.abs(b.offsetLeft - x); if (dd < d) { d = dd; best = i } }); return best };
function mountDock() {
  dock = document.createElement('nav'); dock.className = 'tabs'; dock.setAttribute('aria-label', 'Tabs');
  dock.innerHTML = '<span class="dpill" aria-hidden="true"><i></i></span>' + DOCK_T.map(([ic, l], k) => `<button type="button" data-k="${k}" aria-label="${l}">${ICON[ic]}<span>${l}</span></button>`).join('');
  document.body.appendChild(dock); bub = dock.querySelector('.dpill'); jel = bub.querySelector('i'); tbs = [...dock.querySelectorAll('button')];
  dock.addEventListener('pointerdown', e => { if (e.button > 0) return; try { dock.setPointerCapture(e.pointerId) } catch (_) { } const r = dock.getBoundingClientRect(); ddrag = { left: r.left }; press = 1.08; dock.classList.add('drag'); bs.set(rubber(e.clientX - r.left - bw / 2)) });
  dock.addEventListener('pointermove', e => { if (ddrag) bs.set(rubber(e.clientX - ddrag.left - bw / 2)) });
  const end = e => { if (!ddrag) return; const i = nearest(bs.target); ddrag = null; press = 1; dock.classList.remove('drag'); if (e.type === 'pointercancel') { bs.set(slotX(dockI)); return } if (i !== dockI) vib(6); go(i) };
  dock.addEventListener('pointerup', end); dock.addEventListener('pointercancel', end);
  dock.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const b = e.target.closest('button'); if (b) { e.preventDefault(); go(+b.dataset.k) } } });
  addEventListener('resize', () => { sizeBubble() }); sizeBubble();
}
function go(i) {
  if (i === dockI && i !== 0) i = 0;
  dockI = i; bs.set(slotX(i));
  document.body.classList.toggle('feedtab', i === 1);
  $('#feed').classList.toggle('open', i === 1 || DESK.matches);
  $('#about').classList.toggle('open', i === 3);
  $('#replay').classList.toggle('open', i === 2);
  $('#thSheet').classList.remove('open');
  $('#ticker').classList.toggle('hide', i !== 0 && !(DESK.matches && i === 1));
  $('#scrim').classList.toggle('on', (i === 1 && !DESK.matches) || i === 3);
  if (i === 1) renderFeed();
  if (i === 2) { requestAnimationFrame(drawHist); if (S.mode !== 'scrub') { S.T = Date.now() / 1000; scrubUI(); } }
  if (i !== 2 && S.mode === 'scrub') goLive();
  if (i === 3) renderAbout();
}
$('#scrim').addEventListener('click', () => { go(0); });
$('#noteMore').addEventListener('click', e => { e.preventDefault(); go(3); });

// ---------------------------------------------------------------- theatre picker + about
$('#thBtn').addEventListener('click', () => {
  const ix = S.index; const th = (ix?.theatres || []).slice().sort((a, b) => b.esc24 - a.esc24 || b.n7 - a.n7);
  $('#thList').innerHTML = th.map(t => { const lv = LV.find(l => t.esc24 < l[0]); return `<button class="th${t.id === S.tid ? ' cur' : ''}" data-t="${t.id}"><span><b>${esc(t.name)}</b><small>${t.n24} reports in 24h · ${t.k24} kinetic · ${t.n7} in 7d</small></span><span class="e" style="color:${lv[2]}">${t.esc24}<small style="font-size:9px;letter-spacing:.1em">${lv[1]}</small></span></button>`; }).join('');
  $('#thSheet').classList.add('open'); $('#scrim').classList.add('on');
});
$('#thList').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; $('#thSheet').classList.remove('open'); $('#scrim').classList.remove('on'); if (b.dataset.t !== S.tid) { location.hash = 't=' + b.dataset.t; loadTheatre(b.dataset.t); } });
function renderAbout() {
  const ix = S.index || {}; const src = (ix.sources || []);
  $('#aboutBody').innerHTML = `<h3>WHAT THIS IS</h3><p>Frontline turns <b>real news reports</b> into a 3D battlefield. Every animation is triggered by a published article, and every feed item links to it. Animations are <b>symbolic</b>: an arc means "a report of a missile attack here", not a real trajectory, unit or position. Nothing is predicted, invented or estimated, and no AI is used anywhere.</p>
  <h3>HOW EVENTS ARE MADE</h3><ul><li>Every ~15 minutes a GitHub Action fetches public RSS feeds (and the GDELT 2.0 API when it answers).</li><li>A headline joins a theatre only if it names that conflict (e.g. Iran, Tehran, IRGC, Hormuz).</li><li>Fixed keyword rules pick the type (missile, drone, airstrike, naval, ground, cyber, deployment, sanctions, threat, diplomacy, statement). Hypothetical headlines ("could", "ready to") count as threats, not attacks.</li><li>Severity 1–5: a base for the type, +1 for casualty or destruction words, +1 for strategic targets (nuclear sites, capitals, energy), −1 for "minor/limited".</li><li>Location comes from a hand-built list of place names. Country-level mentions are shown as approximate. Places outside the map show as off-map.</li><li>The side that acted is taken from the headline's wording ("US strikes…"). If it's unclear, the arc falls from the sky.</li><li>Reports of the same incident (same type, within 12h, similar headline) are grouped so they count once.</li></ul>
  <h3>ESCALATION METER</h3><p>Weights by severity: 1, 2, 4, 8, 16. Kinetic reports count in full; deployments, threats, cyber and sanctions count half; diplomacy and statements count zero. Score S is the sum over the last 24h, and Escalation = 100 × (1 − e<sup>−S/30</sup>). The 7d average uses S over 7 days ÷ 7. Bands: Calm &lt;15, Tense &lt;35, Elevated &lt;60, High &lt;80, then Severe.</p>
  <h3>FRONT LINE</h3><p>Kinetic pressure over 7 days per side, using the same weights. Position = 50 + 40 × (A − B) / (A + B + 5). It shows who is <i>reported</i> as acting more, not who is winning.</p>
  <h3>SOURCES (LAST REFRESH ${ix.updated ? esc(hm(ix.updated)) : '–'})</h3><ul>${src.map(s => `<li class="${s.ok ? 'srcok' : 'srcbad'}">${s.ok ? '✓' : '✗'} <span style="color:#ddd">${esc(s.src)}</span>${typeof s.n === 'number' ? ` · ${s.n} items` : ''}</li>`).join('')}</ul>
  <h3>LIMITS</h3><p>Headlines can be wrong, one-sided or later corrected. Keyword rules misclassify sometimes, so always read the source. History builds up from the day tracking started (up to 14 days kept). Base and site markers are publicly reported locations.</p>
  <p style="color:var(--dim);font-size:11px">Terrain: AWS Terrain Tiles (Mapzen/Terrarium). Borders: Natural Earth via world-atlas. 3D: three.js.</p>`;
}

// ---------------------------------------------------------------- load
function clearWorld() { for (const o of [...world.children]) if (o !== markers && o !== pinGroup) world.remove(o); markers.clear(); pinGroup.clear(); pins.clear(); fx.length = 0; labels.forEach(l => l.el.remove()); labels = []; if (terrain) { terrain.geometry.dispose(); terrain = null; } }
async function loadTheatre(tid) {
  if (!S.TH[tid]) tid = 'us-iran';
  $('#boot').classList.remove('gone');
  S.tid = tid; S.th = S.TH[tid]; localStorage.setItem('fl_t', tid);
  $('#thName').textContent = S.th.name; $('#sideA').textContent = S.th.sides[0].short; $('#sideB').textContent = S.th.sides[1].short;
  document.documentElement.style.setProperty('--A', S.th.sides[0].color); document.documentElement.style.setProperty('--B', S.th.sides[1].color);
  clearWorld();
  const [d] = await Promise.all([getJSON('data/' + tid + '.json').catch(() => ({ events: [] })), buildTerrain(tid, S.th)]);
  buildMarkers(S.th); homeCam();
  S.events = d.events || []; S.seen = new Set(S.events.map(e => e.id)); S.clusters = groupClusters(); S.live = [];
  for (const c of S.clusters) { if (Date.now() / 1000 - c.lead.ts < 7 * 86400) dropPin(c.lead, evPos(c.lead)); }
  goLive(); S.nextAt = performance.now() + 1500;
  renderFeed();
  setTimeout(() => $('#boot').classList.add('gone'), 300);
}
async function poll() {
  try {
    S.index = await getJSON('data/index.json');
    const d = await getJSON('data/' + S.tid + '.json');
    const fresh = (d.events || []).filter(e => !S.seen.has(e.id));
    if (fresh.length) {
      S.events = d.events; fresh.forEach(e => S.seen.add(e.id)); S.clusters = groupClusters();
      const leads = new Set(S.clusters.map(c => c.lead.id)); S.live.push(...fresh.filter(e => leads.has(e.id)).sort((a, b) => a.ts - b.ts));
      if (S.mode !== 'scrub') { metrics(Date.now() / 1000); buildQueue(); } renderFeed();
    }
  } catch (_) { }
}

let last = performance.now(); const _shk = new THREE.Vector3();
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); labels.forEach(l => l.w = 0); }
addEventListener('resize', resize);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  terrMat.uniforms.uTime.value = now / 1000;
  tick(now);
  for (let i = fx.length - 1; i >= 0; i--) if (!fx[i](now)) fx.splice(i, 1);
  for (const a of assets) { const s = 1 + .25 * Math.sin(now / 700 + a.phase); a.ring.scale.setScalar(.09 * s); a.gl.material.opacity = .6 + .3 * Math.sin(now / 500 + a.phase); }
  camera.position.sub(_shk);
  const idle = performance.now() - S.userAt > 15000;
  if (camGoal.target && idle) {
    const k = 1 - Math.exp(-dt * 1.6);
    const off = camera.position.clone().sub(controls.target);
    controls.target.lerp(camGoal.target, k);
    const d = off.length(); const nd = d + (camGoal.dist - d) * k * .6; off.setLength(nd);
    if (!RMQ.matches) off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * .02);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
  shake *= Math.exp(-dt * 4.5);
  if (RMQ.matches) shake = 0;
  _shk.set((Math.random() - .5) * shake * .25, (Math.random() - .5) * shake * .2, (Math.random() - .5) * shake * .25);
  camera.position.add(_shk);
  renderer.render(scene, camera);
  placeLabels();
}
async function init() {
  resize(); mountDock();
  S.TH = await getJSON('geo/theatres.json');
  S.index = await getJSON('data/index.json').catch(() => null);
  const h = (location.hash.match(/t=([\w-]+)/) || [])[1];
  await loadTheatre(h || localStorage.getItem('fl_t') || 'us-iran');
  go(DESK.matches ? 1 : 0); if (DESK.matches) { dockI = 0; bs.set(slotX(0)); }
  requestAnimationFrame(frame);
  setInterval(poll, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
  window.__fl = { S, play, go, flyTo, homeCam };
}
init().catch(err => { $('#boot span').textContent = 'Could not start: ' + err.message; console.error(err); });

// ---------------------------------------------------------------- service worker (pattern proven on Android Chrome)
if ('serviceWorker' in navigator) { let had = !!navigator.serviceWorker.controller, rl = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !rl) { rl = true; location.reload(); } });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { r.update(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update(); }); }).catch(() => { })); }
