// Төлем боты: Kaspi төлем → чек → админ растайды → жабық каналға бір реттік сілтеме
// Баптаулар (wrangler.toml / Cloudflare):
//   BOT_TOKEN  — секрет, BotFather берген токен
//   ADMIN_ID   — сіздің Telegram ID (чектер сізге келеді)
//   CHANNEL_ID — жабық каналдың ID (-100...)
//   KASPI_URL  — Kaspi Pay төлем сілтемесі (Kaspi Pay жоқ болса — KASPI_PHONE + KASPI_NAME: нөмірге аударым)
//   PRICE      — баға мәтіні, мысалы "4 990 ₸"

// Бір курс: аты, сипаттамасы, бағасы, Kaspi сілтемесі, канал — wrangler.toml [vars]-тан
function courses(env) {
  if (!(env.KASPI_URL || env.KASPI_PHONE) || !env.CHANNEL_ID) return {};
  return { main: { name: env.COURSE_NAME || "Курс", desc: env.COURSE_DESC || "", price: env.PRICE || "", kaspi: env.KASPI_URL || "",
    phone: env.KASPI_PHONE || "", holder: env.KASPI_NAME || "", ch: [env.CHANNEL_ID] } };
}

const T = {
  start: (c) =>
    `👋 Сәлеметсіз бе!\n\n<b>${c.name}</b>\n${c.desc}\n\n` +
    `Курс бағасы — <b>${c.price}</b>\n\n` +
    (c.kaspi ? `1️⃣ Төмендегі батырма арқылы Kaspi-де төлеңіз.\n`
      : `1️⃣ Kaspi-ге аударым жасаңыз:\n📱 <code>${c.phone}</code>${c.holder ? ` (${c.holder})` : ""}\nНөмірді басып тұрсаңыз, көшіріледі.\n`) +
    `2️⃣ Төлем чегін (скриншот немесе PDF) осы чатқа жіберіңіз.\n` +
    `3️⃣ Чек тексерілгеннен кейін курс каналына кіру сілтемесі осында келеді ✅`,
  menu: "👋 Сәлеметсіз бе! Қай курсқа қосыласыз?",
  gotReceipt: "🧾 Чегіңіз қабылданды! Тексеріп жатырмыз, көп ұзамай курс сілтемесі осында келеді.",
  askReceipt: "Төлем жасаған соң, чектің <b>скриншотын немесе PDF файлын</b> осы чатқа жіберіңіз 🙏",
  approved: (links) =>
    `🎉 Төлем расталды! Курсқа қош келдіңіз.\n\n` + links.map((l) => `👉 ${l}`).join("\n") +
    `\n\nСілтеме тек сізге арналған және бір рет қана жұмыс істейді.`,
  rejected: "😔 Төлем табылмады. Чекті қайта жіберіп көріңіз немесе осы чатқа сұрағыңызды жазыңыз.",
};

