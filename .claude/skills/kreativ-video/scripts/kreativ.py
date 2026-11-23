#!/usr/bin/env python3
"""Креатив-видео: сөйлеп тұрған адамның видеосынан жарнама (split-screen стилі).

Командалар (жоба түбірінен):
  python3 .claude/skills/kreativ-video/scripts/kreativ.py check
  python3 .claude/skills/kreativ-video/scripts/kreativ.py setup
  python3 .claude/skills/kreativ-video/scripts/kreativ.py prep   Бастапқы/video.mp4
  python3 .claude/skills/kreativ-video/scripts/kreativ.py sketch .kreativ/<аты>/plan.json
  python3 .claude/skills/kreativ-video/scripts/kreativ.py render .kreativ/<аты>/plan.json [--max-mb 90]
  python3 .claude/skills/kreativ-video/scripts/kreativ.py cover  .kreativ/<аты>/plan.json
"""
import sys, os, json, math, shutil, subprocess, wave, argparse

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(SKILL, "fonts", "Montserrat.ttf")
W, H, FPS = 1080, 1920, 30
SEAM = 860            # split режимінде графика панелінің биіктігі
SR = 44100

# ---------------------------------------------------------------- орта
def check():
    ok = True
    for b in ("ffmpeg", "ffprobe"):
        if not shutil.which(b): print("жоқ:", b); ok = False
    for m in ("numpy", "PIL", "cv2", "faster_whisper"):
        try: __import__(m)
        except Exception: print("жоқ: python модулі", m); ok = False
    if not os.path.exists(FONT): print("жоқ: шрифт", FONT); ok = False
    print("бәрі дайын" if ok else "setup керек")
    return ok

def setup():
    if not shutil.which("ffmpeg"):
        subprocess.run("apt-get update -qq && apt-get install -y -qq ffmpeg", shell=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "numpy", "pillow",
                    "opencv-python-headless", "faster-whisper"], check=False)
    try:
        from faster_whisper import WhisperModel
        WhisperModel("medium", device="cpu", compute_type="int8")
    except Exception as e:
        print("Whisper моделі жүктелмеді:", e)
    check()

# ---------------------------------------------------------------- көмекші
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:stream=codec_type,width,height,color_transfer:stream_side_data=rotation",
                        "-of", "json", path], capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    v = [s for s in d["streams"] if s["codec_type"] == "video"][0]
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    w, h = v["width"], v["height"]
    if abs(rot) in (90, 270): w, h = h, w
    hdr = v.get("color_transfer") in ("arib-std-b67", "smpte2084")
    return {"dur": float(d["format"]["duration"]), "w": w, "h": h, "hdr": hdr,
            "audio": any(s["codec_type"] == "audio" for s in d["streams"])}

def vf_base(info):
    """Кез келген видеоны 1080x1920 тік кадрға (бетті ортада ұстап) келтіру"""
    f = []
    if info["hdr"]:
        f.append("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
                 "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
    f.append(f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}")
    return ",".join(f)

def wdir(name):
    d = os.path.join(".kreativ", name); os.makedirs(d, exist_ok=True); return d

# ---------------------------------------------------------------- prep
def prep(video, model="medium"):
    import numpy as np
    name = os.path.splitext(os.path.basename(video))[0]
    d = wdir(name)
    info = probe(video)
    # дыбыс -> 16 кГц wav
    wav = os.path.join(d, "voice16.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-ac", "1", "-ar", "16000", wav], check=True)
    w = wave.open(wav); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; w.close()
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(a, language="kk", beam_size=5, word_timestamps=True,
                           initial_prompt="Креатив, таргет, монтаж, субтитр, Claude.")
    words = []
    for s in segs:
        for x in s.words:
            words.append([round(x.start, 2), round(x.end, 2), x.word.strip()])
    # бет орны (1080x1920 кадрда)
    face = find_face(video, info)
    data = {"video": video, "name": name, **info, "face": face, "words": words}
    json.dump(data, open(os.path.join(d, "data.json"), "w"), ensure_ascii=False, indent=1)
    # оқуға ыңғайлы мәтін
    print(f"ұзақтығы {info['dur']:.1f} с, сөз саны {len(words)}, бет орны {face}")
    line, t0 = "", None
    for s, e, t in words:
        if t0 is None: t0 = s
        line += t + " "
        if len(line) > 60 or t.endswith((".", "?", "!")):
            print(f"[{t0:5.1f}] {line.strip()}"); line, t0 = "", None
    if line: print(f"[{t0:5.1f}] {line.strip()}")
    # үзілістер
    gaps = [(float(round(words[i][1], 2)), float(round(words[i + 1][0], 2))) for i in range(len(words) - 1)
            if words[i + 1][0] - words[i][1] > 0.45]
    print("ұзақ үзілістер (кесуге болады):", gaps)
    print("дайын:", os.path.join(d, "data.json"))

def find_face(video, info):
    """YuNet (OpenCV, MIT лицензия) арқылы бет орнын табу"""
    import cv2, numpy as np
    model = os.path.join(SKILL, "models", "face_yunet.onnx")
    sw, sh = 540, 960
    det = cv2.FaceDetectorYN.create(model, "", (sw, sh), 0.7)
    pts = []
    for k in range(8):
        t = info["dur"] * (k + .5) / 8
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1",
                            "-vf", vf_base(info) + f",scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
        if len(r.stdout) != sw * sh * 3: continue
        img = np.frombuffer(r.stdout, np.uint8).reshape(sh, sw, 3)
        _, faces = det.detect(img)
        if faces is not None and len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
            pts.append(((x + w / 2) * 2, (y + h / 2) * 2, h * 2))
    if not pts: return [540, 800, 400]
    pts = np.array(pts)
    return [int(np.median(pts[:, 0])), int(np.median(pts[:, 1])), int(np.median(pts[:, 2]))]

