#!/usr/bin/env python3
"""Сайт жасау: эскиз (телефон көрінісі) және Cloudflare-ге тегін жариялау.

  python3 .claude/skills/sait-jasau/scripts/sait.py new     <аты>                # Сайттар/<аты>/index.html (шаблоннан)
  python3 .claude/skills/sait-jasau/scripts/sait.py sketch  Сайттар/<аты>        # -> Раскадровка/<аты>_сайт-эскиз.jpg
  python3 .claude/skills/sait-jasau/scripts/sait.py check                         # Cloudflare кілті жұмыс істей ме
  python3 .claude/skills/sait-jasau/scripts/sait.py publish Сайттар/<аты>        # -> https://<аты>.<subdomain>.workers.dev
  python3 .claude/skills/sait-jasau/scripts/sait.py unpublish <аты>
"""
import sys, os, json, re, shutil, subprocess, time, urllib.request, mimetypes, threading, http.server, socketserver, functools

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, "..", "templates", "base.html")
API = "https://api.cloudflare.com/client/v4"
WRANGLER = ["npx", "-y", "wrangler@4.166.0"]
TOKEN = "proxy-injected"   # нақты кілтті бұлттың проксиі өзі қояды

def slug(s):
    s = re.sub(r"[^a-z0-9-]+", "-", s.lower()).strip("-")
    return s[:50] or "sait"

# ---------------------------------------------------------------- new
def new(name):
    d = os.path.join("Сайттар", name); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, "index.html")
    if not os.path.exists(p): shutil.copy(TPL, p)
    print("дайын:", p)

# ---------------------------------------------------------------- sketch
def serve(folder):
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=folder)
    srv = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

