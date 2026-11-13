// Serverul site-ului: servește paginile publice, răspunde la cererile testelor și ale panoului.
// Fără dependențe externe. Pornire: node server/server.js  (setări în server/config.js).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const store = require("./store");
const auth = require("./auth");
const people = require("./people");
const pay = require("./pay");
const sc = require("./scoring");
const { validateDoc } = require("./validate");
const { SITE, merge } = require("../public/js/content.js");
const { TESTS } = require("./tests");
const { httpError } = auth;

const SITE_FILE = path.join(cfg.DATA_DIR, "site.json");
const HISTORY_DIR = path.join(cfg.DATA_DIR, "history");
const AUDIT_FILE = path.join(cfg.DATA_DIR, "audit.log");
const DEFAULTS = { site: SITE, tests: TESTS };

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2"
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

// ---- Conținutul site-ului: valorile implicite, peste care se pune ce s-a salvat din panou.
let cache = null;
function getDoc() {
  if (cache) return cache;
  const saved = store.readJson(SITE_FILE, null);
  const d = (saved && saved.doc) || {};
  cache = { rev: saved ? saved.rev : 0, updated: saved ? saved.updated : null, by: saved ? saved.by : null, site: merge(SITE, d.site || {}), tests: merge(TESTS, d.tests || {}) };
  return cache;
}
function saveDoc(doc, by, note, expectRev) {
  const current = store.readJson(SITE_FILE, null);
  const rev = current ? current.rev : 0;
  if (expectRev !== rev) throw httpError(409, "Între timp s-a făcut o altă salvare. Reîncărcați pagina ca să vedeți versiunea nouă, apoi refaceți modificările.");
  const stamp = new Date().toISOString();
  if (current) {
    store.writeJson(path.join(HISTORY_DIR, stamp.replace(/[:.]/g, "-") + "-v" + rev + ".json"), current);
    const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".json")).sort();
    for (const f of files.slice(0, Math.max(0, files.length - cfg.HISTORY_KEEP))) store.remove(path.join(HISTORY_DIR, f));
  }
  store.writeJson(SITE_FILE, { rev: rev + 1, updated: stamp, by, note: String(note || "").slice(0, 200), doc });
  cache = null;
  return getDoc();
}
function listHistory() {
  let files = [];
  try { files = fs.readdirSync(HISTORY_DIR).filter((f) => /^[\w-]+\.json$/.test(f)).sort().reverse(); } catch (e) { /* încă nu există istoric */ }
  return files.map((f) => {
    const v = store.readJson(path.join(HISTORY_DIR, f), null) || {};
    return { id: f, rev: v.rev || 0, updated: v.updated || null, by: v.by || "", note: v.note || "" };
  });
}

// Ce are voie să știe browserul despre teste: numere, nu întrebări.
function publicSite() {
  const doc = getDoc();
  const meta = { modules: {}, couple: { free: doc.tests.couple.questions.filter((q) => q.free).length, total: doc.tests.couple.questions.length } };
  for (const [id, mod] of Object.entries(doc.tests.modules)) {
    meta.modules[id] = mod.type === "tarot" ? { type: "tarot", cards: mod.cards.length, spread: mod.positions.length }
      : { type: mod.type, free: mod.questions.filter((q) => q.free).length, total: mod.questions.length };
  }
  return { rev: doc.rev, site: doc.site, meta };
}

