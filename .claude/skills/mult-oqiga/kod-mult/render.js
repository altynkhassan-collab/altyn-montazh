// node render.js scene1.html out.mp4 [fps]      — видео (дыбыссыз)
// node render.js scene1.html stills:1,4.5,10    — тексеру суреттері (out_<t>.jpg)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
(async () => {
  const [, , page, out, fpsArg] = process.argv;
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  await p.goto(`http://127.0.0.1:${port}/${page}`);
  await p.waitForFunction('window.READY === true', null, { timeout: 30000 });
  await p.evaluate(() => document.fonts.ready);
  const stage = await p.$('#stage');
  if (out.startsWith('stills:')) {
    for (const t of out.slice(7).split(',').map(Number)) {
      await p.evaluate(t => window.renderFrame(t), t);
      await stage.screenshot({ path: path.join(ROOT, `still_${t}.jpg`), type: 'jpeg', quality: 88 });
    }
  } else {
    const fps = +(fpsArg || 30); const total = await p.evaluate(() => window.TOTAL);
    const n = Math.round(total * fps);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await p.evaluate(t => window.renderFrame(t), i / fps);
      const buf = await stage.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(`кадр ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}с`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close(); srv.close();
})();
