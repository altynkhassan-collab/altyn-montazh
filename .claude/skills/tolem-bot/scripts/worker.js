// Төлем боты: Kaspi төлем → чек → админ растайды → жабық каналға бір реттік сілтеме
// Баптаулар (wrangler.toml / Cloudflare):
//   BOT_TOKEN  — секрет, BotFather берген токен
//   ADMIN_ID   — сіздің Telegram ID (чектер сізге келеді)
//   CHANNEL_ID — жабық каналдың ID (-100...)
//   KASPI_URL  — Kaspi Pay төлем сілтемесі (Kaspi Pay жоқ болса — KASPI_PHONE + KASPI_NAME: нөмірге аударым)
//   PRICE      — баға мәтіні, мысалы "4 990 ₸"

// Курс және тарифтер — wrangler.toml [vars]-тан.
// TARIFFS (міндетті емес) — JSON: [{"key":"t1","name":"...","price":"14 990 ₸","months":3,"desc":"...","feedback":true,"homework":true}]
//   months: 0 = шексіз; feedback: FEEDBACK_CHAT_ID чатына да сілтеме; homework: оқушы тапсырма жібере алады.
function courses(env) {
  if (!(env.KASPI_URL || env.KASPI_PHONE) || !env.CHANNEL_ID) return {};
  const base = { name: env.COURSE_NAME || "Курс", desc: env.COURSE_DESC || "", kaspi: env.KASPI_URL || "",
    phone: env.KASPI_PHONE || "", holder: env.KASPI_NAME || "" };
  let tar = [];
  try { tar = JSON.parse(env.TARIFFS || "[]"); } catch (e) { tar = []; }
  if (!tar.length) return { main: { ...base, price: env.PRICE || "", months: 0, ch: [env.CHANNEL_ID] } };
  const out = {};
  for (const t of tar) out[t.key] = { ...base, tname: t.name, tdesc: t.desc || "", price: t.price, months: +t.months || 0,
    homework: !!t.homework, ch: [env.CHANNEL_ID, ...(t.feedback && env.FEEDBACK_CHAT_ID ? [env.FEEDBACK_CHAT_ID] : [])] };
  return out;
}

const DAY = 864e5;
const fmt = (ms) => { const d = new Date(ms + 5 * 3600e3); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const access = (c) => (c.months ? `${c.months} ай` : "шексіз");

const T = {
  start: (c) =>
    `👋 Сәлеметсіз бе!\n\n<b>${c.name}</b>\n${c.desc}\n\n` +
    (c.tname ? `Тариф: <b>${c.tname}</b>\n${c.tdesc ? c.tdesc + "\n" : ""}Қолжетімділік: <b>${access(c)}</b>\n` : "") +
    `Бағасы — <b>${c.price}</b>\n\n` +
    (c.kaspi ? `1️⃣ Төмендегі батырма арқылы Kaspi-де төлеңіз.\n`
      : `1️⃣ Kaspi-ге аударым жасаңыз:\n📱 <code>${c.phone}</code>${c.holder ? ` (${c.holder})` : ""}\nНөмірді басып тұрсаңыз, көшіріледі.\n`) +
    `2️⃣ Төлем чегін (скриншот немесе PDF) осы чатқа жіберіңіз.\n` +
    `3️⃣ Чек тексерілгеннен кейін курсқа кіру сілтемесі осында келеді ✅`,
  menu: (C) => {
    const a = Object.values(C)[0];
    return `👋 Сәлеметсіз бе!\n\n<b>${a.name}</b>\n${a.desc}\n\n` +
      Object.values(C).map((c) => `▫️ <b>${c.tname} — ${c.price}</b>\n${c.tdesc ? c.tdesc + "\n" : ""}Қолжетімділік: ${access(c)}`).join("\n\n") +
      `\n\nТарифті таңдаңыз 👇`;
  },
  gotReceipt: "🧾 Чегіңіз қабылданды! Тексеріп жатырмыз, көп ұзамай курс сілтемесі осында келеді.",
  askReceipt: "Төлем жасаған соң, чектің <b>скриншотын немесе PDF файлын</b> осы чатқа жіберіңіз 🙏",
  approved: (links, c, exp) =>
    `🎉 Төлем расталды! Курсқа қош келдіңіз.\n\n` +
    links.map((l, i) => `👉 ${i === 0 ? "Сабақтар" : "Кері байланыс чаты"}: ${l}`).join("\n") +
    `\n\nСілтеме тек сізге арналған және бір рет қана жұмыс істейді.` +
    (c.tname ? `\nҚолжетімділік: <b>${exp ? fmt(exp) + " дейін" : "шексіз"}</b>` : "") +
    (c.homework ? `\n\n📚 Үй тапсырмасын (видео, сурет, мәтін) осы чатқа жіберіңіз — тексеріп, жауабын осында жазамыз.` : ""),
  rejected: "😔 Төлем табылмады. Чекті қайта жіберіп көріңіз немесе осы чатқа сұрағыңызды жазыңыз.",
  warn: (exp) => `⏳ Курсқа қолжетімділігіңіз <b>${fmt(exp)}</b> күні бітеді.\nҰзарту немесе тарифті ауыстыру үшін /start басыңыз.`,
  expired: "⌛ Курсқа қолжетімділік мерзімі бітті. Рахмет, бізбен бірге болғаныңызға! Қайта қосылу үшін /start басыңыз.",
};

const kvj = async (env, k) => { try { return JSON.parse((await env.SITE.get(k)) || "null"); } catch (e) { return null; } };
async function getChoice(env, uid) {
  const v = await env.SITE.get("_choice_" + uid);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return { k: v, t: 0 }; }
}
async function getMem(env, uid) {
  const r = await kvj(env, "m_" + uid);
  return r && (!r.exp || r.exp > Date.now()) ? r : null;
}
const remember = (env, msg, uid) =>
  msg && msg.ok && env.SITE.put("r_" + msg.result.message_id, String(uid), { expirationTtl: 90 * 86400 });

