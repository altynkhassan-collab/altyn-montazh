// 3D фондар (three.js), мульт стилі: toon материал + қара контур
import * as THREE from './node_modules/three/build/three.module.js';

export const W = 1080, H = 1920;
const OUT = new THREE.MeshBasicMaterial({ color: 0x1d140f, side: THREE.BackSide });

function gradMap() {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const GM = gradMap();
export const toon = (c, extra = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: GM }, extra));

// контурымен меш
export function mesh(geo, mat, outline = 0.025) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); g.add(m);
  if (outline) {
    const o = new THREE.Mesh(geo, OUT);
    geo.computeBoundingBox(); const b = geo.boundingBox, sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
    o.scale.set(1 + outline * 2 / Math.max(sx, .01), 1 + outline * 2 / Math.max(sy, .01), 1 + outline * 2 / Math.max(sz, .01));
    g.add(o);
  }
  g.userData.m = m; return g;
}
export function box(w, h, d, c, x, y, z, ol = .025) { const g = mesh(new THREE.BoxGeometry(w, h, d), toon(c), ol); g.position.set(x, y, z); return g; }

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// қазақ оюы (қошқар мүйіз) — канвасқа
export function oyu(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -6);
    ctx.bezierCurveTo(0, -30, k * 34, -34, k * 34, -10); ctx.bezierCurveTo(k * 34, 6, k * 14, 6, k * 16, -8); ctx.stroke();
  }
  ctx.restore();
}

export function makeRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H); r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('bg').appendChild(r.domElement);
  return r;
}

// ---------------- Үй іші (кеш, шам) ----------------
export function houseInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a12);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 100);
  cam.position.set(0, 1.55, 6.2); cam.lookAt(0, 1.75, 0);

  // еден (тақтай)
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#8a5a34'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#7d5030' : '#94623a'; c.fillRect(0, i * 64, w, 62); c.fillStyle = '#4a2c18'; c.fillRect(0, i * 64 + 62, w, 3); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), toon(0xffffff, { map: floorTex }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // қабырғалар
  const wallTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#e6c79c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(150,110,70,${Math.random() * .08})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, Math.random() * 18, 0, 7); c.fill(); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), toon(0xffffff, { map: wallTex })); back.position.set(0, 3.5, -2); scene.add(back);
  for (const k of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), toon(0xdcb98d, { map: wallTex })); sw.position.set(k * 3.2, 3.5, 2); sw.rotation.y = -k * Math.PI / 2; scene.add(sw);
  }
  // төбедегі арқалықтар
  for (let i = 0; i < 4; i++) scene.add(box(7, .22, .26, 0x5a3820, 0, 4.6, -1.6 + i * 1.6));
  // еденнің жиегі
  scene.add(box(12, .25, .12, 0x5a3820, 0, .12, -1.94));

  // терезе (түнгі аспан + ай)
  const winTex = canvasTex(256, 320, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1f45'); g.addColorStop(1, '#2b4c86'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = '#fff'; c.globalAlpha = Math.random() * .8 + .2; c.fillRect(Math.random() * w, Math.random() * h * .7, 2, 2); }
    c.globalAlpha = 1; c.fillStyle = '#fff6cf'; c.beginPath(); c.arc(170, 80, 30, 0, 7); c.fill();
    c.fillStyle = '#16284d'; c.beginPath(); c.moveTo(0, h); c.lineTo(60, 230); c.lineTo(120, 270); c.lineTo(190, 210); c.lineTo(w, 260); c.lineTo(w, h); c.fill();
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ map: winTex })); win.position.set(1.75, 2.75, -1.97); scene.add(win);
  scene.add(box(1.3, .1, .14, 0x6b4426, 1.75, 3.5, -1.92)); scene.add(box(1.3, .14, .2, 0x6b4426, 1.75, 2.0, -1.9));
  scene.add(box(.1, 1.5, .14, 0x6b4426, 1.15, 2.75, -1.92)); scene.add(box(.1, 1.5, .14, 0x6b4426, 2.35, 2.75, -1.92)); scene.add(box(.06, 1.4, .1, 0x6b4426, 1.75, 2.75, -1.92));

  // қабырғадағы тұс кілем
  const rugTex = canvasTex(512, 400, (c, w, h) => {
    c.fillStyle = '#a3222e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e7b84a'; c.lineWidth = 14; c.strokeRect(20, 20, w - 40, h - 40);
    c.fillStyle = '#1f2d5c'; c.fillRect(48, 48, w - 96, h - 96);
    oyu(c, w / 2, h / 2 + 10, 2.3, '#e7b84a');
    for (const [x, y] of [[110, 110], [w - 110, 110], [110, h - 100], [w - 110, h - 100]]) oyu(c, x, y, 1, '#f2ede2');
    for (let i = 30; i < w; i += 36) { c.fillStyle = '#f2ede2'; c.beginPath(); c.moveTo(i, 4); c.lineTo(i + 10, 16); c.lineTo(i + 20, 4); c.fill(); }
  });
  const rug = mesh(new THREE.BoxGeometry(2.0, 1.55, .04), [toon(0xa3222e), toon(0xa3222e), toon(0xa3222e), toon(0xa3222e), toon(0xffffff, { map: rugTex }), toon(0xa3222e)], .02);
  rug.position.set(-1.35, 2.85, -1.96); scene.add(rug);

  // сөре және ыдыстар
  scene.add(box(1.4, .08, .35, 0x6b4426, -1.4, 1.65, -1.8));
  const bowl = (x, c) => { const g = mesh(new THREE.SphereGeometry(.14, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(c), .015); g.rotation.x = Math.PI; g.position.set(x, 1.83, -1.75); g.scale.y = .8; scene.add(g); };
  bowl(-1.85, 0xeef0f3); bowl(-1.5, 0x4a77b0); bowl(-1.15, 0xeef0f3);
  const pot = mesh(new THREE.CylinderGeometry(.12, .16, .34, 16), toon(0xb46a30), .015); pot.position.set(-0.8, 1.86, -1.75); scene.add(pot);
  // сандық
  const chestTex = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#9c3a22'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e7b84a'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); oyu(c, w / 2, h / 2 + 8, 1.2, '#e7b84a'); });
  const chest = mesh(new THREE.BoxGeometry(1.2, .7, .6), [toon(0x7d2c18), toon(0x7d2c18), toon(0x8a321c), toon(0x7d2c18), toon(0xffffff, { map: chestTex }), toon(0x7d2c18)], .02);
  chest.position.set(-2.35, .35, -1.2); chest.rotation.y = .5; scene.add(chest);
  // көрпелер сандық үстінде
  [0xd9a843, 0x2f6f8f, 0xa3222e].forEach((c, i) => { const b = box(1.1, .14, .55, c, -2.35, .78 + i * .15, -1.2, .015); b.rotation.y = .5; scene.add(b); });

  // жарық
  scene.add(new THREE.HemisphereLight(0x8fa6d8, 0x3a2414, .9));
  const lamp = new THREE.PointLight(0xffb45a, 26, 12, 1.6); lamp.position.set(0, 1.45, 1.6); scene.add(lamp);
  const moon = new THREE.DirectionalLight(0x9ab8ff, .5); moon.position.set(2, 4, 3); scene.add(moon);

  return {
    scene, cam,
    update(t) { lamp.intensity = 26 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23.7) * 1.0; },
  };
}
