// Datele clienților: profiluri (fără cont), cupluri, comenzi și coduri promoționale.
// Un profil se recunoaște după un cod secret ținut în browserul clientului. Pe disc stă doar hash-ul lui.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const store = require("./store");
const { httpError, sha256 } = require("./auth");

const PROFILES = path.join(cfg.DATA_DIR, "profiles");
const COUPLES = path.join(cfg.DATA_DIR, "couples");
const ORDERS = path.join(cfg.DATA_DIR, "orders.json");
const PROMOS = path.join(cfg.DATA_DIR, "promos.json");
const DAY_MS = 24 * 3600 * 1000;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
const listJson = (dir) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch (e) { return []; } };

// ---- Profiluri
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const profileFile = (hash) => path.join(PROFILES, hash + ".json");

function createProfile() {
  const token = crypto.randomBytes(24).toString("base64url");
  const now = new Date().toISOString();
  store.writeJson(profileFile(sha256(token)), { created: now, seen: now, answers: {}, paid: { pachet: false, modules: {} }, tarot: {}, couples: [] });
  return token;
}
function loadProfile(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const hash = sha256(token);
  const data = store.readJson(profileFile(hash), null);
  if (!data) return null;
  data.answers = data.answers || {};
  data.paid = data.paid || { pachet: false, modules: {} };
  data.paid.modules = data.paid.modules || {};
  data.tarot = data.tarot || {};
  data.couples = data.couples || [];
  // „Văzut ultima dată” se actualizează cel mult o dată pe zi, ca să nu scriem pe disc la fiecare cerere.
  if (Date.now() - Date.parse(data.seen || 0) > DAY_MS) { data.seen = new Date().toISOString(); store.writeJson(profileFile(hash), data); }
  return { hash, data };
}
const loadProfileByHash = (hash) => store.readJson(profileFile(hash), null);
const saveProfile = (p) => store.writeJson(profileFile(p.hash), p.data);
function deleteProfile(p) {
  for (const id of p.data.couples) store.remove(coupleFile(id));
  store.remove(profileFile(p.hash));
}
const hasPack = (hash) => { const d = hash && loadProfileByHash(hash); return !!(d && d.paid && d.paid.pachet); };

// ---- Cupluri
const COUPLE_RE = /^[A-Za-z0-9_-]{16}$/;
const coupleFile = (id) => path.join(COUPLES, id + ".json");
function createCouple(p, name) {
  const id = crypto.randomBytes(12).toString("base64url");
  const c = { id, created: new Date().toISOString(), a: { hash: p.hash, name }, b: null, answers: { a: {}, b: {} }, paid: false };
  store.writeJson(coupleFile(id), c);
  p.data.couples.push(id);
  saveProfile(p);
  return c;
}
function loadCouple(id) {
  if (typeof id !== "string" || !COUPLE_RE.test(id)) return null;
  return store.readJson(coupleFile(id), null);
}
const saveCouple = (c) => store.writeJson(coupleFile(c.id), c);
const sideOf = (c, hash) => (c.a.hash === hash ? "a" : c.b && c.b.hash === hash ? "b" : null);
const couplePaid = (c) => c.paid || hasPack(c.a.hash) || hasPack(c.b && c.b.hash);

// ---- Coduri promoționale
const CODE_RE = /^[A-Z0-9-]{3,24}$/;
const normCode = (s) => String(s || "").trim().toUpperCase();
const readPromos = () => { const d = store.readJson(PROMOS, null); return d && Array.isArray(d.codes) ? d.codes : []; };
const writePromos = (codes) => store.writeJson(PROMOS, { codes });