async function showCourse(env, chat, key) {
  const C = courses(env), c = C[key];
  if (!c) return;
  if (env.SITE) await env.SITE.put("_choice_" + chat, JSON.stringify({ k: key, t: Date.now() }));
  const kb = c.kaspi ? { reply_markup: { inline_keyboard: [[{ text: `Kaspi арқылы төлеу — ${c.price}`, url: c.kaspi }]] } } : {};
  return send(env, chat, T.start(c), kb);
}

async function showMenu(env, chat) {
  const C = courses(env), keys = Object.keys(C);
  if (keys.length === 1) return showCourse(env, chat, keys[0]);
  return send(env, chat, T.menu(C), { reply_markup: { inline_keyboard: keys.map((k) => [{ text: `${C[k].tname} — ${C[k].price}`, callback_data: `c:${k}` }]) } });
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
    if (act === "c") {   // клиент тарифті таңдады
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
      return showCourse(env, q.from.id, uid);
    }
    if (act === "done") return tg(env, "answerCallbackQuery", { callback_query_id: q.id });
    if (String(q.from.id) !== String(env.ADMIN_ID)) {
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id, text: "Рұқсат жоқ" });
      return;
    }
    let note;
    if (act === "ok") {
      const C = courses(env), c = C[key0] || C[Object.keys(C)[0]], key = C[key0] ? key0 : Object.keys(C)[0];
      const old = await getMem(env, uid);
      const links = [];
      for (const ch of c.ch) {
        await tg(env, "unbanChatMember", { chat_id: ch, user_id: +uid, only_if_banned: true });
        const inv = await tg(env, "createChatInviteLink", { chat_id: ch, member_limit: 1, name: `user ${uid}` });
        if (!inv.ok) {
          await tg(env, "answerCallbackQuery", { callback_query_id: q.id, show_alert: true,
            text: "Сілтеме жасалмады: бот каналда/чатта админ емес немесе ID қате. " + (inv.description || "") });
          return;
        }
        links.push(inv.result.invite_link);
      }
      // мерзім: ескі мерзім біте қоймаса — соның үстіне қосылады
      let exp = 0;
      if (c.months && !(old && !old.exp)) {
        const d = new Date(old && old.exp > Date.now() ? old.exp : Date.now());
        d.setMonth(d.getMonth() + c.months);
        exp = d.getTime();
      }
      const rec = { k: key, exp, hw: !!(c.homework || (old && old.hw)), ch: [...new Set([...(old ? old.ch : []), ...c.ch])], warned: false };
      await env.SITE.put("m_" + uid, JSON.stringify(rec));
      await env.SITE.delete("_choice_" + uid);
      await send(env, uid, T.approved(links, { ...c, homework: rec.hw }, exp));
      note = "✅ РАСТАЛДЫ" + (c.tname ? ` · ${exp ? fmt(exp) + " дейін" : "шексіз"}` : " — сілтеме жіберілді");
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
  if (!m) return;
  const text = (m.text || "").trim();

  // топта/чатта "/id" — чат ID (кері байланыс чатын баптау үшін)
  if (m.chat.type === "group" || m.chat.type === "supergroup") {
    if (/^\/id(@\w+)?$/.test(text)) await send(env, m.chat.id, `Чат ID: <code>${m.chat.id}</code>`);
    return;
  }
  if (m.chat.type !== "private") return;

  if (text === "/id") return send(env, m.chat.id, `Сіздің ID: <code>${m.chat.id}</code>`);

  const isAdmin = String(m.chat.id) === String(env.ADMIN_ID);

  // иесі оқушының хабарламасына «Ответить» арқылы жауап берді
  if (isAdmin && m.reply_to_message) {
    const to = await env.SITE.get("r_" + m.reply_to_message.message_id);
    if (to) {
      const r = await tg(env, "copyMessage", { chat_id: to, from_chat_id: m.chat.id, message_id: m.message_id });
      return send(env, m.chat.id, r.ok ? "✅ Жауап жіберілді" : "❌ Жіберілмеді: " + esc(r.description));
    }
  }

  if (text.startsWith("/start")) {
    const C = courses(env), arg = text.split(/\s+/)[1] || "";
    if (!Object.keys(C).length) return send(env, m.chat.id, "Бот бапталып жатыр. Сіздің ID: <code>" + m.chat.id + "</code>");
    if (C[arg]) return showCourse(env, m.chat.id, arg);
    return showMenu(env, m.chat.id);
  }

  const C = courses(env);
  if (!Object.keys(C).length) return;
  const media = m.photo || m.document || m.video;
  const mem = isAdmin ? null : await getMem(env, m.from.id);
  const choice = await getChoice(env, m.from.id);
  const fresh = choice && C[choice.k] && Date.now() - (choice.t || 0) < 3 * DAY;
  const who = `${esc(m.from.first_name)} ${esc(m.from.last_name || "")}`.trim() +
    (m.from.username ? ` (@${esc(m.from.username)})` : "") + `\nID: <code>${m.from.id}</code>`;

  // чек келді (сурет немесе файл)
  if (media && (fresh || !mem)) {
    const keys = Object.keys(C);
    const key = fresh ? choice.k : (keys.length === 1 ? keys[0] : (choice && C[choice.k] ? choice.k : null));
    if (!key) {
      await send(env, m.chat.id, "Алдымен тарифті таңдаңыз, сосын чекті қайта жіберіңіз 👇");
      return showMenu(env, m.chat.id);
    }
    const c = C[key];
    await send(env, env.ADMIN_ID, `🧾 <b>Жаңа чек</b>\n${who}\n\nКурс: <b>${c.name}</b>` +
      (c.tname ? `\nТариф: <b>${c.tname}</b> (${access(c)})` : "") +
      `\nKaspi-ге <b>${c.price}</b> түскенін тексеріп, батырманы басыңыз:`);
    await tg(env, "copyMessage", {
      chat_id: env.ADMIN_ID, from_chat_id: m.chat.id, message_id: m.message_id,
      reply_markup: { inline_keyboard: [[
        { text: "✅ Растау", callback_data: `ok:${m.from.id}:${key}` },
        { text: "❌ Бас тарту", callback_data: `no:${m.from.id}` },
      ]] },
    });
    return send(env, m.chat.id, T.gotReceipt);
  }

  if (isAdmin) return;

  // оқушы: үй тапсырмасы / сұрақ — иесіне, жауабы «Ответить» арқылы қайтады
  if (mem) {
    const c = C[mem.k] || {};
    const head = await send(env, env.ADMIN_ID, (mem.hw ? "📚 <b>Үй тапсырмасы / сұрақ</b>" : "💬 <b>Оқушыдан хабарлама</b>") +
      `\n${who}${c.tname ? `\nТариф: ${c.tname}` : ""}\n\nЖауап беру үшін төмендегі хабарламаға «Ответить» басыңыз 👇`);
    await remember(env, head, m.from.id);
    const cp = await tg(env, "copyMessage", { chat_id: env.ADMIN_ID, from_chat_id: m.chat.id, message_id: m.message_id });
    await remember(env, cp, m.from.id);
    return send(env, m.chat.id, mem.hw ? "📚 Жіберілді! Тексеріп, жауабын осында жазамыз." : "✉️ Хабарламаңыз жіберілді, жауабы осында келеді.");
  }

  // басқа мәтін — админге жіберу (сұрақтар), клиентке нұсқау
  const q = await send(env, env.ADMIN_ID, `💬 ${esc(m.from.first_name)} (ID <code>${m.from.id}</code>):\n${esc(text)}\n\nЖауап беру үшін «Ответить» басыңыз.`);
  await remember(env, q, m.from.id);
  return send(env, m.chat.id, T.askReceipt);
}

