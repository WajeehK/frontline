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
const TERR_F = `uniform float uTime; uniform float uFog; uniform vec3 uLight; uniform vec4 uHit[6]; uniform vec3 uHitC[6]; uniform vec4 uRad; varying float vE; varying vec3 vN; varying vec2 vUv; varying vec3 vW; varying float vFog;
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
 // impacts: hot core light, expanding shockwave ring, lingering embers (x,z,age 0..1,intensity)
 for(int i=0;i<6;i++){ vec4 H=uHit[i]; if(H.w<=0.) continue; float r=length(vW.xz-H.xy); float a=H.z;
  float core=exp(-r*r/(.02+.05*a))*(1.-a)*1.6; float wave=exp(-pow((r-a*1.4)*14.,2.))*(1.-a)*.9; float emb=exp(-r*r/.012)*.35*(1.-a*a);
  col+=uHitC[i]*(core+wave*.6+emb)*H.w; }
 // ambient radar sweep around the theatre focus
 if(uRad.w>0.){ vec2 q=vW.xz-uRad.xy; float r=length(q); float ang=atan(q.y,q.x); float sw=mod(uTime*.55,6.2832)-3.1416; float da=mod(sw-ang+6.2832,6.2832);
  float fall=smoothstep(uRad.z,uRad.z*.2,r); float sweep=exp(-da*2.2)*fall; float rings=(1.-smoothstep(0.,fwidth(r/1.6)*1.5,abs(fract(r/1.6)-.5)-.47))*fall*.35;
  col+=vec3(.25,.75,.45)*(sweep*.08+rings*.045)*uRad.w; }
 float coast=1.-smoothstep(0.,1.6,abs(vE)/max(fwidth(vE),1.));
 col+=vec3(.35,.6,.8)*coast*.55;
 float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); col*=smoothstep(0.,.07,e);
 col*=exp(-pow(vFog*uFog,2.));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const terrMat = new THREE.ShaderMaterial({ vertexShader: TERR_V, fragmentShader: TERR_F, uniforms: { uTime: { value: 0 }, uFog: { value: 0.028 }, uLight: { value: new THREE.Vector3(-0.5, 0.8, 0.35) }, uHit: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uHitC: { value: Array.from({ length: 6 }, () => new THREE.Color()) }, uRad: { value: new THREE.Vector4(0, 0, 9, 1) } } });
let hitI = 0;
function groundHit(p, sev, color = 0xff7a2a, dur = 2600) { const i = hitI++ % 6; const H = terrMat.uniforms.uHit.value[i]; terrMat.uniforms.uHitC.value[i].set(color); const st = performance.now(); const w = .5 + sev * .18;
  H.set(p.x, p.z, 0, w); fx.push(now => { const t = (now - st) / dur; if (t >= 1) { if (H.x === p.x) H.w = 0; return false; } if (H.x === p.x) H.z = t; return true; }); }

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
  S.borders = gj.borders; const pts = [];
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
let HUDB = 0; const _hudEl = document.getElementById('hud');
function measureHud() { HUDB = _hudEl.getBoundingClientRect().bottom; document.documentElement.style.setProperty('--hudB', Math.round(HUDB) + 'px'); }
new ResizeObserver(measureHud).observe(_hudEl); addEventListener('resize', measureHud); measureHud();
function placeLabels() {
  const W = innerWidth, H = innerHeight, placed = []; if ((placeLabels.n = (placeLabels.n || 0) + 1) % 15 === 0 || !HUDB) measureHud(); const hudB = HUDB;
  const camD = camera.position.distanceTo(controls.target);
  const sorted = labels.slice().sort((a, b) => b.pri - a.pri);
  for (const L of sorted) {
    if (L.dead) continue; if (L.hide || L.dead2) { if (L._op !== 0) { L.el.style.opacity = 0; L._op = 0; } continue; }
    _v.copy(L.p).project(camera);
    let show = _v.z < 1 && _v.x > -1.1 && _v.x < 1.1 && _v.y > -1.1 && _v.y < 1.1 && (!L.maxD || camD < L.maxD);
    if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    let x = (_v.x * .5 + .5) * W - (L.ax ?? .5) * L.w, y = (-_v.y * .5 + .5) * H - (L.ay ?? .5) * L.h;
    if (L.force) { x = Math.max(8, Math.min(W - L.w - 8, x)); y = Math.max(hudB + 6, y); }
    else if (x < 2 || x + L.w > W - 2) show = false;
    if (show && !L.force && y < hudB + 2) show = false; // never draw map labels under the HUD
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
const RING2 = new THREE.RingGeometry(.955, 1, 72); RING2.rotateX(-Math.PI / 2);
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
    let ping = null; if (kind === 'capital' || kind === 'nuclear' || kind === 'base' || kind === 'naval') { ping = new THREE.Mesh(RING2, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ping.position.copy(p).y += .012; markers.add(ping); }
    const a = { side, name, kind, lat, lon, p, ring, gl, ping, phase: Math.random() * 6 };
    assets.push(a);
    addLabel(`<i>${GLY[kind] || '●'}</i>${esc(name)}`, 'as ' + side, p.clone().setY(p.y + hgt + .06), kind === 'capital' ? 6 : kind === 'nuclear' ? 5 : 4, { ay: 1, op: .85, maxD: kind === 'capital' ? 99 : 23 });
  }
  for (const [t, lat, lon] of th.labels) {
    const sea = /[a-z]/.test(t);
    addLabel(esc(t), sea ? 'sea' : 'cty', ground(lat, lon, .02), sea ? 1 : 2);
  }
}

// ---------------------------------------------------------------- adaptive quality (target 60fps on mid-range phones)
const Q = { low: false, pr: renderer.getPixelRatio(), acc: 0, n: 0, good: 0,
  frame(ms) { if (!(ms > 0 && ms < 250) || document.hidden) return; this.acc += ms; this.n++; if (this.n < 90) return; const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (avg > 21 && this.pr > .85) { this.pr = Math.max(.85, this.pr - .25); renderer.setPixelRatio(this.pr); resize(); this.good = 0; }
    else if (avg > 21) { this.low = true; motes.visible = false; terrMat.uniforms.uRad.value.w = .6; }
    else if (avg < 13 && ++this.good > 6 && this.pr < Math.min(devicePixelRatio || 1, DESK.matches ? 2 : 1.75)) { this.pr = Math.min(this.pr + .25, Math.min(devicePixelRatio || 1, DESK.matches ? 2 : 1.75)); renderer.setPixelRatio(this.pr); resize(); this.good = 0; } } };
// ambient dust motes drifting over the map
const motes = (() => { const n = 260, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - .5) * 26; a[i * 3 + 1] = .3 + Math.random() * 2.2; a[i * 3 + 2] = (Math.random() - .5) * 20; }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3)); const m = new THREE.PointsMaterial({ color: 0xffd9b0, size: .035, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, m); scene.add(pts); if (RMQ.matches) pts.visible = false; return pts; })();

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
  const nS = Q.low ? 2 + sev : 3 + sev * 2;
  for (let i = 0; i < nS; i++) {
    const sm = add(sprite(SMOKE, new THREE.Color(0x6a6560), s * 2, false)); const dx = (Math.random() - .5) * s * 2, dz = (Math.random() - .5) * s * 2, d0 = Math.random() * .25;
    sm.position.set(p.x + dx, p.y, p.z + dz); sm.material.opacity = 0;
    fade(sm, sm.material, 4200 + sev * 500, t => { const u = Math.max(0, (t - d0) / (1 - d0)); sm.material.opacity = Math.sin(Math.min(1, u) * Math.PI) * .55; sm.position.y = p.y + u * s * 5; sm.scale.setScalar(s * (1.5 + u * 4)); });
  }
  for (let i = 0; i < (Q.low ? 3 + sev : 6 + sev * 3); i++) {
    const sp = add(sprite(GLOW, new THREE.Color(0xffb060), .05)); const v = new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 2 + .6, (Math.random() - .5) * 2).multiplyScalar(s * 2.2);
    fade(sp, sp.material, 900, t => { sp.position.set(p.x + v.x * t, p.y + v.y * t - 2.2 * t * t * s, p.z + v.z * t); sp.material.opacity = 1 - t; });
  }
  groundHit(p, sev, color);
  if (sev >= 4 && !Q.low) { const col = add(new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); col.position.copy(p);
    fade(col, col.material, 900, t => { col.scale.set(6 * (1 - t) + 1, (1.4 + sev * .2) * Math.sqrt(t) + .01, 6 * (1 - t) + 1); col.material.opacity = (1 - t) * .8; }); }
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
    if (!head.userData.l) { head.userData.l = 1; const p0 = curve.getPoint(0); const lf = add(sprite(GLOW, new THREE.Color(0xfff0d0), size * 5)); lf.position.copy(p0); fade(lf, lf.material, 500, u => { lf.material.opacity = 1 - u; lf.scale.setScalar(size * (5 + 6 * u)); }); groundHit(p0, 1, color, 1400); }
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
    const r = add(new THREE.Mesh(RING2, m)); r.position.copy(p).y += .03;
    fade(r, m, dur, t => { r.scale.setScalar(size * (.15 + t)); m.opacity = (1 - t) * .7; });
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
const cap = s => s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\b(Uk|Raf|Uae|Us|Npp|Idf)\b/g, w => w.toUpperCase());
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
function flyTo(p, dist) { if (performance.now() - S.userAt < 15000) return; camGoal.target = p.clone(); camGoal.dist = dist ?? (DESK.matches ? 11 : 12.5);
  const off = camera.position.clone().sub(controls.target); const far = controls.target.distanceTo(p);
  camGoal.fl = { t0: performance.now(), dur: RMQ.matches ? 1 : Math.min(2600, 1100 + far * 160), a: controls.target.clone(), d0: off.length(), arc: Math.min(.35, far * .025) }; }
function homeCam() {
  const f = S.th.focus; const p = ground(f[0], f[1]); p.y = 0;
  const asp = innerWidth / innerHeight; const d = asp < 1 ? 19 / Math.max(.45, asp) * .42 : 15;
  controls.target.copy(p); camera.position.set(p.x, p.y + d * .78, p.z + d * .62); controls.update();
  camGoal.target = p.clone(); camGoal.dist = d; S.home = { p: p.clone(), d };
  terrMat.uniforms.uRad.value.set(p.x, p.z, Math.max(7, d * .6), Q.low ? .6 : 1);
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
  countTo($('#escN'), e24); $('#escL').textContent = lv[1]; $('#escL').style.color = lv[2];
  $('#escSub').textContent = `7d avg ${e7} ${e24 > e7 + 5 ? '↑' : e24 < e7 - 5 ? '↓' : '→'} · ${d1.length} reports`;
  $('#escBar').style.left = `calc(${e24}% - 1.5px)`;
  $('#tugA').style.width = front + '%'; $('#tugB').style.width = (100 - front) + '%'; $('#tugM').style.left = `calc(${front}% - 1px)`;
  $('#pA').textContent = `${pa.length} kinetic`; $('#pB').textContent = `${pb.length} kinetic`;
}

// ---------------------------------------------------------------- ticker + feed
function ticker(e) {
  S.tickE = e;
  const [nm, ic, col] = TY[e.type];
  const side = e.actor ? S.th.sides[e.actor === 'A' ? 0 : 1] : null;
  $('#ticker').innerHTML = `<div class="ic" style="box-shadow:inset 0 0 0 1px ${col}55">${ic}</div><div class="tx"><a class="tt" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
   <div class="mt">${e.live ? '<span class="lvb">● LIVE</span>' : ''}<span class="tag" style="color:${col}">${nm}</span>${side ? `<span style="color:${side.color}">${esc(side.short)} ▸</span>` : ''}<span>${esc(e.outlet)}</span><span>${hm(e.ts)} · ${ago(e.ts)}</span></div></div>`;
  $('#ticker').classList.remove('hide'); const tk = $('#ticker'); tk.classList.remove('tin'); void tk.offsetWidth; tk.classList.add('tin');
}
function toLeads(d) { if (d.clusters) return d.clusters.map(c => ({ ...c, id: c.cid, via: (c.outlets && c.outlets[0] || {}).via })); return d.events || []; }
function groupClusters() { const m = new Map(); for (const e of S.events) { if (!m.has(e.cid)) m.set(e.cid, { lead: e, more: [] }); else m.get(e.cid).more.push(e); } return [...m.values()]; }
function renderFeed() {
  const f = S.filter; const T = S.mode === 'scrub' ? S.T : Infinity;
  const list = S.clusters.filter(c => c.lead.ts <= T).filter(c => f === 'all' || (f === 'kin' ? KIN.has(c.lead.type) : f === 'dip' ? c.lead.type === 'diplomacy' : !KIN.has(c.lead.type) && c.lead.type !== 'diplomacy'));
  $('#feedList').innerHTML = list.length ? list.slice(0, 150).map(c => { const e = c.lead; const [nm, ic, col] = TY[e.type]; const side = e.actor ? S.th.sides[e.actor === 'A' ? 0 : 1] : null;
    return `<div class="ev" data-id="${esc(e.id)}" role="button" tabindex="0"><div class="h"><span class="tag" style="color:${col}">${ic} ${nm}</span>${e.live ? '<span class="lvb" title="From the Al Jazeera fast lane (checked every ~2 min)">● LIVE</span>' : ''}<span class="sev" style="color:${col}">${'●'.repeat(e.sev)}${'○'.repeat(5 - e.sev)}</span>${side ? `<span style="color:${side.color};font-weight:700">${esc(side.short)} ▸</span>` : ''}${e.loc ? `<span>📍 ${esc(cap(e.loc.name))}</span>` : ''}</div>
    <a class="t" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
    <div class="m"><span>${esc(e.outlet)}${e.via === 'GDELT' ? ' (via GDELT)' : e.via === 'LIVE' ? ' · fast lane' : ''} · ${hm(e.ts)} · ${ago(e.ts)}</span><button data-id="${e.id}">Show on map ▸</button></div>
    ${(e.outlets || []).length > 1 ? `<details><summary>Covered by ${e.outlets.length} outlets: ${esc(e.outlets.map(o => o.outlet).join(', '))}</summary>${e.outlets.map(m => `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.outlet)} · ${hm(m.ts)} · ${esc(m.title)} ↗</a>`).join('')}</details>` : ''}</div>`; }).join('')
    : `<div class="empty">No reports in this filter yet. Data refreshes every ~15 minutes.</div>`;
}
$('#feedList').addEventListener('click', ev => { const card = ev.target.closest('.ev'); if (card && !ev.target.closest('button[data-id]') && !ev.target.closest('summary')) { ev.preventDefault(); const e = S.events.find(x => x.id === card.dataset.id); if (e) openStory(e); return; } const b = ev.target.closest('button[data-id]'); if (!b) return; const e = S.events.find(x => x.id === b.dataset.id); if (!e) return; S.userAt = -1e9; if (!DESK.matches) go(0); setTimeout(() => play(e), 250); });
document.querySelectorAll('.filters button').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; document.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x === b)); renderFeed(); }));

// ---------------------------------------------------------------- sequencing: loop recent reports, animate new ones live
function setMode(m) {
  S.mode = m; const mc = $('#mode');
  if (m === 'live') { mc.textContent = 'LIVE · NEW REPORT'; mc.className = 'modechip live'; }
  else if (m === 'since') { mc.textContent = `SINCE YOUR LAST VISIT · ${S.queue.length} NEW`; mc.className = 'modechip since'; }
  else if (m === 'loop' && S.queue.length <= 1) { mc.textContent = S.queue.length ? (S.firstVisit ? 'LATEST REPORT' : 'NOTHING NEW SINCE LAST VISIT · LATEST') : 'WATCHING FOR NEW REPORTS'; mc.className = 'modechip'; }
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
  if (S.live && S.live.length) { if (now > S.nextAt) { setMode('live'); const e = S.live.shift(); if (isMajor(e) && !BRK_SEEN.has(e.id) && Date.now() / 1000 - e.ts < 6 * 3600) { breaking(e); S.nextAt = now + 9000; } else { play(e); S.nextAt = now + 5200; } } return; }
  if (S.mode === 'live' && now > S.nextAt) setMode('loop');
  if (S.once && S.qi >= S.queue.length) { if (S.queue.length && !S.doneAt) { S.doneAt = 1; markVisit(); if (S.since) { S.since = false; setMode('loop'); } } return; }
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
  g.globalAlpha = 1; for (const c2 of S.clusters) { const e = c2.lead; if (!isMajor(e)) continue; const x = (e.ts - a) / (b - a) * r.width; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 4, 0); g.lineTo(x + 4, 0); g.lineTo(x, 6); g.fill(); }
  $('#rStart').textContent = new Date(a * 1000).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
slider.addEventListener('input', () => { const [a, b] = span(); S.T = a + (b - a) * slider.value / 1000; scrubUI(); renderFeed(); });
function togglePlay(on) { S.playing = on ?? !S.playing; S.lastT = 0; $('#rPlay').innerHTML = S.playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'; if (S.playing && S.mode !== 'scrub') { S.T = span()[0]; scrubUI(); } }
$('#rPlay').addEventListener('click', () => { if (S.mode !== 'scrub' || S.T >= Date.now() / 1000 - 120) { S.T = span()[0]; scrubUI(); } togglePlay(); });
$('#rSpeed').addEventListener('click', () => { S.speed = S.speed === 1 ? 4 : 1; $('#rSpeed').textContent = S.speed + '×'; });
$('#rLive').addEventListener('click', goLive);
function goLive(open) { togglePlay(false); S.T = null; if (open) openQueue(); else idleQueue(); setMode(S.since ? 'since' : 'loop'); metrics(Date.now() / 1000); pinsAt(Date.now() / 1000); renderFeed(); slider.value = 1000; S.nextAt = 0; }

// ---------------------------------------------------------------- dock (liquid-glass spring pill, ported from Revise Shorts)
const ICON = {
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  feed: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>',
  sides: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M14 20v-7M20 20V8"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
};
const DOCK_T = [['map', 'Map'], ['feed', 'Feed'], ['sides', 'Sides'], ['replay', 'Replay'], ['info', 'About']];
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
  dockI = i; bs.set(slotX(i)); if (tbs) tbs.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  document.body.classList.toggle('feedtab', i === 1);
  $('#feed').classList.toggle('open', i === 1 || DESK.matches);
  $('#about').classList.toggle('open', i === 4);
  $('#sides').classList.toggle('open', i === 2);
  $('#replay').classList.toggle('open', i === 3);
  $('#thSheet').classList.remove('open'); $('#opts').classList.remove('open'); $('#sentS').classList.remove('open');
  $('#ticker').classList.toggle('hide', i !== 0 && !(DESK.matches && i === 1));
  $('#scrim').classList.toggle('on', (i === 1 && !DESK.matches) || i === 4 || i === 2);
  if (i === 1) renderFeed();
  if (i === 2) renderSides();
  if (i === 3) { requestAnimationFrame(drawHist); if (S.mode !== 'scrub') { S.T = Date.now() / 1000; scrubUI(); } }
  if (i !== 3 && S.mode === 'scrub') goLive(false);
  if (i === 4) renderAbout();
}
$('#scrim').addEventListener('click', () => { if (storyOpen) { closeStory(); return; } go(0); });
$('#noteMore').addEventListener('click', e => { e.preventDefault(); go(4); });

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


// ================================================================ v4: live layers, markets, scoreboard, alerts, breaking
const liveG = new THREE.Group(); world.add(liveG);
const LAY = Object.assign({ air: true, naval: true, bases: true, pins: true }, JSON.parse(localStorage.getItem('fl_lay') || '{}'));
let liveLabels = [];
const isMajor = e => KIN.has(e.type) && (e.sev >= 4 || (e.sev >= 3 && ['missile', 'air', 'drone'].includes(e.type)));
function applyLayers() { markers.visible = LAY.bases; labels.forEach(l => { if (l.el.classList.contains('as')) l.dead2 = !LAY.bases; }); pinGroup.visible = LAY.pins; liveG.visible = LAY.air || LAY.naval; liveG.children.forEach(o => o.visible = LAY[o.userData.layer]); liveLabels.forEach(l => l.hide = !LAY[l.layer]); localStorage.setItem('fl_lay', JSON.stringify(LAY)); }
const PLANE = (() => { const sh = new THREE.Shape(); sh.moveTo(0, .11); sh.lineTo(.02, .02); sh.lineTo(.09, -.02); sh.lineTo(.02, -.01); sh.lineTo(.015, -.07); sh.lineTo(.04, -.09); sh.lineTo(0, -.08); sh.lineTo(-.04, -.09); sh.lineTo(-.015, -.07); sh.lineTo(-.02, -.01); sh.lineTo(-.09, -.02); sh.lineTo(-.02, .02); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; })();
const HULL = (() => { const sh = new THREE.Shape(); sh.moveTo(0, .16); sh.lineTo(.035, .06); sh.lineTo(.035, -.12); sh.lineTo(-.035, -.12); sh.lineTo(-.035, .06); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; })();
S.extras = { ac: null, nav: null, mkt: null };
async function loadExtras(rebuild) {
  const [ac, nav, mkt] = await Promise.all(['aircraft', 'naval', 'markets'].map(n => getJSON('data/' + n + '.json').catch(() => null)));
  S.extras = { ac, nav, mkt }; buildLive(); renderMarkets();
}
function buildLive() {
  if (!S.th || !BB) return;
  liveG.clear(); liveLabels.forEach(l => { l.dead = true; l.el.remove(); }); labels = labels.filter(l => !l.live); liveLabels = [];
  const ac = S.extras.ac;
  if (ac) for (const a of ac.ac) {
    if (!inMap(a.lat, a.lon)) continue;
    const p = ground(a.lat, a.lon); const alt = a.alt === 'ground' ? 0 : Math.max(0, +a.alt || 0);
    p.y = Math.max(p.y, 0) + .25 + Math.min(1.1, alt / 40000);
    const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ color: 0xffd479, side: THREE.DoubleSide, transparent: true, opacity: .95 }));
    m.position.copy(p); m.rotation.y = -((+a.trk || 0) * Math.PI / 180); m.scale.setScalar(1.25); m.userData.layer = 'air'; liveG.add(m);
    const st = new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: .18, depthWrite: false })); st.position.set(p.x, hAt(p.x, p.z), p.z); st.scale.y = p.y - hAt(p.x, p.z); st.userData.layer = 'air'; liveG.add(st);
    const L = addLabel(`<i style="color:#ffd479">✈</i>${esc(a.fl || a.r || a.hex)}${a.t ? ' · ' + esc(a.t) : ''}`, 'as live', p.clone().setY(p.y + .08), 3, { ay: 1, op: .8, maxD: 16, live: true, layer: 'air' }); liveLabels.push(L);
  }
  const nav = S.extras.nav;
  const seen = {};
  if (nav) for (const r of nav.reports) {
    if (!inMap(r.lat, r.lon) || Date.now() / 1000 - r.ts > 21 * 86400) continue;
    const key = r.lat + ',' + r.lon, k = seen[key] = (seen[key] ?? -1) + 1; // ships reported in the same named area are fanned out around its centre
    const p = ground(r.lat, r.lon); p.y = .02; let h = 0; for (const c of r.ship) h = (h * 31 + c.charCodeAt(0)) >>> 0; if (k) { p.x += Math.cos(k * 2.1) * .45; p.z += Math.sin(k * 2.1) * .45; }
    const m = new THREE.Mesh(HULL, new THREE.MeshBasicMaterial({ color: 0x7fd8ff, side: THREE.DoubleSide, transparent: true, opacity: .9 })); m.position.copy(p); m.rotation.y = (h % 360) * Math.PI / 180; m.scale.setScalar(1.4); m.userData.layer = 'naval'; liveG.add(m);
    const rg = new THREE.Mesh(RING2, new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide })); rg.position.copy(p); rg.scale.setScalar(.22); rg.userData.layer = 'naval'; liveG.add(rg);
    const d = new Date(r.ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const L = addLabel(`<i style="color:#7fd8ff">⚓</i>${esc(r.ship)} <em class="rep">REPORTED ${esc(d)} · ${esc(r.outlet)}</em>`, 'as live', p.clone().setY(p.y + .1), 5, { ay: 1, op: .9, maxD: 30, live: true, layer: 'naval' }); liveLabels.push(L);
  }
  applyLayers(); renderLayerInfo();
}
function renderLayerInfo() {
  const ac = S.extras.ac, nav = S.extras.nav; const el = $('#layInfo'); if (!el) return;
  const nIn = ac ? ac.ac.filter(a => inMap(a.lat, a.lon)).length : 0; const nNav = nav ? nav.reports.filter(r => inMap(r.lat, r.lon)).length : 0;
  el.innerHTML = `<p>✈ <b>${nIn}</b> military aircraft broadcasting over this map ${ac ? `(ADS-B snapshot ${esc(hm(ac.now))}, ${esc(ac.src)})` : '(feed unavailable)'}. Most military flights don’t broadcast, so this is never the full picture. Positions are shown exactly as reported and refresh about every 15 minutes.</p>
   <p>⚓ <b>${nNav}</b> ships with <b>reported</b> positions from news articles in the last 21 days (not live AIS; no free live ship feed exists without sign-up). ${nav && nav.reports.length ? nav.reports.filter(r => inMap(r.lat, r.lon)).map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.ship)}: ${esc(cap(r.where))}, ${esc(r.outlet)} ${esc(new Date(r.ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))} ↗</a>`).join('') : ''}</p>`;
}
// ---- market strip
function spark(ser, w = 54, h = 18) {
  if (!ser || ser.length < 2) return ''; const ys = ser.map(p => p[1]); const mn = Math.min(...ys), mx = Math.max(...ys), t0 = ser[0][0], t1 = ser[ser.length - 1][0];
  const X = t => ((t - t0) / (t1 - t0 || 1) * w).toFixed(1), Y = v => (h - 2 - (v - mn) / (mx - mn || 1) * (h - 4)).toFixed(1);
  const marks = S.events.filter(e => isMajor(e) && e.ts >= t0 && e.ts <= t1).map(e => `<line x1="${X(e.ts)}" x2="${X(e.ts)}" y1="0" y2="${h}" stroke="#ff5a3a" stroke-width="1" opacity=".8"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${marks}<polyline fill="none" stroke="currentColor" stroke-width="1.3" points="${ser.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/></svg>`;
}
const fmtP = q => { const v = q.last; if (v == null) return '–'; const s = v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2); return (q.cur === 'USD' && q.kind !== 'fx' ? '$' : '') + s + (q.cur === 'GBp' ? 'p' : ''); };
function renderMarkets() {
  const m = S.extras.mkt, el = $('#mkt'); if (!el) return;
  if (!m) { el.innerHTML = '<span class="mq dim">Markets unavailable</span>'; return; }
  const items = m.q.map(q => { const up = (q.ch || 0) >= 0; return `<span class="mq ${up ? 'up' : 'dn'}" title="${esc(q.name)} · ${esc(m.src)} · ${esc(hm(q.t))}"><b>${esc(q.name.replace('Lockheed Martin', 'LMT').replace('Northrop Grumman', 'NOC').replace('BAE Systems', 'BAE').replace('Dollar index', 'DXY'))}</b> ${fmtP(q)} <em>${q.ch == null ? '' : (up ? '▲' : '▼') + Math.abs(q.ch).toFixed(2) + '%'}</em>${spark(q.series)}</span>`; }).join('') + `<span class="mq dim">5-day · red lines = major reported strikes · ${esc(m.src)}</span>`;
  el.innerHTML = `<div class="mkt-track"><div class="mkt-set">${items}</div><div class="mkt-set" aria-hidden="true">${items}</div></div>`;
  requestAnimationFrame(() => { const t = el.querySelector('.mkt-set'); if (t) el.style.setProperty('--mdur', Math.max(18, t.offsetWidth / 32).toFixed(1) + 's'); });
}
// ---- sides scoreboard (counts of reported, classified incidents only)
// ---- options sheet: layers + alerts
const VAPID = 'BHOiDmI_WYfE7wK2yi1zyAQfG18afV7hl1-9dCvlBnpi_PRHsAB4RZPCwTlnDpbxlSKG9A9hsA7zTyXq1PWnCVk', SPKI = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA/e0bYnNdyuxNqrZQaY7xk9Vf4t91ZQWKNDX81f0RyFuKn1otTPFKzMbEgoYcZbAYEVRU8KPqOJXnErFCK7l7A16Ha3I3NFBd2OcD8/biDGblsU5nxYX/NnqoO4IUnL7S6mS+zb7YIMCyi8M8AxQh1E5jaLZyl+mnUTSyFlR+XiDTbscYRKVDYshn/M7w91WIB4sMKdjNSzflKDAuCNdptmP3yX9ptGJWMDJA1bfTl2u7KXKGxdoubxcqgKztB6jO6H/QitLMs8vZQyJ4BkxYQAFixEOTBmCT2ZsT278gUfVhK8HdnKkYzbFnBRcCl1COKBtO34/dfIcZrLD/YR3jJwIDAQAB', TOPIC = 'https://ntfy.sh/fl-sub-f11ebc9ad43b6dd3b99316cf';
const u8 = b => { const s = atob(b.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b.length % 4) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const LSg = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } };
let P = LSg('fl_push', { on: false, th: ['us-iran'], esc: true, sig: '', synced: 0 });
const DEV = LSg('fl_dev', null) || (() => { const id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now(); localStorage.setItem('fl_dev', JSON.stringify(id)); return id; })();
const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function post(msg) {
  const pub = await crypto.subtle.importKey('spki', u8(SPKI.replace(/\+/g, '-').replace(/\//g, '_')), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(msg))); const k = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, await crypto.subtle.exportKey('raw', key));
  const r = await fetch(TOPIC, { method: 'POST', body: JSON.stringify({ v: 1, k: b64(k), iv: b64(iv), c: b64(c) }) }); if (!r.ok) throw new Error('relay ' + r.status);
}
const saveP = () => localStorage.setItem('fl_push', JSON.stringify(P));
async function pushSync(force, test) {
  if (!P.on || !pushOK() || Notification.permission !== 'granted') return; const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID) });
  const s = sub.toJSON(); const sig = JSON.stringify([s.endpoint, P.th, P.esc]); if (!force && sig === P.sig && Date.now() - P.synced < 86400000) return;
  await post({ id: DEV, sub: { endpoint: s.endpoint, keys: s.keys }, th: P.th, esc: P.esc, v: 4, test: !!test }); P.sig = sig; P.synced = Date.now(); saveP(); renderOpts();
}
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 5200); }
async function pushOn() { if (!pushOK()) { toast('This browser doesn’t support push notifications.'); return; } try { const perm = await Notification.requestPermission(); if (perm !== 'granted') { renderOpts(); return; } P.on = true; saveP(); await pushSync(true, true); toast('Alerts on. A confirmation push arrives with the next refresh (within ~15 min).'); } catch (e) { P.on = false; saveP(); toast('Could not turn on alerts: ' + (e.message || e)); } renderOpts(); }
async function pushOff() { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); await post({ id: DEV, off: true }); sub && await sub.unsubscribe(); } catch (_) { } P.on = false; P.sig = ''; saveP(); renderOpts(); }
function sw(id, on, dis) { return `<button class="sw ${on ? 'on' : ''}" data-sw="${id}" role="switch" aria-checked="${on}" ${dis ? 'disabled' : ''}><i></i></button>`; }
function renderOpts() {
  const el = $('#optsBody'); if (!el || !S.TH) return; const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const note = !pushOK() ? 'Push isn’t supported in this browser.' : perm === 'denied' ? 'Notifications are blocked for this site. Allow them in Chrome’s site settings.' : P.on ? `On. You’ll get major strikes, missile launches and escalation jumps for the conflicts ticked below, even when the app is closed. Max 4 an hour; quiet 00:30–07:30 UK unless severity 5. Delivered within ~15 min of a report.${P.synced ? ' Synced ' + hm(P.synced / 1000) + '.' : ''}` : 'Get notified about major events even when the app is closed.';
  el.innerHTML = `<h3>ALERTS</h3><div class="orow"><span><b>Push alerts</b><small>${note}</small></span>${sw('push', P.on, !pushOK() || perm === 'denied')}</div>
   ${Object.entries(S.TH).map(([id, t]) => `<div class="orow sub ${P.on ? '' : 'dim'}"><span>${esc(t.name)}</span>${sw('th:' + id, P.th.includes(id), !P.on)}</div>`).join('')}
   <div class="orow sub ${P.on ? '' : 'dim'}"><span>Escalation jumps (meter reaches High or Severe)</span>${sw('esc', P.esc, !P.on)}</div>
   ${P.on ? '<button class="obtn" id="pushTest">Send me a test alert</button>' : ''}
   <h3>MAP LAYERS</h3>
   <div class="orow"><span><b>Military aircraft (live ADS-B)</b><small>Public ADS-B/MLAT from adsb.lol, refreshed ~15 min</small></span>${sw('lay:air', LAY.air)}</div>
   <div class="orow"><span><b>Naval positions (reported)</b><small>From news articles, with date and source. Placed at the named sea area, not live tracking</small></span>${sw('lay:naval', LAY.naval)}</div>
   <div class="orow"><span><b>Bases & sites</b><small>Publicly known locations</small></span>${sw('lay:bases', LAY.bases)}</div>
   <div class="orow"><span><b>Event pins</b><small>Reports from the last 24h</small></span>${sw('lay:pins', LAY.pins)}</div>
   <div id="layInfo" class="prose small"></div>`;
  renderLayerInfo();
}
$('#opts').addEventListener('click', async e => {
  if (e.target.id === 'pushTest') { try { await pushSync(true, true); toast('Test requested. It arrives with the next refresh (within ~15 min).'); } catch (err) { toast('Failed: ' + err.message); } return; }
  const b = e.target.closest('[data-sw]'); if (!b || b.disabled) return; const k = b.dataset.sw;
  if (k === 'push') { P.on ? await pushOff() : await pushOn(); return; }
  if (k.startsWith('th:')) { const id = k.slice(3); P.th = P.th.includes(id) ? P.th.filter(x => x !== id) : [...P.th, id]; saveP(); renderOpts(); pushSync(true).catch(() => { }); return; }
  if (k === 'esc') { P.esc = !P.esc; saveP(); renderOpts(); pushSync(true).catch(() => { }); return; }
  if (k.startsWith('lay:')) { const id = k.slice(4); LAY[id] = !LAY[id]; applyLayers(); renderOpts(); }
});
function openOpts() { $('#opts').classList.add('open'); $('#scrim').classList.add('on'); renderOpts(); }
$('#fabOpts').addEventListener('click', openOpts);
$('#fabBell').addEventListener('click', openOpts);
// ---- breaking mode: full-screen code-made intro, then fly to the event
const BRK_SEEN = new Set(LSg('fl_brk', []));
function breaking(e, force) {
  if (!force && (BRK_SEEN.has(e.id) || S.mode === 'scrub' || document.visibilityState !== 'visible')) { if (!force) { S.live = S.live || []; } return; }
  BRK_SEEN.add(e.id); localStorage.setItem('fl_brk', JSON.stringify([...BRK_SEEN].slice(-200)));
  const [nm, ic, col] = TY[e.type]; const side = e.actor ? S.th.sides[e.actor === 'A' ? 0 : 1] : null; const P0 = evPos(e);
  const where = P0.off ? cap(P0.where) + ' (off-map)' : P0.unk ? 'Location not stated' : cap(P0.where);
  const words = esc(e.title).split(' ').map((w, i) => `<span style="animation-delay:${1.15 + i * .07}s">${w}</span>`).join(' ');
  const el = $('#brk'); el.style.setProperty('--c', col);
  el.innerHTML = `<div class="bk-scan"></div><div class="bk-grid"></div><div class="bk-radar"><i></i><b></b><em style="background:${side ? side.color : col}"></em></div>
   <div class="bk-top"><span class="bk-live">● BREAKING</span><span>${esc(S.th.name.toUpperCase())}</span></div>
   <div class="bk-mid"><div class="bk-kick"><span class="bk-ic">${ic}</span>${nm}${side ? ` <span class="bk-side" style="color:${side.color}">${esc(side.short)} ▸</span>` : ''}</div>
    <h1 class="bk-h">${words}</h1>
    <div class="bk-meta"><span>📍 ${esc(where)}</span><span>${esc(e.outlet)}${(e.n || 1) > 1 ? ` +${e.n - 1} outlets` : ''}</span><span>${hm(e.ts)} · ${ago(e.ts)}</span></div>
    <div class="bk-sev">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= e.sev ? 'on' : ''}" style="animation-delay:${.9 + i * .08}s"></i>`).join('')}<span>SEVERITY ${e.sev}/5</span></div></div>
   <div class="bk-foot">Symbolic visual of a reported event · tap to skip</div>`;
  el.className = 'on'; vib([30, 40, 30]);
  let done = false; const end = () => { if (done) return; done = true; el.className = 'on out'; setTimeout(() => { el.className = ''; el.innerHTML = ''; }, 700); S.userAt = -1e9; go(0); setTimeout(() => { play(e); S.nextAt = performance.now() + 6500; }, 350); };
  el.onclick = end; setTimeout(end, RMQ.matches ? 1800 : 5200);
}

// ---------------------------------------------------------------- load
function clearWorld() { for (const o of [...world.children]) if (o !== markers && o !== pinGroup && o !== liveG) world.remove(o); markers.clear(); pinGroup.clear(); pins.clear(); fx.length = 0; labels.forEach(l => l.el.remove()); labels = []; if (terrain) { terrain.geometry.dispose(); terrain = null; } }
async function loadTheatre(tid) {
  if (!S.TH[tid]) tid = 'us-iran';
  const firstLoad = !S.tid; if (!firstLoad && !RMQ.matches) { const w = $('#wipe'); w.querySelector('b').textContent = S.TH[tid].name; w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); } else $('#boot').classList.remove('gone');
  if (S.tid && S.tid !== tid) markVisit();
  S.tid = tid; S.th = S.TH[tid]; localStorage.setItem('fl_t', tid);
  $('#thName').textContent = S.th.name; $('#sideA').textContent = S.th.sides[0].short; $('#sideB').textContent = S.th.sides[1].short;
  document.documentElement.style.setProperty('--A', S.th.sides[0].color); document.documentElement.style.setProperty('--B', S.th.sides[1].color);
  clearWorld();
  const [d] = await Promise.all([getJSON('data/' + tid + '.json').catch(() => ({ events: [] })), buildTerrain(tid, S.th)]);
  buildMarkers(S.th); homeCam(); liveG.clear(); loadExtras(true);
  if (!RMQ.matches) { S.rise = performance.now(); world.scale.y = .02; }
  S.seen = new Set(); S.events = mergeFast(toLeads(d)); S.events.forEach(e => S.seen.add(e.id)); S.clusters = groupClusters(); S.live = [];
  for (const c of S.clusters) { if (Date.now() / 1000 - c.lead.ts < 7 * 86400) dropPin(c.lead, evPos(c.lead)); }
  goLive(true); S.nextAt = performance.now() + 1500; renderSent();
  renderFeed();
  setTimeout(() => { $('#boot').classList.add('gone'); $('#hud').classList.remove('loading'); }, 300);
}


// ---- sentiment bar (rule-based lexicon over recent incident headlines, plus GDELT tone when GDELT answers)
function sentInfo() { return ((S.index && S.index.theatres) || []).find(t => t.id === S.tid)?.sent || null; }
function renderSent() {
  const x = sentInfo(); const btn = $('#sent'); if (!btn) return;
  if (!x || x.score == null) { $('#sentW').textContent = 'not enough reports'; $('#sentM').style.left = '50%'; $('#sentFill').style.cssText = 'left:50%;width:0'; $('#sentT').textContent = ''; return; }
  const v = 50 + 50 * x.score; const w = x.score > .25 ? 'ESCALATING' : x.score < -.25 ? 'DE-ESCALATING' : 'MIXED';
  $('#sentW').textContent = w; $('#sentW').className = 'sw0 ' + (x.score > .25 ? 'esc' : x.score < -.25 ? 'de' : 'mix');
  $('#sentM').style.left = v.toFixed(1) + '%';
  $('#sentFill').style.cssText = v >= 50 ? `left:50%;width:${(v - 50).toFixed(1)}%` : `left:${v.toFixed(1)}%;width:${(50 - v).toFixed(1)}%`;
  btn.classList.toggle('hot', x.score > .25); btn.classList.toggle('cool', x.score < -.25);
  const d = x.prev == null ? null : x.score - x.prev;
  $('#sentT').textContent = (d == null ? '' : (d > .05 ? '↑ ' : d < -.05 ? '↓ ' : '→ ')) + x.n + ' rep.';
  $('#sentT').title = `24h trend vs previous 24h; based on ${x.n} incident headlines`;
}
function openSent() {
  const x = sentInfo(); const f = v => v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(2);
  $('#sentBody').innerHTML = `<p>This bar reads the <b>tone of reported coverage</b>, not what is happening on the ground. It uses fixed word rules, no AI.</p>
  <ul><li>Every incident headline from the last 24h (one per incident after merging outlets) is checked against two word lists: <b>escalatory</b> (strike, retaliate, missile, attack, killed, warns, invasion…) and <b>de-escalatory</b> (talks, ceasefire, truce, deal, negotiations, aid, release…).</li>
  <li>A headline scores (escalatory − de-escalatory) ÷ (total matched words), from −1 to +1. Phrases like “talks collapse” or “rejects ceasefire” count as escalatory.</li>
  <li>The bar is the average over all matching headlines. When the GDELT tone API answers (it often rate-limits), its 24h average tone for the conflict is blended in at 25% (tone −3 = neutral; more negative = more escalatory).</li>
  <li>The arrow compares with the previous 24 hours. Below 0.25 either way it reads <b>Mixed</b>.</li></ul>
  ${x ? `<p class="small">Now: score ${f(x.score)} (wording ${f(x.lex)}${x.gdelt ? `, GDELT tone ${x.gdelt.tone} from ${x.gdelt.n} samples` : ', GDELT tone unavailable'}). Based on ${x.n} of ${x.n_all} incident headlines in 24h; previous 24h ${f(x.prev)} from ${x.n_prev}. Few reports = low confidence.</p>` : '<p class="small">No data yet.</p>'}`;
  $('#sentS').classList.add('open'); $('#scrim').classList.add('on');
}
$('#sent').addEventListener('click', openSent);


// ================================================================ v8
// ---- open-app replay: only what is new since the last visit (per theatre), else a short look at the latest item
const LV_KEY = t => 'fl_lv_' + t;
function lastVisit(t) { const v = +localStorage.getItem(LV_KEY(t)); return v > 0 ? v : 0; }
function markVisit() { if (S.tid) localStorage.setItem(LV_KEY(S.tid), String(Math.floor(Date.now() / 1000))); }
function openQueue() {
  const lv = lastVisit(S.tid); const leads = S.clusters.map(c => c.lead).sort((a, b) => a.ts - b.ts);
  const fresh = lv ? leads.filter(e => e.ts > lv) : []; S.firstVisit = !lv;
  S.once = true; S.qi = 0; S.doneAt = 0; S.loopH = 24;
  if (fresh.length) { S.queue = fresh.slice(-24); S.since = true; }
  else { S.queue = leads.length ? [leads[leads.length - 1]] : []; S.since = false; }
}
function idleQueue() { const leads = S.clusters.map(c => c.lead).sort((a, b) => a.ts - b.ts); S.queue = leads.length ? [leads[leads.length - 1]] : []; S.qi = S.queue.length; S.once = true; S.since = false; S.doneAt = 1; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') markVisit(); });
addEventListener('pagehide', markVisit);

// ---- sheets: one close path for every panel; handle tap + drag-down to close
const TAB_SHEETS = { feed: 1, sides: 2, replay: 3, about: 4 };
$('#ticker').addEventListener('click', ev => { if (!S.tickE) return; ev.preventDefault(); openStory(S.tickE); });
function closeSheet(el) {
  if (!el) return; if (el.id === 'story') { closeStory(); return; }
  if (TAB_SHEETS[el.id] && !(DESK.matches && el.id === 'feed')) { if (dockI === TAB_SHEETS[el.id]) go(0); else el.classList.remove('open'); return; }
  el.classList.remove('open'); if (!document.querySelector('.sheet.open:not(#feed)') || DESK.matches) $('#scrim').classList.remove('on');
}
function sheetDrag(el) {
  const zones = el.querySelectorAll('.grab, .shead, .sthead'); let d = null;
  zones.forEach(z => {
    z.addEventListener('pointerdown', e => { if (e.button > 0 || e.target.closest('button:not(.grab), a, input')) return; d = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId }; try { z.setPointerCapture(e.pointerId); } catch (_) { } el.classList.add('dragging'); });
    z.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; d.dy = Math.max(0, e.clientY - d.y); el.style.transform = `translate3d(0,${d.dy}px,0)`; });
    const end = e => { if (!d) return; const { dy, t } = d; const tap = dy < 6 && performance.now() - t < 500; d = null; el.classList.remove('dragging'); el.style.transform = '';
      if (e.type !== 'pointercancel' && (dy > 70 || tap && e.currentTarget.classList.contains('grab') || tap && e.currentTarget.classList.contains('shead') && e.target.closest('.grab'))) closeSheet(el); };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
    if (z.classList.contains('grab')) { z.setAttribute('role', 'button'); z.setAttribute('aria-label', 'Close panel'); z.tabIndex = 0; z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeSheet(el); } }); }
  });
}
document.querySelectorAll('.sheet').forEach(sheetDrag);
addEventListener('keydown', e => { if (e.key === 'Escape') { const o = [...document.querySelectorAll('.sheet.open')].filter(x => !(DESK.matches && x.id === 'feed')).pop(); if (o) closeSheet(o); } });

// ---- headline tone (same fixed lexicon as scripts/fetch.py)
const ESC_RX = /\b(strikes?|struck|airstrikes?|attack(s|ed|ing)?|retaliat\w*|escalat\w*|missiles?|drones?|bomb\w*|kill(s|ed|ing)?|dead|deaths?|invad\w*|invasion|offensive|threat(s|en\w*)?|warn(s|ed|ing)?|war|wars|mobili[sz]\w*|shell(s|ed|ing)|assault\w*|raids?|clash(es|ed)?|revenge|ultimatum|seiz\w*|explosions?|blasts?|launch(es|ed)?|fire[sd]?|intercept\w*|casualt\w*|wounded|injur\w*|sanction\w*|hostil\w*|bombard\w*|siege)\b/gi;
const DE_RX = /\b(talks?|ceasefire|cease-fire|truce|peace|negotiat\w*|deal|agreements?|diplomac\w*|diplomat\w*|dialogue|de-?escalat\w*|calm|restraint|releas\w*|exchanges?|humanitarian|aid|mediat\w*|summit|withdraw\w*|pause[sd]?|reopen\w*|accords?|envoys?|meet(s|ing)?|met|reconcil\w*|handover|resum\w*)\b/gi;
const NEG_RX = /\b(reject\w*|collaps\w*|fail\w*|stall\w*|break(s|ing)? down|broke down|violat\w*|suspend\w*|walk(s|ed)? out|call(s|ed)? off|no deal|end(s|ed)? (the )?(truce|ceasefire))\b/i;
function toneOf(t) { const E = (t.match(ESC_RX) || []), D = (t.match(DE_RX) || []); let e = E.length, d = D.length; if (d && NEG_RX.test(t)) { e += d; d = 0; } return e + d ? { v: (e - d) / (e + d), E, D } : null; }

// ---- casualty figures: only when a headline/summary states a number (shown with its source, never summed)
const CAS_RX = /\b(\d{1,3}(?:,\d{3})*|\d+)\s+(?:people\s+|civilians\s+|soldiers\s+|troops\s+|children\s+|palestinians\s+|israelis\s+|ukrainians\s+|russians\s+|iranians\s+|others\s+|fighters\s+|militants\s+|persons\s+)?(?:were\s+|are\s+|have been\s+)?(killed|dead|die[ds]?|wounded|injured|hurt)\b/i;
const casOf = e => { for (const t of [e.title, e.desc || '']) { const m = t && t.match(CAS_RX); if (m) return { n: m[1], what: /kill|dead|die/i.test(m[2]) ? 'killed' : 'injured', text: m[0] }; } return null; };

// ---- in-app story view
let storyOpen = null;
function related(e) {
  const tk = new Set((e.title.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(w => !['says', 'said', 'after', 'amid', 'with', 'from', 'over', 'that', 'this', 'their', 'will'].includes(w)));
  return S.clusters.map(c => c.lead).filter(x => x.id !== e.id).map(x => { const t2 = (x.title.toLowerCase().match(/[a-z0-9]{4,}/g) || []); let sc = t2.filter(w => tk.has(w)).length;
    if (e.loc && x.loc && e.loc.name === x.loc.name && e.loc.kind !== 'country') sc += 1.5; if (x.type === e.type) sc += .5; return [sc, x]; }).filter(([sc]) => sc >= 2.5).sort((a, b) => b[0] - a[0] || b[1].ts - a[1].ts).slice(0, 5).map(x => x[1]);
}
function miniMap(e) {
  if (!S.borders || !BB) return ''; const kx = Math.cos(LATC * Math.PI / 180); const W = (BB[2] - BB[0]) * kx, H = BB[3] - BB[1];
  const X = lon => ((lon - BB[0]) * kx).toFixed(2), Y = lat => (BB[3] - lat).toFixed(2);
  const lines = S.borders.map(L => { let d = ''; for (let i = 0; i + 1 < L.length; i += 2) d += (i ? 'L' : 'M') + X(L[i]) + ' ' + Y(L[i + 1]); return d; }).join('');
  const P = e.loc && e.loc.lat != null && inMap(e.loc.lat, e.loc.lon) ? `<circle class="mmp" cx="${X(e.loc.lon)}" cy="${Y(e.loc.lat)}" r="${(W / 60).toFixed(2)}"/><circle class="mmr" cx="${X(e.loc.lon)}" cy="${Y(e.loc.lat)}" r="${(W / 60).toFixed(2)}"/>` : '';
  return `<svg class="mm" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" preserveAspectRatio="xMidYMid meet"><path d="${lines}" vector-effect="non-scaling-stroke"/>${P}</svg>`;
}
function storyHTML(e) {
  const [nm, ic, col] = TY[e.type]; const sd = S.th.sides; const side = k => sd[k === 'A' ? 0 : 1];
  const who = [e.atk ? `<span class="chip2" style="color:${side(e.atk).color}">${esc(side(e.atk).short)} ▸ acted</span>` : '', e.icp ? `<span class="chip2" style="color:${side(e.icp).color}">${esc(side(e.icp).short)} intercepted</span>` : '',
    ...(e.men || []).filter(k => k !== e.atk && k !== e.icp).map(k => `<span class="chip2 dim" style="color:${side(k).color}">${esc(side(k).short)} mentioned</span>`)].join('');
  const P = evPos(e); const where = P.off ? cap(P.where) + ' (off this map)' : P.unk ? 'Location not stated' : cap(P.where) + (P.approx ? ' (country-level)' : '');
  const tn = toneOf(e.title); const tv = tn ? 50 + 50 * tn.v : 50; const cas = casOf(e);
  const outs = (e.outlets && e.outlets.length ? e.outlets : [{ outlet: e.outlet, url: e.url, title: e.title, ts: e.ts, via: e.via }]);
  const rel = related(e);
  return `<div class="grab"></div>
  <div class="sthead"><span class="tag" style="color:${col}">${ic} ${nm}</span>${e.live ? '<span class="lvb">● LIVE</span>' : ''}<span class="sev" style="color:${col}">${'●'.repeat(e.sev)}${'○'.repeat(5 - e.sev)}</span><button class="stx" aria-label="Close">✕</button></div>
  <div class="stbody">
   <h1 class="sth">${esc(e.title)}</h1>
   <div class="stm"><span>${esc(e.outlet)}</span><span>${hm(e.ts)}</span><span>${ago(e.ts)}</span>${outs.length > 1 ? `<span>${outs.length} outlets</span>` : ''}</div>
   ${who ? `<div class="stwho">${who}</div>` : ''}
   ${e.desc ? `<p class="std">${esc(e.desc)}</p><p class="stsrc">Summary from the ${esc(e.outlet)} feed.</p>` : `<p class="stsrc">The feed gave no summary for this report.</p>`}
   ${cas ? `<div class="stcas">Figure stated in this report: <b>${esc(cas.text)}</b> (${esc(e.outlet)}). Not independently verified.</div>` : ''}
   <div class="stcard"><div class="stcl">WHERE</div><div class="stloc"><div class="mmw">${miniMap(e)}</div><div><b>${esc(where)}</b><small>Placed from place names in the headline. Animations are symbolic.</small><button class="obtn stfly">Show on map ▸</button></div></div></div>
   <div class="stcard"><div class="stcl">HEADLINE TONE</div>${tn ? `<div class="srow"><span class="se">De-esc.</span><div class="sbar2"><em class="stn" style="left:${tv.toFixed(1)}%"></em></div><span class="se">Esc.</span></div><small>${tn.E.length ? 'Escalatory words: ' + esc([...new Set(tn.E.map(w => w.toLowerCase()))].join(', ')) + '. ' : ''}${tn.D.length ? 'De-escalatory: ' + esc([...new Set(tn.D.map(w => w.toLowerCase()))].join(', ')) + '.' : ''} Fixed word lists, same as the sentiment bar.</small>` : '<small>No words from either list in this headline.</small>'}</div>
   <div class="stcard"><div class="stcl">COVERAGE · ${outs.length} OUTLET${outs.length > 1 ? 'S' : ''}</div>${outs.map(o => `<div class="sto"><b>${esc(o.outlet)}${o.via === 'GDELT' ? ' <i>via GDELT</i>' : o.via === 'LIVE' ? ' <i>fast lane</i>' : ''}</b><span>${esc(o.title || '')}</span><small>${hm(o.ts)} · ${ago(o.ts)} · <a href="${esc(o.url)}" target="_blank" rel="noopener">Read original ↗</a></small></div>`).join('')}</div>
   ${rel.length ? `<div class="stcard"><div class="stcl">RELATED INCIDENTS</div>${rel.map(x => `<button class="strel" data-id="${esc(x.id)}"><span class="tag" style="color:${TY[x.type][2]}">${TY[x.type][1]} ${TY[x.type][0]}</span><b>${esc(x.title)}</b><small>${esc(x.outlet)} · ${ago(x.ts)}</small></button>`).join('')}</div>` : ''}
   <p class="stnote">Frontline shows headlines and feed summaries only, with links to the original reporting.</p>
  </div>
`;
}
function openStory(e, push = true) {
  if (!e) return; const el = $('#story'); storyOpen = e; el.innerHTML = storyHTML(e); el.scrollTop = 0; sheetDrag(el);
  $('#stbar').innerHTML = `<button class="obtn stfly">Show on map</button><a class="obtn pri" href="${esc(e.url)}" target="_blank" rel="noopener">Read original at ${esc(e.outlet)} ↗</a>`;
  requestAnimationFrame(() => { el.classList.add('open'); $('#stbar').classList.add('open'); }); document.body.classList.add('storyon');
  if (push) history.pushState({ story: e.id }, '', location.pathname + location.search + '#t=' + S.tid + '&s=' + encodeURIComponent(e.id));
  else history.replaceState({ story: e.id }, '', location.pathname + location.search + '#t=' + S.tid + '&s=' + encodeURIComponent(e.id));
}
function hideStory() { const el = $('#story'); el.classList.remove('open'); $('#stbar').classList.remove('open'); document.body.classList.remove('storyon'); storyOpen = null; }
function closeStory() { if (history.state && history.state.story) history.back(); else { hideStory(); history.replaceState(null, '', location.pathname + location.search + '#t=' + S.tid); } }
addEventListener('popstate', ev => { const id = ev.state && ev.state.story; if (id) { const e = S.events.find(x => x.id === id); if (e) openStory(e, false); } else if (storyOpen) hideStory(); });
const storyClick = ev => {
  if (ev.target.closest('.stx')) { closeStory(); return; }
  if (ev.target.closest('.stfly')) { const e = storyOpen; closeStory(); setTimeout(() => { S.userAt = -1e9; go(0); play(e); }, 320); return; }
  const r = ev.target.closest('.strel'); if (r) { const e = S.events.find(x => x.id === r.dataset.id); if (e) openStory(e, false); }
};
$('#story').addEventListener('click', storyClick); $('#stbar').addEventListener('click', storyClick);
// the body (not only the handle) closes on a firm swipe down when scrolled to the top
(() => { const el = $('#story'); let y0 = null, dy = 0; el.addEventListener('touchstart', e => { y0 = el.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  el.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0 && el.scrollTop <= 0) { el.classList.add('dragging'); el.style.transform = `translate3d(0,${dy * .9}px,0)`; } }, { passive: true });
  el.addEventListener('touchend', () => { if (y0 == null) return; el.classList.remove('dragging'); el.style.transform = ''; if (dy > 110) closeStory(); y0 = null; }); })();

