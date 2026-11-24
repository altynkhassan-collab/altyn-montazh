#!/usr/bin/env python3
"""Сурет-видео: ИИ суреттері + дауыс (ElevenLabs т.б.) -> қозғалатын жарнама видео.
2-түр (ИИ суретімен жарнама) және 3-түр (мульт-оқиға) осы движокпен жасалады.

  python3 .claude/skills/suret-video/scripts/suret.py prep   Бастапқы/<аты>/   [--lang kk]
  python3 .claude/skills/suret-video/scripts/suret.py sketch .suret/<аты>/plan.json
  python3 .claude/skills/suret-video/scripts/suret.py render .suret/<аты>/plan.json [--max-mb 90]
  python3 .claude/skills/suret-video/scripts/suret.py cover  .suret/<аты>/plan.json
"""
import sys, os, json, math, re, subprocess, wave, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "kreativ-video", "scripts"))
import kreativ as K   # ортақ графика, шрифт, музыка, соңғы экран

W, H, FPS, SR = K.W, K.H, K.FPS, K.SR
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic")
AUD_EXT = (".mp3", ".m4a", ".wav", ".aac", ".ogg", ".mp4", ".mov")

def natkey(s): return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", s)]

def to_jpg(path, outdir):
    """HEIC/WEBP -> JPG (ffmpeg арқылы)"""
    base = os.path.splitext(os.path.basename(path))[0]
    if path.lower().endswith((".jpg", ".jpeg", ".png")): return path
    out = os.path.join(outdir, base + ".jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, out], check=True); return out

# ---------------------------------------------------------------- prep
def prep(folder, lang="kk", model="medium"):
    import numpy as np
    from PIL import Image
    folder = folder.rstrip("/"); name = os.path.basename(folder)
    d = os.path.join(".suret", name); os.makedirs(d, exist_ok=True)
    files = sorted(os.listdir(folder), key=natkey)
    imgs, audio = [], None
    for f in files:
        p = os.path.join(folder, f); low = f.lower()
        if low.startswith("logo"): continue
        if low.endswith(IMG_EXT):
            p = to_jpg(p, d); im = Image.open(p); imgs.append({"file": p, "w": im.width, "h": im.height})
        elif low.endswith(AUD_EXT) and audio is None: audio = p
    logo = next((os.path.join(folder, f) for f in files if f.lower().startswith("logo")), None)
    data = {"name": name, "folder": folder, "images": imgs, "logo": logo, "audio": audio, "words": [], "dur": 0}
    if audio:
        wav = os.path.join(d, "voice16.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", audio, "-ac", "1", "-ar", "16000", wav], check=True)
        w = wave.open(wav); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        data["dur"] = w.getnframes() / 16000; w.close()
        from faster_whisper import WhisperModel
        m = WhisperModel(model, device="cpu", compute_type="int8")
        segs, _ = m.transcribe(a, language=lang, beam_size=5, word_timestamps=True)
        for s in segs:
            for x in s.words: data["words"].append([round(float(x.start), 2), round(float(x.end), 2), x.word.strip()])
    json.dump(data, open(os.path.join(d, "data.json"), "w"), ensure_ascii=False, indent=1)
    print(f"суреттер: {len(imgs)}  " + ", ".join(f"{os.path.basename(i['file'])} {i['w']}x{i['h']}" for i in imgs))
    print("логотип:", logo or "жоқ")
    if audio:
        print(f"дауыс: {audio}, {data['dur']:.1f} с, {len(data['words'])} сөз")
        line, t0 = "", None
        for s, e, t in data["words"]:
            if t0 is None: t0 = s
            line += t + " "
            if len(line) > 60 or t.endswith((".", "?", "!")): print(f"[{t0:5.1f}-{e:5.1f}] {line.strip()}"); line, t0 = "", None
        if line: print(f"[{t0:5.1f}] {line.strip()}")
    else:
        print("дауыс жоқ — сахна ұзақтығын plan.json-да қолмен бер")
    print("дайын:", os.path.join(d, "data.json"))