// ---- Unelte pentru cereri
function clientIp(req) {
  if (cfg.TRUST_PROXY) { const f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(); if (f) return f; }
  return req.socket.remoteAddress || "?";
}
function isHttps(req) {
  if (cfg.COOKIE_SECURE === "always") return true;
  if (cfg.COOKIE_SECURE === "never") return false;
  return !!req.socket.encrypted || (cfg.TRUST_PROXY && req.headers["x-forwarded-proto"] === "https");
}
const cookieName = (req) => (isHttps(req) ? "__Host-cq_admin" : "cq_admin");
// Adresa publică a site-ului, la care procesatorul îl întoarce pe client după plată.
function baseUrl(req) {
  if (cfg.PUBLIC_URL) return cfg.PUBLIC_URL;
  const host = String(req.headers.host || "");
  if (!/^[A-Za-z0-9.:[\]-]{1,255}$/.test(host)) throw httpError(400, "Adresa site-ului nu a putut fi citită.");
  return (isHttps(req) ? "https://" : "http://") + host;
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return out;
}
function sessionCookie(req, value, maxAge) {
  return cookieName(req) + "=" + value + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge + (isHttps(req) ? "; Secure" : "");
}
// Cererea trebuie să vină de pe același domeniu ca site-ul.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (origin) { try { return new URL(origin).host === req.headers.host; } catch (e) { return false; } }
  return req.headers["sec-fetch-site"] === "same-origin";
}
function baseHeaders(extra) {
  return Object.assign({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": CSP, "Permissions-Policy": "camera=(), microphone=(), geolocation=()" }, extra);
}
function sendJson(res, status, body, extra) {
  const text = JSON.stringify(body);
  res.writeHead(status, baseHeaders(Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(text) }, extra)));
  res.end(text);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) return reject(httpError(415, "Cererea trebuie trimisă ca JSON."));
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(httpError(413, "Datele trimise sunt prea mari.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      try { const v = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(); resolve(v); }
      catch (e) { reject(httpError(400, "Datele trimise nu au putut fi citite.")); }
    });
    req.on("error", reject);
  });
}

// Limită simplă de cereri pe IP, ținută în memorie.
const hits = new Map();
function limit(req, name, max, windowMs) {
  const key = name + "|" + clientIp(req);
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw httpError(429, "Prea multe încercări într-un timp scurt. Așteaptă câteva minute și încearcă din nou.");
  list.push(now);
  hits.set(key, list);
}
setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (!l.length || now - l[l.length - 1] > 3600000) hits.delete(k); }, 600000).unref();

function audit(req, event, detail) {
  try {
    fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
    try { if (fs.statSync(AUDIT_FILE).size > 5 * 1024 * 1024) fs.renameSync(AUDIT_FILE, AUDIT_FILE + ".1"); } catch (e) { /* fișierul nu există încă */ }
    fs.appendFileSync(AUDIT_FILE, JSON.stringify({ at: new Date().toISOString(), ip: clientIp(req), event, ...detail }) + "\n", { mode: 0o600 });
  } catch (e) { console.error("Nu pot scrie jurnalul:", e.message); }
}