function cleanPromo(input, existing) {
  const p = existing ? { ...existing } : { used: 0, created: new Date().toISOString() };
  if (!existing) {
    p.code = normCode(input.code) || "CQ-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    if (!CODE_RE.test(p.code)) throw httpError(400, "Codul poate conține doar litere fără diacritice, cifre și liniuță, între 3 și 24 de caractere.");
    p.type = input.type === "2plus1" ? "2plus1" : input.type === "percent" ? "percent" : null;
    if (!p.type) throw httpError(400, "Alegeți tipul reducerii: procent sau 2+1 gratis.");
    p.percent = p.type === "percent" ? Number(input.percent) : 0;
    if (p.type === "percent" && (!Number.isInteger(p.percent) || p.percent < 0 || p.percent > 100)) throw httpError(400, "Procentul trebuie să fie un număr întreg între 0 și 100.");
  }
  if (input.max !== undefined) {
    p.max = Number(input.max);
    if (!Number.isInteger(p.max) || p.max < 0 || p.max > 1000000) throw httpError(400, "Numărul de folosiri trebuie să fie un număr întreg între 0 și 1.000.000. Scrieți 0 pentru nelimitat.");
  } else if (!existing) p.max = 0;
  if (input.expires !== undefined) {
    p.expires = String(input.expires || "");
    if (p.expires && (!/^\d{4}-\d{2}-\d{2}$/.test(p.expires) || Number.isNaN(Date.parse(p.expires)))) throw httpError(400, "Data de expirare trebuie aleasă din calendar sau lăsată goală.");
  } else if (!existing) p.expires = "";
  if (input.active !== undefined) p.active = !!input.active; else if (!existing) p.active = true;
  if (input.note !== undefined) p.note = String(input.note || "").slice(0, 120); else if (!existing) p.note = "";
  return p;
}
function createPromo(input) {
  const codes = readPromos();
  if (codes.length >= 500) throw httpError(400, "Aveți deja 500 de coduri. Ștergeți din cele vechi înainte să adăugați altele.");
  const p = cleanPromo(input || {}, null);
  if (codes.some((c) => c.code === p.code)) throw httpError(400, "Există deja un cod „" + p.code + "”. Alegeți alt nume.");
  codes.unshift(p);
  writePromos(codes);
  return p;
}
function updatePromo(code, input) {
  const codes = readPromos();
  const i = codes.findIndex((c) => c.code === normCode(code));
  if (i < 0) throw httpError(404, "Codul nu mai există. Reîncărcați pagina.");
  codes[i] = cleanPromo(input || {}, codes[i]);
  writePromos(codes);
  return codes[i];
}
function removePromo(code) {
  const codes = readPromos();
  const next = codes.filter((c) => c.code !== normCode(code));
  if (next.length === codes.length) throw httpError(404, "Codul nu mai există. Reîncărcați pagina.");
  writePromos(next);
}
// Întoarce codul dacă se poate folosi acum; altfel explică de ce nu.
function usablePromo(raw) {
  const code = normCode(raw);
  if (!code) return null;
  const p = CODE_RE.test(code) ? readPromos().find((c) => c.code === code) : null;
  if (!p) throw httpError(400, "Codul nu există. Verifică dacă l-ai scris corect.");
  if (!p.active) throw httpError(400, "Codul nu mai este activ.");
  if (p.expires && today() > p.expires) throw httpError(400, "Codul a expirat.");
  if (p.max > 0 && p.used >= p.max) throw httpError(400, "Codul a fost deja folosit de numărul maxim de ori.");
  return p;
}
function bumpPromo(code) {
  const codes = readPromos();
  const p = codes.find((c) => c.code === code);
  if (p) { p.used = (p.used || 0) + 1; writePromos(codes); }
}

// ---- Coș și comenzi. Toate sumele se calculează în bani (întregi), ca să nu apară erori de rotunjire.
const toBani = (price) => Math.round(Number(price) * 100);