# ---------------------------------------------------------------- графика
from functools import lru_cache

def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

class Theme:
    def __init__(self, t):
        t = t or {}
        self.bg = hexrgb(t.get("bg", "#FFF8F3")); self.ink = hexrgb(t.get("ink", "#1A1210"))
        self.acc = hexrgb(t.get("accent", "#FF5A1F")); self.acc2 = hexrgb(t.get("accent2", "#FF8A3D"))
        self.muted = hexrgb(t.get("muted", "#6B5D57")); self.line = hexrgb(t.get("line", "#F3DCCD"))
        self.red = (232, 59, 59); self.green = (34, 170, 90); self.white = (255, 255, 255)
    def col(self, name):
        return {"accent": self.acc, "red": self.red, "green": self.green, "ink": self.ink,
                "muted": self.muted, "white": self.white}.get(name, hexrgb(name) if str(name).startswith("#") else self.acc)

_fc = {}
def F(size, w="Black"):
    from PIL import ImageFont
    k = (size, w)
    if k not in _fc:
        f = ImageFont.truetype(FONT, size)
        try: f.set_variation_by_name(w)
        except Exception: pass
        _fc[k] = f
    return _fc[k]

def ease(p): p = max(0, min(1, p)); return 1 - (1 - p) ** 3
def back(p):
    p = max(0, min(1, p)); c = 1.70158
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2

