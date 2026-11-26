// Барлық 3D фондар
import * as THREE from './node_modules/three/build/three.module.js';
import { W, H, toon, mesh, box, canvasTex, oyu, houseInterior } from './room.js';
export { houseInterior };

const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function skyTex(stops) {
  return canvasTex(16, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); });
}
function pine(x, z, s = 1, col = 0x2f6b3a) {
  const g = new THREE.Group();
  const tr = mesh(new THREE.CylinderGeometry(.07, .1, .6, 8), toon(0x6b4426), .02); tr.position.y = .3; g.add(tr);
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(.55 - i * .13, .8, 8), toon(col), .025); c.position.y = .75 + i * .42; g.add(c); }
  g.position.set(x, 0, z); g.scale.setScalar(s); return g;
}
function rock(x, y, z, s, col = 0xb79a8c, sx = 1, sy = 1, sz = 1) {
  const g = mesh(new THREE.DodecahedronGeometry(1, 0), toon(col), .03); g.position.set(x, y, z); g.scale.set(s * sx, s * sy, s * sz);
  g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); return g;
}
function cloud(x, y, z, s) {
  const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [[0, 0, 1], [.9, -.1, .75], [-.9, -.15, .7], [.4, .35, .7]].forEach(([a, b, r]) => { const p = mesh(new THREE.SphereGeometry(r, 14, 10), m, .03); p.position.set(a, b, 0); g.add(p); });
  g.position.set(x, y, z); g.scale.set(s * 1.4, s * .8, s * .8); return g;
}

// ---------------- Тау жолы (күндіз) ----------------
export function mountains() {
  const scene = new THREE.Scene();
  scene.background = skyTex([[0, '#5aa8e8'], [.6, '#a9d8f5'], [1, '#e8f4ff']]);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 200);
  cam.position.set(0, 1.7, 8); cam.lookAt(0, 2.2, 0);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), toon(0x9bb85a)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // жол
  const path = new THREE.Mesh(new THREE.PlaneGeometry(30, 1.8), toon(0xc9a46a)); path.rotation.x = -Math.PI / 2; path.position.set(0, .01, 3.2); scene.add(path);
  // алыстағы таулар
  [[-14, -40, 14, 0x7f8fb0], [2, -50, 18, 0x8597b8], [18, -42, 13, 0x7a8aac], [-30, -55, 16, 0x8a99ba]].forEach(([x, z, h, c]) => {
    const m = mesh(new THREE.ConeGeometry(h * .9, h, 6), toon(c), .05); m.position.set(x, h / 2, z); scene.add(m);
    const sn = mesh(new THREE.ConeGeometry(h * .9 * .3, h * .3, 6), toon(0xf6f8ff), 0); sn.position.set(x, h * .86, z); scene.add(sn);
  });
  // гранит жартастар (Баянауылға ұқсас)
  for (let i = 0; i < 14; i++) scene.add(rock(-9 + rnd() * 18, .6 + rnd(), -6 - rnd() * 8, 1 + rnd() * 1.6, [0xc29a86, 0xb08a78, 0xd0ac96][i % 3], 1, 1.3, 1));
  // үңгір жартасы (оң жақта)
  const cliff = new THREE.Group();
  [[0, 2, 0, 3.2, 1.1, 1, .8], [-1.8, 1.2, .6, 1.8, 1, 1, 1], [1.9, 1.4, .3, 2, 1, 1.2, 1], [.2, 4.3, -.4, 2.4, 1.2, .8, 1]].forEach(([x, y, z, s, a, b, c]) => cliff.add(rock(x, y, z, s, 0xb89482, a, b, c)));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x120a10 })); hole.position.set(0, .02, 3.05); hole.scale.set(1, 1.35, 1); cliff.add(hole);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.6, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7ff0e0, transparent: true, opacity: 0 })); glow.position.set(0, .02, 3.07); glow.scale.set(1, 1.2, 1); cliff.add(glow);
  cliff.position.set(1.9, 0, -4.2); cliff.scale.setScalar(.8); scene.add(cliff);
  // қарағайлар
  [[-4.5, -1, 1.3], [-3.2, -2.5, 1.6], [-6, -3, 1.8], [-2, -5, 1.4], [1.5, -6, 1.5], [7.5, -1, 1.5], [-5.5, 1.5, 1.1], [8, -4, 1.9]].forEach(([x, z, s]) => scene.add(pine(x, z, s)));
  // гүлдер, шөп
  for (let i = 0; i < 40; i++) { const b = mesh(new THREE.SphereGeometry(.06, 6, 4), toon([0xfff070, 0xff8aa0, 0xffffff][i % 3]), 0); b.position.set(-8 + rnd() * 16, .05, 1 + rnd() * 5); scene.add(b); }
  const clouds = [cloud(-6, 13, -30, 2.2), cloud(7, 15, -35, 2.6), cloud(0, 18, -40, 2)]; clouds.forEach(c => scene.add(c));
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6a7a3a, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(-5, 10, 6); scene.add(sun);
  return { scene, cam, update(t, p = {}) { clouds.forEach((c, i) => c.position.x += 0); clouds.forEach((c, i) => c.position.x = [-6, 7, 0][i] + t * .25); glow.material.opacity = p.caveGlow || 0; } };
}

