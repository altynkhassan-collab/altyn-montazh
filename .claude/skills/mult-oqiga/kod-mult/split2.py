import json, subprocess, numpy as np, os, wave, re
W = json.load(open("Бастапқы/qanysh/raw/words.json"))
TXT = {}
for l in open("Сценарий/qanysh_озвучка.md"):
    m = re.match(r"- \*\*(\d\d)\*\* — (?:\[[^\]]*\] )?(.*)", l.strip())
    if m: TXT[int(m.group(1))] = m.group(2)
MAP = {"Zuu.mp3": [1,3,5,8,13,15,18,19,25], "Spuds.mp3": [2,7,16,20,26], "Lauren.mp3": [6,9,17,21,27],
       "Jessica.mp3": [14,22,23,24,28], "Lyan.mp3": [4], "Chutki.mp3": [10], "Bunty.mp3": [11], "Aarush.mp3": [12]}
L = lambda s: len(re.sub(r"[^\w]", "", s))
SR = 44100
info = {}
for f, ids in MAP.items():
    ws = W[f]; n = len(ws); k = len(ids)
    exp = [L(TXT[i]) for i in ids]; tot = sum(exp)
    wl = [L(w[2]) for w in ws]; wt = sum(wl)
    scale = wt / tot
    gap = [ws[i+1][0] - ws[i][1] for i in range(n-1)]
    punct = [1 if re.search(r"[.!?]$", ws[i][2]) else 0 for i in range(n-1)]
    # DP: best[j][i] = j сегмент, i сөзге дейін
    INF = 1e18; best = [[INF]*(n+1) for _ in range(k+1)]; back = [[0]*(n+1) for _ in range(k+1)]
    best[0][0] = 0; cum = np.concatenate([[0], np.cumsum(wl)])
    for j in range(1, k+1):
        for i in range(1, n+1):
            for p in range(j-1, i):
                if best[j-1][p] >= INF: continue
                c = (cum[i]-cum[p] - exp[j-1]*scale)**2 / (exp[j-1]*scale)
                if i < n: c -= 6*gap[i-1] + 3*punct[i-1]
                if j == k and i != n: c = INF
                v = best[j-1][p] + c
                if v < best[j][i]: best[j][i] = v; back[j][i] = p
    cuts = []; i = n
    for j in range(k, 0, -1): p = back[j][i]; cuts.append((p, i)); i = p
    cuts.reverse()
    raw = subprocess.run(["ffmpeg","-v","error","-i",f"Бастапқы/qanysh/raw/{f}","-ac","1","-ar",str(SR),"-f","s16le","-"],capture_output=True).stdout
    a = np.frombuffer(raw,np.int16).astype(np.float32)/32768; dur = len(a)/SR
    print("==", f)
    for idx, (p, q) in enumerate(cuts):
        lid = ids[idx]
        s = ws[p][0]; e = ws[q-1][1]
        lo = ws[p-1][1] if p > 0 else 0; hi = ws[q][0] if q < n else dur
        s0 = max(lo + (s-lo)*.4, s - .15) if p > 0 else max(0, s - .15)
        e0 = min(e + (hi-e)*.6, e + .25) if q < n else min(dur, e + .3)
        seg = a[int(s0*SR):int(e0*SR)].copy()
        fd = int(.02*SR); seg[:fd] *= np.linspace(0,1,fd); seg[-fd:] *= np.linspace(1,0,fd)
        with wave.open(f"Бастапқы/qanysh/lines/{lid:02d}.wav","w") as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes((np.clip(seg,-1,1)*32767).astype(np.int16).tobytes())
        fr = SR//30; env = np.array([np.sqrt(np.mean(seg[i:i+fr]**2)) for i in range(0, len(seg), fr)])
        env = env/(np.percentile(env,95)+1e-6); env = np.clip((env-.12)/.88, 0, 1)
        info[lid] = {"dur": round(len(seg)/SR,3), "amp": [round(float(x),2) for x in env]}
        print(f"  {lid:02d} {len(seg)/SR:5.2f}с | {' '.join(w[2] for w in ws[p:q])}")
json.dump(info, open("Бастапқы/qanysh/lines/lines.json","w"))