class G:
    """Спрайттар мен анимация"""
    def __init__(self, th):
        from PIL import Image, ImageDraw, ImageFilter
        self.Image, self.Draw, self.Filter = Image, ImageDraw, ImageFilter
        self.th = th; self.cache = {}

    def sprite(self, key, fn):
        if key not in self.cache: self.cache[key] = fn()
        return self.cache[key]

    def card_base(self, w, h, r=36, fill=None, outline=None, sh=24):
        th = self.th; fill = fill or th.white; outline = outline or th.line
        pad = sh * 2
        im = self.Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
        m = self.Image.new("L", im.size, 0)
        self.Draw.Draw(m).rounded_rectangle([pad, pad + 10, pad + w, pad + h + 10], r, fill=70)
        m = m.filter(self.Filter.GaussianBlur(sh))
        s = self.Image.new("RGBA", im.size, (180, 80, 30, 0)); s.putalpha(m); im.alpha_composite(s)
        self.Draw.Draw(im).rounded_rectangle([pad, pad, pad + w, pad + h], r, fill=fill, outline=outline, width=3)
        return im, pad

    def mark(self, d, kind, cx, cy, r):
        th = self.th
        if kind == "x":
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=th.red); k = r * .42
            d.line([cx - k, cy - k, cx + k, cy + k], fill=th.white, width=int(r * .28))
            d.line([cx - k, cy + k, cx + k, cy - k], fill=th.white, width=int(r * .28))
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=th.acc)
            d.line([cx - r * .45, cy, cx - r * .1, cy + r * .38, cx + r * .5, cy - r * .35],
                   fill=th.white, width=int(r * .26), joint="curve")

    def card(self, text, mark="v", w=520, h=120):
        size = 50 if h >= 120 else 42
        while F(size, "ExtraBold").getlength(text) > w - 150 and size > 26: size -= 2
        im, pad = self.card_base(w, h); d = self.Draw.Draw(im)
        if mark in ("x", "v"):
            self.mark(d, mark, pad + 70, pad + h // 2, int(h * .3)); tx = pad + 130
        else: tx = pad + 40
        d.text((tx, pad + h / 2), text, font=F(size, "ExtraBold"), fill=self.th.ink, anchor="lm")
        return im

    def pill(self, text, color="accent", fg="white", size=40):
        f = F(size, "ExtraBold"); tw = int(f.getlength(text))
        bg = self.th.col(color) if color != "soft" else (255, 233, 220)
        fgc = self.th.col(fg) if color != "soft" else self.th.acc
        im = self.Image.new("RGBA", (tw + 64, size + 40), (0, 0, 0, 0)); d = self.Draw.Draw(im)
        d.rounded_rectangle([0, 0, tw + 63, size + 39], (size + 40) // 2, fill=bg)
        d.text(((tw + 64) / 2, (size + 40) / 2), text, font=f, fill=fgc, anchor="mm")
        return im

    def big(self, text, size=120, color="accent", maxw=960):
        while F(size).getlength(text) > maxw and size > 40: size -= 4
        f = F(size); tw = int(f.getlength(text))
        im = self.Image.new("RGBA", (tw + 40, int(size * 1.4)), (0, 0, 0, 0))
        self.Draw.Draw(im).text(((tw + 40) / 2, size * .7), text, font=f, fill=self.th.col(color), anchor="mm")
        return im

    def strike(self, text, size=74):
        im = self.big(text, size, "muted"); d = self.Draw.Draw(im)
        d.line([20, im.height * .5, im.width - 20, im.height * .5], fill=self.th.acc, width=8)
        return im

    def button(self, text, price):
        w, h = 840, 150
        im, pad = self.card_base(w, h, r=40, fill=self.th.acc, outline=self.th.acc); d = self.Draw.Draw(im)
        pf = F(42, "Black"); pw = pf.getlength(price) + 50 if price else 0
        size = 50
        while F(size, "Black").getlength(text) > w - 100 - pw and size > 28: size -= 2
        d.text((pad + 44, pad + h / 2), text, font=F(size, "Black"), fill=self.th.white, anchor="lm")
        if price:
            d.rounded_rectangle([pad + w - 34 - pw, pad + 34, pad + w - 34, pad + h - 34], 20, fill=self.th.white)
            d.text((pad + w - 34 - pw / 2, pad + h / 2), price, font=pf, fill=self.th.acc, anchor="mm")
        return im

    # --- белгішелер
    def icon(self, name, size=300):
        fn = getattr(self, "ic_" + name, None)
        if not fn: raise SystemExit(f"белгісіз icon: {name}. Бар: {', '.join(ICONS)}")
        return fn(size)

    def _canvas(self, s):
        im = self.Image.new("RGBA", (s + 40, s + 40), (0, 0, 0, 0)); return im, self.Draw.Draw(im), (s + 40) / 2

    def ic_target(self, s):
        im, d, c = self._canvas(s); th = self.th
        for i, col in enumerate([th.acc, th.white, th.acc, th.white, th.acc]):
            r = s / 2 * (1 - i * .19); d.ellipse([c - r, c - r, c + r, c + r], fill=col)
        d.line([c, c, c + s * .48, c - s * .48], fill=th.ink, width=max(6, s // 24))
        ax, ay = c + s * .48, c - s * .48
        d.polygon([(ax + 6, ay - 6), (ax - s * .14, ay - s * .03), (ax + s * .03, ay + s * .14)], fill=th.ink)
        return im

    def ic_bulb(self, s):
        im, d, c = self._canvas(s); th = self.th; k = s / 360
        for a in (-90, -45, 0, 45, 90, 135, -135):
            if a in (135, -135): continue
            ra = math.radians(a - 90)
            d.line([c + 125 * k * math.cos(ra), c - 20 * k + 125 * k * math.sin(ra),
                    c + 165 * k * math.cos(ra), c - 20 * k + 165 * k * math.sin(ra)], fill=th.acc2, width=int(12 * k))
        d.ellipse([c - 92 * k, c - 112 * k, c + 92 * k, c + 72 * k], fill=(255, 205, 80))
        d.rectangle([c - 45 * k, c + 50 * k, c + 45 * k, c + 100 * k], fill=(255, 205, 80))
        for i in range(3):
            d.rounded_rectangle([c - 52 * k, c + (100 + i * 22) * k, c + 52 * k, c + (116 + i * 22) * k], int(8 * k), fill=th.muted)
        return im

    def ic_sad(self, s):
        im, d, c = self._canvas(s); th = self.th; r = s / 2
        d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 214, 120))
        e = r * .14
        d.ellipse([c - r * .4 - e, c - r * .3 - e, c - r * .4 + e, c - r * .3 + e], fill=th.ink)
        d.ellipse([c + r * .4 - e, c - r * .3 - e, c + r * .4 + e, c - r * .3 + e], fill=th.ink)
        d.arc([c - r * .5, c + r * .2, c + r * .5, c + r * .85], 200, 340, fill=th.ink, width=max(6, int(r * .1)))
        return im

    def ic_happy(self, s):
        im, d, c = self._canvas(s); th = self.th; r = s / 2
        d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 214, 120))
        e = r * .14
        d.ellipse([c - r * .4 - e, c - r * .3 - e, c - r * .4 + e, c - r * .3 + e], fill=th.ink)
        d.ellipse([c + r * .4 - e, c - r * .3 - e, c + r * .4 + e, c - r * .3 + e], fill=th.ink)
        d.arc([c - r * .55, c - r * .1, c + r * .55, c + r * .6], 20, 160, fill=th.ink, width=max(6, int(r * .1)))
        return im

    def ic_phone(self, s):
        th = self.th; w, h = int(s * .55), s
        im, pad = self.card_base(w, h, r=int(s * .12), fill=th.ink, outline=th.ink); d = self.Draw.Draw(im)
        cols = [(255, 170, 120), (255, 205, 160), (255, 140, 90), (255, 215, 180)]
        cw = (w - 40) / 3; ch = cw * 1.3; k = 0
        for r in range(int((h - 70) // (ch + 8))):
            for cc in range(3):
                x0 = pad + 14 + cc * (cw + 6); y0 = pad + 50 + r * (ch + 8)
                d.rounded_rectangle([x0, y0, x0 + cw, y0 + ch], 10, fill=cols[k % 4]); k += 1
                d.polygon([(x0 + cw * .38, y0 + ch * .35), (x0 + cw * .38, y0 + ch * .65), (x0 + cw * .68, y0 + ch * .5)], fill=th.white)
        return im

    def ic_money(self, s):
        im, d, c = self._canvas(s); th = self.th
        for i in range(3):
            o = i * s * .06
            d.rounded_rectangle([c - s * .45 + o, c - s * .25 - o, c + s * .45 + o, c + s * .25 - o], int(s * .05),
                                fill=th.green if i == 2 else (120, 200, 140), outline=th.white, width=4)
        d.text((c + s * .12, c - s * .12), "₸", font=F(int(s * .32)), fill=th.white, anchor="mm")
        return im

    def ic_clock(self, s): return self.clock(s, 0)

    def clock(self, s, t):
        im, d, c = self._canvas(s); th = self.th; r = s / 2 - 10
        d.ellipse([c - r - 12, c - r - 12, c + r + 12, c + r + 12], fill=th.acc)
        d.ellipse([c - r, c - r, c + r, c + r], fill=th.white)
        for i in range(12):
            a = math.radians(i * 30)
            d.line([c + r * .82 * math.sin(a), c - r * .82 * math.cos(a), c + r * .92 * math.sin(a), c - r * .92 * math.cos(a)], fill=th.ink, width=6)
        sp = t * 6
        d.line([c, c, c + r * .55 * math.sin(sp * .2), c - r * .55 * math.cos(sp * .2)], fill=th.ink, width=12)
        d.line([c, c, c + r * .78 * math.sin(sp), c - r * .78 * math.cos(sp)], fill=th.acc, width=8)
        d.ellipse([c - 12, c - 12, c + 12, c + 12], fill=th.ink)
        return im

    def chart(self, p, up, w=640, h=280):
        im = self.Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0)); d = self.Draw.Draw(im); th = self.th
        x0, x1, yb, yt = 20, w + 20, h + 20, 20
        d.line([x0, yt - 10, x0, yb, x1, yb], fill=th.muted, width=8)
        pts = [(0, .1), (.2, .25), (.4, .2), (.6, .5), (.8, .62), (1, .95)] if up else \
              [(0, .9), (.2, .75), (.4, .8), (.6, .45), (.8, .35), (1, .08)]
        col = th.green if up else th.red; out = []
        for i in range(len(pts) - 1):
            (a, ya), (b, yb2) = pts[i], pts[i + 1]
            if p <= a: break
            e = min(p, b); k = (e - a) / (b - a)
            if not out: out.append((x0 + a * (x1 - x0), yb - ya * (yb - yt)))
            out.append((x0 + e * (x1 - x0), yb - (ya + (yb2 - ya) * k) * (yb - yt)))
        if len(out) > 1:
            d.line(out, fill=col, width=16, joint="curve"); ex, ey = out[-1]
            d.ellipse([ex - 18, ey - 18, ex + 18, ey + 18], fill=col)
        return im

    def paste(self, dst, im, cx, cy, t, t_in, t_out):
        age = t - t_in
        s = .55 + .45 * back(age / .32)
        al = ease(age / .18) * (1 - ease((t - (t_out - .15)) / .15))
        if al <= .01: return
        if abs(s - 1) > .005:
            im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), self.Image.BILINEAR)
        if al < .99:
            im = im.copy(); im.putalpha(im.getchannel("A").point(lambda v: int(v * al)))
        dst.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