// ---------------- Тау басы (күн бату) ----------------
export function summit() {
  const scene = new THREE.Scene();
  scene.background = skyTex([[0, '#3b3f8a'], [.35, '#c4588a'], [.62, '#ff9a52'], [.8, '#ffd27a'], [1, '#ffe9b0']]);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 400);
  cam.position.set(0, 2.0, 8); cam.lookAt(0, 1.6, 0);
  // төмендегі дала
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(0xb98a52)); plain.rotation.x = -Math.PI / 2; plain.position.y = -30; scene.add(plain);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(4, 400), toon(0x6a8fc8)); river.rotation.x = -Math.PI / 2; river.rotation.z = .5; river.position.set(-20, -29.9, -120); scene.add(river);
  [[-60, -160, 30], [40, -180, 36], [120, -200, 28], [-130, -190, 34]].forEach(([x, z, h]) => { const m = mesh(new THREE.ConeGeometry(h, h, 6), toon(0x8a5a7a), .08); m.position.set(x, -30 + h / 2, z); scene.add(m); });
  // күн
  const sunD = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); sunD.position.set(30, 6, -250); scene.add(sunD);
  // тау басы (тас алаң)
  [[0, -1.2, 2, 4, 1, .45, 1], [-3.5, -1.5, 0, 3, 1, .6, 1], [3.6, -1.4, 0.5, 3, 1, .6, 1], [5.5, -.3, -1, 1.6, 1, 1.2, 1], [-5.8, -.2, -1.5, 1.4, 1, 1.4, 1]].forEach(([x, y, z, s, a, b, c]) => scene.add(rock(x, y, z, s, 0x9a6a5e, a, b, c)));
  [[-6, -3, 1.3], [6.5, -3.5, 1.2]].forEach(([x, z, s]) => scene.add(pine(x, z, s, 0x3a5a3a)));
  const clouds = [cloud(-25, 4, -120, 6), cloud(30, 9, -160, 7), cloud(-60, 12, -200, 8)]; clouds.forEach(c => { c.children.forEach(m => { m.children[0].material = new THREE.MeshBasicMaterial({ color: 0xffc8a8 }); }); scene.add(c); });
  scene.add(new THREE.HemisphereLight(0xffc8a0, 0x553355, 1.1));
  const sun = new THREE.DirectionalLight(0xffb070, 2.4); sun.position.set(6, 4, -4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8a7ad8, .7); fill.position.set(-4, 3, 6); scene.add(fill);
  return { scene, cam, update(t) { clouds.forEach((c, i) => c.position.x = [-25, 30, -60][i] + t * .6); } };
}

