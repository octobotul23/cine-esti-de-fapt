// Plățile reale. Fiecare metodă știe două lucruri: cum pornește plata și cum află că s-a plătit.
//   card   – Stripe Checkout: card, Apple Pay, Google Pay, Link și orice altă metodă pornită în contul Stripe
//   paypal – PayPal, legat direct (prin Stripe nu este disponibil firmelor din SUA)
//   sms    – SMS cu suprataxă / plată pe factura de telefon, printr-un agregator care ne apelează la fiecare mesaj
// Comanda, codul promo și deblocarea sunt aceleași pentru toate (server/people.js).
// Cheile secrete vin doar din variabile de mediu (server/config.js). Fără dependențe: se folosește fetch din Node.
"use strict";
const crypto = require("crypto");
const cfg = require("./config");
const people = require("./people");
const { httpError } = require("./auth");

const toBani = (x) => Math.round(Number(x) * 100);
const NO_ANSWER = "Procesatorul de plăți nu răspunde acum. Încearcă din nou peste un minut sau alege altă metodă.";
const REFUSED = "Plata nu a putut fi pornită. Alege altă metodă sau încearcă din nou.";

// Ce variabile de mediu lipsesc pentru o metodă. Listă goală = metoda poate încasa.
function missing(id) {
  if (id === "card") return cfg.STRIPE_SECRET_KEY ? [] : ["STRIPE_SECRET_KEY"];
  if (id === "paypal") return [!cfg.PAYPAL_CLIENT_ID && "PAYPAL_CLIENT_ID", !cfg.PAYPAL_SECRET && "PAYPAL_SECRET"].filter(Boolean);
  if (id === "sms") return cfg.SMS_HOOK_SECRET ? [] : ["SMS_HOOK_SECRET"];
  return ["?"];
}

// PayPal nu încasează în lei. Dacă moneda lui diferă de a site-ului, suma se trece în euro la cursul din panou.
function paypalCharge(settings, total) {
  if (cfg.PAYPAL_CURRENCY === settings.currencyCode) return { amount: Number(total), currency: cfg.PAYPAL_CURRENCY };
  if (cfg.PAYPAL_CURRENCY !== "EUR" || !(settings.eurRate > 0)) return null;
  return { amount: Math.max(0.01, Math.round((total / settings.eurRate) * 100) / 100), currency: "EUR" };
}
// Tariful de SMS al comenzii. SMS-ul are preț fix, deci merge doar pentru un singur produs, fără reducere.
function smsTariff(settings, q) {
  if (q.items.length !== 1 || q.discount > 0) return null;
  const t = settings.pay.sms.tariffs[q.items[0].type];
  return t && t.on && t.number ? t : null;
}

// Metodele pe care le poate alege clientul pentru un coș anume, în ordinea din panou.
// În modul de probă apar toate cele pornite; în modul real, doar cele care au și cheile puse pe server.
function methodsFor(settings, q) {
  if (!(q.total > 0) || settings.payments === "oprit") return [];
  const real = settings.payments === "real";
  const out = [];
  for (const m of settings.pay.methods) {
    if (!m.on || (real && missing(m.id).length)) continue;
    let detail = "";
    if (m.id === "sms") {
      const t = smsTariff(settings, q);
      if (!t) continue;
      detail = t.cost;
    } else if (m.id === "paypal") {
      const c = paypalCharge(settings, q.total);
      if (!c) continue;
      if (c.currency !== settings.currencyCode) detail = c.amount.toFixed(2).replace(".", ",") + " " + c.currency;
    }
    out.push({ id: m.id, name: m.name, note: m.note, detail });
  }
  return out;
}

const orderName = (order, settings) => (settings.siteName + ": " + order.items.map((i) => i.label).join(", ")).slice(0, 120);
// Unde merge clientul după plată.
function nextPath(order) {
  const it = order.items[0];
  if (order.items.length === 1 && it.type === "cuplu") return "/noi/" + it.id;
  if (order.items.length === 1 && it.type === "modul" && it.id === "tarot") return "/tarot";
  return "/eu";
}

async function call(url, opts, who) {
  let res, text;
  try {
    res = await fetch(url, Object.assign({ signal: AbortSignal.timeout(15000) }, opts));
    text = await res.text();
  } catch (e) {
    console.error(who + " nu răspunde: " + e.message);
    throw httpError(502, NO_ANSWER);
  }
  let data = {};
  try { data = JSON.parse(text) || {}; } catch (e) { /* răspuns care nu e JSON */ }
  return { ok: res.ok, status: res.status, data };
}