ICONS = ["target", "bulb", "sad", "happy", "phone", "money", "clock"]


def end_card(g, th, bg, E, te):
    """Соңғы экран: тег, тақырып, ескі/жаңа баға, батырма, жебе. E['logo'] — логотип суреті (міндетті емес)"""
    img = bg.copy(); d = g.Draw.Draw(img); y = 330
    if E.get("logo") and os.path.exists(E["logo"]):
        def lg():
            im = g.Image.open(E["logo"]).convert("RGBA"); k = min(560 / im.width, 300 / im.height)
            return im.resize((int(im.width * k), int(im.height * k)))
        im = g.sprite(("logo", E["logo"]), lg); g.paste(img, im, 540, y + im.height / 2 - 40, te, 0, 99); y += im.height + 40
    if E.get("tag"):
        g.paste(img, g.sprite("e_tag", lambda: g.pill(E["tag"], "soft", size=38)), 540, y, te, 0, 99); y += 120
    for i, line in enumerate(E.get("title", [])):
        g.paste(img, g.sprite(("e_t", i, line), lambda: g.big(line, 96, "ink")), 540, y, te, .15 + i * .05, 99); y += 110
    for i, line in enumerate(E.get("lines", [])):
        g.paste(img, g.sprite(("e_l", i, line), lambda: g.big(line, 50, "muted")), 540, y, te, .3 + i * .05, 99); y += 70
    y += 40
    if E.get("old"):
        g.paste(img, g.sprite("e_old", lambda: g.strike(E["old"])), 540, y, te, .45, 99); y += 160
    if E.get("price"):
        g.paste(img, g.sprite("e_new", lambda: g.big(E["price"], 190)), 540, y, te, .6, 99); y += 230
    if E.get("button"):
        im = g.sprite("e_btn", lambda: g.button(E["button"], E.get("price", "")))
        if te > 1.3:
            k = 1 + .03 * math.sin((te - .9) * 7); im = im.resize((int(im.width * k), int(im.height * k)))
        g.paste(img, im, 540, y, te, .9, 99); y += 160
    if E.get("hint") and te > 1.2:
        g.paste(img, g.sprite("e_hint", lambda: g.big(E["hint"], 52, "ink")), 540, y, te, 1.2, 99)
        cx, cy = 540, y + 130 + 18 * math.sin((te - 1.2) * 6)
        d.line([cx, cy - 50, cx, cy + 30], fill=th.acc, width=16)
        d.polygon([(cx - 40, cy + 10), (cx + 40, cy + 10), (cx, cy + 60)], fill=th.acc)
    return img