// ---------------- Үңгір ----------------
function caveBase(bg = 0x150d18, wallCol = 0x4a3646) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 100);
  cam.position.set(0, 1.7, 8); cam.lookAt(0, 2.0, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toon(0x3a2a30)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // қабырға тастары
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * .1 - rnd() * Math.PI * .8;
    const r = 6.5 + rnd() * 2;
    scene.add(rock(Math.cos(a) * r * 1.1, 1 + rnd() * 5, Math.sin(a) * r * .8 - 1, 1.6 + rnd() * 1.6, [wallCol, 0x5a4256, 0x3e2c3c][i % 3]));
  }
  for (let i = 0; i < 10; i++) { const st = mesh(new THREE.ConeGeometry(.25 + rnd() * .3, 1 + rnd() * 1.5, 6), toon(0x5a4256), .02); st.rotation.x = Math.PI; st.position.set(-5 + rnd() * 10, 6.5 - rnd() * .5, -2 - rnd() * 4); scene.add(st); }
  const hemi = new THREE.HemisphereLight(0x7a6aa0, 0x201018, .55); scene.add(hemi);
  return { scene, cam, hemi };
}
function crystal(x, y, z, s, col, rot = 0) {
  const g = new THREE.Group(); const mats = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshToonMaterial({ color: col, emissive: col, emissiveIntensity: 0 });
    mats.push(m);
    const c = mesh(new THREE.ConeGeometry(.16 + i * .03, .9 - i * .12, 6), m, .02);
    c.position.set((i - 1.5) * .18, .35, (i % 2) * .1); c.rotation.z = (i - 1.5) * .3; g.add(c);
  }
  g.position.set(x, y, z); g.scale.setScalar(s); g.rotation.z = rot; return { g, mats };
}

export function caveCrystals() {
  const { scene, cam, hemi } = caveBase();
  const cr = []; const lights = [];
  [[-1.9, 0, -.3, 1.5, 0x39e0d0], [2.0, 0, -.6, 1.6, 0xb070ff], [-1.0, 0, -3, 1.4, 0xffa040], [1.2, 0, -3.4, 1.3, 0x39e0d0], [-2.3, 2.6, -2.4, 1.3, 0xffd040, -.8], [2.4, 3.2, -2.4, 1.2, 0x39e0d0, .9], [0, 0, -4.5, 1.8, 0xb070ff], [-.4, 4.6, -3.5, 1.1, 0x39e0d0, 3.14], [1.1, 5, -3, 1, 0xb070ff, 3.0]]
    .forEach(([x, y, z, s, c, r]) => { const k = crystal(x, y, z, s, c, r || 0); scene.add(k.g); cr.push(k); });
  [[-1.8, 1.4, .5, 0x39e0d0], [1.8, 1.4, .5, 0xb070ff], [0, 3, -1, 0xffc060], [0, 2, 4, 0xffd8b0]].forEach(([x, y, z, c]) => { const l = new THREE.PointLight(c, 0, 12, 1.5); l.position.set(x, y, z); scene.add(l); lights.push(l); });
  // тастар отыратын жартас (ортада)
  const ledge = mesh(new THREE.CylinderGeometry(2.4, 2.8, .7, 9), toon(0x5a4652), .03); ledge.position.set(0, .35, -1.2); scene.add(ledge);
  return { scene, cam, update(t, p = {}) {
    const k = p.light ?? 1;
    cr.forEach((c, i) => c.mats.forEach(m => m.emissiveIntensity = k * (.55 + .25 * Math.sin(t * 2 + i))));
    lights.forEach((l, i) => l.intensity = k * (22 + 4 * Math.sin(t * 2.3 + i)));
    hemi.intensity = .5 + k * .7;
  } };
}