function normalizeItems(raw, p, doc) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) throw httpError(400, "Alege cel puțin un test.");
  const products = doc.site.settings.products;
  if (raw.some((i) => i && i.type === "pachet")) {
    if (p.data.paid.pachet) throw httpError(400, "Ai deja tot pachetul.");
    if (!products.pachet.on) throw httpError(400, "Pachetul nu se poate cumpăra momentan.");
    return [{ type: "pachet", label: products.pachet.name, bani: toBani(products.pachet.price) }];
  }
  const out = [];
  const seen = new Set();
  for (const it of raw) {
    if (!it || typeof it.id !== "string" || seen.has(it.type + ":" + it.id)) continue;
    seen.add(it.type + ":" + it.id);
    if (it.type === "modul") {
      const m = doc.site.modules.find((x) => x.id === it.id && x.on);
      if (!m || !doc.tests.modules[m.id]) throw httpError(400, "Unul dintre testele alese nu mai este disponibil. Reîncarcă pagina.");
      if (!products.modul.on) throw httpError(400, "Testele nu se pot cumpăra separat momentan.");
      if (p.data.paid.pachet || p.data.paid.modules[m.id]) continue;
      out.push({ type: "modul", id: m.id, label: m.name, bani: toBani(products.modul.price) });
    } else if (it.type === "cuplu") {
      const c = loadCouple(it.id);
      if (!c || !sideOf(c, p.hash)) throw httpError(400, "Testul de cuplu ales nu a fost găsit.");
      if (!products.cuplu.on) throw httpError(400, "Testul de cuplu nu se poate cumpăra momentan.");
      if (couplePaid(c)) continue;
      out.push({ type: "cuplu", id: c.id, label: doc.site.settings.coupleName, bani: toBani(products.cuplu.price) });
    }
  }
  if (!out.length) throw httpError(400, "Ai deja tot ce ai ales.");
  return out;
}

function quote(items, promo) {
  const subtotal = items.reduce((s, i) => s + i.bani, 0);
  let discount = 0, text = "", note = "";
  if (promo && promo.type === "percent") {
    discount = Math.round((subtotal * promo.percent) / 100);
    text = promo.percent + "% reducere";
  } else if (promo) {
    // 2+1: din fiecare trei teste alese, cel mai ieftin este gratuit. Pachetul nu intră la numărătoare.
    const prices = items.filter((i) => i.type !== "pachet").map((i) => i.bani).sort((a, b) => a - b);
    const free = Math.floor(prices.length / 3);
    discount = prices.slice(0, free).reduce((s, x) => s + x, 0);
    text = "2+1 gratis";
    if (!free) note = "Codul se aplică atunci când alegi cel puțin trei teste separate.";
  }
  const total = Math.max(0, subtotal - discount);
  return {
    items: items.map((i) => ({ type: i.type, id: i.id || null, label: i.label, price: i.bani / 100 })),
    subtotal: subtotal / 100, discount: discount / 100, total: total / 100,
    code: promo ? promo.code : "", codeText: text, codeNote: note
  };
}

const readOrders = () => { const d = store.readJson(ORDERS, null); return d && Array.isArray(d.orders) ? d.orders : []; };
const writeOrders = (orders) => store.writeJson(ORDERS, { orders: orders.slice(-5000) });

// Literele și cifrele codului din SMS: fără 0/O și 1/I, ca să nu fie încurcate la tastare.
const SMS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const smsCode = () => Array.from(crypto.randomBytes(6), (b) => SMS_ALPHABET[b % SMS_ALPHABET.length]).join("");