# ---------------------------------------------------------------- жоспар
class Plan:
    def __init__(self, path):
        self.path = path
        p = json.load(open(path))
        self.p = p
        self.data = json.load(open(os.path.join(os.path.dirname(path), "data.json")))
        self.name = self.data["name"]; self.video = self.data["video"]
        self.th = Theme(p.get("theme")); self.g = G(self.th)
        self.keep = p.get("keep") or [[0, self.data["dur"]]]
        self.subs = p.get("subs", [])
        self.layout = p.get("layout", [{"s": 0, "e": 9999, "mode": "split"}])
        self.el = p.get("elements", [])
        self.end = p.get("end")
        self.end_dur = float(self.end.get("dur", 3.5)) if self.end else 0
        o, self.segs = 0, []
        for i, (a, b) in enumerate(self.keep):
            self.segs.append((o, o + (b - a), a, i)); o += b - a
        self.body = o; self.total = o + self.end_dur
        self.face = self.data.get("face", [540, 800, 400])
        self.bgp = self.make_bg(SEAM); self.bgf = self.make_bg(H)

    def make_bg(self, h):
        import numpy as np
        from PIL import Image
        yy, xx = np.mgrid[0:h, 0:W]
        a = np.zeros((h, W, 3), np.float32); a[:] = self.th.bg
        tint = np.array(self.th.acc, np.float32) * .25 + np.array(self.th.bg, np.float32) * .75
        g = np.exp(-(((xx - 880) / 520) ** 2 + ((yy - 120) / 380) ** 2))[..., None]
        a = a * (1 - g * .45) + tint * g * .45
        g2 = np.exp(-(((xx - 120) / 420) ** 2 + ((yy - h + 80) / 300) ** 2))[..., None]
        a = a * (1 - g2 * .35) + tint * g2 * .35
        return Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA")

    def src_of(self, to):
        for o0, o1, a, i in self.segs:
            if to < o1: return a + (to - o0), i
        return None, None

    def out_of(self, src):
        for o0, o1, a, i in self.segs:
            if a <= src < a + (o1 - o0): return o0 + src - a
        return None

    def mode_at(self, t):
        for L in self.layout:
            if L["s"] <= t < L["e"]: return L["mode"]
        return "split"

    def sub_at(self, t):
        for s, e, tx in self.subs:
            if s - .05 <= t < e + .12: return s, e, tx
        return None

    # --- элемент спрайты
    def el_sprite(self, e, t):
        g = self.g; ty = e["type"]
        if ty == "pill": return g.sprite(("pill", e["text"], e.get("color", "accent")), lambda: g.pill(e["text"], e.get("color", "accent")))
        if ty == "card": return g.sprite(("card", e["text"], e.get("mark", "v"), e.get("w", 520), e.get("h", 120)),
                                         lambda: g.card(e["text"], e.get("mark", "v"), e.get("w", 520), e.get("h", 120)))
        if ty == "big": return g.sprite(("big", e["text"], e.get("size", 120), e.get("color", "accent")),
                                        lambda: g.big(e["text"], e.get("size", 120), e.get("color", "accent")))
        if ty == "icon":
            if e["name"] == "clock": return g.clock(e.get("size", 280), t - e["s"])
            return g.sprite(("icon", e["name"], e.get("size", 300)), lambda: g.icon(e["name"], e.get("size", 300)))
        if ty == "chart": return g.chart(ease((t - e["s"]) / 1.2), e.get("dir", "up") == "up")
        raise SystemExit(f"белгісіз элемент: {ty}")

    def draw_elements(self, canvas, t, mode):
        for e in self.el:
            if e["s"] <= t < e["e"] and e.get("mode", "split" if mode == "split" else "gfx") == mode:
                im = self.el_sprite(e, t)
                self.g.paste(canvas, im, e.get("x", 540), e["y"], t, e["s"], e["e"])

    # --- субтитр
    @staticmethod
    def parse(text):
        out = []
        for i, part in enumerate(text.split("*")):
            for w in part.split(): out.append((w, i % 2 == 1))
        return out

    @staticmethod
    def wrap(words, f, maxw):
        lines, cur = [], []
        for w in words:
            test = cur + [w]
            if cur and f.getlength(" ".join(x for x, _ in test)) > maxw: lines.append(cur); cur = [w]
            else: cur = test
        if cur: lines.append(cur)
        if len(lines) >= 2 and len(lines[-1]) == 1 and len(lines[-2]) > 2: lines[-1].insert(0, lines[-2].pop())
        return lines

    def sub_panel(self, img, t, y0=None, accent_y=800):
        r = self.sub_at(t)
        if not r: return
        s, e, tx = r; words = self.parse(tx); f = F(46, "Bold")
        d = self.g.Draw.Draw(img); has_acc = any(a for _, a in words)
        lines = self.wrap(words, f, 900)
        y = y0 if y0 is not None else (640 if has_acc else 690)
        for ln in lines[:2]:
            lw = sum(f.getlength(w + " ") for w, _ in ln) - f.getlength(" "); x = (W - lw) / 2
            for w, a in ln:
                d.text((x, y), w, font=f, fill=self.th.acc if a else self.th.ink, anchor="lm"); x += f.getlength(w + " ")
            y += 56
        acc = [w for w, a in words if a]
        if acc and accent_y:
            word = acc[0].strip(",.!?«»").upper()
            im = self.g.sprite(("acc", word), lambda: self.g.big(word, 118))
            self.g.paste(img, im, 540, accent_y, t, s + .05, e + .12)

    def sub_full(self, img, t):
        r = self.sub_at(t)
        if not r: return
        s, e, tx = r; words = self.parse(tx); f = F(66, "ExtraBold"); d = self.g.Draw.Draw(img)
        y = 1330
        for ln in self.wrap(words, f, 860)[:2]:
            lw = sum(f.getlength(w + " ") for w, _ in ln) - f.getlength(" "); x = (W - lw) / 2
            for w, a in ln:
                if a:
                    ww = f.getlength(w)
                    d.rounded_rectangle([x - 14, y - 46, x + ww + 14, y + 46], 18, fill=self.th.acc)
                    d.text((x, y), w, font=f, fill=self.th.white, anchor="lm")
                else:
                    d.text((x, y), w, font=f, fill=self.th.white, anchor="lm", stroke_width=7, stroke_fill=(20, 12, 10))
                x += f.getlength(w + " ")
            y += 92

    # --- адам
    def person(self, fr, zoom, split):
        from PIL import Image
        fx, fy, fh = self.face
        im = Image.fromarray(fr)
        if split:
            hh = H - SEAM; cw, ch = W / zoom, hh / zoom
            x0 = min(max(fx - cw / 2, 0), W - cw); y0 = min(max(fy - fh * .9 - ch * .12, 0), H - ch)
            return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, hh), Image.BILINEAR)
        if zoom > 1.001:
            cw, ch = W / zoom, H / zoom
            x0 = min(max(fx - cw / 2, 0), W - cw); y0 = min(max(fy - ch * .45, 0), H - ch)
            im = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)
        return im

    # --- соңғы экран
    def end_card(self, te):
        return end_card(self.g, self.th, self.bgf, self.end, te)

    # --- бір кадр
    def compose(self, to, fr):
        from PIL import Image
        if to >= self.body: return self.end_card(to - self.body).convert("RGB")
        t, seg = self.src_of(to)
        zoom = 1.0 if seg % 2 == 0 else 1.08
        mode = self.mode_at(t)
        if mode == "gfx":
            img = self.bgf.copy(); self.draw_elements(img, t, "gfx")
            self.sub_panel(img, t, y0=1180, accent_y=None)
        elif mode == "full":
            img = self.person(fr, zoom, False).convert("RGBA"); self.draw_elements(img, t, "full")
            self.sub_full(img, t)
        else:
            img = Image.new("RGBA", (W, H)); img.paste(self.person(fr, zoom, True), (0, SEAM))
            panel = self.bgp.copy(); self.draw_elements(panel, t, "split"); self.sub_panel(panel, t)
            img.alpha_composite(panel, (0, 0))
            self.g.Draw.Draw(img).rectangle([0, SEAM - 4, W, SEAM], fill=self.th.acc)
        return img.convert("RGB")

    # --- тексеру
    def lint(self):
        warn = []
        for e in self.el:
            m = e.get("mode", "split")
            try: im = self.el_sprite(e, e["s"] + 2)
            except SystemExit as x: warn.append(str(x)); continue
            x, y = e.get("x", 540), e["y"]
            bb = im.getchannel("A").point(lambda v: 255 if v > 140 else 0).getbbox() or (0, 0, im.width, im.height)
            l, tp = x - im.width / 2 + bb[0], y - im.height / 2 + bb[1]
            r, bt = x - im.width / 2 + bb[2], y - im.height / 2 + bb[3]
            if l < 20 or r > W - 20: warn.append(f"{e['s']}с {e.get('text', e.get('name', e['type']))}: көлденең шетке шығып тұр")
            if m == "split" and (tp < 200 or bt > 640):
                warn.append(f"{e['s']}с {e.get('text', e.get('name', e['type']))}: панельде y {int(tp)}–{int(bt)} (рұқсат 200–640)")
        for s, e, tx in self.subs:
            if self.mode_at(s) == "split":
                f = F(46, "Bold")
                if len(self.wrap(self.parse(tx), f, 900)) > 2: warn.append(f"{s}с субтитр 2 жолдан ұзын: {tx}")
        return warn

    # --- кесілген видео
    def cut(self):
        out = os.path.join(os.path.dirname(self.path), "cut.mov")
        sig = json.dumps(self.keep)
        sigf = out + ".keep"
        if os.path.exists(out) and os.path.exists(sigf) and open(sigf).read() == sig: return out
        info = probe(self.video); base = vf_base(info); vf, af, n = [], [], len(self.keep)
        for i, (a, b) in enumerate(self.keep):
            vf.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,{base},fps={FPS}[v{i}]")
            af.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample={SR},afade=t=in:d=0.02,"
                      f"afade=t=out:st={max(0, b - a - 0.03):.3f}:d=0.03[a{i}]")
        cat = "".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", self.video, "-filter_complex", ";".join(vf + af + [cat]),
                        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "14", "-preset", "fast",
                        "-c:a", "pcm_s16le", out], check=True)
        open(sigf, "w").write(sig)
        return out

    def frame_at(self, cut, to):
        import numpy as np
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{min(to, self.body - .05):.3f}", "-i", cut, "-frames:v", "1",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        return np.frombuffer(r, np.uint8).reshape(H, W, 3)