export function caveChasm() {
  const { scene, cam, hemi } = caveBase(0x0e0a16, 0x3c3050);
  // жар: алдыңғы еденді кесеміз — қара жолақ
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.2), new THREE.MeshBasicMaterial({ color: 0x05030a })); gap.rotation.x = -Math.PI / 2; gap.position.set(0, .02, -1.2); scene.add(gap);
  const edge = mesh(new THREE.BoxGeometry(40, .4, .3), toon(0x2a1e2a), .02); edge.position.set(0, -.1, .45); scene.add(edge);
  const edge2 = mesh(new THREE.BoxGeometry(40, .4, .3), toon(0x2a1e2a), .02); edge2.position.set(0, -.1, -2.85); scene.add(edge2);
  // құлаған көпір
  for (let i = 0; i < 5; i++) { const p = box(.9, .08, .3, 0x7a5a3a, -.3 + (i % 2) * .1, -.2 - i * .38, .35 - i * .05, .015); p.rotation.z = .2 * (i % 2 ? 1 : -1); p.rotation.x = 1.2; scene.add(p); }
  for (let i = 0; i < 4; i++) { const p = box(.9, .08, .3, 0x7a5a3a, .2, -.2 - i * .38, -2.7, .015); p.rotation.x = -1.2; scene.add(p); }
  const rope = (x1, y1, z1, x2, y2, z2) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xc9a46a }))); };
  rope(-.8, .9, .45, -.6, -1.6, .2); rope(.6, .9, .45, .4, -1.6, .2);
  [[-.8, .45], [.6, .45]].forEach(([x, z]) => { const post = box(.14, 1, .14, 0x6b4426, x, .5, z, .015); scene.add(post); });
  // қабырғадағы белгі (сол жақта) + жасырын жол
  const signTex = canvasTex(256, 256, (c) => { c.strokeStyle = '#fff'; c.lineWidth = 18; c.beginPath(); c.arc(128, 128, 90, 0, 7); c.stroke(); c.lineJoin = 'round'; c.beginPath(); c.moveTo(70, 165); c.lineTo(128, 70); c.lineTo(186, 165); c.closePath(); c.stroke(); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: 0x6a5a6a })); sign.position.set(-3.1, 2.6, 1.5); sign.rotation.y = .9; scene.add(sign);
  const pass = new THREE.Mesh(new THREE.CircleGeometry(.9, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x040208 })); pass.position.set(-3.35, .02, 2.6); pass.rotation.y = .9; pass.scale.set(1, 1.6, 1); scene.add(pass);
  const door = rock(-3.3, 1, 2.7, 1.15, 0x4a3a4c, .5, 1.2, 1); scene.add(door);
  const sl = new THREE.PointLight(0x39e0d0, 0, 8, 1.5); sl.position.set(-2.4, 2.4, 2.2); scene.add(sl);
  hemi.intensity = 1.1; const blue = new THREE.PointLight(0x6080ff, 16, 16, 1.4); blue.position.set(0, 4, -1); scene.add(blue);
  const lantern = new THREE.PointLight(0xffb060, 22, 14, 1.4); lantern.position.set(.5, 2.5, 3); scene.add(lantern);
  return { scene, cam, update(t, p = {}) {
    const s = p.sign || 0; sign.material.color.setRGB(.42 + s * .2, .36 + s * .64, .42 + s * .5); sl.intensity = s * 16;
    const o = p.open || 0; door.position.x = -3.3 + o * 1.4; door.position.z = 2.7 + o * 1.0;
  } };
}

export function caveCopper() {
  const { scene, cam, hemi } = caveBase(0x10100c, 0x5a4a38);
  const veinTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#4a3a2c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { c.strokeStyle = i % 3 ? '#3fdc9a' : '#e8843a'; c.lineWidth = 6 + rnd() * 10; c.beginPath(); let x = rnd() * w, y = rnd() * h; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - .5) * 160; y += (rnd() - .5) * 160; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 60; i++) { c.fillStyle = '#7fffc8'; c.beginPath(); c.arc(rnd() * w, rnd() * h, 3 + rnd() * 6, 0, 7); c.fill(); }
  });
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, map: veinTex, emissive: 0xffffff, emissiveMap: veinTex, emissiveIntensity: .6 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 14, 24, 1, true, Math.PI * .6, Math.PI * .8), mat); wall.material.side = THREE.BackSide; wall.position.set(0, 6, 3); scene.add(wall);
  const boulders = [];
  [[-3, .9, -1, 1.3], [3.2, 1, -1.5, 1.5], [0, 1.3, -4, 2]].forEach(([x, y, z, s]) => { const m = mesh(new THREE.DodecahedronGeometry(1, 0), mat, .03); m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m); boulders.push(m); });
  const g1 = new THREE.PointLight(0x40ffa0, 18, 14, 1.4); g1.position.set(-2, 3, 0); scene.add(g1);
  const g2 = new THREE.PointLight(0xff9a40, 14, 14, 1.4); g2.position.set(2.5, 2.5, 0); scene.add(g2);
  const fill = new THREE.PointLight(0xffd8a0, 20, 14, 1.4); fill.position.set(0, 2.5, 5); scene.add(fill);
  hemi.intensity = 1.1;
  return { scene, cam, update(t) { mat.emissiveIntensity = .6 + .12 * Math.sin(t * 2); } };
}