function adminSession(req) {
  const token = parseCookies(req)[cookieName(req)];
  const s = auth.getSession(token);
  if (!s) throw httpError(401, "Sesiunea a expirat. Autentificați-vă din nou.");
  return { ...s, token };
}
// Orice modificare din panou: sesiune validă, token CSRF și cerere de pe același domeniu.
function guard(req) {
  const s = adminSession(req);
  if (!sameOrigin(req)) throw httpError(403, "Cererea nu vine din panoul de administrare.");
  if (!auth.sameToken(String(req.headers["x-csrf"] || ""), s.csrf)) throw httpError(403, "Pagina a stat deschisă prea mult. Reîncărcați-o și încercați din nou.");
  return s;
}
function needProfile(req) {
  const p = people.loadProfile(req.headers["x-profile"]);
  if (!p) throw httpError(401, "Nu ți-am găsit rezultatele pe acest dispozitiv. Deschide linkul tău privat sau începe un test nou.");
  return p;
}
function visibleModule(doc, id) {
  const m = doc.site.modules.find((x) => x.id === id && x.on);
  const mod = m && doc.tests.modules[id];
  if (!mod) throw httpError(404, "Acest test nu este disponibil.");
  return { m, mod };
}
const isUnlocked = (p, id) => !!(p.data.paid.pachet || p.data.paid.modules[id]);
const cleanName = (v) => {
  const s = String(v || "").trim().replace(/\s+/g, " ");
  if (!/^[\p{L}][\p{L} .'-]{0,29}$/u.test(s)) throw httpError(400, "Scrie un prenume de cel mult 30 de litere.");
  return s;
};

// ---- Cuplu: ce vede unul dintre parteneri
function coupleView(doc, c, side) {
  const cp = doc.tests.couple;
  const paid = people.couplePaid(c);
  const other = side === "a" ? "b" : "a";
  const free = cp.questions.filter((q) => q.free);
  const scope = paid ? cp.questions : free;
  const mine = c.answers[side] || {}, theirs = c.answers[other] || {};
  const v = {
    id: c.id, me: side, myName: c[side].name, partnerName: c[other] ? c[other].name : null, paid,
    mine: { answered: sc.pairCount(scope, mine), total: scope.length },
    theirs: c[other] ? { answered: sc.pairCount(scope, theirs), total: scope.length } : null
  };
  const myFree = sc.pairCount(free, mine) >= free.length;
  const theirFree = !!c[other] && sc.pairCount(free, theirs) >= free.length;
  if (!myFree) v.stage = "answer";
  else if (!c[other]) v.stage = "invite";
  else if (!theirFree) v.stage = "wait";
  else if (!paid) { v.stage = "teaser"; v.teaser = sc.pairSame(free, mine, theirs); }
  else { v.stage = "report"; v.report = sc.pairReport(cp, cp.questions, c.answers.a, c.answers.b); v.names = { a: c.a.name, b: c.b.name }; }
  return v;
}

// ---- Cererile publice (clienți)
async function publicApi(req, res, parts) {
  const doc = getDoc();
  const method = req.method;
  const post = method === "POST" || method === "DELETE";
  if (post) {
    if (!sameOrigin(req)) throw httpError(403, "Cererea nu vine de pe site.");
    limit(req, "post", 400, 600000);
  }
  const body = method === "POST" ? await readBody(req, 60000) : {};
  const route = method + " " + parts.join("/");

  if (route === "GET site") return sendJson(res, 200, publicSite());

  if (route === "POST profile") {
    limit(req, "profile", 30, 3600000);
    return sendJson(res, 200, { token: people.createProfile() });
  }

  if (route === "GET me") {
    const p = people.loadProfile(req.headers["x-profile"]);
    if (!p) return sendJson(res, 200, { exists: false });
    const modules = {};
    for (const m of doc.site.modules) {
      const mod = doc.tests.modules[m.id];
      if (m.on && mod) modules[m.id] = sc.moduleStatus(mod, p.data.answers[m.id], isUnlocked(p, m.id));
    }
    const couples = [];
    for (const id of p.data.couples) {
      const c = people.loadCouple(id);
      const side = c && people.sideOf(c, p.hash);
      if (side) { const v = coupleView(doc, c, side); couples.push({ id, partner: v.partnerName, stage: v.stage, paid: v.paid }); }
    }
    const all = Object.values(modules);
    return sendJson(res, 200, { exists: true, paid: p.data.paid, modules, couples, email: p.data.email || "", hasReport: p.data.paid.pachet || (all.length > 0 && all.every((x) => x.unlocked)) });
  }

  if (parts[0] === "test" && parts.length === 2) {
    const p = needProfile(req);
    const { m, mod } = visibleModule(doc, parts[1]);
    if (mod.type === "tarot") throw httpError(404, "Acest test nu are întrebări.");
    const unlocked = isUnlocked(p, m.id);
    const scope = sc.inScope(mod, unlocked);
    const answers = p.data.answers[m.id] || {};
    if (method === "GET") {
      const mine = {};
      for (const q of scope) if (sc.validAnswer(mod, q, answers[q.id])) mine[q.id] = answers[q.id];
      return sendJson(res, 200, {
        id: m.id, name: m.name, type: mod.type, unlocked, scale: mod.type === "likert" ? doc.tests.scale : null,
        questions: scope.map((q) => (mod.type === "likert" ? { id: q.id, text: q.text } : { id: q.id, text: q.text, options: q.options })), answers: mine
      });
    }
    if (method === "POST") {
      const sent = body.answers;
      if (!sent || typeof sent !== "object") throw httpError(400, "Nu am primit niciun răspuns.");
      for (const q of scope) {
        if (sent[q.id] === undefined) continue;
        if (!sc.validAnswer(mod, q, sent[q.id])) throw httpError(400, "Unul dintre răspunsuri nu a putut fi citit. Reîncarcă pagina și încearcă din nou.");
        answers[q.id] = sent[q.id];
      }
      p.data.answers[m.id] = answers;
      people.saveProfile(p);
      return sendJson(res, 200, sc.moduleStatus(mod, answers, unlocked));
    }
  }

  if (method === "GET" && parts[0] === "result" && parts.length === 2) {
    const p = needProfile(req);
    const { m, mod } = visibleModule(doc, parts[1]);
    if (mod.type === "tarot") throw httpError(404, "Acest test nu are un rezultat de acest fel.");
    return sendJson(res, 200, { id: m.id, name: m.name, ...sc.moduleResult(mod, p.data.answers[m.id], isUnlocked(p, m.id), doc.tests) });
  }

  if (route === "GET report") {
    const p = needProfile(req);
    if (!p.data.paid.pachet && !doc.site.modules.every((m) => !m.on || isUnlocked(p, m.id))) throw httpError(402, "Raportul complet apare după ce deblochezi tot pachetul.");
    return sendJson(res, 200, sc.buildReport(doc.tests, doc.site.modules, p.data.answers));
  }

  // ---- Tarot
  if (parts[0] === "tarot") {
    const p = needProfile(req);
    const { mod } = visibleModule(doc, "tarot");
    const unlocked = isUnlocked(p, "tarot");
    const day = people.today();
    const card = (n) => mod.cards.find((c) => c.n === n);
    if (route === "POST tarot/personal") {
      if (!unlocked) throw httpError(402, "Cartea personală face parte din varianta completă.");
      const name = cleanName(body.name);
      const d = Number(body.day), mo = Number(body.month), y = Number(body.year);
      const date = new Date(Date.UTC(y, mo - 1, d));
      if (!Number.isInteger(d) || !Number.isInteger(mo) || !Number.isInteger(y) || y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || date.getTime() > Date.now()) {
        throw httpError(400, "Data nașterii nu este corectă. Verifică ziua, luna și anul.");
      }
      // Data nașterii nu se păstrează: rămân doar numărul cărții și prenumele.
      p.data.tarot.personal = { n: sc.personalNumber(d, mo, y), name };
      people.saveProfile(p);
    } else if (route === "POST tarot/spread") {
      if (!unlocked) throw httpError(402, "Etalarea de trei cărți face parte din varianta completă.");
      const s = p.data.tarot.spread;
      if (!s || s.day !== day) { p.data.tarot.spread = { day, cards: sc.drawSpread(mod.cards, mod.positions.length) }; people.saveProfile(p); }
    } else if (route !== "GET tarot") throw httpError(404, "Adresa nu există.");
    const t = p.data.tarot;
    const out = { unlocked, positions: mod.positions, day: { date: day, card: sc.publicCard(sc.cardOfDay(mod.cards, p.hash, day), unlocked) }, personal: null, spread: null };
    if (unlocked && t.personal && card(t.personal.n)) out.personal = { name: t.personal.name, card: { ...sc.publicCard(card(t.personal.n), true), personal: card(t.personal.n).personal } };
    if (unlocked && t.spread) {
      const cards = t.spread.cards.map((n, i) => (card(n) && mod.positions[i] ? { position: mod.positions[i], card: sc.publicCard(card(n), true) } : null)).filter(Boolean);
      if (cards.length) out.spread = { date: t.spread.day, cards, canRedraw: t.spread.day !== day };
    }
    return sendJson(res, 200, out);
  }

  // ---- Cuplu
  if (route === "POST couple") {
    const p = needProfile(req);
    if (body.consent !== true) throw httpError(400, "Bifează acordul ca să poți continua.");
    if (p.data.couples.length >= 10) throw httpError(400, "Ai deja 10 teste de cuplu începute.");
    limit(req, "couple", 20, 3600000);
    return sendJson(res, 200, { id: people.createCouple(p, cleanName(body.name)).id });
  }
  if (method === "GET" && parts[0] === "invite" && parts.length === 2) {
    const c = people.loadCouple(parts[1]);
    if (!c) throw httpError(404, "Invitația nu mai este valabilă.");
    const p = people.loadProfile(req.headers["x-profile"]);
    const side = p ? people.sideOf(c, p.hash) : null;
    return sendJson(res, 200, { name: c.a.name, full: !!c.b, mine: side });
  }
  if (route === "POST couple/join") {
    const p = needProfile(req);
    const c = people.loadCouple(body.id);
    if (!c) throw httpError(404, "Invitația nu mai este valabilă.");
    if (people.sideOf(c, p.hash)) return sendJson(res, 200, { id: c.id });
    if (c.b) throw httpError(400, "La acest test a răspuns deja altcineva.");
    if (body.consent !== true) throw httpError(400, "Bifează acordul ca să poți continua.");
    c.b = { hash: p.hash, name: cleanName(body.name) };
    people.saveCouple(c);
    p.data.couples.push(c.id);
    people.saveProfile(p);
    return sendJson(res, 200, { id: c.id });
  }
  if (parts[0] === "couple" && parts.length >= 2) {
    const p = needProfile(req);
    const c = people.loadCouple(parts[1]);
    const side = c && people.sideOf(c, p.hash);
    if (!side) throw httpError(404, "Testul de cuplu nu a fost găsit.");
    const cp = doc.tests.couple;
    const scope = people.couplePaid(c) ? cp.questions : cp.questions.filter((q) => q.free);
    if (method === "GET" && parts.length === 2) return sendJson(res, 200, coupleView(doc, c, side));
    if (method === "GET" && parts[2] === "questions") {
      const mine = {};
      for (const q of scope) if (sc.pairAnswerOk(q, c.answers[side][q.id])) mine[q.id] = c.answers[side][q.id];
      const other = side === "a" ? c.b : c.a;
      return sendJson(res, 200, { questions: scope.map((q) => ({ id: q.id, text: q.text, options: q.options })), answers: mine, partnerName: other ? other.name : null });
    }
    if (method === "POST" && parts[2] === "answers") {
      const sent = body.answers;
      if (!sent || typeof sent !== "object") throw httpError(400, "Nu am primit niciun răspuns.");
      for (const q of scope) {
        if (sent[q.id] === undefined) continue;
        if (!sc.pairAnswerOk(q, sent[q.id])) throw httpError(400, "Unul dintre răspunsuri nu a putut fi citit. Reîncarcă pagina și încearcă din nou.");
        c.answers[side][q.id] = { own: sent[q.id].own, guess: sent[q.id].guess };
      }
      people.saveCouple(c);
      return sendJson(res, 200, coupleView(doc, c, side));
    }
  }

  // ---- Plată
  if (parts[0] === "pay") {
    const p = needProfile(req);
    const settings = doc.site.settings;
    // Pagina de plată prin SMS întreabă din când în când dacă a sosit mesajul.
    if (route === "GET pay/status") {
      const order = people.getOrder(String(new URL(req.url, "http://x").searchParams.get("order") || ""), p);
      return sendJson(res, 200, { paid: order.status === "paid", next: pay.nextPath(order) });
    }
    if (route === "POST pay/test") {
      const order = people.getOrder(String(body.order || ""), p);
      if (settings.payments !== "test" || order.mode !== "test") throw httpError(400, "Plata de probă este oprită.");
      people.fulfill(order.id, p);
      return sendJson(res, 200, { paid: true, total: order.total, next: pay.nextPath(order) });
    }
    // Clientul s-a întors de la procesator: îl întrebăm pe acesta dacă s-a plătit.
    if (route === "POST pay/confirm") {
      limit(req, "confirm", 120, 600000);
      const order = people.getOrder(String(body.order || ""), p);
      const paid = await pay.confirm(order, settings);
      if (paid) people.fulfill(order.id, p);
      return sendJson(res, 200, { paid, next: pay.nextPath(order) });
    }
    if (route === "POST pay/quote" || route === "POST pay/start") {
      if (body.code) limit(req, "code", 30, 600000);
      const items = people.normalizeItems(body.items, p, doc);
      const q = people.quote(items, people.usablePromo(body.code));
      q.methods = pay.methodsFor(settings, q);
      if (parts[1] === "quote") return sendJson(res, 200, q);
      const mode = settings.payments;
      let chosen = "";
      if (q.total > 0) {
        if (mode === "oprit") throw httpError(400, "Plățile sunt oprite momentan. Încearcă din nou mai târziu.");
        chosen = typeof body.method === "string" ? body.method : "";
        // În modul de probă se poate „plăti” și fără nicio metodă aleasă; în modul real, metoda e obligatorie.
        if ((chosen || mode === "real") && !q.methods.some((m) => m.id === chosen)) {
          throw httpError(400, q.methods.length ? "Alege cum vrei să plătești." : "Nicio metodă de plată nu este pornită încă. Revino curând.");
        }
      }
      limit(req, "order", 40, 3600000);
      const order = people.addOrder(p, q, q.total > 0 ? mode : "gratuit", chosen);
      if (!(q.total > 0)) {
        people.fulfill(order.id, p);
        return sendJson(res, 200, { paid: true, total: 0, next: pay.nextPath(order) });
      }
      const out = { paid: false, order: order.id, total: q.total, mode, method: chosen };
      if (chosen === "sms") Object.assign(out, pay.smsInfo(order, settings));
      else if (mode === "real") Object.assign(out, await pay.start(order, { base: baseUrl(req), settings }));
      return sendJson(res, 200, out);
    }
  }

  // ---- E-mail opțional și ștergerea datelor
  if (route === "POST email") {
    const p = needProfile(req);
    const email = auth.normEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw httpError(400, "Adresa de e-mail nu pare corectă. Exemplu: nume@exemplu.ro");
    if (body.consent !== true) throw httpError(400, "Bifează acordul ca să îți putem păstra adresa.");
    p.data.email = email;
    p.data.emailConsent = new Date().toISOString();
    people.saveProfile(p);
    return sendJson(res, 200, { email });
  }
  if (route === "DELETE email") {
    const p = needProfile(req);
    delete p.data.email;
    delete p.data.emailConsent;
    people.saveProfile(p);
    return sendJson(res, 200, { email: "" });
  }
  if (route === "DELETE profile") {
    people.deleteProfile(needProfile(req));
    return sendJson(res, 200, { deleted: true });
  }

  throw httpError(404, "Adresa nu există.");
}

// ---- Cererile panoului de administrare
async function adminApi(req, res, parts) {
  const method = req.method;
  const route = method + " " + parts.join("/");
  const body = method === "POST" || method === "PUT" ? await readBody(req, 3 * 1024 * 1024) : {};

  if (route === "POST admin/login") {
    if (!sameOrigin(req)) throw httpError(403, "Cererea nu vine din panoul de administrare.");
    const ip = "ip:" + clientIp(req);
    const email = auth.normEmail(body.email).slice(0, 120);
    const acc = "cont:" + email;
    const wait = Math.max(auth.lockedFor(ip), auth.lockedFor(acc));
    if (wait) throw httpError(429, "Prea multe parole greșite. Încercați din nou peste " + Math.ceil(wait / 60) + " minute.");
    const user = await auth.verifyPassword(email, body.password);
    if (!user) {
      auth.noteFail(ip);
      auth.noteFail(acc);
      audit(req, "autentificare-esuata", { email });
      const locked = Math.max(auth.lockedFor(ip), auth.lockedFor(acc));
      throw httpError(401, locked ? "Prea multe parole greșite. Încercați din nou peste " + Math.ceil(locked / 60) + " minute." : "Adresa de e-mail sau parola nu sunt corecte.");
    }
    auth.clearFails(ip);
    auth.clearFails(acc);
    const s = auth.createSession(user.email);
    audit(req, "autentificare", { email: user.email });
    return sendJson(res, 200, { email: user.email, csrf: s.csrf }, { "Set-Cookie": sessionCookie(req, s.token, cfg.SESSION_MAX_DAYS * 86400) });
  }
  if (route === "GET admin/me") {
    const s = auth.getSession(parseCookies(req)[cookieName(req)]);
    return sendJson(res, 200, s ? { email: s.email, csrf: s.csrf } : { email: null, hasAccount: auth.readUsers().length > 0 });
  }
  if (route === "POST admin/logout") {
    const s = guard(req);
    auth.destroySession(s.token);
    audit(req, "iesire", { email: s.email });
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
  }
  if (route === "POST admin/password") {
    const s = guard(req);
    if (!(await auth.verifyPassword(s.email, body.current))) throw httpError(400, "Parola de acum nu este corectă. Scrieți parola cu care ați intrat în panou.");
    await auth.setPassword(s.email, body.next);
    auth.revokeSessions(s.email, s.token);
    audit(req, "parola-schimbata", { email: s.email });
    return sendJson(res, 200, { ok: true });
  }

  if (route === "GET admin/doc") {
    adminSession(req);
    const d = getDoc();
    return sendJson(res, 200, { rev: d.rev, updated: d.updated, by: d.by, version: cfg.VERSION, doc: { site: d.site, tests: d.tests } });
  }
  if (route === "PUT site") {
    const s = guard(req);
    const result = validateDoc(body.doc, DEFAULTS);
    if (result.errors) throw httpError(400, "Nu am salvat. " + result.errors[0], { errors: result.errors });
    const d = saveDoc(result.doc, s.email, body.note, body.rev);
    audit(req, "salvare", { email: s.email, rev: d.rev });
    return sendJson(res, 200, { rev: d.rev, updated: d.updated, by: d.by, doc: { site: d.site, tests: d.tests } });
  }
  if (route === "GET admin/history") {
    adminSession(req);
    return sendJson(res, 200, { current: getDoc().rev, versions: listHistory() });
  }
  if (route === "POST admin/restore") {
    const s = guard(req);
    let doc = {};
    let label = "valorile implicite";
    if (body.id !== "implicit") {
      const id = String(body.id || "");
      const v = /^[\w-]+\.json$/.test(id) ? store.readJson(path.join(HISTORY_DIR, id), null) : null;
      if (!v || !v.doc) throw httpError(404, "Versiunea aleasă nu mai există. Reîncărcați lista.");
      const checked = validateDoc({ site: merge(SITE, v.doc.site || {}), tests: merge(TESTS, v.doc.tests || {}) }, DEFAULTS);
      if (checked.errors) throw httpError(400, "Versiunea aleasă nu mai poate fi folosită: " + checked.errors[0]);
      doc = checked.doc;
      label = "versiunea " + v.rev;
    }
    const d = saveDoc(doc, s.email, "Restaurare: " + label, getDoc().rev);
    audit(req, "restaurare", { email: s.email, din: label, rev: d.rev });
    return sendJson(res, 200, { rev: d.rev, updated: d.updated, by: d.by, doc: { site: d.site, tests: d.tests } });
  }

  if (route === "GET admin/promos") { adminSession(req); return sendJson(res, 200, { codes: people.readPromos() }); }
  if (route === "POST admin/promos") {
    const s = guard(req);
    const p = people.createPromo(body);
    audit(req, "cod-creat", { email: s.email, cod: p.code, tip: p.type, procent: p.percent });
    return sendJson(res, 200, { codes: people.readPromos() });
  }
  if (parts[1] === "promos" && parts.length === 3 && (method === "PUT" || method === "DELETE")) {
    const s = guard(req);
    const code = decodeURIComponent(parts[2]);
    if (method === "PUT") people.updatePromo(code, body); else people.removePromo(code);
    audit(req, method === "PUT" ? "cod-schimbat" : "cod-sters", { email: s.email, cod: code });
    return sendJson(res, 200, { codes: people.readPromos() });
  }

  if (route === "GET admin/stats") { adminSession(req); return sendJson(res, 200, people.stats()); }
  // Ce metode de plată au cheile puse pe server. Nu trimite nicio cheie, doar dacă există.
  if (route === "GET admin/pay") { adminSession(req); return sendJson(res, 200, pay.adminStatus(baseUrl(req))); }
  if (route === "GET admin/audit") {
    adminSession(req);
    let lines = [];
    try { lines = fs.readFileSync(AUDIT_FILE, "utf8").trim().split("\n").slice(-80).reverse().map((l) => JSON.parse(l)); } catch (e) { /* jurnal gol */ }
    return sendJson(res, 200, { lines });
  }
  if (route === "GET admin/emails.csv") {
    const s = adminSession(req);
    audit(req, "export-email", { email: s.email });
    const csv = "﻿email,acord_din\r\n" + people.emailList().map((e) => e.email.replace(/[",\r\n]/g, "") + "," + e.since).join("\r\n");
    res.writeHead(200, baseHeaders({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="adrese-email.csv"', "Cache-Control": "no-store" }));
    return res.end(csv);
  }
  throw httpError(404, "Adresa nu există.");
}

// ---- Apelurile venite de la procesatorii de plăți. Nu vin din browser, deci nu au profil și nici „același domeniu”:
// Stripe se recunoaște după semnătură, agregatorul de SMS după secretul din adresă.
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(httpError(413, "Datele trimise sunt prea mari.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function hookApi(req, res, parts, url) {
  const settings = getDoc().site.settings;
  if (parts[1] === "stripe" && parts.length === 2 && req.method === "POST") {
    const raw = await readRaw(req, 512 * 1024);
    const event = pay.stripeEvent(raw, req.headers["stripe-signature"]);
    pay.stripeHandle(event, settings);
    return sendJson(res, 200, { received: true });
  }
  if (parts[1] === "sms" && parts.length === 3 && (req.method === "GET" || req.method === "POST")) {
    if (!cfg.SMS_HOOK_SECRET || !auth.sameToken(parts[2], cfg.SMS_HOOK_SECRET)) throw httpError(404, "Adresa nu există.");
    if (cfg.SMS_HOOK_IPS.length && !cfg.SMS_HOOK_IPS.includes(clientIp(req))) throw httpError(403, "Adresa IP nu are voie să apeleze.");
    limit(req, "sms", 600, 600000);
    const params = Object.fromEntries(url.searchParams);
    if (req.method === "POST") {
      const text = (await readRaw(req, 64 * 1024)).toString("utf8");
      if (/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) {
        try { const j = JSON.parse(text); if (j && typeof j === "object" && !Array.isArray(j)) Object.assign(params, j); } catch (e) { /* corp necitibil: rămân câmpurile din adresă */ }
      } else Object.assign(params, Object.fromEntries(new URLSearchParams(text)));
    }
    const reply = pay.smsHook(params, settings).reply;
    res.writeHead(200, baseHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    return res.end(reply);
  }
  throw httpError(404, "Adresa nu există.");
}

// ---- Fișiere publice. Se servește doar ce e în folderul public/, cu extensii cunoscute.
function serveStatic(req, res, pathname) {
  let rel = pathname;
  const extra = {};
  if (rel === "/") rel = "/index.html";
  else if (rel === "/admin" || rel === "/admin/") { rel = "/admin.html"; }
  if (rel === "/admin.html") extra["X-Robots-Tag"] = "noindex, nofollow";
  let file;
  try { file = path.normalize(path.join(cfg.PUBLIC_DIR, decodeURIComponent(rel))); } catch (e) { file = ""; }
  const type = MIME[path.extname(file).toLowerCase()];
  if (!file.startsWith(cfg.PUBLIC_DIR + path.sep) || !type || rel.includes("\0") || /(^|[\\/])\./.test(path.relative(cfg.PUBLIC_DIR, file))) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const etag = '"' + st.size.toString(16) + "-" + Math.floor(st.mtimeMs).toString(16) + '"';
    const headers = baseHeaders(Object.assign({ "Content-Type": type, "Cache-Control": "no-cache", ETag: etag }, extra));
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
    headers["Content-Length"] = st.size;
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  res.writeHead(404, baseHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
  res.end("Pagina nu există.");
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, "http://x"); } catch (e) { return notFound(res); }
  const pathname = url.pathname;
  try {
    if (pathname.startsWith("/api/")) {
      const parts = pathname.slice(5).split("/").filter(Boolean);
      if (parts[0] === "admin" || (parts[0] === "site" && req.method === "PUT")) return await adminApi(req, res, parts);
      if (parts[0] === "hook") return await hookApi(req, res, parts, url);
      return await publicApi(req, res, parts);
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, baseHeaders({ Allow: "GET, HEAD" })); return res.end(); }
    const origin = baseUrl(req);
    if (pathname === "/robots.txt") {
      res.writeHead(200, baseHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      return res.end("User-agent: *\nDisallow: /api/\nSitemap: " + origin + "/sitemap.xml\n");
    }
    if (pathname === "/sitemap.xml") {
      res.writeHead(200, baseHeaders({ "Content-Type": "application/xml; charset=utf-8" }));
      return res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + "/</loc></url></urlset>\n");
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    if (res.headersSent) return res.end();
    const status = e.status || 500;
    if (status === 500) console.error(e);
    sendJson(res, status, Object.assign({ error: status === 500 ? "A apărut o problemă pe server. Încearcă din nou peste câteva minute." : e.message }, e.extra));
  }
});

if (require.main === module) {
  fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
  const removed = people.purgeOld();
  setInterval(() => people.purgeOld(), 24 * 3600 * 1000).unref();
  server.listen(cfg.PORT, cfg.HOST, () => {
    console.log("Site:   http://localhost:" + cfg.PORT + "/");
    console.log("Panou:  http://localhost:" + cfg.PORT + "/admin");
    console.log("Date:   " + cfg.DATA_DIR + (removed ? "  (" + removed + " profiluri vechi șterse)" : ""));
    if (!auth.readUsers().length) console.log("Nu există cont de administrare. Creați unul cu: node server/manage.js create-admin adresa@exemplu.ro");
  });
}

module.exports = { server, getDoc };