# ---------------------------------------------------------------- дыбыс
def synth_music(T):
    """Жайлы фон музыкасы (өзіміз синтездейміз — авторлық құқық мәселесі жоқ)"""
    import numpy as np
    N = int(T * SR) + SR; music = np.zeros(N)
    def add(buf, s, x):
        if s >= N: return
        e = min(N, s + len(x)); buf[s:e] += x[:e - s]
    def env(n, a, r):
        e = np.ones(n); a, r = int(a * SR), int(r * SR); e[:a] = np.linspace(0, 1, a); e[-r:] *= np.linspace(1, 0, r); return e
    def note(f, dur, kind):
        n = int(dur * SR); t = np.arange(n) / SR
        if kind == "pad":
            s = sum(np.sin(2 * np.pi * f * m * t + np.sin(2 * np.pi * .3 * t) * .3) / m ** 1.6 for m in (1, 2, 3))
            return s * env(n, .8, .9) * .18
        return (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 4.5) * env(n, .005, .05) * .16
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    bar = 4 * 60 / 92; chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [46, 50, 53, 57]]
    t0, i = 0, 0
    while t0 < T:
        ch = chords[i % 4]; s = int(t0 * SR)
        for m in ch: add(music, s, note(hz(m), bar + .6, "pad"))
        add(music, s, note(hz(ch[0] - 12), bar, "pad") * 1.3)
        for k in range(8):
            m = ch[[0, 2, 1, 3, 2, 1, 3, 2][k]] + 12; add(music, int((t0 + k * bar / 8) * SR), note(hz(m), .6, "pluck"))
        t0 += bar; i += 1
    dl = int(.11 * SR); wet = np.zeros_like(music)
    for k, gg in enumerate([.35, .22, .14, .08]): wet[dl * (k + 1):] += music[:-dl * (k + 1)] * gg
    music = music + wet; music /= max(1e-6, np.abs(music).max())
    fd = int(1.5 * SR); e = int(T * SR); music[e - fd:e] *= np.linspace(1, 0, fd); music[e:] = 0
    return music