// ---------------- Кен орны (болашақ, 1940-жж.) ----------------
export function mine() {
  const scene = new THREE.Scene();
  scene.background = skyTex([[0, '#6fb0e8'], [.7, '#cfe6f5'], [1, '#f2e6c8']]);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 300);
  cam.position.set(0, 2.2, 9); cam.lookAt(0, 2.2, 0);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), toon(0xd2b27a)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // карьер террассалары
  for (let i = 0; i < 4; i++) { const c = mesh(new THREE.CylinderGeometry(9 - i * 1.8, 9.4 - i * 1.8, .6, 20), toon([0xb88c5a, 0xa0784e, 0x8a6a48, 0x5a8a6a][i]), .03); c.position.set(-2, -.3 - i * .55 + .02, -14); c.scale.y = 1; scene.add(c); }
  // мыс тастары (жасыл)
  for (let i = 0; i < 10; i++) scene.add(rock(-5 + rnd() * 10, .3, -3 - rnd() * 4, .3 + rnd() * .4, [0x3fa87a, 0x6a5a4a, 0x2f8a6a][i % 3]));
  // бұрғы мұнарасы
  const tw = new THREE.Group();
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => { const l = box(.14, 7, .14, 0x6b4426, a * .7, 3.5, b * .7, .015); l.rotation.z = -a * .1; l.rotation.x = b * .1; tw.add(l); });
  for (let y = 1; y < 7; y += 1.5) tw.add(box(1.6 - y * .12, .1, .1, 0x6b4426, 0, y, .7, .01));
  tw.position.set(6, 0, -8); scene.add(tw);
  // шатырлар
  [[-6.5, -6], [-4.2, -9]].forEach(([x, z]) => { const t = mesh(new THREE.ConeGeometry(1.4, 1.8, 4), toon(0xe8dcc0), .03); t.position.set(x, .9, z); t.rotation.y = .7; scene.add(t); });
  // алыс таулар
  [[-40, -90, 12], [20, -100, 16], [60, -95, 10]].forEach(([x, z, h]) => { const m = mesh(new THREE.ConeGeometry(h * 1.6, h, 6), toon(0xb09a88), .06); m.position.set(x, h / 2, z); scene.add(m); });
  const clouds = [cloud(-12, 16, -60, 3), cloud(14, 20, -70, 3.5)]; clouds.forEach(c => scene.add(c));
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x8a7040, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(5, 10, 6); scene.add(sun);
  return { scene, cam, update(t) { clouds.forEach((c, i) => c.position.x = [-12, 14][i] + t * .3); } };
}

// ---------------- Академия залы ----------------
export function academy() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1e1a);
  const cam = new THREE.PerspectiveCamera(42, W / H, .1, 100);
  cam.position.set(0, 1.8, 9); cam.lookAt(0, 2.6, 0);
  const fl = canvasTex(512, 512, (c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#e8e0d0' : '#8a6a52'; c.fillRect(x * 64, y * 64, 64, 64); } });
  fl.wrapS = fl.wrapT = THREE.RepeatWrapping; fl.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), toon(0xffffff, { map: fl })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), toon(0xe8d8b8)); wall.position.set(0, 7, -4); scene.add(wall);
  // терезелер мен перделер
  [-4.2, 0, 4.2].forEach(x => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 4.2), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); win.position.set(x, 4.2, -3.95); scene.add(win);
    [-1, 1].forEach(k => { const c = box(.6, 4.8, .15, 0x9a1f2a, x + k * 1.1, 4.2, -3.85, .02); scene.add(c); });
    scene.add(box(3, .3, .3, 0xc9a24a, x, 6.5, -3.8, .02));
  });
  // бағаналар
  [-6, -2.1, 2.1, 6].forEach(x => { const c = mesh(new THREE.CylinderGeometry(.42, .48, 8, 16), toon(0xf2ece0), .03); c.position.set(x, 4, -2.6); scene.add(c); scene.add(box(1.2, .4, 1.2, 0xe0d6c6, x, .2, -2.6)); scene.add(box(1.2, .4, 1.2, 0xe0d6c6, x, 8, -2.6)); });
  // мінбер
  const pod = box(1.6, 1.2, .9, 0x7a4a2a, 0, .6, -1.2); scene.add(pod);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 12), toon(0xa3222e)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .01, 2); scene.add(rug);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4030, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.position.set(-3, 8, 6); scene.add(sun);
  const spot = new THREE.PointLight(0xffe0a0, 14, 12, 1.4); spot.position.set(0, 4, 2); scene.add(spot);
  return { scene, cam, update() {} };
}
