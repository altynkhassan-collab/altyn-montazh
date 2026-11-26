import json, re
src = open(".mult/engine/scenes.js").read()
info = {int(k): v for k, v in json.load(open("Бастапқы/qanysh/lines/lines.json")).items()}
scenes = []
for m in re.finditer(r"dur: ([\d.]+), lines: \[(.*?)\n  \],", src, re.S):
    dur = float(m.group(1))
    lines = [(float(a), float(b), w, t) for a, b, w, t in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", m.group(2))]
    scenes.append((dur, lines))
assert len(scenes) == 8, len(scenes)
lid = 1; out = []; total = 0
for dur, lines in scenes:
    cur = min(lines[0][0], 2.2); warp = [[0, 0]]; nl = []
    for i, (a, b, w, t) in enumerate(lines):
        d = info[lid]["dur"]
        ns, ne = cur, cur + d
        nl.append([round(ns, 3), round(ne, 3), w, t, lid])
        warp += [[round(ns, 3), a], [round(ne, 3), b]]
        if i + 1 < len(lines): cur = ne + min(max(lines[i + 1][0] - b, .2), .9)
        lid += 1
    nd = round(cur + d + min(max(dur - lines[-1][1], .7), 1.6), 3)
    warp.append([nd, dur])
    out.append({"dur": nd, "lines": nl, "warp": warp}); total += nd
    print(f"көрініс {len(out)}: {dur:.1f} -> {nd:.1f} с")
print("барлығы:", round(total, 1))
amp = {k: v["amp"] for k, v in info.items()}
open(".mult/engine/voice.js", "w").write("window.VOICE = " + json.dumps({"fps": 30, "scenes": out, "amp": amp}, ensure_ascii=False) + ";")
json.dump(out, open("Бастапқы/qanysh/lines/timing.json", "w"), ensure_ascii=False)