class Sfx:
    def __init__(self, T):
        import numpy as np
        self.np = np; self.N = int(T * SR) + SR; self.a = np.zeros(self.N); self.rng = np.random.default_rng(1)
    def add(self, s, x):
        if s >= self.N: return
        e = min(self.N, s + len(x)); self.a[s:e] += x[:e - s]
    def pop(self, at, f=900):
        np = self.np; n = int(.12 * SR); t = np.arange(n) / SR
        self.add(int(at * SR), np.sin(2 * np.pi * (f * np.exp(-t * 18) + 300) * t) * np.exp(-t * 35) * .5)
    def whoosh(self, at):
        np = self.np; n = int(.45 * SR); x = self.rng.standard_normal(n); k = np.linspace(0, 1, n)
        x = np.convolve(x, np.ones(30) / 30, "same") * np.sin(np.pi * k) ** 2 * .45
        self.add(int(max(0, at - .25) * SR), x)

def write_wav(path, a):
    import numpy as np
    a = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    w = wave.open(path, "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes()); w.close()

def mix_audio(voice_src, music, sfx, T, outwav, music_volume=0.2):
    """дауыс + музыка (дауыс кезінде тыншиды) + эффектілер -> -14 LUFS"""
    import numpy as np
    d = os.path.dirname(outwav); mw, sw = os.path.join(d, "music.wav"), os.path.join(d, "sfx.wav")
    write_wav(mw, music if music is not None else np.zeros(int(T * SR) + SR)); write_wav(sw, sfx)
    if voice_src:
        inputs = ["-i", voice_src, "-i", mw, "-i", sw]
        fc = (f"[0:a]aresample={SR},pan=mono|c0=c0,asplit[v][vk];[1:a]volume={music_volume}[m];"
              "[m][vk]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500[md];[2:a]volume=0.30[s];"
              f"[v]apad[vp];[vp][md][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:{T:.3f},"
              "loudnorm=I=-14:TP=-1.5:LRA=11[out]")
    else:
        inputs = ["-i", mw, "-i", sw]
        fc = (f"[0:a]volume={max(music_volume, .5)}[m];[1:a]volume=0.30[s];[m][s]amix=inputs=2:normalize=0:duration=longest,"
              f"atrim=0:{T:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[out]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[out]",
                    "-ar", str(SR), "-c:a", "pcm_s16le", outwav], check=True)

def make_audio(P, outwav):
    T = P.total
    music = synth_music(T) if P.p.get("music", True) else None
    fx = Sfx(T)
    if P.p.get("sfx", True):
        for e in P.el:
            o = P.out_of(e["s"] + .001)
            if o is not None: fx.pop(o, 700 if e["type"] == "pill" else 1000)
        for o0, o1, a, i in P.segs[1:]: fx.whoosh(o0)
        for L in P.layout[1:]:
            o = P.out_of(L["s"] + .001)
            if o is not None: fx.whoosh(o)
        if P.end:
            fx.whoosh(P.body)
            for x in (0, .15, .45, .6, .9, 1.2): fx.pop(P.body + x, 1100)
    mix_audio(P.cut(), music, fx.a, T, outwav, float(P.p.get("music_volume", 0.20)))