// ---- count-up numbers
function countUp(root) { if (RMQ.matches) return; root.querySelectorAll('[data-n]').forEach(el => { const to = +el.dataset.n; if (!(to > 0)) return; const st = performance.now(), dur = 650 + Math.min(500, to * 40);
  const f = now => { const u = Math.min(1, (now - st) / dur); el.textContent = Math.round(to * (1 - (1 - u) ** 3)); if (u < 1) requestAnimationFrame(f); }; el.textContent = '0'; requestAnimationFrame(f); }); }
function countTo(el, to) { if (RMQ.matches || !el) { if (el) el.textContent = to; return; } const from = +el.textContent || 0; if (from === to) { el.textContent = to; return; } const st = performance.now();
  const f = now => { const u = Math.min(1, (now - st) / 800); el.textContent = Math.round(from + (to - from) * (1 - (1 - u) ** 3)); if (u < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

// ---- sides scoreboard v8: clearer stats, each tappable to list the exact incidents
const SB_ROWS = [
  ['launched', 'Strikes launched', 'Missile, drone, air, naval or ground attacks this side is reported to have carried out.', e => KIN.has(e.type), 'atk'],
  ['received', 'Strikes received', 'Attacks the other side is reported to have carried out against this side, including ones reported intercepted.', e => KIN.has(e.type), 'rcv'],
  ['intercepted', 'Interceptions', 'Reports of this side shooting down or intercepting incoming missiles or drones.', e => !!e.icp, 'icp'],
  ['cas', 'Casualty figures reported', 'Attacks by this side where the report itself states a number killed or injured. Figures are listed with their source, never added up.', e => KIN.has(e.type) && !!casOf(e), 'atk'],
  ['diplo', 'Diplomatic moves', 'Talks, deals, ceasefire steps, envoys and meetings that name this side.', e => e.type === 'diplomacy', 'men'],
  ['threat', 'Threats & statements', 'Warnings, threats and official statements that name this side.', e => e.type === 'threat' || e.type === 'statement', 'men'],
  ['naval', 'Deployments & naval moves', 'Troop, ship or aircraft movements and naval incidents that name this side.', e => e.type === 'deploy' || e.type === 'naval', 'men'],
];
function sbMatch(row, e, side) { const [, , , f, fld] = row; if (!f(e)) return false; if (fld === 'men') return (e.men || []).includes(side); if (fld === 'rcv') return !!e.atk && e.atk !== side; return e[fld] === side; }
function renderSides() {
  const now = S.mode === 'scrub' ? S.T : Date.now() / 1000; const sd = S.th.sides;
  const d1 = clustersIn(now - 86400, now), d7 = clustersIn(now - 7 * 86400, now);
  const trend = (n1, n7) => { const avg = n7 / 7; if (!n7) return ['', '']; return n1 > avg * 1.5 + .5 ? ['up', '↑'] : n1 < avg * .5 - .25 ? ['dn', '↓'] : ['', '→']; };
  const cell = (row, side) => { const n1 = d1.filter(e => sbMatch(row, e, side)).length, n7 = d7.filter(e => sbMatch(row, e, side)).length; const [tc, ta] = trend(n1, n7);
    return { n1, n7, html: `<button class="sbc ${side}" data-row="${row[0]}" data-side="${side}" ${n7 ? '' : 'disabled'} aria-label="${esc(row[1])}, ${esc(sd[side === 'A' ? 0 : 1].name)}: ${n1} in 24 hours, ${n7} in 7 days"><b data-n="${n1}">${n1}</b><span>24h</span><i data-n="${n7}">${n7}</i><span>7d</span><em class="tr ${tc}" title="24h vs 7-day daily average">${ta}</em></button>` }; };
  const unat = d7.filter(e => KIN.has(e.type) && !e.atk && !e.icp);
  $('#sidesBody').innerHTML = `<div class="sbh"><span style="color:${sd[0].color}">${esc(sd[0].name)}</span><span>24h · 7d</span><span style="color:${sd[1].color}">${esc(sd[1].name)}</span></div>` +
    `<p class="sbhint">Tap any number to see the exact reports behind it.</p>` + SB_ROWS.map(row => { const a = cell(row, 'A'), b = cell(row, 'B'); const tot = Math.max(1, a.n7 + b.n7);
      return `<div class="sbr" data-row="${row[0]}"><div class="sbl">${row[1]}</div><div class="sbv">${a.html}<div class="sbbar"><i style="--w:${(a.n7 / tot * 100).toFixed(1)}%;background:${sd[0].color}"></i><i style="--w:${(b.n7 / tot * 100).toFixed(1)}%;background:${sd[1].color}"></i></div>${b.html}</div><div class="sbx">${row[2]} Last 24h and last 7 days.</div><div class="sbd"><div></div></div></div>`; }).join('') +
    `<div class="sbr" data-row="unat"><div class="sbl">Attacks with no clear actor</div><div class="sbv one"><button class="sbc" data-row="unat" data-side="-" ${unat.length ? '' : 'disabled'}><b data-n="${d1.filter(e => KIN.has(e.type) && !e.atk && !e.icp).length}">0</b><span>24h</span><i data-n="${unat.length}">0</i><span>7d</span></button></div><div class="sbx">Kinetic reports whose headline doesn't say who acted. Not counted for either side.</div><div class="sbd"><div></div></div></div>` +
    `<p class="sbn">All counts are <b>reported incidents</b>: news reports merged across outlets and sorted by fixed keyword rules, which can misread a headline. Tap any number to check the exact reports behind it. Trend arrows compare the last 24h with the 7-day daily average.</p>`;
  countUp($('#sidesBody'));
}
function sbList(rowId, side) {
  const now = S.mode === 'scrub' ? S.T : Date.now() / 1000; const d7 = clustersIn(now - 7 * 86400, now);
  const row = SB_ROWS.find(r => r[0] === rowId); const list = (rowId === 'unat' ? d7.filter(e => KIN.has(e.type) && !e.atk && !e.icp) : d7.filter(e => sbMatch(row, e, side))).sort((a, b) => b.ts - a.ts);
  return list.map((e, i) => { const [nm, ic, col] = TY[e.type]; const c = rowId === 'cas' ? casOf(e) : null;
    return `<div class="sbitem" style="--i:${i}"><button class="sbo" data-id="${esc(e.id)}"><span class="tag" style="color:${col}">${ic} ${nm}</span>${now - e.ts < 86400 ? '<span class="n24">24h</span>' : ''}<b>${esc(e.title)}</b><small>${esc(e.outlet)}${(e.n || 1) > 1 ? ` +${e.n - 1}` : ''} · ${hm(e.ts)} · ${ago(e.ts)}</small>${c ? `<small class="cas">Stated: “${esc(c.text)}”</small>` : ''}</button><div class="sba"><button class="sbf" data-id="${esc(e.id)}">Map ▸</button><a href="${esc(e.url)}" target="_blank" rel="noopener">Original ↗</a></div></div>`; }).join('') || '<div class="empty">No reports.</div>';
}
$('#sidesBody').addEventListener('click', ev => {
  const c = ev.target.closest('.sbc'); if (c) { const r = c.closest('.sbr'); const key = c.dataset.row + c.dataset.side; const open = r.classList.contains('open') && r.dataset.k === key;
    $('#sidesBody').querySelectorAll('.sbr.open').forEach(x => { x.classList.remove('open'); x.querySelectorAll('.sbc').forEach(b => b.classList.remove('sel')); });
    if (!open) { r.dataset.k = key; r.querySelector('.sbd>div').innerHTML = `<div class="sbdh">${c.dataset.side === '-' ? 'Unattributed attacks' : esc(S.th.sides[c.dataset.side === 'A' ? 0 : 1].name)} · ${esc(r.querySelector('.sbl').textContent)} · last 7 days</div>` + sbList(c.dataset.row, c.dataset.side); r.classList.add('open'); c.classList.add('sel'); setTimeout(() => r.scrollIntoView({ block: 'nearest', behavior: RMQ.matches ? 'auto' : 'smooth' }), 120); }
    return; }
  const o = ev.target.closest('.sbo'); if (o) { openStory(S.events.find(x => x.id === o.dataset.id)); return; }
  const f = ev.target.closest('.sbf'); if (f) { const e = S.events.find(x => x.id === f.dataset.id); if (e) { S.userAt = -1e9; go(0); setTimeout(() => play(e), 250); } }
});

// ---- fast lane: Al Jazeera items published by the box poller (scripts/live.py) to a public ntfy topic, polled every minute
const LIVE_TOPIC = 'fl-live-8143ad24bad1fb3ffba4'; S.fast = {};
const nurl = u => { try { const x = new URL(u); return (x.protocol + '//' + x.host.toLowerCase() + x.pathname.replace(/\/+$/, '')); } catch (_) { return u; } };
function mergeFast(all) {
  const fast = Object.values(S.fast[S.tid] || {}); if (!fast.length) return all;
  const byUrl = new Map(fast.map(e => [nurl(e.url), e]));
  for (const c of all) for (const o of (c.outlets || [])) { const f = byUrl.get(nurl(o.url)); if (f) { c.live = 1; if (S.seen && S.seen.has(f.cid)) S.seen.add(c.id); byUrl.delete(nurl(o.url)); } }
  const extra = [...byUrl.values()].map(e => ({ ...e, id: e.cid, via: 'LIVE' }));
  return extra.length ? [...extra, ...all].sort((a, b) => b.ts - a.ts) : all;
}
async function pollFast() {
  try {
    const r = await fetch('https://ntfy.sh/' + LIVE_TOPIC + '/json?poll=1&since=6h', { cache: 'no-store' }); if (!r.ok) return;
    let got = 0;
    for (const ln of (await r.text()).split('\n')) { try { const m = JSON.parse(ln); if (m.event !== 'message') continue; const x = JSON.parse(m.message); if (!x || !x.e || !x.tid || !S.TH[x.tid]) continue; const b = S.fast[x.tid] = S.fast[x.tid] || {}; if (!b[x.e.cid]) { b[x.e.cid] = x.e; if (x.tid === S.tid) got++; } } catch (_) { } }
    S.fastAt = Date.now();
    if (got && S.events) {
      const all = mergeFast(S.events.filter(e => e.via !== 'LIVE')); const fresh = all.filter(e => !S.seen.has(e.id));
      S.events = all; fresh.forEach(e => S.seen.add(e.id)); S.clusters = groupClusters();
      S.live.push(...fresh.sort((a, b) => a.ts - b.ts)); if (S.mode !== 'scrub') { metrics(Date.now() / 1000); buildQueue(); } renderFeed();
    }
  } catch (_) { }
}
async function poll() {
  try {
    S.index = await getJSON('data/index.json'); renderSent();
    const d = await getJSON('data/' + S.tid + '.json');
    const all = mergeFast(toLeads(d)); const fresh = all.filter(e => !S.seen.has(e.id));
    loadExtras();
    if (fresh.length) {
      S.events = all; fresh.forEach(e => S.seen.add(e.id)); S.clusters = groupClusters();
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
  const dt = Math.min(.05, (now - last) / 1000); Q.frame(now - last); last = now;
  terrMat.uniforms.uTime.value = now / 1000;
  tick(now);
  for (let i = fx.length - 1; i >= 0; i--) if (!fx[i](now)) fx.splice(i, 1);
  for (const a of assets) { const s = 1 + .25 * Math.sin(now / 700 + a.phase); a.ring.scale.setScalar(.09 * s); a.gl.material.opacity = .6 + .3 * Math.sin(now / 500 + a.phase);
    if (a.ping) { const u = ((now / 1000 + a.phase) % 3.2) / 3.2; a.ping.scale.setScalar(.06 + u * .34); a.ping.material.opacity = (1 - u) ** 2 * .5; } }
  if (motes.visible) { motes.rotation.y = now / 90000; motes.position.y = Math.sin(now / 4000) * .05; }
  if (S.rise != null) { const u = Math.min(1, (now - S.rise) / 1300); world.scale.y = .02 + .98 * (1 - (1 - u) ** 3); if (u >= 1) S.rise = null; }
  camera.position.sub(_shk);
  const idle = performance.now() - S.userAt > 15000;
  if (camGoal.target && idle && camGoal.fl) {  // eased flight: smootherstep path + altitude arc
    const F = camGoal.fl; const u = Math.min(1, (now - F.t0) / F.dur); const e = u * u * u * (u * (u * 6 - 15) + 10);
    const off = camera.position.clone().sub(controls.target);
    controls.target.copy(F.a).lerp(camGoal.target, e);
    off.setLength((F.d0 + (camGoal.dist - F.d0) * e) * (1 + F.arc * Math.sin(Math.PI * e)));
    camera.position.copy(controls.target).add(off); if (u >= 1) camGoal.fl = null;
  } else if (camGoal.target && idle) {
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
  applyLayers(); renderOpts(); pushSync(false).catch(() => { });
  await Promise.race([pollFast(), new Promise(r => setTimeout(r, 2500))]);
  const hs = decodeURIComponent((location.hash.match(/s=([^&]+)/) || [])[1] || ''); if (hs) { const e = S.events.find(x => x.id === hs); if (e) { history.replaceState(null, '', location.pathname + location.search + '#t=' + S.tid); openStory(e); } }
  const he = (location.hash.match(/e=([\w-]+)/) || [])[1]; if (he) { const e = S.events.find(x => x.id === he); if (e) setTimeout(() => breaking(e, true), 600); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', ev => { const m = ev.data || {}; if (m.type === 'open' && m.url) { const u = new URL(m.url); const t = (u.hash.match(/t=([\w-]+)/) || [])[1], e = (u.hash.match(/e=([\w-]+)/) || [])[1]; (t && t !== S.tid ? loadTheatre(t) : Promise.resolve()).then(() => { const ev2 = S.events.find(x => x.id === e); if (ev2) breaking(ev2, true); }); } if (m.type === 'pushed') poll(); });
  requestAnimationFrame(frame);
  setInterval(poll, 120000); setInterval(() => { if (document.visibilityState === 'visible') pollFast(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { poll(); pollFast(); } });
  $('#mkt').addEventListener('click', () => $('#mkt').classList.toggle('paused'));
window.__fl = { S, play, go, flyTo, homeCam, breaking, openOpts, renderSides, loadExtras, ground };
}
init().catch(err => { $('#boot span').textContent = 'Could not start: ' + err.message; console.error(err); });

// ---------------------------------------------------------------- service worker (pattern proven on Android Chrome)
if ('serviceWorker' in navigator) { let had = !!navigator.serviceWorker.controller, rl = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !rl) { rl = true; location.reload(); } });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { r.update(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update(); }); }).catch(() => { })); }
