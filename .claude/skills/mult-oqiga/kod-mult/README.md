# Кодпен салынатын мульт (Қаныш жобасы)
Жұмыс папкасы: `.mult/engine/` (коммит жасалмайды). Қалпына келтіру:
```bash
mkdir -p .mult/engine && cp .claude/skills/mult-oqiga/kod-mult/* .mult/engine/ && cp .claude/skills/kreativ-video/fonts/Montserrat.ttf .mult/engine/
cd .mult/engine && npm init -y >/dev/null && npm i three@0.170.0
./stills.sh 3 1,5,9                          # 3-көріністің тексеру суреттері
node render.js film.html film_silent.mp4 30   # толық фильм (дыбыссыз)
```
- `chars.js` — 2D кейіпкерлер (SVG): эмоция, ауыз (mouth 0..1), көз жұму, қол, жүріс.
- `room.js` — 3D фондар (three.js, toon + контур).
- `sceneN.html` — көрініс: `window.renderFrame(t)`, `window.TOTAL`.
- `scenes.js` — 8 көрініс (lines: [басы, соңы, кім, мәтін]); `film.html` — бәрін жинайды, `?scene=N` — бір көрініс.
