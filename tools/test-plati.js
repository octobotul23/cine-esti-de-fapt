// Probă a plăților reale cu procesatori simulați pe acest calculator (niciun apel nu iese în internet).
// Rulare: node tools/test-plati.js
const root = process.argv[2] || require("path").resolve(__dirname, "..");
const fs = require("fs"), path = require("path"), crypto = require("crypto"), http = require("http");
const rnd = () => crypto.randomBytes(12).toString("base64url");
const WH = "whsec_" + rnd(), SMS = rnd(), SK = "sk_test_" + rnd(), PPS = rnd(); // valori de probă, aleatoare
Object.assign(process.env, {
  DATA_DIR: "data-smoke-pay", PORT: "5198", HOST: "127.0.0.1", PUBLIC_URL: "http://127.0.0.1:5198",
  STRIPE_SECRET_KEY: SK, STRIPE_WEBHOOK_SECRET: WH, STRIPE_API: "http://127.0.0.1:5197",
  PAYPAL_CLIENT_ID: "client-simulat", PAYPAL_SECRET: PPS, PAYPAL_API: "http://127.0.0.1:5196", SMS_HOOK_SECRET: SMS
});
fs.rmSync(path.join(root, "data-smoke-pay"), { recursive: true, force: true });
const { server } = require(path.join(root, "server/server.js"));
const auth = require(path.join(root, "server/auth.js"));
const B = "http://127.0.0.1:5198";
const PW = rnd();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("  FAIL", m); } else console.log("  ok  ", m); };
async function call(method, url, body, headers = {}) {
  const h = { Origin: B, ...headers }; if (body !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, j, t, headers: r.headers };
}
const readBody = (req) => new Promise((res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => res(b)); });

// ---- Stripe simulat
const sessions = {}; let stripeCalls = 0;
const stripe = http.createServer(async (req, res) => {
  const body = await readBody(req); stripeCalls++;
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.headers.authorization !== "Bearer " + SK) return send(401, { error: { message: "cheie greșită" } });
  if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
    const f = Object.fromEntries(new URLSearchParams(body));
    const id = "cs_test_" + Object.keys(sessions).length;
    sessions[id] = { id, form: f, payment_status: "unpaid", amount_total: Number(f["line_items[0][price_data][unit_amount]"]), currency: f["line_items[0][price_data][currency]"], client_reference_id: f.client_reference_id, metadata: { order: f["metadata[order]"] } };
    return send(200, { id, url: "http://127.0.0.1:5197/pay/" + id });
  }
  const m = req.url.match(/^\/v1\/checkout\/sessions\/(\w+)$/);
  if (req.method === "GET" && m && sessions[m[1]]) return send(200, sessions[m[1]]);
  send(404, { error: { message: "nu există" } });
});
// ---- PayPal simulat
const pp = {}; let ppTokens = 0;
const paypal = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.url === "/v1/oauth2/token") {
    if (req.headers.authorization !== "Basic " + Buffer.from("client-simulat:" + PPS).toString("base64")) return send(401, {});
    ppTokens++; return send(200, { access_token: "tok", expires_in: 3600 });
  }
  if (req.headers.authorization !== "Bearer tok") return send(401, {});
  if (req.method === "POST" && req.url === "/v2/checkout/orders") {
    const b = JSON.parse(body); const id = "PP" + Object.keys(pp).length;
    pp[id] = { id, body: b, approved: false, captured: false, amount: b.purchase_units[0].amount };
    return send(201, { id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "self", href: "x" }, { rel: "payer-action", href: "http://127.0.0.1:5196/approve/" + id }] });
  }
  const m = req.url.match(/^\/v2\/checkout\/orders\/(\w+)(\/capture)?$/);
  const o = m && pp[m[1]];
  if (!o) return send(404, {});
  const done = () => ({ id: o.id, status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: o.amount }] } }] });
  if (m[2]) {
    if (!o.approved) return send(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED" }] });
    if (o.captured) return send(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] });
    o.captured = true; return send(201, done());
  }
  send(200, o.captured ? done() : { id: o.id, status: o.approved ? "APPROVED" : "PAYER_ACTION_REQUIRED" });
});
const hook = (event, opt = {}) => {
  const raw = JSON.stringify(event), t = opt.t || Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", opt.secret || WH).update(t + "." + raw).digest("hex");
  return fetch(B + "/api/hook/stripe", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": "t=" + t + ",v1=" + sig }, body: raw });
};

(async () => {
  await Promise.all([[server, 5198], [stripe, 5197], [paypal, 5196]].map(([s, p]) => new Promise((r) => s.listen(p, "127.0.0.1", r))));
  const profile = async () => ({ "X-Profile": (await call("POST", "/api/profile", {})).j.token });
  const unlocked = async (P, id) => { const m = (await call("GET", "/api/me", undefined, P)).j; return id === "pachet" ? m.paid.pachet : !!(m.modules[id] && m.modules[id].unlocked); };
  const one = [{ type: "modul", id: "bigfive" }], two = [{ type: "modul", id: "bigfive" }, { type: "modul", id: "iq" }];

  console.log("panou");
  await auth.setPassword("test@test.ro", PW);
  let r = await call("POST", "/api/admin/login", { email: "test@test.ro", password: PW });
  const A = { Cookie: r.headers.get("set-cookie").split(";")[0], "X-CSRF": r.j.csrf };
  r = await call("GET", "/api/admin/doc", undefined, A); const doc = r.j.doc; let rev = r.j.rev; const s = doc.site.settings;
  const save = async () => { const x = await call("PUT", "/api/site", { rev, doc }, A); if (x.status === 200) rev = x.j.rev; return x; };
  ok(s.payments === "test" && s.pay.methods.map((m) => m.id).join() === "card,paypal,sms", "valori implicite: de probă, 3 metode");
  s.payments = "altceva"; r = await save(); ok(r.status === 400, "stare necunoscută refuzată");
  s.payments = "real"; s.currencyCode = "lei"; r = await save(); ok(r.status === 400, "cod de monedă greșit refuzat");
  s.currencyCode = "RON"; const keep = s.pay.methods; s.pay.methods = keep.slice(0, 2); r = await save(); ok(r.status === 400, "metodă ștearsă refuzată");
  s.pay.methods = keep; keep[1].on = true; keep[2].on = true;
  const T = s.pay.sms.tariffs;
  Object.assign(T.modul, { on: true, number: "74x5", keyword: "CINE", cost: "5 EUR + TVA" }); r = await save(); ok(r.status === 400, "număr scurt cu litere refuzat");
  T.modul.number = "7415"; Object.assign(T.pachet, { on: true, number: "7415", keyword: "cine", cost: "" }); r = await save(); ok(r.status === 400 && r.j.errors.length >= 2, "tarif fără cost + tarife identice refuzate (" + (r.j.errors || []).length + " erori)");
  Object.assign(T.pachet, { number: "7499", cost: "10 EUR + TVA" }); r = await save(); ok(r.status === 200, "setări de plată salvate");
  r = await call("GET", "/api/admin/pay", undefined, A);
  ok(r.status === 200 && !r.j.card.missing.length && r.j.card.webhook && !r.j.card.live && r.j.card.hook === B + "/api/hook/stripe" && ![SK, WH, SMS, PPS].some((x) => r.t.includes(x)), "starea metodelor, fără nicio cheie în răspuns");
  r = await call("GET", "/api/admin/pay"); ok(r.status === 401, "starea metodelor cere sesiune");
  r = await call("GET", "/api/site"); ok(![SK, WH, SMS, PPS].some((x) => r.t.includes(x)), "nicio cheie în datele publice");

  console.log("metode");
  const P = await profile();
  r = await call("POST", "/api/pay/quote", { items: one }, P); const price = r.j.total;
  ok(r.j.methods.map((m) => m.id).join() === "card,paypal,sms" && r.j.methods[2].detail === "5 EUR + TVA" && r.j.methods[1].detail === (price / s.eurRate).toFixed(2).replace(".", ",") + " EUR", "un produs: card, PayPal (" + r.j.methods[1].detail + "), SMS");
  r = await call("POST", "/api/pay/quote", { items: two }, P); ok(r.j.methods.map((m) => m.id).join() === "card,paypal", "două produse: fără SMS");
  r = await call("POST", "/api/pay/start", { items: one }, P); ok(r.status === 400, "fără metodă: " + r.j.error);
  r = await call("POST", "/api/pay/start", { items: one, method: "bitcoin" }, P); ok(r.status === 400, "metodă necunoscută refuzată");
  r = await call("POST", "/api/pay/start", { items: two, method: "sms" }, P); ok(r.status === 400, "SMS pentru două produse refuzat");

  console.log("card (Stripe)");
  r = await call("POST", "/api/pay/start", { items: two, method: "card" }, P); const o1 = r.j.order; const s1 = Object.values(sessions)[0];
  ok(r.j.redirect === "http://127.0.0.1:5197/pay/" + s1.id && !r.j.paid, "pornire → pagina Stripe");
  ok(s1.amount_total === Math.round(r.j.total * 100) && s1.currency === "ron" && s1.form.mode === "payment" && s1.form.success_url === B + "/?plata=" + o1 && !("payment_method_types[0]" in s1.form), "Stripe a primit suma în bani, moneda, adresa de întoarcere");
  r = await call("POST", "/api/pay/test", { order: o1 }, P); ok(r.status === 400, "comandă reală nu se poate „plăti” de probă");
  r = await call("POST", "/api/pay/confirm", { order: o1 }, P); ok(r.j.paid === false && !(await unlocked(P, "iq")), "neplătit la Stripe → rămâne blocat");
  const X = await profile();
  r = await call("POST", "/api/pay/confirm", { order: o1 }, X); ok(r.status === 404, "alt vizitator nu poate confirma comanda");
  s1.payment_status = "paid"; s1.amount_total -= 100;
  r = await call("POST", "/api/pay/confirm", { order: o1 }, P); ok(r.j.paid === false, "sumă diferită la Stripe → refuzat");
  s1.amount_total += 100;
  r = await call("POST", "/api/pay/confirm", { order: o1 }, P); ok(r.j.paid === true && r.j.next === "/eu" && (await unlocked(P, "iq")) && (await unlocked(P, "bigfive")), "plătit → deblocat");
  const n = stripeCalls; r = await call("POST", "/api/pay/confirm", { order: o1 }, P); ok(r.j.paid && stripeCalls === n, "a doua confirmare nu mai întreabă Stripe");

  console.log("card (webhook)");
  const P2 = await profile();
  r = await call("POST", "/api/pay/start", { items: [{ type: "pachet" }], method: "card" }, P2); const o2 = r.j.order; const s2 = Object.values(sessions)[1];
  const ev = (over) => ({ type: "checkout.session.completed", data: { object: Object.assign({}, s2, { payment_status: "paid" }, over) } });
  let w = await hook(ev(), { secret: "whsec_altul" }); ok(w.status === 400 && !(await unlocked(P2, "pachet")), "semnătură greșită → 400");
  w = await hook(ev(), { t: Math.floor(Date.now() / 1000) - 3600 }); ok(w.status === 400, "semnătură veche → 400");
  w = await fetch(B + "/api/hook/stripe", { method: "POST", body: "{}" }); ok(w.status === 400, "fără semnătură → 400");
  w = await hook(ev({ amount_total: 100 })); ok(w.status === 200 && !(await unlocked(P2, "pachet")), "sumă greșită în eveniment → ignorat");
  w = await hook(ev({ payment_status: "unpaid" })); ok(w.status === 200 && !(await unlocked(P2, "pachet")), "eveniment neplătit → ignorat");
  w = await hook({ type: "charge.refunded", data: { object: {} } }); ok(w.status === 200, "alt tip de eveniment → primit, ignorat");
  w = await hook(ev()); ok(w.status === 200 && (await unlocked(P2, "pachet")), "eveniment bun → deblocat fără ca clientul să revină");
  r = await call("GET", "/api/pay/status?order=" + o2, undefined, P2); ok(r.j.paid === true, "starea comenzii: plătită");
  w = await hook(ev()); ok(w.status === 200, "același eveniment de două ori → fără eroare");

  console.log("PayPal");
  const P3 = await profile();
  r = await call("POST", "/api/pay/start", { items: one, method: "paypal" }, P3); const o3 = r.j.order; const p0 = pp.PP0;
  ok(r.j.redirect === "http://127.0.0.1:5196/approve/PP0", "pornire → pagina PayPal");
  ok(p0.amount.currency_code === "EUR" && p0.amount.value === (price / s.eurRate).toFixed(2) && p0.body.intent === "CAPTURE" && p0.body.payment_source.paypal.experience_context.return_url === B + "/?plata=" + o3, "PayPal a primit suma în euro: " + p0.amount.value);
  r = await call("POST", "/api/pay/confirm", { order: o3 }, P3); ok(r.j.paid === false && !(await unlocked(P3, "bigfive")), "neaprobat în PayPal → rămâne blocat");
  p0.approved = true;
  r = await call("POST", "/api/pay/confirm", { order: o3 }, P3); ok(r.j.paid === true && p0.captured && (await unlocked(P3, "bigfive")), "aprobat → încasat și deblocat");
  const P4 = await profile();
  r = await call("POST", "/api/pay/start", { items: one, method: "paypal" }, P4); pp.PP1.approved = true; pp.PP1.amount = { currency_code: "EUR", value: "0.01" };
  r = await call("POST", "/api/pay/confirm", { order: r.j.order }, P4); ok(r.j.paid === false && !(await unlocked(P4, "bigfive")), "sumă încasată diferită → refuzat");
  ok(ppTokens === 1, "tokenul PayPal este refolosit");

  console.log("SMS");
  const P5 = await profile();
  r = await call("POST", "/api/pay/start", { items: one, method: "sms" }, P5); const o5 = r.j.order, sms = r.j.sms;
  ok(sms && sms.number === "7415" && /^CINE [A-Z2-9]{6}$/.test(sms.text) && sms.cost === "5 EUR + TVA" && !r.j.redirect, "pornire → instrucțiuni: „" + (sms && sms.text.replace(/\w{6}$/, "······")) + "” la " + (sms && sms.number));
  const code = sms.text.split(" ")[1];
  const hit = async (q, secret) => { const x = await fetch(B + "/api/hook/sms/" + (secret || SMS) + "?" + new URLSearchParams(q)); return { status: x.status, t: await x.text() }; };
  const good = s.pay.sms.reply, bad = s.pay.sms.replyBad;
  w = await hit({ message: sms.text, shortcode: "7415" }, "secret-gresit"); ok(w.status === 404, "secret greșit în adresă → 404");
  w = await hit({ message: "CINE ZZZZZZ", shortcode: "7415" }); ok(w.status === 200 && w.t === bad, "cod necunoscut → răspuns de eroare");
  w = await hit({ message: sms.text, shortcode: "7499" }); ok(w.t === bad, "cod bun la alt număr scurt → refuzat");
  w = await hit({ message: sms.text }); ok(w.t === bad, "fără număr scurt, când sunt două tarife → refuzat");
  w = await hit({ message: code, shortcode: "7415" }); ok(w.t === bad, "fără cuvântul-cheie → refuzat");
  r = await call("GET", "/api/pay/status?order=" + o5, undefined, P5); ok(r.j.paid === false && !(await unlocked(P5, "bigfive")), "după încercările greșite: tot blocat");
  r = await call("GET", "/api/pay/status?order=" + o5, undefined, X); ok(r.status === 404, "alt vizitator nu vede starea comenzii");
  w = await hit({ message: "  cine  " + code.toLowerCase() + " ", shortcode: "407415" }); ok(w.t === good, "SMS bun (litere mici, spații) → răspuns de succes");
  r = await call("GET", "/api/pay/status?order=" + o5, undefined, P5); ok(r.j.paid === true && (await unlocked(P5, "bigfive")), "deblocat prin SMS");
  const P6 = await profile();
  r = await call("POST", "/api/pay/start", { items: [{ type: "pachet" }], method: "sms" }, P6);
  ok(r.j.sms.number === "7499", "pachetul are alt număr scurt");
  w = await fetch(B + "/api/hook/sms/" + SMS, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ text: r.j.sms.text, to: "7499" }).toString() });
  ok((await w.text()) === good && (await unlocked(P6, "pachet")), "SMS trimis ca formular POST → deblocat");

  console.log("comenzi + stări");
  r = await call("GET", "/api/admin/stats", undefined, A);
  ok(r.j.orders === 5 && r.j.recent.map((o) => o.method).sort().join() === "card,card,paypal,sms,sms" && r.j.revenue > 0, "panou: 5 comenzi plătite, cu metoda fiecăreia, încasări " + r.j.revenue);
  s.payments = "oprit"; await save();
  r = await call("POST", "/api/pay/quote", { items: one }, X); ok(r.j.methods.length === 0, "plăți oprite: nicio metodă");
  r = await call("POST", "/api/pay/start", { items: one, method: "card" }, X); ok(r.status === 400, "plăți oprite: " + r.j.error);
  s.payments = "test"; await save();
  r = await call("POST", "/api/pay/start", { items: one, method: "card" }, X); ok(r.j.paid === false && !r.j.redirect && r.j.mode === "test", "de probă: cardul nu duce la Stripe");
  r = await call("POST", "/api/pay/test", { order: r.j.order }, X); ok(r.j.paid && (await unlocked(X, "bigfive")), "de probă: deblocat fără plată");
  const X2 = await profile();
  r = await call("POST", "/api/pay/start", { items: one, method: "sms" }, X2);
  w = await hit({ message: r.j.sms.text, shortcode: "7415" }); ok(w.t === bad && !(await unlocked(X2, "bigfive")), "comandă de probă nu se deblochează cu SMS real");

  console.log(fails ? "\n" + fails + " PROBLEME" : "\nTOATE AU TRECUT");
  fs.rmSync(path.join(root, "data-smoke-pay"), { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
