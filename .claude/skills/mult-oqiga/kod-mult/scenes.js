// «Қаныштың арманы» — 8 көрініс
const P = (...a) => CH.place(...a);
export const U = {};
const lerp = U.lerp = (a, b, k) => a + (b - a) * k;
const clamp = U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = U.ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
const seg = (t, a, b) => ease((t - a) / (b - a));   // a..b аралығында 0→1
const blink = (t, ph) => { const x = (t + ph) % 3.7; return x < .14 ? Math.sin(x / .14 * Math.PI) : 0; };

// ауыз: дауыс файлы болса — дыбыс күші, болмаса — шартты
U.mouth = (who, t) => {
  const { sc, idx } = U.cur;
  const V = window.VOICE;
  if (V) { const tn = U.cur.tn;
    for (const [a, b, w, , id] of V.scenes[idx].lines) if (w === who && tn >= a && tn < b) { const arr = V.amp[id] || [], i = Math.floor((tn - a) * V.fps); return clamp(arr[i] || 0, 0, 1); }
    return 0; }
  for (const [a, b, w] of sc.lines) if (w === who && t > a && t < b) return clamp(.15 + .85 * Math.abs(Math.sin(t * 12.5) * Math.sin(t * 7.1 + 1.3)), 0, 1);
  return 0;
};
const speaking = (who, t) => U.cur.sc.lines.some(([a, b, w]) => w === who && t > a - .1 && t < b + .1);
const M = U.mouth;

U.DEFS = `<defs><radialGradient id="lampg"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb040" stop-opacity="0"/></radialGradient>
<radialGradient id="gl"><stop offset="0" stop-color="#7ffff0" stop-opacity=".9"/><stop offset=".4" stop-color="#39e0d0" stop-opacity=".35"/><stop offset="1" stop-color="#39e0d0" stop-opacity="0"/></radialGradient>
<radialGradient id="gold"><stop offset="0" stop-color="#fff2a0" stop-opacity=".9"/><stop offset=".45" stop-color="#ffc840" stop-opacity=".35"/><stop offset="1" stop-color="#ffc840" stop-opacity="0"/></radialGradient>
<radialGradient id="cu"><stop offset="0" stop-color="#b0ffd8" stop-opacity=".9"/><stop offset=".45" stop-color="#3fdc9a" stop-opacity=".35"/><stop offset="1" stop-color="#3fdc9a" stop-opacity="0"/></radialGradient>
<radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="vig"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient></defs>`;

