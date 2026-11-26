# python3 audio.py out.wav [scene]  — дауыс + музыка (дауыс кезінде музыка тынышталады)
import json, sys, wave, numpy as np
sys.path.insert(0, '../../.claude/skills/kreativ-video/scripts'); import kreativ as k
V = json.load(open('../../Бастапқы/qanysh/lines/timing.json'))
only = int(sys.argv[2]) if len(sys.argv) > 2 else None
sc = [V[only - 1]] if only else V
T = sum(s['dur'] for s in sc); SR = 44100
voice = np.zeros(int(T * SR) + SR)
t0 = 0
for s in sc:
    for a, b, w, txt, lid in s['lines']:
        f = wave.open(f'../../Бастапқы/qanysh/lines/fast/{lid:02d}.wav'); x = np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768
        if f.getframerate() != SR: raise SystemExit('SR')
        i = int((t0 + a) * SR); voice[i:i + len(x)] += x
    t0 += s['dur']
voice = voice / max(1e-6, np.abs(voice).max()) * .9
music = k.synth_music(T)[:len(voice)]; music = np.pad(music, (0, len(voice) - len(music)))
# дауыс конверті бойынша музыканы басу
win = int(.3 * SR); env = np.convolve(np.abs(voice), np.ones(win) / win, mode='same')
duck = 1 - .65 * np.clip(env / (np.percentile(env[env > 0], 60) + 1e-6), 0, 1)
mix = voice + music * .15 * duck
fd = int(1.5 * SR); e = int(T * SR); mix[e - fd:e] *= np.linspace(1, .0, fd) ** .5 if False else 1
mix = mix[:int(T * SR)]
mix = mix / max(1e-6, np.abs(mix).max()) * .95
k.write_wav(sys.argv[1], mix)
print('ұзақтығы', round(T, 2))
