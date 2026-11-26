# Кодпен салынатын мульт (Қаныш жобасы)
Жұмыс папкасы: `.mult/engine/` (коммит жасалмайды). Қалпына келтіру:
```bash
mkdir -p .mult/engine && cp .claude/skills/mult-oqiga/kod-mult/* .mult/engine/ && cp .claude/skills/kreativ-video/fonts/Montserrat.ttf .mult/engine/
cd .mult/engine && npm init -y >/dev/null && npm i three@0.170.0
node render.js scene1.html stills:1.5,6,10     # тексеру суреттері
node render.js scene1.html out.mp4 30          # видео (дыбыссыз)
```
- `chars.js` — 2D кейіпкерлер (SVG): эмоция, ауыз (mouth 0..1), көз жұму, қол, жүріс.
- `room.js` — 3D фондар (three.js, toon + контур).
- `sceneN.html` — көрініс: `window.renderFrame(t)`, `window.TOTAL`.