def sketch(folder):
    folder = folder.rstrip("/"); name = os.path.basename(folder)
    srv, port = serve(folder)
    os.makedirs("Раскадровка", exist_ok=True)
    png = os.path.join("Раскадровка", f".{name}_full.png"); out = os.path.join("Раскадровка", f"{name}_сайт-эскиз.jpg")
    js = f"""
const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();
const p=await b.newPage({{viewport:{{width:390,height:844}},deviceScaleFactor:2}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('requestfailed',r=>errs.push('жүктелмеді: '+r.url()));p.on('response',r=>{{if(r.status()>=400)errs.push('файл жоқ: '+decodeURIComponent(r.url().split('/').pop()))}});
await p.goto('http://127.0.0.1:{port}/');await p.waitForTimeout(800);
await p.evaluate(async()=>{{for(let y=0;y<document.body.scrollHeight;y+=300){{window.scrollTo(0,y);await new Promise(r=>setTimeout(r,100))}}window.scrollTo(0,0)}});
await p.waitForTimeout(1600);
const wide=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
await p.evaluate(()=>{{document.querySelectorAll('nav,.bar').forEach(e=>e.style.position='static');document.querySelectorAll('details').forEach(d=>d.open=true)}});
await p.screenshot({{path:'{png}',fullPage:true}});
console.log(JSON.stringify({{errs,wide}}));await b.close();}})();"""
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True); srv.shutdown()
    if r.returncode: print(r.stderr[-800:]); sys.exit(1)
    info = json.loads(r.stdout.strip().splitlines()[-1])
    from PIL import Image
    im = Image.open(png); cols = max(1, min(4, round(im.height / 2400) or 1)); h = im.height // cols + 1
    S = Image.new("RGB", (780 * cols + 20 * (cols - 1), h), (40, 40, 40))
    for k in range(cols): S.paste(im.crop((0, k * h, 780, min(im.height, (k + 1) * h))), (k * 800, 0))
    S = S.resize((S.width // 2, S.height // 2)); S.save(out, quality=85); os.remove(png)
    for e in info["errs"]: print("⚠️", e)
    if info["wide"]: print("⚠️ бет телефон экранынан кең — көлденең жылжиды, түзет")
    print("дайын:", out)

# ---------------------------------------------------------------- Cloudflare
def api(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read())
        except Exception: return {"success": False, "errors": [{"message": str(e)}]}

def account():
    r = api("GET", "/accounts")
    if not r.get("success") or not r.get("result"):
        print("❌ Cloudflare кілті жоқ немесе аккаунтқа рұқсаты жоқ.", r.get("errors")); sys.exit(2)
    return r["result"][0]["id"]

def subdomain(acc, want):
    r = api("GET", f"/accounts/{acc}/workers/subdomain")
    if r.get("success") and r["result"] and r["result"].get("subdomain"): return r["result"]["subdomain"]
    for i in range(20):
        s = want if i == 0 else f"{want}{i}"
        r = api("PUT", f"/accounts/{acc}/workers/subdomain", {"subdomain": s})
        if r.get("success"): return s
    print("❌ workers.dev адресін жасау мүмкін болмады:", r.get("errors")); sys.exit(2)

def check():
    acc = account(); print("✅ Cloudflare кілті жұмыс істейді, аккаунт:", acc)

WORKER_JS = r'''
const TYPES = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", json: "application/json",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml", gif: "image/gif",
  mp4: "video/mp4", mp3: "audio/mpeg", ico: "image/x-icon", woff2: "font/woff2", pdf: "application/pdf" };
export default { async fetch(req, env) {
  const url = new URL(req.url);
  let key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (key && !key.includes(".") && !key.endsWith("/")) return Response.redirect(url.origin + "/" + key + "/", 301);
  if (key === "" || key.endsWith("/")) key += "index.html";
  const buf = await env.SITE.get(key, "arrayBuffer");
  if (!buf) return new Response("Табылмады", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const ext = key.split(".").pop().toLowerCase();
  const h = { "content-type": TYPES[ext] || "application/octet-stream", "accept-ranges": "bytes",
              "cache-control": ext === "html" ? "public, max-age=60" : "public, max-age=86400" };
  const size = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  if (m) { let s = m[1] === "" ? size - Number(m[2]) : Number(m[1]); let e = m[1] !== "" && m[2] !== "" ? Number(m[2]) : size - 1;
    e = Math.min(e, size - 1); if (s > e) return new Response(null, { status: 416 });
    return new Response(buf.slice(s, e + 1), { status: 206, headers: { ...h, "content-range": `bytes ${s}-${e}/${size}`, "content-length": String(e - s + 1) } }); }
  return new Response(buf, { headers: { ...h, "content-length": String(size) } });
} };
'''

def wr(args, cwd, acc):
    env = dict(os.environ, CLOUDFLARE_API_TOKEN=TOKEN, CLOUDFLARE_ACCOUNT_ID=acc, WRANGLER_SEND_METRICS="false")
    return subprocess.run(WRANGLER + args, cwd=cwd, env=env, capture_output=True, text=True)

def publish(folder):
    folder = os.path.abspath(folder.rstrip("/")); name = slug(os.path.basename(folder))
    if not os.path.exists(os.path.join(folder, "index.html")): print("❌ index.html жоқ"); sys.exit(1)
    big = [f for f in os.listdir(folder) if os.path.getsize(os.path.join(folder, f)) > 24_000_000]
    if big: print("❌ 24 МБ-тан үлкен файлдар (сығымда):", big); sys.exit(1)
    acc = account(); sub = subdomain(acc, slug(name)[:20] + "-site")
    work = os.path.join(".sait", name); os.makedirs(work, exist_ok=True)
    meta = os.path.join(work, "meta.json"); m = json.load(open(meta)) if os.path.exists(meta) else {}
    if not m.get("ns"):
        lst = api("GET", f"/accounts/{acc}/storage/kv/namespaces?per_page=100")
        ns = next((n["id"] for n in lst.get("result", []) if n["title"] == f"sait-{name}"), None)
        if not ns:
            r = api("POST", f"/accounts/{acc}/storage/kv/namespaces", {"title": f"sait-{name}"})
            if not r.get("success"): print("❌", r.get("errors")); sys.exit(2)
            ns = r["result"]["id"]
        m["ns"] = ns
    json.dump(m, open(meta, "w"))
    # файлдар
    n = 0
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("."): continue
            p = os.path.join(root, f); key = os.path.relpath(p, folder).replace(os.sep, "/")
            r = wr(["kv", "key", "put", key, "--path", p, "--namespace-id", m["ns"], "--remote"], work, acc)
            if r.returncode: print("❌ жүктелмеді:", key, r.stderr[-300:]); sys.exit(2)
            n += 1
    open(os.path.join(work, "worker.js"), "w").write(WORKER_JS)
    open(os.path.join(work, "wrangler.toml"), "w").write(
        f'name = "{name}"\nmain = "worker.js"\ncompatibility_date = "2025-09-01"\nworkers_dev = true\npreview_urls = false\n\n'
        f'[[kv_namespaces]]\nbinding = "SITE"\nid = "{m["ns"]}"\n')
    r = wr(["deploy"], work, acc)
    if r.returncode: print("❌ жариялау қатесі:", (r.stdout + r.stderr)[-600:]); sys.exit(2)
    url = f"https://{name}.{sub}.workers.dev"
    print(f"файлдар: {n}")
    ok = False
    for i in range(30):
        c = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", url + "/?t=" + str(time.time())],
                           capture_output=True, text=True).stdout
        ok = c == "200"
        if ok: break
        time.sleep(10)   # жаңа адрестің https сертификаты бірнеше минутта іске қосылады
    print(("✅ сайт ашылды: " if ok else "⏳ жарияланды, адрес бірнеше минуттан кейін ашылады: ") + url)

def unpublish(name):
    acc = account(); name = slug(name); work = os.path.join(".sait", name)
    r = wr(["delete", "--name", name, "--force"], work if os.path.isdir(work) else ".", acc)
    print("өшірілді" if r.returncode == 0 else r.stderr[-300:])

if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else ""
    a = sys.argv[2] if len(sys.argv) > 2 else ""
    {"new": lambda: new(a), "sketch": lambda: sketch(a), "check": check, "publish": lambda: publish(a),
     "unpublish": lambda: unpublish(a)}.get(c, lambda: print(__doc__))()