// ---- Stripe Checkout
const stripeHeaders = (extra) => Object.assign({ Authorization: "Bearer " + cfg.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" }, extra);

async function stripeStart(order, ctx) {
  // Nu cerem anumite tipuri de plată: Stripe arată singur tot ce e pornit în cont și se potrivește cu moneda și țara clientului.
  const form = new URLSearchParams({
    mode: "payment",
    locale: "ro",
    client_reference_id: order.id,
    "metadata[order]": order.id,
    success_url: ctx.base + "/?plata=" + order.id,
    cancel_url: ctx.base + "/?plata_anulata=" + order.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": ctx.settings.currencyCode.toLowerCase(),
    // Suma în subunități (bani). Valabil pentru monedele cu două zecimale, cum sunt RON, EUR și USD.
    "line_items[0][price_data][unit_amount]": String(toBani(order.total)),
    "line_items[0][price_data][product_data][name]": orderName(order, ctx.settings)
  });
  const r = await call(cfg.STRIPE_API + "/v1/checkout/sessions", { method: "POST", headers: stripeHeaders({ "Idempotency-Key": "cq-" + order.id }), body: form.toString() }, "Stripe");
  if (!r.ok || !r.data.url || !r.data.id) {
    console.error("Stripe a refuzat comanda " + order.id + ":", r.status, r.data.error ? r.data.error.message : "");
    throw httpError(502, REFUSED);
  }
  people.patchOrder(order.id, { ref: r.data.id });
  return { redirect: r.data.url };
}
// Plătit înseamnă: Stripe spune „paid”, iar suma și moneda sunt chiar cele ale comenzii.
const stripePaid = (session, order, settings) => !!session && session.payment_status === "paid" &&
  session.amount_total === toBani(order.total) && String(session.currency).toLowerCase() === settings.currencyCode.toLowerCase();

async function stripeConfirm(order, settings) {
  if (!order.ref) return false;
  const r = await call(cfg.STRIPE_API + "/v1/checkout/sessions/" + encodeURIComponent(order.ref), { headers: stripeHeaders() }, "Stripe");
  return r.ok && stripePaid(r.data, order, settings);
}
// Verifică semnătura unui apel venit de la Stripe și întoarce evenimentul. `raw` sunt octeții primiți, neschimbați.
function stripeEvent(raw, header) {
  if (!cfg.STRIPE_WEBHOOK_SECRET) throw httpError(503, "Lipsește STRIPE_WEBHOOK_SECRET pe server.");
  const pairs = String(header || "").split(",").map((x) => x.trim().split("="));
  const t = (pairs.find((p) => p[0] === "t") || [])[1];
  const sigs = pairs.filter((p) => p[0] === "v1").map((p) => p[1] || "");
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) throw httpError(400, "Semnătura lipsește sau a expirat.");
  const want = crypto.createHmac("sha256", cfg.STRIPE_WEBHOOK_SECRET).update(t + ".").update(raw).digest();
  const ok = sigs.some((s) => { const got = Buffer.from(s, "hex"); return got.length === want.length && crypto.timingSafeEqual(got, want); });
  if (!ok) throw httpError(400, "Semnătura nu se potrivește.");
  try { return JSON.parse(raw.toString("utf8")); } catch (e) { throw httpError(400, "Mesajul nu a putut fi citit."); }
}
// Întoarce comanda deblocată sau null dacă evenimentul nu ne privește.
function stripeHandle(event, settings) {
  if (!event || (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded")) return null;
  const session = event.data && event.data.object;
  const id = session && (session.client_reference_id || (session.metadata && session.metadata.order));
  let order;
  try { order = people.getOrder(String(id || "")); } catch (e) { return null; }
  if (order.method !== "card" || order.mode !== "real" || !stripePaid(session, order, settings)) return null;
  return people.fulfill(order.id);
}

// ---- PayPal
let ppToken = null;
async function paypalHeaders(extra) {
  if (!ppToken || ppToken.until < Date.now()) {
    const basic = Buffer.from(cfg.PAYPAL_CLIENT_ID + ":" + cfg.PAYPAL_SECRET).toString("base64");
    const r = await call(cfg.PAYPAL_API + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" }, "PayPal");
    if (!r.ok || !r.data.access_token) { console.error("PayPal a refuzat cheile:", r.status); throw httpError(502, REFUSED); }
    ppToken = { value: r.data.access_token, until: Date.now() + (Number(r.data.expires_in) || 300) * 1000 - 60000 };
  }
  return Object.assign({ Authorization: "Bearer " + ppToken.value, "Content-Type": "application/json" }, extra);
}
async function paypalStart(order, ctx) {
  const charge = paypalCharge(ctx.settings, order.total);
  if (!charge) throw httpError(400, REFUSED);
  const body = {
    intent: "CAPTURE",
    purchase_units: [{ custom_id: order.id, description: orderName(order, ctx.settings), amount: { currency_code: charge.currency, value: charge.amount.toFixed(2) } }],
    payment_source: { paypal: { experience_context: {
      return_url: ctx.base + "/?plata=" + order.id, cancel_url: ctx.base + "/?plata_anulata=" + order.id,
      user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", brand_name: ctx.settings.siteName.slice(0, 120)
    } } }
  };
  const r = await call(cfg.PAYPAL_API + "/v2/checkout/orders", { method: "POST", headers: await paypalHeaders({ "PayPal-Request-Id": "cq-" + order.id }), body: JSON.stringify(body) }, "PayPal");
  const link = (r.data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!r.ok || !r.data.id || !link) {
    console.error("PayPal a refuzat comanda " + order.id + ":", r.status, r.data.message || "");
    throw httpError(502, REFUSED);
  }
  people.patchOrder(order.id, { ref: r.data.id, charge });
  return { redirect: link.href };
}
// După ce clientul a aprobat plata în PayPal, banii se iau abia la „capture”.
async function paypalConfirm(order) {
  if (!order.ref || !order.charge) return false;
  const url = cfg.PAYPAL_API + "/v2/checkout/orders/" + encodeURIComponent(order.ref);
  let r = await call(url + "/capture", { method: "POST", headers: await paypalHeaders({ "PayPal-Request-Id": "cq-cap-" + order.id }), body: "{}" }, "PayPal");
  // Refuz la „capture”: fie a fost deja încasată, fie clientul nu a aprobat încă. Starea comenzii ne spune care.
  if (!r.ok) r = await call(url, { headers: await paypalHeaders() }, "PayPal");
  const unit = (r.data.purchase_units || [])[0];
  const cap = unit && unit.payments && (unit.payments.captures || [])[0];
  return r.ok && r.data.status === "COMPLETED" && !!cap && cap.status === "COMPLETED" &&
    cap.amount.currency_code === order.charge.currency && toBani(cap.amount.value) === toBani(order.charge.amount);
}

// ---- SMS
function smsInfo(order, settings) {
  const t = settings.pay.sms.tariffs[order.items[0].type];
  return { sms: { number: t.number, text: [t.keyword.toUpperCase(), order.sms].filter(Boolean).join(" "), cost: t.cost } };
}
// Agregatorul ne-a trimis un SMS primit. `params` sunt câmpurile lui, din adresă și din corpul cererii.
// Răspunsul este textul pe care agregatorul îl trimite înapoi clientului, tot prin SMS.
function smsHook(params, settings) {
  const pick = (names) => { for (const n of names) if (params[n] != null && params[n] !== "") return String(params[n]); return ""; };
  if (cfg.SMS_STATUS_PARAM && pick([cfg.SMS_STATUS_PARAM]) !== cfg.SMS_STATUS_OK) return { reply: "OK" };
  const text = pick(cfg.SMS_TEXT_PARAM ? [cfg.SMS_TEXT_PARAM] : ["message", "text", "msg", "body", "content", "sms"]);
  const number = pick(cfg.SMS_NUMBER_PARAM ? [cfg.SMS_NUMBER_PARAM] : ["shortcode", "short_code", "to", "number", "destination", "receiver"]).replace(/\D/g, "");
  const sms = settings.pay.sms;
  const order = people.findSmsOrder(text);
  const t = order && order.mode === "real" && sms.tariffs[order.items[0].type];
  if (!t || !t.on) return { reply: sms.replyBad };
  // Un SMS la un tarif mai mic nu are voie să deblocheze un produs mai scump: numărul scurt și cuvântul-cheie trebuie să fie ale tarifului.
  const numbers = new Set(Object.values(sms.tariffs).filter((x) => x.on).map((x) => x.number));
  if (number ? !number.endsWith(t.number) : numbers.size > 1) return { reply: sms.replyBad };
  if (t.keyword && !text.toUpperCase().split(/[^A-Z0-9]+/).includes(t.keyword.toUpperCase())) return { reply: sms.replyBad };
  return { reply: sms.reply, order: people.fulfill(order.id) };
}

// ---- Folosite de server
async function start(order, ctx) {
  if (order.method === "card") return stripeStart(order, ctx);
  if (order.method === "paypal") return paypalStart(order, ctx);
  throw httpError(400, "Metoda de plată aleasă nu este disponibilă.");
}
// Întreabă procesatorul dacă o comandă a fost plătită (la întoarcerea clientului pe site).
async function confirm(order, settings) {
  if (order.status === "paid") return true;
  if (order.mode !== "real") return false;
  if (order.method === "card") return stripeConfirm(order, settings);
  if (order.method === "paypal") return paypalConfirm(order);
  return false;
}
// Ce arată panoul despre fiecare metodă. Nu conține nicio cheie, doar dacă există.
function adminStatus(base) {
  return {
    card: { missing: missing("card"), live: /^(sk|rk)_live_/.test(cfg.STRIPE_SECRET_KEY), webhook: !!cfg.STRIPE_WEBHOOK_SECRET, hook: base + "/api/hook/stripe" },
    paypal: { missing: missing("paypal"), live: cfg.PAYPAL_ENV === "live", currency: cfg.PAYPAL_CURRENCY },
    sms: { missing: missing("sms"), ips: cfg.SMS_HOOK_IPS.length, hook: base + "/api/hook/sms/SECRETUL" },
    publicUrl: !!cfg.PUBLIC_URL
  };
}

module.exports = { missing, methodsFor, nextPath, start, confirm, stripeEvent, stripeHandle, smsInfo, smsHook, adminStatus };
