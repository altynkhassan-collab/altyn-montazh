// 2D мульт кейіпкерлер (SVG). Әр функция SVG жолын қайтарады; (0,0) — аяқтың ортасы.
(function () {
  const OL = '#1d140f';           // контур түсі
  const SW = 5;                   // контур қалыңдығы
  const f = (n) => (Math.round(n * 10) / 10);
  const deg = (a) => a * Math.PI / 180;

  function shade(hex, k) {        // k<1 қараңғы, k>1 ашық
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
    return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1);
  }

  // ---------- бет ----------
  function face(cx, cy, R, st, opt = {}) {
    const e = st.emotion || 'neutral';
    const blink = st.blink || 0;
    const look = st.look || 0, lookY = st.lookY || 0;
    const mo = st.mouth || 0;                 // 0..1 сөйлеу
    let s = '';
    const ex = R * 0.36, ey = cy - R * 0.02;
    const erx = R * (opt.eyeRx || 0.21), ery = R * (opt.eyeRy || 0.27);
    // көз
    for (const side of [-1, 1]) {
      const x = cx + side * ex;
      if (e === 'laugh' || e === 'joy') {
        s += `<path d="M${f(x - erx)} ${f(ey + ery * .3)} Q${f(x)} ${f(ey - ery * 1.1)} ${f(x + erx)} ${f(ey + ery * .3)}" fill="none" stroke="${OL}" stroke-width="${SW + 1}" stroke-linecap="round"/>`;
        continue;
      }
      const k = (e === 'surprised' || e === 'amazed') ? 1.15 : (e === 'sleepy' ? .5 : 1);
      const ry = Math.max(ery * k * (1 - blink), 1.5);
      if (ry < 3) {
        s += `<path d="M${f(x - erx)} ${f(ey)} L${f(x + erx)} ${f(ey)}" stroke="${OL}" stroke-width="${SW}" stroke-linecap="round"/>`;
      } else {
        s += `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="${f(erx * k)}" ry="${f(ry)}" fill="#fff" stroke="${OL}" stroke-width="${SW - 1}"/>`;
        const pr = erx * (e === 'surprised' ? .45 : .62);
        const px = x + look * erx * .45, py = ey + lookY * ry * .4 + ry * .08;
        s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(Math.min(pr, ry * .8))}" fill="${OL}"/>`;
        s += `<circle cx="${f(px + pr * .35)}" cy="${f(py - pr * .4)}" r="${f(pr * .3)}" fill="#fff"/>`;
      }
    }
    // қас
    const bro = { neutral: [0, 0], happy: [3, -5], joy: [4, -8], laugh: [3, -6], surprised: [4, -16], amazed: [4, -14],
      worried: [14, -6], sad: [14, -2], thinking: [-6, -2], proud: [3, -6], angry: [-16, 4], calm: [0, 0], talk: [2, -4] }[e] || [0, 0];
    if (!opt.noBrows) for (const side of [-1, 1]) {
      const x = cx + side * ex, y = ey - ery * 1.62 + bro[1];
      const L = erx * 0.85, r = bro[0] * .9;
      s += `<path d="M${f(x - side * L)} ${f(y - r)} Q${f(x)} ${f(y - 7 - r * .4)} ${f(x + side * L)} ${f(y + r * .3)}" fill="none" stroke="${opt.browColor || OL}" stroke-width="${SW + 1}" stroke-linecap="round"/>`;
    }
    // ұрт
    if (!opt.noCheeks) for (const side of [-1, 1])
      s += `<ellipse cx="${f(cx + side * R * .58)}" cy="${f(cy + R * .3)}" rx="${f(R * .14)}" ry="${f(R * .09)}" fill="#ff6f6f" opacity=".35"/>`;
    // мұрын
    if (!opt.noNose) s += `<path d="M${f(cx - R * .04)} ${f(cy + R * .16)} Q${f(cx + R * .07)} ${f(cy + R * .24)} ${f(cx - R * .02)} ${f(cy + R * .29)}" fill="none" stroke="${shade(opt.skin || '#e9b48a', .6)}" stroke-width="4" stroke-linecap="round"/>`;
    // ауыз
    if (opt.noMouth) return s;
    const my = cy + R * (opt.mouthY || .5), mw = R * .3;
    const smile = { neutral: .25, happy: .6, joy: .9, laugh: 1, surprised: 0, amazed: .2, worried: -.3, sad: -.5, thinking: 0, proud: .6, angry: -.3, calm: .35, talk: .3 }[e] ?? .3;
    let open = mo;
    if (e === 'laugh') open = Math.max(open, .75);
    if (e === 'surprised' || e === 'amazed') open = Math.max(open, .55);
    if (open > .06) {
      const h = R * .28 * open, w = mw * (e === 'surprised' ? .6 : 1) * (1 - open * .2);
      const top = my - h * .35 - smile * R * .05;
      const bot = my + h * .65 + smile * R * .08;
      s += `<path d="M${f(cx - w)} ${f(top + smile * R * .02)} Q${f(cx)} ${f(top - smile * R * .04 + R * .03)} ${f(cx + w)} ${f(top + smile * R * .02)} Q${f(cx + w * .9)} ${f(bot)} ${f(cx)} ${f(bot)} Q${f(cx - w * .9)} ${f(bot)} ${f(cx - w)} ${f(top + smile * R * .02)}Z" fill="#7a1f24" stroke="${OL}" stroke-width="${SW - 1}" stroke-linejoin="round"/>`;
      if (open > .35) s += `<ellipse cx="${f(cx)}" cy="${f(bot - h * .22)}" rx="${f(w * .45)}" ry="${f(h * .18)}" fill="#e0646a"/>`;
    } else {
      const c = smile * R * .22;
      s += `<path d="M${f(cx - mw)} ${f(my - c * .3)} Q${f(cx)} ${f(my + c)} ${f(cx + mw)} ${f(my - c * .3)}" fill="none" stroke="${OL}" stroke-width="${SW}" stroke-linecap="round"/>`;
    }
    return s;
  }

  // ---------- аяқ-қол ----------
  function limb(x, y, len, w, ang, color, endColor, endR, endShape) {
    const a = deg(ang);
    const x2 = x + Math.sin(a) * len, y2 = y + Math.cos(a) * len;
    let s = `<path d="M${f(x)} ${f(y)} L${f(x2)} ${f(y2)}" stroke="${OL}" stroke-width="${w + SW * 2}" stroke-linecap="round"/>`;
    s += `<path d="M${f(x)} ${f(y)} L${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    if (endShape === 'boot')
      s += `<ellipse cx="${f(x2 + 6)}" cy="${f(y2 + 2)}" rx="${f(endR * 1.35)}" ry="${f(endR * .8)}" fill="${endColor}" stroke="${OL}" stroke-width="${SW}"/>`;
    else
      s += `<circle cx="${f(x2)}" cy="${f(y2)}" r="${f(endR)}" fill="${endColor}" stroke="${OL}" stroke-width="${SW}"/>`;
    return { s, x2, y2 };
  }

  // ---------- жалпы адам ----------
  function human(c, st = {}) {
    const R = c.headR, legH = c.legH, bodyH = c.bodyH, bw = c.bodyW;
    const ph = st.walk || 0;                         // жүріс фазасы (радиан)
    const walking = st.walking ? 1 : 0;
    const swing = Math.sin(ph) * 24 * walking;
    const bob = Math.abs(Math.sin(ph)) * -6 * walking + (st.bob || 0);
    const hipY = -legH + bob, shY = hipY - bodyH;
    let s = `<g>`;
    // артқы қол
    const armLen = c.armLen || bodyH * .85;
    const aL = (st.armL ?? 8) + (-swing * .8);
    const aR = (st.armR ?? 8) + (swing * .8);
    const back = limb(-bw * .42, shY + 14, armLen, c.armW || 20, -aL, shade(c.coat, .82), c.skin, c.handR || 11);
    s += back.s;
    // аяқтар
    s += limb(-bw * .2, hipY - 5, legH - 8, c.legW || 20, swing, c.trousers, c.boots, 13, 'boot').s;
    s += limb(bw * .2, hipY - 5, legH - 8, c.legW || 20, -swing, shade(c.trousers, .85), c.boots, 13, 'boot').s;
    // дене (шапан/көйлек)
    const hem = hipY + (c.coatLen || 0);
    const hw = bw * (c.flare || .62);
    s += `<path d="M${f(-bw * .44)} ${f(shY + 6)} Q${f(-bw * .5)} ${f(shY - 4)} ${f(-bw * .2)} ${f(shY - 6)} L${f(bw * .2)} ${f(shY - 6)} Q${f(bw * .5)} ${f(shY - 4)} ${f(bw * .44)} ${f(shY + 6)} L${f(hw)} ${f(hem)} Q0 ${f(hem + 10)} ${f(-hw)} ${f(hem)}Z" fill="${c.coat}" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    // көлеңке
    s += `<path d="M${f(bw * .15)} ${f(shY)} L${f(bw * .44)} ${f(shY + 6)} L${f(hw)} ${f(hem)} Q${f(hw * .6)} ${f(hem + 6)} ${f(bw * .25)} ${f(hem + 6)}Z" fill="${shade(c.coat, .82)}" opacity=".6"/>`;
    if (c.bodyDeco) s += c.bodyDeco(c, shY, hipY, hem, bw, hw);
    // алдыңғы қол
    const fr = limb(bw * .42, shY + 14, armLen, c.armW || 20, aR, c.coat, c.skin, c.handR || 11);
    s += fr.s;
    if (c.holds && st.hold) s += c.holds(st.hold, fr.x2, fr.y2);
    // бас
    const tilt = st.tilt || 0;
    const hx = 0, hy = shY - R * .82;
    s += `<g transform="rotate(${tilt} ${hx} ${f(hy + R)})">`;
    if (c.backHead) s += c.backHead(hx, hy, R);
    s += `<circle cx="${hx}" cy="${f(hy)}" r="${R}" fill="${c.skin}" stroke="${OL}" stroke-width="${SW}"/>`;
    // құлақ
    for (const side of [-1, 1]) if (!c.noEars)
      s += `<ellipse cx="${f(hx + side * R * .97)}" cy="${f(hy + R * .08)}" rx="${f(R * .13)}" ry="${f(R * .18)}" fill="${c.skin}" stroke="${OL}" stroke-width="${SW - 1}"/>`;
    if (c.frontHeadUnder) s += c.frontHeadUnder(hx, hy, R, st);
    s += face(hx, hy + R * .06, R * .9, st, Object.assign({ skin: c.skin }, c.faceOpt || {}));
    if (c.frontHead) s += c.frontHead(hx, hy, R, st);
    s += `</g></g>`;
    return s;
  }

  // ---------- кейіпкерлер ----------
  const SKIN = '#eab68c';
  const C = {};

  C.kanysh = {
    name: 'Қаныш', headR: 62, legH: 62, bodyH: 86, bodyW: 84, coatLen: 30, flare: .58,
    skin: SKIN, coat: '#3d8a52', trousers: '#7b5638', boots: '#5a3a22', armLen: 70, armW: 18, legW: 18,
    bodyDeco: (c, shY, hipY, hem, bw) =>
      `<path d="M0 ${f(shY - 4)} L0 ${f(hem + 4)}" stroke="${shade(c.coat, .6)}" stroke-width="4"/>` +
      `<rect x="${f(-bw * .5)}" y="${f(hipY - 22)}" width="${f(bw)}" height="12" rx="4" fill="#6b3f1f" stroke="${OL}" stroke-width="4"/>` +
      `<rect x="-8" y="${f(hipY - 24)}" width="16" height="16" rx="3" fill="#e5c060" stroke="${OL}" stroke-width="3"/>` +
      // иықтағы сөмке белбеуі
      `<path d="M${f(-bw * .3)} ${f(shY)} L${f(bw * .46)} ${f(hipY - 26)}" stroke="#8a5a2f" stroke-width="9"/>` +
      `<rect x="${f(bw * .34)}" y="${f(hipY - 34)}" width="34" height="30" rx="6" fill="#9b6634" stroke="${OL}" stroke-width="4"/>`,
    frontHead: (x, y, R) =>
      // шаш (маңдайда)
      `<path d="M${f(x - R * .9)} ${f(y - R * .38)} Q${f(x - R * .6)} ${f(y - R * .72)} ${f(x - R * .2)} ${f(y - R * .56)} Q${f(x)} ${f(y - R * .72)} ${f(x + R * .25)} ${f(y - R * .56)} Q${f(x + R * .6)} ${f(y - R * .72)} ${f(x + R * .9)} ${f(y - R * .38)} L${f(x + R * .8)} ${f(y - R * .7)} L${f(x - R * .8)} ${f(y - R * .7)}Z" fill="#1d1a1a" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>` +
      // тақия
      `<path d="M${f(x - R * .82)} ${f(y - R * .58)} Q${f(x - R * .78)} ${f(y - R * 1.28)} ${f(x)} ${f(y - R * 1.3)} Q${f(x + R * .78)} ${f(y - R * 1.28)} ${f(x + R * .82)} ${f(y - R * .58)} Q${f(x)} ${f(y - R * .72)} ${f(x - R * .82)} ${f(y - R * .58)}Z" fill="#1e1e22" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M${f(x - R * .6)} ${f(y - R * .82)} l${f(R * .15)} ${f(-R * .2)} l${f(R * .15)} ${f(R * .2)} l${f(R * .15)} ${f(-R * .2)} l${f(R * .15)} ${f(R * .2)} l${f(R * .15)} ${f(-R * .2)} l${f(R * .15)} ${f(R * .2)} l${f(R * .15)} ${f(-R * .2)} l${f(R * .15)} ${f(R * .2)}" fill="none" stroke="#f3efe6" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle cx="${x}" cy="${f(y - R * 1.1)}" r="5" fill="#f3efe6"/>`,
    holds: (what, x, y) => what === 'map'
      ? `<g transform="translate(${f(x - 10)} ${f(y - 40)}) rotate(-8)"><rect x="0" y="0" width="70" height="56" rx="4" fill="#e9d29a" stroke="${OL}" stroke-width="4"/><path d="M8 40 L22 22 L34 36 L46 16 L62 40" fill="none" stroke="#8a6a3a" stroke-width="3"/><circle cx="46" cy="14" r="6" fill="#39e0d0" stroke="${OL}" stroke-width="2"/></g>`
      : what === 'stone'
      ? `<g transform="translate(${f(x)} ${f(y - 12)})"><path d="M-16 6 L-10 -12 L6 -16 L18 -2 L10 14 L-8 14Z" fill="#3fbf8a" stroke="${OL}" stroke-width="4"/><circle cx="0" cy="0" r="26" fill="#6fffd0" opacity=".25"/></g>` : '',
  };

  C.father = {
    name: 'Әкесі', headR: 62, legH: 92, bodyH: 132, bodyW: 118, coatLen: 66, flare: .66,
    skin: '#dfa77d', coat: '#7a4a2a', trousers: '#3b2c24', boots: '#2f2018', armLen: 104, armW: 24, legW: 24,
    bodyDeco: (c, shY, hipY, hem, bw, hw) =>
      `<path d="M${f(-bw * .2)} ${f(shY - 6)} L${f(-hw * .25)} ${f(hem + 6)}" stroke="#d9a843" stroke-width="7"/>` +
      `<path d="M${f(bw * .2)} ${f(shY - 6)} L${f(hw * .25)} ${f(hem + 6)}" stroke="#d9a843" stroke-width="7"/>` +
      `<path d="M${f(-hw)} ${f(hem - 8)} Q0 ${f(hem + 2)} ${f(hw)} ${f(hem - 8)}" fill="none" stroke="#d9a843" stroke-width="7"/>` +
      `<rect x="${f(-bw * .5)}" y="${f(hipY - 40)}" width="${f(bw)}" height="14" rx="5" fill="#3a2414" stroke="${OL}" stroke-width="4"/>`,
    frontHead: (x, y, R, st) =>
      // сақал-мұрт
      `<path d="M${f(x - R * .72)} ${f(y + R * .15)} Q${f(x - R * .75)} ${f(y + R * 1.05)} ${f(x)} ${f(y + R * 1.18)} Q${f(x + R * .75)} ${f(y + R * 1.05)} ${f(x + R * .72)} ${f(y + R * .15)} Q${f(x + R * .5)} ${f(y + R * .75)} ${f(x)} ${f(y + R * .72)} Q${f(x - R * .5)} ${f(y + R * .75)} ${f(x - R * .72)} ${f(y + R * .15)}Z" fill="#1f1a18" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M${f(x - R * .42)} ${f(y + R * .5)} Q${f(x - R * .2)} ${f(y + R * .32)} ${f(x)} ${f(y + R * .42)} Q${f(x + R * .2)} ${f(y + R * .32)} ${f(x + R * .42)} ${f(y + R * .5)} Q${f(x)} ${f(y + R * .5)} ${f(x - R * .42)} ${f(y + R * .5)}Z" fill="#1f1a18" stroke="${OL}" stroke-width="3"/>` +
      (st.mouth > .06 ? `<ellipse cx="${x}" cy="${f(y + R * .64)}" rx="${f(R * .2)}" ry="${f(R * .16 * st.mouth + 2)}" fill="#7a1f24" stroke="${OL}" stroke-width="3"/>` : `<path d="M${f(x - R * .2)} ${f(y + R * .6)} Q${x} ${f(y + R * ({happy:.74,joy:.78,laugh:.78,proud:.72,worried:.56}[st.emotion] ?? .66))} ${f(x + R * .2)} ${f(y + R * .6)}" fill="none" stroke="#d98c7a" stroke-width="4" stroke-linecap="round"/>`) +
      // ақ қалпақ, қара жиегі
      `<path d="M${f(x - R * .95)} ${f(y - R * .42)} Q${f(x - R * .7)} ${f(y - R * 1.75)} ${f(x)} ${f(y - R * 1.8)} Q${f(x + R * .7)} ${f(y - R * 1.75)} ${f(x + R * .95)} ${f(y - R * .42)}Z" fill="#f2ede2" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M${f(x - R * 1.08)} ${f(y - R * .32)} L${f(x - R * .98)} ${f(y - R * .78)} Q${f(x)} ${f(y - R * .98)} ${f(x + R * .98)} ${f(y - R * .78)} L${f(x + R * 1.08)} ${f(y - R * .32)} Q${f(x)} ${f(y - R * .5)} ${f(x - R * 1.08)} ${f(y - R * .32)}Z" fill="#1e1e22" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M${f(x - R * .2)} ${f(y - R * 1.2)} l${f(R * .2)} ${f(-R * .2)} l${f(R * .2)} ${f(R * .2)}" fill="none" stroke="#b03a2e" stroke-width="4"/>`,
  };
  // әкенің аузы сақал ішінде: face() ауызын жасырамыз
  C.father.faceOpt = { noMouth: true };

  C.mother = {
    name: 'Анасы', headR: 60, legH: 84, bodyH: 124, bodyW: 104, coatLen: 80, flare: .72,
    skin: '#ebb990', coat: '#8e2236', trousers: '#8e2236', boots: '#3a2418', armLen: 98, armW: 22, legW: 20,
    bodyDeco: (c, shY, hipY, hem, bw) =>
      // камзол
      `<path d="M${f(-bw * .44)} ${f(shY + 6)} Q${f(-bw * .5)} ${f(shY - 4)} ${f(-bw * .2)} ${f(shY - 6)} L${f(-bw * .1)} ${f(hipY - 6)} L${f(-bw * .52)} ${f(hipY - 6)}Z" fill="#24406e" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M${f(bw * .44)} ${f(shY + 6)} Q${f(bw * .5)} ${f(shY - 4)} ${f(bw * .2)} ${f(shY - 6)} L${f(bw * .1)} ${f(hipY - 6)} L${f(bw * .52)} ${f(hipY - 6)}Z" fill="#24406e" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
      [0, 1, 2].map(i => `<circle cx="${f(-bw * .16)}" cy="${f(shY + 22 + i * 30)}" r="5" fill="#dfe6ee" stroke="${OL}" stroke-width="2"/><circle cx="${f(bw * .16)}" cy="${f(shY + 22 + i * 30)}" r="5" fill="#dfe6ee" stroke="${OL}" stroke-width="2"/>`).join('') +
      `<path d="M${f(-bw * .66)} ${f(hem - 14)} Q0 ${f(hem - 2)} ${f(bw * .66)} ${f(hem - 14)}" fill="none" stroke="#e7b84a" stroke-width="6"/>`,
    noEars: true,
    backHead: (x, y, R) =>
      // кимешек — бастың сыртын жабады
      `<path d="M${f(x - R * 1.22)} ${f(y + R * 1.55)} Q${f(x - R * 1.45)} ${f(y - R * 1.35)} ${f(x)} ${f(y - R * 1.45)} Q${f(x + R * 1.45)} ${f(y - R * 1.35)} ${f(x + R * 1.22)} ${f(y + R * 1.55)} Q${f(x)} ${f(y + R * 1.85)} ${f(x - R * 1.22)} ${f(y + R * 1.55)}Z" fill="#f7f4ee" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    frontHead: (x, y, R) =>
      `<path d="M${f(x - R * 1.0)} ${f(y - R * .1)} Q${f(x - R * 1.05)} ${f(y - R * 1.12)} ${f(x)} ${f(y - R * 1.15)} Q${f(x + R * 1.05)} ${f(y - R * 1.12)} ${f(x + R * 1.0)} ${f(y - R * .1)} Q${f(x + R * .85)} ${f(y - R * .78)} ${f(x)} ${f(y - R * .8)} Q${f(x - R * .85)} ${f(y - R * .78)} ${f(x - R * 1.0)} ${f(y - R * .1)}Z" fill="#f7f4ee" stroke="${OL}" stroke-width="4"/>` +
      `<path d="M${f(x - R * .8)} ${f(y - R * .86)} Q${f(x)} ${f(y - R * 1.02)} ${f(x + R * .8)} ${f(y - R * .86)}" fill="none" stroke="#c8323a" stroke-width="7"/>` +
      `<path d="M${f(x - R * .7)} ${f(y + R * 1.25)} Q${f(x)} ${f(y + R * 1.45)} ${f(x + R * .7)} ${f(y + R * 1.25)}" fill="none" stroke="#c8323a" stroke-width="7"/>` +
      `<path d="M${f(x - R * .5)} ${f(y + R * 1.36)} l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10" fill="none" stroke="#e7b84a" stroke-width="3"/>`,
  };

  C.adult = {
    name: 'Ересек Қаныш', headR: 60, legH: 96, bodyH: 136, bodyW: 116, coatLen: 22, flare: .55,
    skin: '#e2ad84', coat: '#6c737d', trousers: '#4f555d', boots: '#222', armLen: 106, armW: 24, legW: 24,
    bodyDeco: (c, shY, hipY, hem, bw) =>
      `<path d="M${f(-bw * .2)} ${f(shY - 6)} L0 ${f(shY + 50)} L${f(bw * .2)} ${f(shY - 6)}Z" fill="#f4f1ea" stroke="${OL}" stroke-width="4"/>` +
      `<path d="M-7 ${f(shY + 2)} L7 ${f(shY + 2)} L10 ${f(shY + 52)} L0 ${f(shY + 64)} L-10 ${f(shY + 52)}Z" fill="#7d2a2a" stroke="${OL}" stroke-width="3"/>` +
      `<path d="M${f(-bw * .2)} ${f(shY - 6)} L${f(-bw * .04)} ${f(shY + 70)}" stroke="${OL}" stroke-width="4"/><path d="M${f(bw * .2)} ${f(shY - 6)} L${f(bw * .04)} ${f(shY + 70)}" stroke="${OL}" stroke-width="4"/>` +
      `<circle cx="0" cy="${f(shY + 92)}" r="5" fill="${OL}"/><circle cx="0" cy="${f(shY + 118)}" r="5" fill="${OL}"/>`,
    frontHead: (x, y, R) =>
      `<path d="M${f(x - R * .95)} ${f(y - R * .1)} Q${f(x - R * 1.05)} ${f(y - R * 1.25)} ${f(x)} ${f(y - R * 1.2)} Q${f(x + R * 1.05)} ${f(y - R * 1.25)} ${f(x + R * .95)} ${f(y - R * .1)} Q${f(x + R * .8)} ${f(y - R * .7)} ${f(x + R * .1)} ${f(y - R * .78)} Q${f(x - R * .6)} ${f(y - R * .75)} ${f(x - R * .95)} ${f(y - R * .1)}Z" fill="#202022" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M${f(x - R * .48)} ${f(y + R * .52)} Q${f(x - R * .25)} ${f(y + R * .3)} ${f(x)} ${f(y + R * .42)} Q${f(x + R * .25)} ${f(y + R * .3)} ${f(x + R * .48)} ${f(y + R * .52)} Q${f(x)} ${f(y + R * .56)} ${f(x - R * .48)} ${f(y + R * .52)}Z" fill="#202022" stroke="${OL}" stroke-width="3"/>`,
    faceOpt: { mouthY: .68 },
    holds: (what, x, y) => what === 'hammer'
      ? `<g transform="translate(${f(x)} ${f(y)}) rotate(-30)"><rect x="-4" y="-70" width="8" height="78" fill="#8a5a2f" stroke="${OL}" stroke-width="3"/><rect x="-22" y="-82" width="44" height="16" rx="3" fill="#888" stroke="${OL}" stroke-width="3"/></g>` : '',
  };

  // ---------- сөйлейтін тастар ----------
  function stone(kind, st = {}) {
    const P = {
      copper: { fill: '#d0773a', dark: '#9c4f22', spots: '#3fbf8a', pts: '-70,0 -78,-60 -40,-112 22,-118 74,-70 70,0' },
      coal: { fill: '#2b2b30', dark: '#16161a', spots: '#5a5a66', pts: '-66,0 -74,-70 -26,-108 40,-100 72,-52 64,0' },
      gold: { fill: '#f2c230', dark: '#c58f12', spots: '#fff3a6', pts: '-62,0 -70,-54 -36,-96 20,-106 66,-62 60,0' },
    }[kind];
    const bob = st.bob || 0;
    let s = `<g transform="translate(0 ${f(bob)})">`;
    if (kind === 'gold') s += `<circle cx="0" cy="-55" r="95" fill="#ffe27a" opacity="${.25 + (st.glow || 0) * .3}"/>`;
    // аяқтар
    s += `<ellipse cx="-30" cy="0" rx="20" ry="11" fill="${P.dark}" stroke="${OL}" stroke-width="${SW}"/><ellipse cx="30" cy="0" rx="20" ry="11" fill="${P.dark}" stroke="${OL}" stroke-width="${SW}"/>`;
    s += `<polygon points="${P.pts}" transform="translate(0 -8)" fill="${P.fill}" stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    s += `<polygon points="20,-118 74,-70 70,0 30,-8 40,-70" transform="translate(0 -8)" fill="${P.dark}" opacity=".45"/>`;
    if (kind === 'copper') s += `<circle cx="-40" cy="-40" r="9" fill="${P.spots}" stroke="${OL}" stroke-width="3"/><circle cx="42" cy="-96" r="7" fill="${P.spots}" stroke="${OL}" stroke-width="3"/><circle cx="50" cy="-30" r="6" fill="${P.spots}" stroke="${OL}" stroke-width="3"/>`;
    if (kind === 'coal') s += `<path d="M-6 -124 q10 -16 4 -28 q16 12 8 28z" fill="#ff8a2a" stroke="${OL}" stroke-width="3"/><path d="M-50 -30 L-30 -38" stroke="${P.spots}" stroke-width="5"/>`;
    if (kind === 'gold') s += `<path d="M-30 -86 l6 -14 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6z" fill="${P.spots}"/><path d="M44 -40 l4 -9 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4z" fill="${P.spots}"/>`;
    s += face(0, -62, 48, st, { noNose: true, eyeRx: .26, eyeRy: .32 });
    s += `</g>`;
    return s;
  }

  function draw(id, st = {}) {
    if (id === 'copper' || id === 'coal' || id === 'gold') return stone(id, st);
    return human(C[id], st);
  }
  // орналастыру: x,y экранда, scale, flip
  function place(id, x, y, sc, st = {}, flip = false) {
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${flip ? -sc : sc} ${sc})">${draw(id, st)}</g>`;
  }

  window.CH = { draw, place, C, face, shade, OL };
})();