// Күн сайын: мерзімі біткендерді шығару, 3 күн қалғанда ескерту
async function sweep(env) {
  const now = Date.now();
  let cursor;
  do {
    const l = await env.SITE.list({ prefix: "m_", cursor });
    for (const k of l.keys) {
      const rec = await kvj(env, k.name);
      if (!rec || !rec.exp) continue;
      const uid = k.name.slice(2);
      if (now >= rec.exp) {
        for (const ch of rec.ch || []) {
          await tg(env, "banChatMember", { chat_id: ch, user_id: +uid });
          await tg(env, "unbanChatMember", { chat_id: ch, user_id: +uid, only_if_banned: true });
        }
        await send(env, uid, T.expired);
        await send(env, env.ADMIN_ID, `⌛ Мерзімі бітті, каналдан шығарылды: ID <code>${uid}</code>`);
        await env.SITE.delete(k.name);
      } else if (!rec.warned && rec.exp - now < 3 * DAY) {
        await send(env, uid, T.warn(rec.exp));
        await env.SITE.put(k.name, JSON.stringify({ ...rec, warned: true }));
      }
    }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
}

export default {
  async scheduled(ev, env0, ctx) {
    const env = { ...env0, BOT_TOKEN: env0.BOT_TOKEN || (await env0.SITE.get("_bot_token")) || "" };
    if (env.BOT_TOKEN) ctx.waitUntil(sweep(env));
  },

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