async function showCourse(env, chat, key) {
  const C = courses(env), c = C[key];
  if (!c) return;
  if (env.SITE) await env.SITE.put("_choice_" + chat, key);
  const kb = c.kaspi ? { reply_markup: { inline_keyboard: [[{ text: `Kaspi арқылы төлеу — ${c.price}`, url: c.kaspi }]] } } : {};
  return send(env, chat, T.start(c), kb);
}

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const send = (env, chat_id, text, extra = {}) =>
  tg(env, "sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

const esc = (s) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

async function onUpdate(env, u) {
  // каналда "/id" жазса — канал ID-ін көрсетеді (баптау үшін)
  if (u.channel_post) {
    if ((u.channel_post.text || "").trim() === "/id")
      await send(env, u.channel_post.chat.id, `Канал ID: <code>${u.channel_post.chat.id}</code>`);
    return;
  }

  if (u.callback_query) {
    const q = u.callback_query;
    const [act, uid, key0] = (q.data || "").split(":");
    if (act === "c") {   // клиент курсты таңдады
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
      return showCourse(env, q.from.id, uid);
    }
    if (String(q.from.id) !== String(env.ADMIN_ID)) {
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id, text: "Рұқсат жоқ" });
      return;
    }
    let note;
    if (act === "ok") {
      const c = courses(env).main;
      const links = [];
      for (const ch of c.ch) {
        const inv = await tg(env, "createChatInviteLink", { chat_id: ch, member_limit: 1, name: `user ${uid}` });
        if (!inv.ok) {
          await tg(env, "answerCallbackQuery", { callback_query_id: q.id, show_alert: true,
            text: "Сілтеме жасалмады: бот каналда админ емес немесе канал ID қате. " + (inv.description || "") });
          return;
        }
        links.push(inv.result.invite_link);
      }
      await send(env, uid, T.approved(links));
      note = "✅ РАСТАЛДЫ — сілтеме жіберілді";
    } else {
      await send(env, uid, T.rejected);
      note = "❌ БАС ТАРТЫЛДЫ";
    }
    await tg(env, "answerCallbackQuery", { callback_query_id: q.id, text: note });
    await tg(env, "editMessageReplyMarkup", {
      chat_id: q.message.chat.id, message_id: q.message.message_id,
      reply_markup: { inline_keyboard: [[{ text: note, callback_data: "done" }]] },
    });
    return;
  }

  const m = u.message;
  if (!m || m.chat.type !== "private") return;
  const text = (m.text || "").trim();

  if (text === "/id") return send(env, m.chat.id, `Сіздің ID: <code>${m.chat.id}</code>`);

  if (text.startsWith("/start")) {
    const C = courses(env), arg = text.split(/\s+/)[1] || "";
    const key = "main";
    if (C[key]) return showCourse(env, m.chat.id, key);
    if (!Object.keys(C).length) return send(env, m.chat.id, "Бот бапталып жатыр. Сіздің ID: <code>" + m.chat.id + "</code>");
    const keys = Object.keys(C);
    if (keys.length === 1) return showCourse(env, m.chat.id, keys[0]);
    return send(env, m.chat.id, T.menu, { reply_markup: { inline_keyboard: keys.map((k) => [{ text: `${C[k].name} — ${C[k].price}`, callback_data: `c:${k}` }]) } });
  }

  // чек келді (сурет немесе файл)
  if (m.photo || m.document) {
    const who = `${esc(m.from.first_name)} ${esc(m.from.last_name || "")}`.trim() +
      (m.from.username ? ` (@${esc(m.from.username)})` : "") + `\nID: <code>${m.from.id}</code>`;
    const C = courses(env);
    let key = "main";
    const c = C[key];
    await send(env, env.ADMIN_ID, `🧾 <b>Жаңа чек</b>\n${who}\n\nКурс: <b>${c.name}</b>\nKaspi-ге <b>${c.price}</b> түскенін тексеріп, батырманы басыңыз:`);
    await tg(env, "copyMessage", {
      chat_id: env.ADMIN_ID, from_chat_id: m.chat.id, message_id: m.message_id,
      reply_markup: { inline_keyboard: [[
        { text: "✅ Растау", callback_data: `ok:${m.from.id}:${key}` },
        { text: "❌ Бас тарту", callback_data: `no:${m.from.id}` },
      ]] },
    });
    return send(env, m.chat.id, T.gotReceipt);
  }

  // басқа мәтін — админге жіберу (сұрақтар), клиентке нұсқау
  if (String(m.chat.id) !== String(env.ADMIN_ID)) {
    await send(env, env.ADMIN_ID, `💬 ${esc(m.from.first_name)} (ID <code>${m.from.id}</code>):\n${esc(text)}`);
    return send(env, m.chat.id, T.askReceipt);
  }
}

export default {
  async fetch(req, env0) {
    const url = new URL(req.url);
    const env = { ...env0, BOT_TOKEN: env0.BOT_TOKEN || (await env0.SITE.get("_bot_token")) || "" };

    if (url.pathname === "/tg" && req.method === "POST") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== await secret(env)) return new Response("no", { status: 403 });
      try { await onUpdate(env, await req.json()); } catch (e) { console.log(e.stack || e); }
      return new Response("ok");
    }

    if (url.pathname === "/setup") {
      if (req.method === "POST") {
        if (env.BOT_TOKEN) return html("✅ Токен бұрын қойылған.");
        const f = await req.formData();
        const tok = String(f.get("token") || "").trim();
        const chk = await (await fetch(`https://api.telegram.org/bot${tok}/getMe`)).json().catch(() => ({}));
        if (!/^\d+:[\w-]+$/.test(tok) || !chk.ok) return html("❌ Токен қате. BotFather берген токенді толық көшіріп қойыңыз.<br><br><a href=/setup>Қайта көру</a>");
        await env.SITE.put("_bot_token", tok);
        env.BOT_TOKEN = tok;
      } else if (!env.BOT_TOKEN) {
        return html(`<b>Telegram бот токенін қойыңыз</b><br><br>
          <form method=post><input name=token placeholder="123456789:AA..." autocomplete=off
          style="width:100%;font-size:18px;padding:12px;border:2px solid #ff5a1f;border-radius:12px"><br><br>
          <button style="width:100%;font-size:20px;padding:14px;background:#ff5a1f;color:#fff;border:0;border-radius:12px">Сақтау</button></form>`);
      }
      const r = await tg(env, "setWebhook", {
        url: `${url.origin}/tg`, secret_token: await secret(env),
        allowed_updates: ["message", "callback_query", "channel_post"],
      });
      const me = await tg(env, "getMe", {});
      return html(r.ok ? `✅ Бот қосылды: @${me.result?.username}<br><br>Енді Telegram-да ботқа <b>/id</b> деп жазыңыз.` : `❌ Қате: ${esc(r.description)}`);
    }

    return html("🤖 Төлем боты жұмыс істеп тұр.");
  },
};

async function secret(env) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kurs:" + env.BOT_TOKEN));
  return [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const html = (msg) => new Response(
  `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><body style="font:20px system-ui;padding:24px">${msg}</body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } });

