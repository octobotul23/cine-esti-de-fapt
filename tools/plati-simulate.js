// Site-ul pornit cu procesatori de plăți SIMULAȚI, ca să puteți încerca plata cap-coadă fără niciun cont
// și fără niciun ban: pagina „Stripe”, pagina „PayPal” și trimiterea unui SMS sunt imitate pe acest calculator.
//
//   node tools/plati-simulate.js            → site-ul la http://localhost:5182, cu datele din data-test/
//
// Apoi, în panou (Setări → Plăți), alegeți „Reale” și porniți metodele pe care vreți să le încercați.
// NU se folosește pe site-ul public: cheile de aici sunt inventate și nu încasează nimic.
"use strict";
const http = require("node:http");
const crypto = require("node:crypto");
const path = require("node:path");

const SITE = 5182, STRIPE = 5187, PAYPAL = 5186;
const base = "http://localhost:" + SITE;
const WH = "whsec_simulat", SMS = "secret-simulat";
Object.assign(process.env, {
  PORT: String(SITE), HOST: "127.0.0.1", DATA_DIR: process.env.DATA_DIR || "data-test", PUBLIC_URL: base,
  STRIPE_SECRET_KEY: "sk_test_simulat", STRIPE_WEBHOOK_SECRET: WH, STRIPE_API: "http://127.0.0.1:" + STRIPE,
  PAYPAL_CLIENT_ID: "client-simulat", PAYPAL_SECRET: "secret-simulat", PAYPAL_ENV: "sandbox", PAYPAL_API: "http://127.0.0.1:" + PAYPAL,
  SMS_HOOK_SECRET: SMS
});
const { server } = require(path.join(__dirname, "..", "server", "server.js"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const readBody = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const go = (res, url) => { res.writeHead(302, { Location: url }); res.end(); };
function pageOf(res, title, body) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end('<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + "</title>" +
    "<style>body{font:17px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a}h1{font-size:1.4rem}.sim{background:#fff3cd;padding:.5rem .75rem;border-radius:8px;font-size:.9rem}" +
    "a.b,button{display:block;width:100%;box-sizing:border-box;margin:.6rem 0;padding:.8rem 1rem;border-radius:10px;border:1px solid #1a1a1a;background:#1a1a1a;color:#fff;text-align:center;text-decoration:none;font:inherit;cursor:pointer}" +
    "a.b.x{background:#fff;color:#1a1a1a}input{font:inherit;width:100%;box-sizing:border-box;padding:.6rem;margin:.25rem 0 .75rem}pre{background:#f2f2f2;padding:.75rem;border-radius:8px;white-space:pre-wrap}</style>" +
    '<p class="sim">Pagină simulată. Nu se ia niciun ban.</p><h1>' + esc(title) + "</h1>" + body + "</html>");
}

// ---- „Stripe”
const sessions = {};
http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const f = Object.fromEntries(new URLSearchParams(body));
    const id = "cs_test_sim" + (Object.keys(sessions).length + 1);
    sessions[id] = { id, payment_status: "unpaid", amount_total: Number(f["line_items[0][price_data][unit_amount]"]), currency: f["line_items[0][price_data][currency]"],
      client_reference_id: f.client_reference_id, metadata: { order: f["metadata[order]"] }, name: f["line_items[0][price_data][product_data][name]"], ok: f.success_url, cancel: f.cancel_url };
    return json(res, 200, { id, url: "http://127.0.0.1:" + STRIPE + "/pay/" + id });
  }
  let m = url.pathname.match(/^\/v1\/checkout\/sessions\/(\w+)$/);
  if (m && sessions[m[1]]) { const s = sessions[m[1]]; return json(res, 200, { id: s.id, payment_status: s.payment_status, amount_total: s.amount_total, currency: s.currency, client_reference_id: s.client_reference_id, metadata: s.metadata }); }
  m = url.pathname.match(/^\/pay\/(\w+)(?:\/(ok|ok-inchis|cancel))?$/);
  const s = m && sessions[m[1]];
  if (s && !m[2]) return pageOf(res, "Stripe (simulat)", "<p>" + esc(s.name) + "</p><p><b>" + (s.amount_total / 100).toFixed(2).replace(".", ",") + " " + esc(String(s.currency).toUpperCase()) + "</b></p>" +
    '<a class="b" href="/pay/' + s.id + '/ok">Plătește și întoarce-te pe site</a><a class="b x" href="/pay/' + s.id + '/ok-inchis">Plătește, dar închide pagina (vine doar webhook-ul)</a><a class="b x" href="/pay/' + s.id + '/cancel">Renunță</a>');
  if (s && m[2] === "cancel") return go(res, s.cancel);
  if (s) {
    s.payment_status = "paid";
    if (m[2] === "ok") return go(res, s.ok);
    // Clientul „a închis pagina”: site-ul află de plată doar din apelul semnat al procesatorului.
    const raw = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: s.id, payment_status: "paid", amount_total: s.amount_total, currency: s.currency, client_reference_id: s.client_reference_id, metadata: s.metadata } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac("sha256", WH).update(t + "." + raw).digest("hex");
    const r = await fetch(base + "/api/hook/stripe", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": "t=" + t + ",v1=" + sig }, body: raw });
    return pageOf(res, "Stripe (simulat)", "<p>Plata a fost făcută, iar clientul nu s-a mai întors. Site-ul a fost anunțat prin webhook (răspuns " + r.status + ").</p><a class=\"b\" href=\"" + esc(base) + "/#/eu\">Deschide site-ul și vezi dacă s-a deblocat</a>");
  }
  // „Telefonul”: trimite un SMS către site, așa cum ar face agregatorul.
  if (url.pathname === "/sms") {
    const number = url.searchParams.get("numar") || "", text = url.searchParams.get("text") || "";
    let out = "";
    if (number || text) {
      const r = await fetch(base + "/api/hook/sms/" + SMS + "?" + new URLSearchParams({ shortcode: number, message: text }));
      out = "<p>SMS-ul de răspuns primit pe telefon:</p><pre>" + esc(await r.text()) + "</pre>";
    }
    return pageOf(res, "Telefon (simulat)", '<form method="get" action="/sms"><label>Numărul scurt<input name="numar" inputmode="numeric" value="' + esc(number) + '"></label><label>Textul mesajului<input name="text" value="' + esc(text) + '"></label><button>Trimite SMS-ul</button></form>' + out);
  }
  json(res, 404, { error: { message: "nu există" } });
}).listen(STRIPE, "127.0.0.1");

// ---- „PayPal”
const pp = {};
http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/v1/oauth2/token") return json(res, 200, { access_token: "tok-simulat", expires_in: 3600 });
  if (req.method === "POST" && url.pathname === "/v2/checkout/orders") {
    const b = JSON.parse(body), id = "PPSIM" + (Object.keys(pp).length + 1), ctx = b.payment_source.paypal.experience_context;
    pp[id] = { id, amount: b.purchase_units[0].amount, name: b.purchase_units[0].description, ok: ctx.return_url, cancel: ctx.cancel_url, approved: false, captured: false };
    return json(res, 201, { id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "http://127.0.0.1:" + PAYPAL + "/approve/" + id }] });
  }
  let m = url.pathname.match(/^\/v2\/checkout\/orders\/(\w+)(\/capture)?$/);
  let o = m && pp[m[1]];
  if (o) {
    const done = () => ({ id: o.id, status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: o.amount }] } }] });
    if (!m[2]) return json(res, 200, o.captured ? done() : { id: o.id, status: o.approved ? "APPROVED" : "PAYER_ACTION_REQUIRED" });
    if (!o.approved || o.captured) return json(res, 422, { name: "UNPROCESSABLE_ENTITY" });
    o.captured = true;
    return json(res, 201, done());
  }
  m = url.pathname.match(/^\/approve\/(\w+)(?:\/(ok|cancel))?$/);
  o = m && pp[m[1]];
  if (o && !m[2]) return pageOf(res, "PayPal (simulat)", "<p>" + esc(o.name) + "</p><p><b>" + esc(o.amount.value.replace(".", ",")) + " " + esc(o.amount.currency_code) + "</b></p>" +
    '<a class="b" href="/approve/' + o.id + '/ok">Aprobă plata</a><a class="b x" href="/approve/' + o.id + '/cancel">Renunță</a>');
  if (o && m[2] === "ok") { o.approved = true; return go(res, o.ok); }
  if (o) return go(res, o.cancel);
  json(res, 404, {});
}).listen(PAYPAL, "127.0.0.1");

server.listen(SITE, "127.0.0.1", () => {
  console.log("Site cu plăți simulate: " + base);
  console.log("Panou: " + base + "/admin  (Setări → Plăți → „Reale”, apoi porniți metodele)");
  console.log("Telefon simulat pentru SMS: http://127.0.0.1:" + STRIPE + "/sms");
});