function addOrder(p, q, mode, method) {
  const orders = readOrders();
  const order = { id: crypto.randomBytes(12).toString("base64url"), at: new Date().toISOString(), profile: p.hash, items: q.items, code: q.code, subtotal: q.subtotal, discount: q.discount, total: q.total, mode, method: method || "", status: "pending" };
  if (method === "sms") order.sms = smsCode();
  orders.push(order);
  writeOrders(orders);
  return order;
}
// Comanda unui client anume. Fără profil (la apelurile venite de la procesator) se caută doar după cod.
function getOrder(orderId, p) {
  const order = readOrders().find((o) => o.id === orderId && (!p || o.profile === p.hash));
  if (!order) throw httpError(404, "Comanda nu a fost găsită. Reia plata de la început.");
  return order;
}
// Notează pe comandă ce a răspuns procesatorul (codul sesiunii de plată, suma cerută).
function patchOrder(orderId, patch) {
  const orders = readOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;
  Object.assign(order, patch);
  writeOrders(orders);
  return order;
}
// Comanda prin SMS încă neplătită al cărei cod apare în textul primit. Se caută doar în ultimele două zile.
function findSmsOrder(text) {
  const words = new Set(String(text || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  const since = Date.now() - 2 * DAY_MS;
  return readOrders().find((o) => o.method === "sms" && o.sms && words.has(o.sms) && Date.parse(o.at) > since) || null;
}
// Marchează comanda plătită și deblochează ce s-a cumpărat. Poate fi apelată de mai multe ori fără urmări.
function fulfill(orderId, p) {
  const orders = readOrders();
  const order = orders.find((o) => o.id === orderId && (!p || o.profile === p.hash));
  if (!order) throw httpError(404, "Comanda nu a fost găsită. Reia plata de la început.");
  if (order.status === "paid") return order;
  // La apelurile venite de la procesator nu avem profilul clientului, așa că îl luăm din comandă.
  const data = p ? p.data : loadProfileByHash(order.profile);
  if (data) {
    data.paid = data.paid || { pachet: false, modules: {} };
    data.paid.modules = data.paid.modules || {};
    for (const it of order.items) {
      if (it.type === "pachet") data.paid.pachet = true;
      else if (it.type === "modul") data.paid.modules[it.id] = true;
      else if (it.type === "cuplu") { const c = loadCouple(it.id); if (c) { c.paid = true; saveCouple(c); } }
    }
    saveProfile({ hash: order.profile, data });
  }
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  writeOrders(orders);
  if (order.code) bumpPromo(order.code);
  return order;
}

// ---- Cifre pentru panou
function stats() {
  const orders = readOrders().filter((o) => o.status === "paid");
  const profiles = listJson(PROFILES);
  let emails = 0, started = 0;
  for (const f of profiles) {
    const d = store.readJson(path.join(PROFILES, f), null);
    if (!d) continue;
    if (d.email && d.emailConsent) emails += 1;
    if (Object.keys(d.answers || {}).length) started += 1;
  }
  return {
    profiles: profiles.length, started, couples: listJson(COUPLES).length, emails,
    orders: orders.length, revenue: Math.round(orders.filter((o) => o.mode === "real").reduce((s, o) => s + toBani(o.total), 0)) / 100,
    recent: orders.slice(-15).reverse().map((o) => ({ at: o.at, total: o.total, code: o.code, mode: o.mode, method: o.method || "", items: o.items.map((i) => i.label) }))
  };
}
function emailList() {
  const out = [];
  for (const f of listJson(PROFILES)) {
    const d = store.readJson(path.join(PROFILES, f), null);
    if (d && d.email && d.emailConsent) out.push({ email: d.email, since: d.emailConsent });
  }
  return out.sort((a, b) => (a.since < b.since ? 1 : -1));
}

// Șterge profilurile și cuplurile nefolosite de mult timp.
function purgeOld() {
  const limit = Date.now() - cfg.RETENTION_DAYS * DAY_MS;
  let removed = 0;
  for (const f of listJson(PROFILES)) {
    const d = store.readJson(path.join(PROFILES, f), null);
    if (d && Date.parse(d.seen || d.created || 0) < limit) { store.remove(path.join(PROFILES, f)); removed += 1; }
  }
  for (const f of listJson(COUPLES)) {
    const c = store.readJson(path.join(COUPLES, f), null);
    if (!c) continue;
    const alive = loadProfileByHash(c.a.hash) || (c.b && loadProfileByHash(c.b.hash));
    if (!alive) { store.remove(path.join(COUPLES, f)); removed += 1; }
  }
  return removed;
}

module.exports = {
  today, createProfile, loadProfile, saveProfile, deleteProfile, createCouple, loadCouple, saveCouple, sideOf, couplePaid,
  readPromos, createPromo, updatePromo, removePromo, usablePromo, normalizeItems, quote, addOrder, getOrder, patchOrder, findSmsOrder, fulfill, stats, emailList, purgeOld
};