# ---------------------------------------------------------------- жоспар
class Plan:
    def __init__(self, path):
        from PIL import Image
        self.Image = Image; self.path = path; self.dir = os.path.dirname(path)
        self.p = json.load(open(path)); self.data = json.load(open(os.path.join(self.dir, "data.json")))
        self.name = self.data["name"]; self.th = K.Theme(self.p.get("theme", {"bg": "#14100E", "ink": "#FFFFFF"}))
        self.g = K.G(self.th)
        self.scenes = self.p["scenes"]; self.subs = self.p.get("subs", []); self.el = self.p.get("elements", [])
        self.end = self.p.get("end")
        if self.end and not self.end.get("logo") and self.data.get("logo"): self.end["logo"] = self.data["logo"]
        self.end_dur = float(self.end.get("dur", 3.5)) if self.end else 0
        self.body = max(s["e"] for s in self.scenes); self.total = self.body + self.end_dur
        self.xf = float(self.p.get("crossfade", 0.45))
        self.sub_style = self.p.get("sub_style", "box")
        self._img = {}
        endbg = self.end.get("bg", "theme") if self.end else "theme"
        self.endbg = K.Plan.make_bg(self, H) if endbg == "theme" else None

    def img_file(self, f):
        if os.path.exists(f): return f
        cand = os.path.join(self.data["folder"], f)
        if os.path.exists(cand): return to_jpg(cand, self.dir)
        for i in self.data["images"]:
            if os.path.basename(i["file"]).split(".")[0] == os.path.splitext(f)[0]: return i["file"]
        raise SystemExit(f"сурет табылмады: {f}")

    def base(self, f):
        """суретті 9:16 кадрға толтырып, 1.18 есе үлкейтілген нұсқасы (қозғалыс үшін қор)"""
        if f not in self._img:
            im = self.Image.open(self.img_file(f)).convert("RGB")
            k = max(W / im.width, H / im.height) * 1.18
            self._img[f] = im.resize((int(im.width * k) + 1, int(im.height * k) + 1), self.Image.LANCZOS)
        return self._img[f]

    def scene_frame(self, sc, t):
        im = self.base(sc["img"]); p = (t - sc["s"]) / max(.1, sc["e"] - sc["s"]); p = max(0, min(1, p))
        p = p * p * (3 - 2 * p) * .85 + p * .15
        mo = sc.get("motion", "in"); fw, fh = im.width, im.height
        z0, z1 = {"in": (1.0, 1.15), "out": (1.15, 1.0)}.get(mo, (1.1, 1.1))
        z = z0 + (z1 - z0) * p
        # кадр өлшемі: 1080x1920 пропорциясы
        sc_k = min(fw / W, fh / H) / z; cw, ch = W * sc_k, H * sc_k
        fx, fy = sc.get("focus", [0.5, 0.45])
        cx, cy = fw * fx, fh * fy
        if mo == "left": cx = fw * (.62 - .24 * p)
        if mo == "right": cx = fw * (.38 + .24 * p)
        if mo == "up": cy = fh * (.6 - .2 * p)
        if mo == "down": cy = fh * (.4 + .2 * p)
        x0 = min(max(cx - cw / 2, 0), fw - cw); y0 = min(max(cy - ch / 2, 0), fh - ch)
        return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), self.Image.BILINEAR)

    def frame_bg(self, t):
        cur = [s for s in self.scenes if s["s"] <= t < s["e"] + (self.xf if s is not self.scenes[-1] else 0)]
        if not cur: cur = [self.scenes[-1]]
        a = self.scene_frame(cur[0], t)
        if len(cur) > 1:
            b = self.scene_frame(cur[1], t); k = (t - cur[1]["s"]) / self.xf
            a = self.Image.blend(a, b, max(0, min(1, k)))
        return a

    # --- мәтін
    def sub_at(self, t):
        for s, e, tx in self.subs:
            if s - .05 <= t < e + .1: return s, e, tx
        return None

    def draw_sub(self, img, t):
        r = self.sub_at(t)
        if not r: return
        s, e, tx = r; words = K.Plan.parse(tx); f = K.F(54, "SemiBold"); d = self.g.Draw.Draw(img)
        lines = K.Plan.wrap(words, f, 820)[:3]
        al = K.ease((t - s) / .25) * (1 - K.ease((t - e + .1) / .2))
        if al <= .01: return
        y0 = int(self.p.get("sub_y", 1360)); lh = 72
        widths = [sum(f.getlength(w + " ") for w, _ in ln) - f.getlength(" ") for ln in lines]
        bw = max(widths) + 64; bh = lh * len(lines) + 36
        if self.sub_style == "box":
            ov = self.Image.new("RGBA", img.size, (0, 0, 0, 0)); od = self.g.Draw.Draw(ov)
            od.rounded_rectangle([(W - bw) / 2, y0 - 18, (W + bw) / 2, y0 - 18 + bh], 26, fill=(10, 8, 8, int(150 * al)))
            img.alpha_composite(ov)
        y = y0 + lh / 2
        for ln, lw in zip(lines, widths):
            x = (W - lw) / 2
            for w, a in ln:
                col = self.th.acc if a else (255, 255, 255)
                col = tuple(int(c * al + 30 * (1 - al)) for c in col)
                if self.sub_style == "box": d.text((x, y), w, font=f, fill=col, anchor="lm")
                else: d.text((x, y), w, font=f, fill=col, anchor="lm", stroke_width=6, stroke_fill=(15, 10, 10))
                x += f.getlength(w + " ")
            y += lh

    def draw_titles(self, img, t):
        for sc in self.scenes:
            if sc.get("title") and sc["s"] <= t < sc["e"]:
                ti = sc["title"]; size = int(sc.get("title_size", 120))
                im = self.g.sprite(("title", ti, size), lambda: self.shadow_text(ti, size))
                ts = sc["s"] + float(sc.get("title_at", 0.3))
                if t >= ts: self.g.paste(img, im, 540, int(sc.get("title_y", 330)), t, ts, sc["e"])
        for e in self.el:
            if e["s"] <= t < e["e"]:
                if e["type"] == "big" and e.get("shadow"):
                    im = self.g.sprite(("bigsh", e["text"], e.get("size", 120)), lambda: self.shadow_text(e["text"], int(e.get("size", 120)), self.th.col(e.get("color", "accent"))))
                else: im = K.Plan.el_sprite(self, e, t)
                self.g.paste(img, im, e.get("x", 540), e["y"], t, e["s"], e["e"])

    def shadow_text(self, text, size, fill=(255, 255, 255)):
        f = K.F(size, "Black")
        while f.getlength(text) > 940 and size > 40: size -= 4; f = K.F(size, "Black")
        tw = int(f.getlength(text)); im = self.Image.new("RGBA", (tw + 80, int(size * 1.6)), (0, 0, 0, 0))
        sh = self.Image.new("RGBA", im.size, (0, 0, 0, 0))
        self.g.Draw.Draw(sh).text((im.width / 2, im.height / 2), text, font=f, fill=(0, 0, 0, 200), anchor="mm")
        sh = sh.filter(self.g.Filter.GaussianBlur(14)); im.alpha_composite(sh)
        self.g.Draw.Draw(im).text((im.width / 2, im.height / 2), text, font=f, fill=fill, anchor="mm")
        return im

    def compose(self, t):
        if t >= self.body:
            te = t - self.body
            if self.endbg is not None: img = K.end_card(self.g, self.th, self.endbg, self.end, te)
            else:
                bg = self.frame_bg(self.body - .01).filter(self.g.Filter.GaussianBlur(18)).convert("RGBA")
                ov = self.Image.new("RGBA", (W, H), (0, 0, 0, 120)); bg.alpha_composite(ov)
                img = K.end_card(self.g, self.th, bg, self.end, te)
            return img.convert("RGB")
        img = self.frame_bg(t).convert("RGBA")
        # жоғары/төмен жұмсақ қараңғылау — мәтін оқылсын
        if not hasattr(self, "_vig"):
            import numpy as np
            y = np.linspace(0, 1, H)[:, None]; a = np.clip((y - .58) / .42, 0, 1) ** 1.5 * 150 + np.clip((.18 - y) / .18, 0, 1) * 90
            v = np.zeros((H, W, 4), np.uint8); v[..., 3] = np.repeat(a, W, 1).astype(np.uint8); self._vig = self.Image.fromarray(v)
        img.alpha_composite(self._vig)
        self.draw_titles(img, t); self.draw_sub(img, t)
        return img.convert("RGB")

    def lint(self):
        w = []
        sc = sorted(self.scenes, key=lambda s: s["s"])
        for a, b in zip(sc, sc[1:]):
            if abs(a["e"] - b["s"]) > .05: w.append(f"сахналар арасында бос орын/қабаттасу: {a['e']} → {b['s']}")
        if sc and sc[0]["s"] > .05: w.append("бірінші сахна 0-ден басталмайды")
        if self.data.get("dur") and self.body < self.data["dur"] - .3: w.append(f"дауыс {self.data['dur']:.1f} с, сахналар {self.body:.1f} с-та бітеді")
        for s in self.scenes:
            try: self.img_file(s["img"])
            except SystemExit as e: w.append(str(e))
            if s["e"] - s["s"] > 7: w.append(f"{s['img']}: {s['e'] - s['s']:.1f} с — ұзақ (≤6 с ұсынылады)")
        for s, e, tx in self.subs:
            if len(K.Plan.wrap(K.Plan.parse(tx), K.F(54, "SemiBold"), 820)) > 2: w.append(f"{s}с субтитр 2 жолдан ұзын: {tx}")
        return w

