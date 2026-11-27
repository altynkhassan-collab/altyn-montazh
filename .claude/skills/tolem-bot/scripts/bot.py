#!/usr/bin/env python3
"""Төлем боты: Telegram бот + Kaspi + жабық канал, Cloudflare-ге тегін жариялау.

  python3 .claude/skills/tolem-bot/scripts/bot.py new     <аты>      # Боттар/<аты>/config.json
  python3 .claude/skills/tolem-bot/scripts/bot.py publish <аты>      # жариялау / жаңарту -> setup сілтемесі
  python3 .claude/skills/tolem-bot/scripts/bot.py status  <аты>      # бот қосылды ма, баптаулар толық па
"""
import sys, os, json, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "sait-jasau", "scripts"))
import sait as S   # Cloudflare көмекшілері (account, subdomain, api, wr, slug)

FIELDS = ["COURSE_NAME", "COURSE_DESC", "PRICE", "KASPI_URL", "KASPI_PHONE", "KASPI_NAME", "ADMIN_ID", "CHANNEL_ID"]
OPTIONAL = {"KASPI_URL", "KASPI_PHONE", "KASPI_NAME"}

def cfg_path(name): return os.path.join("Боттар", name, "config.json")

def new(name):
    os.makedirs(os.path.dirname(cfg_path(name)), exist_ok=True)
    p = cfg_path(name)
    if not os.path.exists(p):
        json.dump({k: "" for k in FIELDS}, open(p, "w"), ensure_ascii=False, indent=1)
    print("дайын:", p, "— өрістерді толтыр, бос қалғанын кейін қосуға болады")

def publish(name):
    c = json.load(open(cfg_path(name)))
    acc = S.account(); sub = S.subdomain(acc, S.slug(name)[:20] + "-site")
    wname = S.slug(name) + "-bot"
    work = os.path.join(".bot", wname); os.makedirs(work, exist_ok=True)
    meta = os.path.join(work, "meta.json"); m = json.load(open(meta)) if os.path.exists(meta) else {}
    if not m.get("ns"):
        lst = S.api("GET", f"/accounts/{acc}/storage/kv/namespaces?per_page=100")
        ns = next((n["id"] for n in lst.get("result", []) if n["title"] == f"bot-{wname}"), None)
        if not ns:
            r = S.api("POST", f"/accounts/{acc}/storage/kv/namespaces", {"title": f"bot-{wname}"})
            if not r.get("success"): print("❌", r.get("errors")); sys.exit(2)
            ns = r["result"]["id"]
        m["ns"] = ns; json.dump(m, open(meta, "w"))
    subprocess.run(["cp", os.path.join(HERE, "worker.js"), os.path.join(work, "worker.js")], check=True)
    vars_ = "".join(f'{k} = {json.dumps(str(c.get(k, "")), ensure_ascii=False)}\n' for k in FIELDS if c.get(k))
    open(os.path.join(work, "wrangler.toml"), "w").write(
        f'name = "{wname}"\nmain = "worker.js"\ncompatibility_date = "2025-09-01"\nworkers_dev = true\npreview_urls = false\n\n'
        f'[[kv_namespaces]]\nbinding = "SITE"\nid = "{m["ns"]}"\n\n[vars]\n{vars_}')
    r = S.wr(["deploy"], work, acc)
    if r.returncode: print("❌ жариялау қатесі:", (r.stdout + r.stderr)[-600:]); sys.exit(2)
    url = f"https://{wname}.{sub}.workers.dev"
    for i in range(30):
        code = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", url + "/"], capture_output=True, text=True).stdout
        if code == "200": break
        time.sleep(10)
    json.dump({**m, "url": url}, open(meta, "w"))
    miss = [k for k in FIELDS if not c.get(k) and k not in OPTIONAL]
    if not (c.get("KASPI_URL") or c.get("KASPI_PHONE")): miss.append("KASPI_URL немесе KASPI_PHONE")
    print("✅ бот жарияланды:", url)
    print("🔑 токен қою беті (бір рет):", url + "/setup")
    if miss: print("⏳ әлі толтырылмаған:", ", ".join(miss))

def status(name):
    meta = os.path.join(".bot", S.slug(name) + "-bot", "meta.json")
    if not os.path.exists(meta): print("жарияланбаған"); return
    url = json.load(open(meta)).get("url")
    r = subprocess.run(["curl", "-s", url + "/setup"], capture_output=True, text=True).stdout
    print("сілтеме:", url)
    print("токен:", "✅ қосылған" if "Бот қосылды" in r or "бұрын қойылған" in r else "❌ әлі қойылмаған — " + url + "/setup")
    c = json.load(open(cfg_path(name)))
    miss = [k for k in FIELDS if not c.get(k) and k not in OPTIONAL]
    if not (c.get("KASPI_URL") or c.get("KASPI_PHONE")): miss.append("KASPI_URL немесе KASPI_PHONE")
    print("баптаулар:", "✅ толық" if not miss else "⏳ жоқ: " + ", ".join(miss))

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""; arg = sys.argv[2] if len(sys.argv) > 2 else ""
    {"new": lambda: new(arg), "publish": lambda: publish(arg), "status": lambda: status(arg)}.get(cmd, lambda: print(__doc__))()