function sparkles(t, cx, cy, n, spread, k, col = '#c8fff7') {
  let s = '';
  if (k <= 0) return s;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = ((t * 60 * (0.4 + (i % 5) * .15) + i * 37) % spread);
    const x = cx + Math.cos(a) * r * .8, y = cy - r * 1.1 + Math.sin(a) * 20;
    const sz = (6 + (i % 4) * 3) * (1 - r / spread) * k;
    if (sz <= .5) continue;
    s += `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 ${-sz * 2} L${sz * .5} ${-sz * .5} L${sz * 2} 0 L${sz * .5} ${sz * .5} L0 ${sz * 2} L${-sz * .5} ${sz * .5} L${-sz * 2} 0 L${-sz * .5} ${-sz * .5}Z" fill="${col}" opacity="${(1 - r / spread).toFixed(2)}"/>`;
  }
  return s;
}
const shadow = (x, y, w) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * .16}" fill="url(#shadow)"/>`;
const symbol = (x, y, r, glow) => {
  let s = '';
  if (glow > 0) s += `<circle cx="${x}" cy="${y}" r="${r * 3 + glow * r * 3}" fill="url(#gl)" opacity="${glow}"/>`;
  s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#bffff6" stroke-width="${r * .16}" opacity="${glow}"/>`;
  s += `<path d="M${x - r * .6} ${y + r * .42} L${x} ${y - r * .55} L${x + r * .6} ${y + r * .42}Z" fill="none" stroke="#bffff6" stroke-width="${r * .14}" stroke-linejoin="round" opacity="${glow}"/>`;
  return s;
};
const bigTitle = (t, a, b, lines, y = 330, col = '#ffd36a') => {
  if (t < a || t > b) return '';
  const k = seg(t, a, a + .5) * (1 - seg(t, b - .5, b));
  let s = `<g opacity="${k.toFixed(3)}" transform="translate(540 ${y - 20 * (1 - seg(t, a, a + .6))})">`;
  lines.forEach((l, i) => { s += `<text y="${i * 82}" text-anchor="middle" font-size="${l.length > 20 ? 50 : (l.length > 16 ? 56 : 64)}" font-weight="900" fill="${i === 0 ? col : '#fff'}" stroke="#1d140f" stroke-width="12" paint-order="stroke" letter-spacing="2">${l}</text>`; });
  return s + '</g>';
};

// ===================== 1. Жұмбақ карта =====================
function houseTable(t, glow, lampX = 905) {
  let s = '';
  s += `<path d="M150 1395 L930 1395 L980 1465 L100 1465Z" fill="#8a5530" stroke="#1d140f" stroke-width="6" stroke-linejoin="round"/>`;
  s += `<path d="M100 1465 L980 1465 L980 1560 L100 1560Z" fill="#6b3f22" stroke="#1d140f" stroke-width="6"/>`;
  for (let x = 160; x < 960; x += 120) s += `<path d="M${x} 1530 q20 -40 40 0 q20 -40 40 0" fill="none" stroke="#d9a843" stroke-width="5"/>`;
  s += `<rect x="120" y="1560" width="46" height="150" fill="#5a3420" stroke="#1d140f" stroke-width="6"/><rect x="914" y="1560" width="46" height="150" fill="#5a3420" stroke="#1d140f" stroke-width="6"/>`;
  s += `<g transform="translate(300 1402)"><path d="M0 8 L300 0 L330 52 L-20 60Z" fill="#e8d098" stroke="#1d140f" stroke-width="5" stroke-linejoin="round"/>`;
  s += `<path d="M20 44 L60 18 L90 38 L130 12 L170 40" fill="none" stroke="#8a6a3a" stroke-width="4"/><path d="M190 46 Q230 20 290 36" fill="none" stroke="#4a86b8" stroke-width="4"/>`;
  s += `<circle cx="236" cy="22" r="${9 + glow * 4}" fill="${glow > .05 ? '#5ff5e2' : '#7a5a2a'}" stroke="#1d140f" stroke-width="3"/>`;
  if (glow > .02) s += `<circle cx="236" cy="22" r="${40 + glow * 90}" fill="url(#gl)" opacity="${glow}"/>`;
  s += `</g>`;
  const fl = 1 + Math.sin(t * 17) * .08 + Math.sin(t * 31) * .05, X = lampX;
  s += `<circle cx="${X}" cy="1300" r="${170 * fl}" fill="url(#lampg)"/>`;
  s += `<path d="M${X - 45} 1400 Q${X} 1370 ${X + 45} 1400 L${X + 30} 1420 L${X - 30} 1420Z" fill="#c9a24a" stroke="#1d140f" stroke-width="5"/>`;
  s += `<path d="M${X - 28} 1395 Q${X - 32} 1320 ${X} 1300 Q${X + 32} 1320 ${X + 28} 1395Z" fill="#fff2c0" opacity=".55" stroke="#1d140f" stroke-width="5"/>`;
  s += `<path d="M${X} ${1372 - 26 * fl} Q${X - 12} 1360 ${X} 1376 Q${X + 12} 1360 ${X} ${1372 - 26 * fl}Z" fill="#ffb02e"/>`;
  return s;
}
function bigMap(t) {
  const glow = ease((t - 0.3) / 1.2);
  let s = `<rect width="1080" height="1920" fill="#3a2414"/>`;
  s += `<g transform="translate(540 960) rotate(${-4 + t * 1.5}) scale(${1.05 + t * .03})">`;
  s += `<path d="M-470 -640 L470 -660 L500 640 L-500 660Z" fill="#e8d098" stroke="#1d140f" stroke-width="10" stroke-linejoin="round"/>`;
  s += `<path d="M-470 -640 L470 -660 L500 640 L-500 660Z" fill="none" stroke="#c9a868" stroke-width="40" opacity=".5"/>`;
  for (const [x, y, sc] of [[-260, -250, 1.3], [-120, -300, 1], [60, -230, 1.5], [230, -320, 1.1]])
    s += `<path transform="translate(${x} ${y}) scale(${sc})" d="M-80 60 L0 -60 L80 60Z" fill="#c9a868" stroke="#6a4a22" stroke-width="7" stroke-linejoin="round"/><path transform="translate(${x} ${y}) scale(${sc})" d="M-22 -27 L0 -60 L22 -27 L8 -20 L0 -30 L-10 -18Z" fill="#f6efe0"/>`;
  s += `<path d="M-460 250 C-250 120 -150 380 40 250 S 320 120 480 230" fill="none" stroke="#4a86b8" stroke-width="20" stroke-linecap="round"/>`;
  for (const [x, y] of [[-330, 60], [-250, 90], [-300, 140], [300, 420], [360, 380], [-380, 470]])
    s += `<path transform="translate(${x} ${y})" d="M0 -40 L26 10 L-26 10Z" fill="#6c8a3c" stroke="#4a3a1a" stroke-width="5"/>`;
  s += `<path d="M-380 520 C-200 420 -80 560 120 420 S 260 80 160 -40" fill="none" stroke="#8a3a22" stroke-width="7" stroke-dasharray="22 18"/>`;
  const gx = 170, gy = -60;
  if (glow > 0) s += `<circle cx="${gx}" cy="${gy}" r="${120 + glow * 260}" fill="url(#gl)" opacity="${glow}"/>`;
  s += `<circle cx="${gx}" cy="${gy}" r="62" fill="${glow > .1 ? '#bffff6' : '#e8d098'}" stroke="${glow > .1 ? '#19b8a8' : '#6a4a22'}" stroke-width="10"/>`;
  s += `<path d="M${gx - 38} ${gy + 26} L${gx} ${gy - 34} L${gx + 38} ${gy + 26}Z" fill="${glow > .1 ? '#39e0d0' : '#c9a868'}" stroke="${glow > .1 ? '#19b8a8' : '#6a4a22'}" stroke-width="8" stroke-linejoin="round"/>`;
  s += sparkles(t, gx, gy, 26, 360, glow);
  const fx = lerp(520, 260, ease(t / 1.0)), fy = lerp(560, 40, ease(t / 1.0));
  s += `<g transform="translate(${fx} ${fy}) rotate(-35)"><rect x="-34" y="0" width="68" height="420" rx="34" fill="#3d8a52" stroke="#1d140f" stroke-width="8"/><rect x="-26" y="-60" width="52" height="110" rx="26" fill="#eab68c" stroke="#1d140f" stroke-width="8"/></g>`;
  return s + `</g>`;
}

const S1 = {
  dur: 15, lines: [
    [0.7, 3.3, 'kanysh', 'Әке, бұл қандай карта?'],
    [3.6, 8.9, 'father', 'Бұл – туған өлкеміздің картасы. Бірақ мына белгілердің мағынасын мен де білмеймін.'],
    [9.1, 11.6, 'kanysh', 'Қараңызшы! Мына белгі жарқырап тұр!'],
  ],
  shot(t) {
    if (t < 3.4) return { env: 'house', cam: [540, 1180, lerp(1.12, 1.2, t / 3.4)] };
    if (t < 8.9) { const k = (t - 3.4) / 5.5; return { env: 'house', cam: [lerp(620, 650, k), 1330, lerp(1.45, 1.55, k)] }; }
    if (t < 11.6) { const k = (t - 8.9) / 2.7; return { env: 'house', cam: [lerp(420, 440, k), 1360, lerp(1.6, 1.75, k)] }; }
    if (t < 13.4) return { lt: t - 11.6 };
    const k = (t - 13.4) / 1.6; return { env: 'house', cam: [560, 1320, lerp(1.35, 1.28, k)] };
  },
  draw(t, sh) {
    if (!sh.env) return bigMap(sh.lt);
    const kT = M('kanysh', t), fT = M('father', t);
    let kEmo = t < 3.4 ? 'talk' : t < 8.9 ? 'calm' : (kT > .3 ? 'happy' : 'surprised');
    if (t > 13.4) kEmo = 'amazed';
    const fEmo = t < 3.4 ? 'calm' : t < 8.9 ? (t > 6.2 ? 'thinking' : 'happy') : 'surprised';
    let s = '';
    s += P('father', 760, 1830, 2.1, { emotion: fEmo, mouth: fT, blink: blink(t, .3), look: t < 3.4 ? -.9 : (t > 8.9 ? -.4 : -.6), lookY: t > 6.2 && t < 8.9 ? .9 : 0, tilt: t > 3.4 && t < 8.9 ? -4 + Math.sin(t * 1.3) * 2 : 0 });
    s += P('kanysh', 360, 1790, 2.4, { emotion: kEmo, mouth: kT, blink: blink(t, 1.9), look: t < 3.4 ? .9 : (t > 8.9 ? .2 : .8), lookY: t > 9 ? .8 : 0, tilt: t < 3.4 ? 6 : (t > 8.9 ? Math.sin(t * 5) * 2 : 3), bob: t > 9.2 && t < 9.9 ? -Math.abs(Math.sin((t - 9.2) * 9)) * 18 : 0 });
    const glow = t > 9.0 ? ease((t - 9.0) / .6) : 0;
    s += houseTable(t, glow);
    if (glow > 0) s += `<circle cx="536" cy="1424" r="${300 + Math.sin(t * 6) * 20}" fill="url(#gl)" opacity="${glow * .7}"/>` + sparkles(t, 536, 1410, 22, 420, glow);
    return s;
  },
  ui: (t) => bigTitle(t, 0.2, 3.0, ['КІШКЕНТАЙ', 'ҚАНЫШТЫҢ ҚҰПИЯСЫ'], 300),
};

// ===================== 2. Белгінің сыры =====================
const S2 = {
  dur: 16, lines: [
    [0.6, 5.4, 'voice', 'Жердің тереңінде үлкен құпия бар... Оны тек білімге құштар жан ғана аша алады!'],
    [5.8, 8.0, 'kanysh', 'Мен бұл құпияны ашқым келеді!'],
    [8.6, 10.4, 'mother', 'Онда бәріміз бірге барайық.'],
    [10.8, 15.2, 'father', 'Нағыз зерттеуші асықпайды, әр қадамын ойланып басады.'],
  ],
  shot(t) {
    if (t < 5.6) return { env: 'house', cam: [540, lerp(1120, 1080, t / 5.6), lerp(1.1, 1.22, t / 5.6)] };
    if (t < 8.3) return { env: 'house', cam: [430, 1340, lerp(1.7, 1.8, (t - 5.6) / 2.7)] };
    if (t < 10.6) return { env: 'house', cam: [300, 1320, 1.5] };
    return { env: 'house', cam: [lerp(700, 720, (t - 10.6) / 5.4), 1290, lerp(1.55, 1.65, (t - 10.6) / 5.4)] };
  },
  draw(t) {
    const magic = 1 - seg(t, 5.2, 6.2) * .6;
    let s = '';
    // ана сол жақтан кіреді
    const mIn = seg(t, 7.4, 8.5), mx = lerp(-150, 150, mIn);
    const kT = M('kanysh', t);
    s += P('father', 780, 1830, 2.1, { emotion: t < 5.6 ? 'amazed' : (speaking('father', t) ? 'calm' : 'happy'), mouth: M('father', t), blink: blink(t, .3), look: t < 5.6 ? 0 : -.7, lookY: t < 5.6 ? -1 : 0, tilt: speaking('father', t) ? Math.sin(t * 1.2) * 3 : 0 });
    s += P('mother', mx, 1820, 2.05, { emotion: speaking('mother', t) ? 'happy' : 'happy', mouth: M('mother', t), blink: blink(t, 2.4), look: .8, walking: t > 7.4 && t < 8.5, walk: t * 9, tilt: 3 });
    s += P('kanysh', 420, 1790, 2.4, { emotion: t < 5.6 ? 'amazed' : (t < 8.2 ? (kT > .2 ? 'joy' : 'happy') : 'happy'), mouth: kT, blink: blink(t, 1.9), look: t < 5.6 ? 0 : (t < 10.6 ? -.8 : .9), lookY: t < 5.6 ? -1 : 0, bob: t > 5.8 && t < 7.6 ? -Math.abs(Math.sin((t - 5.8) * 7)) * 22 : 0 });
    s += houseTable(t, magic);
    // сиқырлы жарық бағаны
    if (t < 6.5) {
      const k = seg(t, 0, .8) * (1 - seg(t, 5.4, 6.5));
      s += `<circle cx="536" cy="1000" r="${420 + Math.sin(t * 3) * 30}" fill="url(#gl)" opacity="${(k * .8).toFixed(2)}"/>`;
      for (let i = 0; i < 30; i++) { const a = t * 2.2 + i * .7, r = 60 + (i * 23 % 220), y = 1420 - ((t * 140 + i * 47) % 700); s += `<circle cx="${(536 + Math.cos(a) * r * (1 - (1420 - y) / 900)).toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + i % 4 * 2}" fill="#c8fff7" opacity="${(k * .9).toFixed(2)}"/>`; }
      s += `<g transform="translate(536 ${880 + Math.sin(t * 2) * 15}) scale(${1 + Math.sin(t * 4) * .05})">${symbol(0, 0, 90, k)}</g>`;
    }
    return s;
  },
};

// ===================== 3. Таудағы үңгір =====================
const S3 = {
  dur: 13, lines: [
    [1.2, 4.8, 'kanysh', 'Әке, қараңызшы! Картадағы белгі дәл осы үңгірді көрсетіп тұр!'],
    [6.0, 10.2, 'mother', 'Балам, айналаға мұқият қара. Зерттеуші үшін әр белгі маңызды.'],
  ],
  shot(t) {
    if (t < 5.4) return { env: 'mountains', cam: [lerp(480, 600, t / 5.4), 1000, 1.0], p: { caveGlow: 0 } };
    return { env: 'mountains', cam: [lerp(430, 470, (t - 5.4) / 7.6), 1240, lerp(1.35, 1.45, (t - 5.4) / 7.6)], p: { caveGlow: seg(t, 9.5, 12) * .7 } };
  },
  draw(t) {
    let s = '';
    const walk = seg(t, 0, 2.6);
    const ground = 1760;
    const fx = lerp(-60, 300, walk), mx = lerp(-260, 120, walk), kx = lerp(160, 620, seg(t, 0, 1.6));
    const walking = t < 2.6;
    const kPoint = t > 1.2 && t < 4.8;
    s += shadow(mx, ground - 4, 110) + shadow(fx, ground + 6, 120) + shadow(kx, ground + 26, 90);
    s += P('mother', mx, ground, 1.6, { emotion: speaking('mother', t) ? 'calm' : 'happy', mouth: M('mother', t), blink: blink(t, 2.1), look: t < 5.4 ? .8 : .9, walking, walk: t * 9 });
    s += P('father', fx, ground + 10, 1.65, { emotion: t > 5 ? 'surprised' : 'happy', mouth: M('father', t), blink: blink(t, .6), look: .9, walking, walk: t * 9 + 1 });
    s += P('kanysh', kx, ground + 30, 1.9, { emotion: t < 1.2 ? 'happy' : (t < 5.4 ? 'joy' : (t > 10.4 ? 'amazed' : 'calm')), mouth: M('kanysh', t), blink: blink(t, 1.2), look: t < 5.4 ? -.6 : .9, walking: t < 1.6, walk: t * 11, armR: kPoint ? lerp(10, 135, seg(t, 1.2, 1.6)) : 10, bob: t < 1.6 ? 0 : Math.sin(t * 3) * 2 });
    if (t > 9.5) s += sparkles(t, 860, 1500, 14, 300, seg(t, 9.5, 11), '#c8fff7');
    return s;
  },
};

// ===================== 4. Сөйлейтін тастар =====================
const S4 = {
  dur: 21, lines: [
    [1.8, 6.2, 'copper', 'Сәлем, Қаныш! Мен – мыспын. Менен түрлі пайдалы бұйым жасалады.'],
    [6.6, 8.8, 'coal', 'Ал мен жылу мен энергия беремін!'],
    [9.2, 11.6, 'gold', 'Мен – табиғаттың бағалы байлығымын!'],
    [12.0, 14.4, 'kanysh', 'Жер астында осынша байлық бар ма?!'],
    [14.8, 19.8, 'narrator', 'Иә! Осы байлықтарды зерттейтін ғылым геология деп аталады.'],
  ],
  shot(t) {
    const light = seg(t, .3, 1.4);
    if (t < 1.8) return { env: 'crystals', cam: [540, 1420, lerp(1.2, 1.28, t / 1.8)], p: { light } };
    if (t < 6.4) return { env: 'crystals', cam: [650, 1440, lerp(1.95, 2.05, (t - 1.8) / 4.6)], p: { light } };
    if (t < 9.0) return { env: 'crystals', cam: [820, 1440, 2.0], p: { light } };
    if (t < 11.8) return { env: 'crystals', cam: [lerp(960, 940, (t - 9) / 2.8), 1440, 2.0], p: { light } };
    if (t < 14.6) return { env: 'crystals', cam: [360, 1380, lerp(1.7, 1.8, (t - 11.8) / 2.8)], p: { light } };
    return { env: 'crystals', cam: [540, 1400, lerp(1.28, 1.2, (t - 14.6) / 6.4)], p: { light } };
  },
  draw(t) {
    let s = '';
    const wake = seg(t, .8, 1.6);
    s += `<path d="M560 1640 Q640 1540 820 1550 Q1000 1540 1080 1620 L1080 1780 L560 1780Z" fill="#5a4652" stroke="#1d140f" stroke-width="6"/>`;
    const st = (id, x, y, sc, ph) => {
      const talking = speaking(id, t);
      return P(id, x, y, sc, { emotion: wake < .5 ? 'calm' : (talking ? (id === 'gold' ? 'proud' : 'happy') : 'happy'), blink: wake < .5 ? 1 - wake : blink(t, ph), mouth: M(id, t), look: talking ? -.6 : -.3, bob: (talking ? -Math.abs(Math.sin(t * 6)) * 10 : 0) + Math.sin(t * 2 + ph) * 3, glow: id === 'gold' ? (talking ? 1 : .4) : 0 });
    };
    if (t > 9 && t < 11.8) s += `<circle cx="990" cy="1480" r="300" fill="url(#gold)" opacity="${seg(t, 9.1, 9.6)}"/>` + sparkles(t, 990, 1480, 20, 300, 1, '#fff2a0');
    s += st('copper', 650, 1600, 1.35, 0) + st('coal', 820, 1590, 1.3, 1.1) + st('gold', 990, 1602, 1.3, 2.2);
    s += shadow(110, 1750, 110) + shadow(290, 1760, 120) + shadow(460, 1790, 95);
    const kEmo = t < 1.8 ? 'surprised' : (speaking('kanysh', t) ? 'amazed' : (t > 14.6 ? 'happy' : 'joy'));
    s += P('mother', 110, 1750, 1.7, { emotion: t < 2 ? 'surprised' : 'happy', blink: blink(t, 2), look: .9 });
    s += P('father', 290, 1760, 1.75, { emotion: t < 2 ? 'surprised' : 'happy', blink: blink(t, .2), look: .9 });
    s += P('kanysh', 460, 1790, 2.0, { emotion: kEmo, mouth: M('kanysh', t), blink: blink(t, 1.3), look: t > 11.8 && t < 14.6 ? -.2 : .9, tilt: speaking('kanysh', t) ? 5 : 0, bob: t > 12 && t < 12.7 ? -Math.abs(Math.sin((t - 12) * 9)) * 16 : 0 });
    return s;
  },
  ui: (t) => {
    if (t < 16.6) return '';
    const k = seg(t, 16.6, 17.2);
    return `<g transform="translate(540 520) scale(${(.7 + .3 * k).toFixed(3)})" opacity="${k.toFixed(3)}"><text text-anchor="middle" font-size="120" font-weight="900" fill="#ffd36a" stroke="#1d140f" stroke-width="18" paint-order="stroke" letter-spacing="6">ГЕОЛОГИЯ</text></g>` + sparkles(t, 540, 560, 16, 260, k, '#fff2a0');
  },
};

// ===================== 5. Үлкен сынақ =====================
const S5 = {
  dur: 18, lines: [
    [0.8, 3.6, 'kanysh', 'Көпір құлап қалыпты! Енді қайтеміз?'],
    [4.0, 6.4, 'father', 'Қорықпа, балам. Сабыр сақтайық.'],
    [6.8, 10.4, 'mother', 'Қаныш, сен картаны жақсы оқисың. Басқа жол бар ма екен?'],
    [11.6, 16.6, 'kanysh', 'Таптым! Қабырғадағы белгі картадағымен бірдей. Ол бізге жасырын жолды көрсетіп тұр!'],
  ],
  shot(t) {
    const p = { sign: 0, open: 0 };
    if (t < 3.8) return { env: 'chasm', cam: [540, 1300, lerp(1.1, 1.15, t / 3.8)], p };
    if (t < 6.6) return { env: 'chasm', cam: [820, 1330, 1.6], p };
    if (t < 10.6) return { env: 'chasm', cam: [600, 1330, 1.6], p };
    if (t < 13.4) return { env: 'chasm', cam: [lerp(420, 330, (t - 10.6) / 2.8), 1230, lerp(1.4, 1.55, (t - 10.6) / 2.8)], p };
    return { env: 'chasm', cam: [lerp(500, 460, (t - 13.4) / 4.6), 1300, lerp(1.15, 1.1, (t - 13.4) / 4.6)], p };
  },
  draw(t) {
    const g = 1600; let s = '';
    const sign = seg(t, 11.2, 12), open = seg(t, 15.0, 16.4);
    s += `<circle cx="680" cy="1300" r="520" fill="url(#lampg)" opacity=".8"/>`;
    // сол жақтағы жартас қабырға, белгі және жасырын жол
    s += `<path d="M0 640 L180 700 L260 900 L240 1200 L300 1450 L280 1640 L0 1640Z" fill="#4a3a52" stroke="#1d140f" stroke-width="7" stroke-linejoin="round"/>`;
    s += `<path d="M40 760 L150 800 L200 980 L120 1000Z" fill="#5a4a64" opacity=".8"/>`;
    s += `<path d="M60 1640 L60 1460 Q140 1360 220 1460 L220 1640Z" fill="#06040a" stroke="#1d140f" stroke-width="6"/>`;
    if (open > 0) s += `<circle cx="140" cy="1540" r="160" fill="url(#gl)" opacity="${open * .8}"/>`;
    s += `<g transform="translate(${-open * 230} ${open * 30})"><path d="M30 1640 L20 1470 Q70 1380 150 1400 Q240 1420 250 1520 L240 1640Z" fill="#5c4a62" stroke="#1d140f" stroke-width="7" stroke-linejoin="round"/><path d="M60 1480 L120 1460 L150 1520" fill="none" stroke="#3a2e40" stroke-width="5"/></g>`;
    s += `<circle cx="140" cy="1130" r="58" fill="none" stroke="${sign > .1 ? '#bffff6' : '#2e2436'}" stroke-width="10"/><path d="M104 1158 L140 1094 L176 1158Z" fill="none" stroke="${sign > .1 ? '#bffff6' : '#2e2436'}" stroke-width="9" stroke-linejoin="round"/>`;
    if (sign > 0) s += symbol(140, 1130, 58, sign) + sparkles(t, 140, 1130, 16, 260, sign);
    // отбасы
    const point = t > 11.6 && t < 15.2;
    s += shadow(660, g, 110) + shadow(880, g + 5, 120) + shadow(470, g + 20, 85);
    s += P('mother', 660, g, 1.6, { emotion: t < 4 ? 'worried' : (t > 11.6 ? 'happy' : 'calm'), mouth: M('mother', t), blink: blink(t, 2), look: -.7, lookY: speaking('mother', t) ? .3 : 0 });
    s += P('father', 880, g + 5, 1.65, { emotion: t < 4 ? 'worried' : (t > 11.6 ? 'happy' : 'calm'), mouth: M('father', t), blink: blink(t, .5), look: -.8 });
    const kW = t < 10.6 ? (t < 4 ? 'worried' : 'thinking') : 'joy';
    s += P('kanysh', 470, g + 20, 1.9, { emotion: speaking('kanysh', t) && t > 11 ? 'joy' : kW, mouth: M('kanysh', t), blink: blink(t, 1.1), look: t > 10.6 ? -1 : (t < 4 ? 0 : .7), lookY: t > 7 && t < 10.6 ? -.6 : 0, armL: point ? lerp(8, 130, seg(t, 11.6, 12)) : 8, tilt: t > 7 && t < 10.6 ? Math.sin(t * 2) * 6 : 0, bob: t > 11.6 && t < 12.3 ? -Math.abs(Math.sin((t - 11.6) * 9)) * 16 : 0 });
    // алдыңғы жар және құлаған көпір
    s += `<path d="M0 1660 Q300 1640 540 1665 Q800 1690 1080 1655 L1080 1920 L0 1920Z" fill="#07050c"/>`;
    s += `<path d="M0 1660 Q300 1640 540 1665 Q800 1690 1080 1655" fill="none" stroke="#3a2e40" stroke-width="14"/>`;
    for (const x of [600, 760]) s += `<rect x="${x - 10}" y="1580" width="20" height="100" fill="#6b4426" stroke="#1d140f" stroke-width="5"/>`;
    const sw = Math.sin(t * 1.5) * 6;
    s += `<path d="M600 1600 Q${600 + sw} 1760 ${620 + sw} 1900" fill="none" stroke="#c9a46a" stroke-width="6"/><path d="M760 1600 Q${760 + sw} 1760 ${740 + sw} 1900" fill="none" stroke="#c9a46a" stroke-width="6"/>`;
    for (let i = 0; i < 3; i++) s += `<rect x="${615 + sw}" y="${1700 + i * 70}" width="130" height="18" rx="4" fill="#7a5a3a" stroke="#1d140f" stroke-width="4" transform="rotate(${(i % 2 ? 8 : -6) + sw} ${680 + sw} ${1709 + i * 70})"/>`;
    return s;
  },
};

// ===================== 6. Ең үлкен жаңалық =====================
const S6 = {
  dur: 15, lines: [
    [1.0, 5.2, 'kanysh', 'Мен түсіндім! Жер қойнауын зерттеу үшін білім, еңбек және шыдамдылық керек екен!'],
    [5.8, 9.8, 'father', 'Дұрыс айтасың! Сенің ізденімпаздығың бізді үлкен жаңалыққа жетеледі.'],
    [10.4, 14.2, 'mother', 'Білімге құштар жүрегің ешқашан сөнбесін, Қанышым!'],
  ],
  shot(t) {
    if (t < 5.4) return { env: 'copper', cam: [540, lerp(1050, 1200, seg(t, 0, 5.4)), lerp(1.0, 1.3, seg(t, 0, 5.4))] };
    if (t < 10.1) return { env: 'copper', cam: [700, 1300, lerp(1.5, 1.6, (t - 5.4) / 4.7)] };
    return { env: 'copper', cam: [lerp(400, 380, (t - 10.1) / 4.9), 1320, lerp(1.45, 1.55, (t - 10.1) / 4.9)] };
  },
  draw(t) {
    const g = 1760; let s = '';
    s += `<circle cx="540" cy="1100" r="600" fill="url(#cu)" opacity=".35"/>`;
    s += sparkles(t, 540, 1300, 18, 600, .8, '#b0ffd8');
    const hug = seg(t, 10.2, 10.8);
    s += shadow(280, g, 110) + shadow(780, g + 5, 120) + shadow(lerp(520, 430, hug), g + 20, 85);
    s += P('mother', 280, g, 1.55, { emotion: speaking('mother', t) ? 'happy' : 'joy', mouth: M('mother', t), blink: blink(t, 2), look: .7, armR: lerp(8, 70, hug), tilt: hug * 8 });
    s += P('father', 780, g + 5, 1.6, { emotion: speaking('father', t) ? 'proud' : 'happy', mouth: M('father', t), blink: blink(t, .4), look: -.7, tilt: speaking('father', t) ? -4 : 0 });
    s += P('kanysh', lerp(520, 430, hug), g + 20, 1.85, { emotion: t < 1 ? 'amazed' : (speaking('kanysh', t) ? 'happy' : 'joy'), mouth: M('kanysh', t), blink: blink(t, 1.6), look: t < 5.4 ? 0 : (t < 10.1 ? .8 : -.8), lookY: t < 1 ? -1 : 0, tilt: -hug * 6 });
    if (hug > 0) for (let i = 0; i < 6; i++) { const y = 1150 - ((t - 10.2) * 90 + i * 60) % 300, x = 360 + Math.sin(t * 2 + i) * 60 + (i - 3) * 20; s += `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${.8 + (i % 3) * .3})" d="M0 8 C-14 -4 -10 -16 0 -8 C10 -16 14 -4 0 8Z" fill="#ff5a7a" stroke="#1d140f" stroke-width="2" opacity="${hug}"/>`; }
    return s;
  },
};

// ===================== 7. Болашаққа саяхат =====================
const S7 = {
  dur: 21, lines: [
    [2.4, 7.8, 'narrator', 'Бұл – кішкентай Қаныштың арманы еді. Жылдар өте келе ол қазақтың көрнекті геолог-ғалымы болды.'],
    [8.2, 13.4, 'narrator', 'Жезқазғанның мыс кен орындарын зерттеуге зор үлес қосып,'],
    [13.8, 19.4, 'narrator', 'Қазақ ССР Ғылым академиясының тұңғыш президенті болды.'],
  ],
  shot(t) {
    if (t < 2.6) return { env: 'copper', cam: [470, 1330, lerp(1.6, 2.2, t / 2.6)], flash: seg(t, 1.9, 2.6) };
    if (t < 13.6) return { env: 'mine', cam: [lerp(520, 560, (t - 2.6) / 11), lerp(1150, 1100, (t - 2.6) / 11), lerp(1.12, 1.0, (t - 2.6) / 11)], flash: 1 - seg(t, 2.6, 3.4) };
    return { env: 'academy', cam: [540, lerp(1150, 1080, (t - 13.6) / 7.4), lerp(1.15, 1.05, (t - 13.6) / 7.4)] };
  },
  draw(t) {
    let s = '';
    if (t < 2.6) {
      s += P('kanysh', 470, 1790, 2.4, { emotion: 'amazed', blink: blink(t, .5), lookY: -.4, hold: 'stone', armR: lerp(10, 150, seg(t, 0, .6)) });
      s += `<circle cx="540" cy="1150" r="${200 + t * 200}" fill="url(#cu)" opacity="${seg(t, .3, 1.2)}"/>` + sparkles(t, 540, 1200, 26, 500, 1, '#b0ffd8');
      return s;
    }
    if (t < 13.6) {
      const g = 1740;
      s += shadow(170, g, 100) + shadow(900, g, 100) + shadow(540, g + 20, 120) + shadow(330, g + 60, 100) + shadow(760, g + 50, 100);
      s += P('geo1', 170, g, 1.35, { emotion: 'happy', blink: blink(t, .1), look: .8, hold: 'paper', armR: 40 });
      s += P('geo2', 900, g, 1.35, { emotion: 'calm', blink: blink(t, 1.1), look: -.8 });
      s += P('adult', 540, g + 20, 1.6, { emotion: t < 8 ? 'calm' : 'happy', blink: blink(t, 2.1), look: Math.sin(t * .6) * .6, hold: t < 8 ? 'hammer' : 'rock', armR: t < 8 ? -30 : lerp(10, 120, seg(t, 8, 8.6)), lookY: t > 8.6 ? -.5 : 0 });
      s += P('geo3', 330, g + 60, 1.45, { emotion: 'amazed', blink: blink(t, 3), look: .7 });
      s += P('geo1', 760, g + 50, 1.42, { emotion: 'happy', blink: blink(t, 1.7), look: -.6 });
      return s;
    }
    // академия: мінберде ересек Қаныш, алдында қол соққан адамдар
    s += P('adult', 540, 1560, 1.5, { emotion: 'proud', blink: blink(t, .8), look: Math.sin(t * .5) * .5, armR: lerp(10, 150, seg(t, 15, 15.6)) });
    s += `<path d="M420 1430 L660 1430 L680 1600 L400 1600Z" fill="#7a4a2a" stroke="#1d140f" stroke-width="6"/><circle cx="540" cy="1500" r="34" fill="#e7b84a" stroke="#1d140f" stroke-width="5"/>`;
    const crowd = [[60, 'geo2'], [230, 'geo1'], [400, 'geo3'], [560, 'geo1'], [720, 'geo2'], [880, 'geo1'], [1040, 'geo3']];
    crowd.forEach(([x, id], i) => { const clap = Math.abs(Math.sin(t * 10 + i)) ; s += P(id, x, 2120 + (i % 2) * 30, 1.45, { emotion: 'joy', blink: 0, armL: 120 + clap * 30, armR: 120 + clap * 30, bob: -clap * 6 }); });
    if (t > 15) s += sparkles(t, 540, 900, 20, 400, 1, '#fff2a0');
    return s;
  },
  ui(t) {
    return bigTitle(t, 8.4, 13.4, ['ЖЕЗҚАЗҒАН', 'мыс кен орындары'], 330) + bigTitle(t, 14.2, 20.4, ['ҚАЗАҚ ССР', 'ҒЫЛЫМ АКАДЕМИЯСЫНЫҢ', 'ТҰҢҒЫШ ПРЕЗИДЕНТІ'], 300);
  },
};

// ===================== 8. Арман орындалады =====================
const S8 = {
  dur: 19, lines: [
    [0.8, 4.4, 'kanysh', 'Мен де өскенде елімнің байлығын зерттейтін ғалым боламын!'],
    [4.8, 7.0, 'father', 'Арманың асқақ болсын, балам!'],
    [7.4, 9.8, 'mother', 'Білім мен еңбектен қол үзбе!'],
    [10.4, 17.4, 'narrator', 'Кішкентай Қаныштың арманы тұтас елдің мақтанышына айналды. Өйткені үлкен жаңалықтың бастауы – кішкентай қызығушылық!'],
  ],
  shot(t) {
    if (t < 4.6) return { env: 'summit', cam: [480, 1300, lerp(1.45, 1.55, t / 4.6)] };
    if (t < 7.2) return { env: 'summit', cam: [740, 1260, 1.55] };
    if (t < 10.2) return { env: 'summit', cam: [300, 1260, 1.55] };
    return { env: 'summit', cam: [540, lerp(1100, 960, seg(t, 10.2, 19)), lerp(1.2, 1.0, seg(t, 10.2, 19))] };
  },
  draw(t) {
    const g = 1780; let s = '';
    s += `<path d="M-20 1720 Q120 1660 300 1690 Q480 1650 640 1680 Q860 1640 1100 1700 L1100 1920 L-20 1920Z" fill="#8a5a52" stroke="#1d140f" stroke-width="7" stroke-linejoin="round"/><path d="M-20 1760 Q200 1730 400 1760 L380 1920 L-20 1920Z" fill="#6e4440"/><path d="M700 1740 Q900 1720 1100 1760 L1100 1920 L760 1920Z" fill="#6e4440"/>`;
    s += shadow(270, g, 110) + shadow(790, g + 5, 120) + shadow(520, g + 20, 85);
    s += P('mother', 270, g, 1.55, { emotion: 'happy', mouth: M('mother', t), blink: blink(t, 2), look: .7 });
    s += P('father', 790, g + 5, 1.6, { emotion: speaking('father', t) ? 'proud' : 'happy', mouth: M('father', t), blink: blink(t, .4), look: -.7 });
    const raise = t > 0.8 && t < 4.6;
    s += P('kanysh', 520, g + 20, 1.85, { emotion: speaking('kanysh', t) ? 'happy' : 'joy', mouth: M('kanysh', t), blink: blink(t, 1.6), look: t < 4.6 ? 0 : (t < 7.2 ? .8 : (t < 10.2 ? -.8 : 0)), lookY: t < 4.6 ? -.5 : 0, armR: raise ? lerp(10, 150, seg(t, 0.8, 1.3)) : (t > 10.2 ? 150 : 10), armL: t > 10.2 ? 150 : 8 });
    return s;
  },
  ui(t) {
    return bigTitle(t, 14.0, 19.2, ['ҮЛКЕН ЖАҢАЛЫҚТЫҢ', 'БАСТАУЫ —', 'КІШКЕНТАЙ ҚЫЗЫҒУШЫЛЫҚ!'], 330) + (t > 14 ? sparkles(t, 540, 420, 18, 300, seg(t, 14, 15), '#fff2a0') : '');
  },
};

export const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8];