# ---------------------------------------------------------------- командалар
def sketch(path, times=None):
    from PIL import Image, ImageDraw
    P = Plan(path)
    for w in P.lint(): print("⚠️", w)
    if not times:
        times = [(s["s"] + s["e"]) / 2 for s in P.scenes]
        if P.end: times += [P.body + 1.6, P.total - .2]
    tiles = []
    for t in times:
        im = P.compose(t).resize((360, 640)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 110, 40], fill=(0, 0, 0)); d.text((8, 6), f"{t:.1f}с", font=K.F(26, "Bold"), fill=(255, 255, 255))
        tiles.append(im)
    cols = 4; rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * 370 + 10, rows * 650 + 10), (240, 240, 240))
    for i, im in enumerate(tiles): sheet.paste(im, (10 + (i % cols) * 370, 10 + (i // cols) * 650))
    os.makedirs("Раскадровка", exist_ok=True)
    out = os.path.join("Раскадровка", f"{P.name}_раскадровка.jpg"); sheet.save(out, quality=88)
    print(f"ұзақтығы {P.total:.1f} с\nдайын: {out}")

def render(path, max_mb=90):
    import numpy as np
    P = Plan(path); os.makedirs("Дайын", exist_ok=True)
    v = 1
    while os.path.exists(os.path.join("Дайын", f"{P.name}_v{v}.mp4")): v += 1
    out = os.path.join("Дайын", f"{P.name}_v{v}.mp4"); silent = os.path.join(P.dir, "silent.mp4")
    kbps = int(max_mb * 8000 / P.total * .92) - 192; nfr = int(round(P.total * FPS))
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "18", "-maxrate", f"{max(2000, kbps)}k", "-bufsize", f"{max(4000, kbps * 2)}k",
                            "-preset", "medium", "-pix_fmt", "yuv420p", silent], stdin=subprocess.PIPE)
    for i in range(nfr):
        enc.stdin.write(np.asarray(P.compose(i / FPS)).tobytes())
        if i % 300 == 0: print(f"{i}/{nfr}", flush=True)
    enc.stdin.close(); enc.wait()
    T = P.total; music = K.synth_music(T) if P.p.get("music", True) else None; fx = K.Sfx(T)
    if P.p.get("sfx", True):
        for s in P.scenes[1:]: fx.whoosh(s["s"])
        for s in P.scenes:
            if s.get("title"): fx.pop(s["s"] + float(s.get("title_at", .3)), 800)
        for e in P.el: fx.pop(e["s"], 900)
        if P.end:
            fx.whoosh(P.body)
            for x in (0, .15, .45, .6, .9, 1.2): fx.pop(P.body + x, 1100)
    voice = P.data.get("audio")
    if voice and P.p.get("voice_delay", 0):
        dl = os.path.join(P.dir, "voice_delay.wav"); ms = int(float(P.p["voice_delay"]) * 1000)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", voice, "-af", f"adelay={ms}", dl], check=True); voice = dl
    mix = os.path.join(P.dir, "mix.wav"); K.mix_audio(voice, music, fx.a, T, mix, float(P.p.get("music_volume", 0.18)))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], check=True)
    print(f"дайын: {out} ({T:.1f} с, {os.path.getsize(out) / 1e6:.1f} МБ)")