# ---------------------------------------------------------------- командалар
def sketch(plan_path, times=None):
    from PIL import Image, ImageDraw
    P = Plan(plan_path)
    for w in P.lint(): print("⚠️", w)
    cut = P.cut()
    if not times:
        ts = []
        for s, e, tx in P.subs:
            o = P.out_of((s + e) / 2)
            if o is not None: ts.append(o)
        step = max(1, len(ts) // 14)
        times = ts[::step][:14]
        if P.end: times += [P.body + 1.5, P.total - .2]
    tiles = []
    for to in times:
        im = P.compose(to, P.frame_at(cut, to)).resize((360, 640))
        d = ImageDraw.Draw(im); d.rectangle([0, 0, 110, 40], fill=(0, 0, 0)); d.text((8, 6), f"{to:.1f}с", font=F(26, "Bold"), fill=(255, 255, 255))
        tiles.append(im)
    cols = 4; rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * 370 + 10, rows * 650 + 10), (240, 240, 240))
    for i, im in enumerate(tiles): sheet.paste(im, (10 + (i % cols) * 370, 10 + (i // cols) * 650))
    os.makedirs("Раскадровка", exist_ok=True)
    out = os.path.join("Раскадровка", f"{P.name}_раскадровка.jpg"); sheet.save(out, quality=88)
    print(f"ұзақтығы {P.total:.1f} с\nдайын: {out}")

def render(plan_path, max_mb=90):
    import numpy as np
    P = Plan(plan_path); d = os.path.dirname(plan_path); cut = P.cut()
    os.makedirs("Дайын", exist_ok=True)
    v = 1
    while os.path.exists(os.path.join("Дайын", f"{P.name}_v{v}.mp4")): v += 1
    out = os.path.join("Дайын", f"{P.name}_v{v}.mp4"); silent = os.path.join(d, "silent.mp4")
    kbps = int(max_mb * 8000 / P.total * .92) - 192
    nfr = int(round(P.total * FPS))
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", cut, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "18", "-maxrate", f"{max(2000, kbps)}k", "-bufsize", f"{max(4000, kbps * 2)}k",
                            "-preset", "medium", "-pix_fmt", "yuv420p", silent], stdin=subprocess.PIPE)
    last = None
    for i in range(nfr):
        to = i / FPS
        if to < P.body:
            buf = dec.stdout.read(W * H * 3)
            if len(buf) == W * H * 3: last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        enc.stdin.write(np.asarray(P.compose(to, last)).tobytes())
        if i % 300 == 0: print(f"{i}/{nfr}", flush=True)
    enc.stdin.close(); enc.wait(); dec.kill()
    mix = os.path.join(d, "mix.wav"); make_audio(P, mix)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], check=True)
    mb = os.path.getsize(out) / 1e6
    print(f"дайын: {out} ({P.total:.1f} с, {mb:.1f} МБ)")

def frames(video, n=8):
    from PIL import Image
    info = probe(video); tiles = []
    for k in range(n):
        t = info["dur"] * (k + .5) / n
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=270:480",
                            "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
        import io; tiles.append(Image.open(io.BytesIO(r.stdout)))
    sheet = Image.new("RGB", (270 * n, 480)); [sheet.paste(im, (i * 270, 0)) for i, im in enumerate(tiles)]
    out = os.path.splitext(video)[0] + "_кадрлар.jpg"; sheet.save(out, quality=85); print("дайын:", out)

def cover(plan_path):
    import numpy as np
    from PIL import Image
    P = Plan(plan_path); C = P.p.get("cover") or {}
    info = probe(P.video)
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(C.get("t", 0.3)), "-i", P.video, "-frames:v", "1", "-vf", vf_base(info),
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(r, np.uint8).reshape(H, W, 3)
    seam = 980; hh = H - seam; fx, fy, fh = P.face
    y0 = min(max(fy - fh * .9 - hh * .12, 0), H - hh)
    img = Image.new("RGBA", (W, H)); img.paste(Image.fromarray(fr).crop((0, int(y0), W, int(y0 + hh))), (0, seam))
    img.alpha_composite(P.make_bg(seam), (0, 0)); P.g.Draw.Draw(img).rectangle([0, seam - 6, W, seam], fill=P.th.acc)
    y = 340; g = P.g
    if C.get("tag"):
        im = g.pill(C["tag"], size=46); img.alpha_composite(im, (int(540 - im.width / 2), int(y - im.height / 2))); y += 150
    for line in C.get("lines", []):
        text, color = (line, "ink") if isinstance(line, str) else (line[0], line[1])
        size = 140 if color == "accent" else 76
        im = g.big(text, size, color, maxw=880)
        img.alpha_composite(im, (int(540 - im.width / 2), int(y - im.height / 2))); y += int(im.height * .95)
    os.makedirs("Дайын", exist_ok=True)
    out = os.path.join("Дайын", f"{P.name}_обложка.jpg"); img.convert("RGB").save(out, quality=93)
    if y > seam - 20: print("⚠️ заголовок ұзын — жолдарды қысқарт")
    print("дайын:", out)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("arg", nargs="?")
    ap.add_argument("--max-mb", type=float, default=90); ap.add_argument("--times"); ap.add_argument("--model", default="medium")
    a = ap.parse_args()
    if a.cmd == "check": sys.exit(0 if check() else 1)
    elif a.cmd == "setup": setup()
    elif a.cmd == "prep": prep(a.arg, a.model)
    elif a.cmd == "sketch": sketch(a.arg, [float(x) for x in a.times.split(",")] if a.times else None)
    elif a.cmd == "render": render(a.arg, a.max_mb)
    elif a.cmd == "cover": cover(a.arg)
    elif a.cmd == "frames": frames(a.arg)
    else: print(__doc__)