def cover(path):
    P = Plan(path); C = P.p.get("cover") or {}
    sc = next((s for s in P.scenes if s["img"] == C.get("img")), P.scenes[0])
    img = P.scene_frame(dict(sc, motion="still"), sc["s"]).convert("RGBA")
    import numpy as np
    y = np.linspace(0, 1, H)[:, None]; a = np.clip((.62 - y) / .62, 0, 1) ** 1.1 * 215
    v = np.zeros((H, W, 4), np.uint8); v[..., 3] = np.repeat(a, W, 1).astype(np.uint8); img.alpha_composite(P.Image.fromarray(v))
    yy = int(C.get("y", 360)); g = P.g
    if C.get("tag"):
        im = g.pill(C["tag"], size=44); img.alpha_composite(im, (int(540 - im.width / 2), int(yy - im.height / 2))); yy += 140
    for line in C.get("lines", []):
        text, color = (line, "white") if isinstance(line, str) else (line[0], line[1])
        size = 130 if color == "accent" else 84
        im = P.shadow_text(text, size, P.th.col(color))
        img.alpha_composite(im, (int(540 - im.width / 2), int(yy - im.height / 2))); yy += int(im.height * .85)
    os.makedirs("Дайын", exist_ok=True); out = os.path.join("Дайын", f"{P.name}_обложка.jpg")
    img.convert("RGB").save(out, quality=93); print("дайын:", out)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("arg", nargs="?")
    ap.add_argument("--max-mb", type=float, default=90); ap.add_argument("--times"); ap.add_argument("--lang", default="kk")
    ap.add_argument("--model", default="medium")
    a = ap.parse_args()
    if a.cmd == "prep": prep(a.arg, a.lang, a.model)
    elif a.cmd == "sketch": sketch(a.arg, [float(x) for x in a.times.split(",")] if a.times else None)
    elif a.cmd == "render": render(a.arg, a.max_mb)
    elif a.cmd == "cover": cover(a.arg)
    else: print(__doc__)
