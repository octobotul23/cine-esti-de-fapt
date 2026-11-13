// Probă a serverului pe un folder de date de test. Rulare: node tools/test-site.js  (folosește folderul data-smoke, pe care îl șterge la sfârșit)
const root = process.argv[2] || require("path").resolve(__dirname, "..");
process.env.DATA_DIR = "data-smoke"; process.env.PORT = "5199"; process.env.HOST = "127.0.0.1";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
fs.rmSync(path.join(root, "data-smoke"), { recursive: true, force: true });
const { server } = require(path.join(root, "server/server.js"));
const auth = require(path.join(root, "server/auth.js"));
const { TESTS } = require(path.join(root, "server/tests.js"));
const B = "http://127.0.0.1:5199";
const PW = crypto.randomBytes(12).toString("base64url"); // parolă de test, aleatoare, nu se afișează
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("  FAIL", m); } else console.log("  ok  ", m); };
async function call(method, url, body, headers = {}) {
  const h = { Origin: B, ...headers }; if (body !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, j, t, headers: r.headers };
}
(async () => {
  await new Promise((r) => server.listen(5199, "127.0.0.1", r));
  console.log("static");
  let r = await call("GET", "/"); ok(r.status === 404 || r.status === 200, "index " + r.status);
  r = await call("GET", "/../server/tests.js"); ok(r.status === 404, "nu servește server/");
  r = await call("GET", "/%2e%2e/server/tests.js"); ok(r.status === 404, "nu servește server/ (codat)");
  r = await call("GET", "/js/content.js"); ok(r.status === 200 && r.headers.get("content-security-policy").includes("script-src 'self'"), "content.js + CSP");
  r = await call("GET", "/api/site"); ok(r.j.meta.modules.bigfive.total === 50 && !r.t.includes("Îmi place să încerc activități"), "site fără întrebări");

  console.log("test rapid");
  ok(r.j.meta.quick.total === 10 && !r.t.includes("Spui lucrurilor pe nume"), "site: 10 întrebări rapide, fără textele de rezultat");
  r = await call("GET", "/api/quick"); const quick = r.j.questions;
  ok(quick.length === 10 && typeof quick[0].options[0] === "string" && !r.t.includes('"right"') && !r.t.includes("Spui lucrurilor pe nume"), "întrebări fără răspunsuri corecte și fără note");
  r = await call("POST", "/api/quick", { answers: { r01: 0 } }); ok(r.status === 400, "test rapid incomplet: " + (r.j && r.j.error));
  r = await call("POST", "/api/quick", { answers: Object.fromEntries(quick.map((q) => [q.id, 9])) }); ok(r.status === 400, "răspuns în afara variantelor refuzat");
  const qa = {}; TESTS.quick.questions.forEach((q) => { qa[q.id] = Math.max(0, q.options.findIndex((o) => o.right)); });
  r = await call("POST", "/api/quick", { answers: qa });
  ok(r.j.score.correct === 5 && r.j.score.total === 5 && r.j.score.title === TESTS.quick.levels.high.title && r.j.choices.length === 5 && r.j.review.length === 5, "rezultat rapid: " + r.j.score.correct + " / " + r.j.score.total);
  // Leadership și Relații au câte două voturi; la egalitate câștigă testul care apare primul pe site.
  ok(r.j.next.id === "leadership" && r.j.choices[0].note, "test recomandat: " + r.j.next.name);
  r = await call("POST", "/api/quick", { answers: Object.fromEntries(quick.map((q) => [q.id, 3])) }); ok(r.j.score.correct === 0 && r.j.score.title === TESTS.quick.levels.low.title && r.j.next.id === "emotional", "toate greșite → treapta de jos, recomandă " + r.j.next.name);

  console.log("profil + test");
  r = await call("POST", "/api/profile", {}); const P = { "X-Profile": r.j.token }; ok(r.j.token.length === 32, "token");
  r = await call("POST", "/api/profile", {}, { Origin: "http://evil.example" }); ok(r.status === 403, "altă origine refuzată");
  r = await call("GET", "/api/test/bigfive", undefined, P); ok(r.j.questions.length === 10 && !("dim" in r.j.questions[0]), "10 întrebări gratuite, fără chei");
  const ans = {}; r.j.questions.forEach((q) => ans[q.id] = 5);
  r = await call("POST", "/api/test/bigfive", { answers: ans }, P); ok(r.j.status === "partial", "status partial");
  r = await call("POST", "/api/test/bigfive", { answers: { bf11: 3 } }, P); r = await call("GET", "/api/test/bigfive", undefined, P); ok(!r.j.answers.bf11, "răspuns la întrebare plătită ignorat");
  r = await call("GET", "/api/result/bigfive", undefined, P); ok(r.j.dims.filter((d) => !d.locked).length === 1 && r.j.complete, "o singură trăsătură vizibilă");
  r = await call("GET", "/api/test/iq", undefined, P); ok(r.j.questions.length === 10 && !("correct" in r.j.questions[0]), "iq 10 fără răspuns corect");
  r = await call("GET", "/api/report", undefined, P); ok(r.status === 402, "raport blocat");
  r = await call("GET", "/api/tarot", undefined, P); ok(r.j.day.card.name && !r.j.day.card.sens && !r.j.unlocked, "cartea zilei, fără sens");
  r = await call("POST", "/api/tarot/personal", { name: "Ana", day: 15, month: 8, year: 1990 }, P); ok(r.status === 402, "carte personală blocată");

  console.log("admin");
  r = await call("POST", "/api/admin/login", { email: "test@test.ro", password: "x" }); ok(r.status === 401, "fără cont → 401");
  await auth.setPassword("test@test.ro", PW);
  r = await call("POST", "/api/admin/login", { email: "test@test.ro", password: PW });
  const cookie = r.headers.get("set-cookie").split(";")[0]; const A = { Cookie: cookie, "X-CSRF": r.j.csrf };
  ok(r.status === 200 && /HttpOnly; SameSite=Strict/.test(r.headers.get("set-cookie")), "login + cookie");
  r = await call("GET", "/api/admin/doc", undefined, { Cookie: cookie }); const doc = r.j.doc; ok(r.j.rev === 0 && doc.tests.modules.iq.questions[0].correct === 2, "doc complet");
  r = await call("GET", "/api/admin/doc"); ok(r.status === 401, "doc fără sesiune");
  r = await call("PUT", "/api/site", { rev: 0, doc }, { Cookie: cookie }); ok(r.status === 403, "fără CSRF");
  r = await call("PUT", "/api/site", { rev: 0, doc }, { ...A, Origin: "http://evil.example" }); ok(r.status === 403, "altă origine");
  doc.site.settings.products.modul.price = 19.99;
  r = await call("PUT", "/api/site", { rev: 0, doc }, A); ok(r.status === 200 && r.j.rev === 1, "salvare rev 1");
  r = await call("PUT", "/api/site", { rev: 0, doc }, A); ok(r.status === 409, "conflict de versiune");
  doc.site.settings.products.modul.price = -5;
  r = await call("PUT", "/api/site", { rev: 1, doc }, A); ok(r.status === 400, "preț negativ: " + (r.j && r.j.error));
  doc.site.settings.products.modul.price = 19.99; doc.tests.modules.iq.questions[0].correct = 9;
  r = await call("PUT", "/api/site", { rev: 1, doc }, A); ok(r.status === 400, "răspuns corect greșit: " + (r.j && r.j.error));
  doc.tests.modules.iq.questions[0].correct = 2; doc.tests.quick.questions[1].options[0].right = true;
  r = await call("PUT", "/api/site", { rev: 1, doc }, A); ok(r.status === 400 && /Test rapid/.test(r.j.error), "două răspunsuri corecte la testul rapid: " + (r.j && r.j.error));
  doc.tests.quick.questions[1].options[0].right = false; doc.tests.quick.questions[0].options[0].module = "nuexista";
  r = await call("PUT", "/api/site", { rev: 1, doc }, A); ok(r.status === 400 && /nu există/.test(r.j.error), "test recomandat inexistent: " + (r.j && r.j.error));
  doc.tests.quick.questions[0].options[0].module = "relations"; doc.site.quick.on = false; doc.site.extra = 1;
  r = await call("PUT", "/api/site", { rev: 1, doc }, A); ok(r.status === 200 && r.j.rev === 2 && !("extra" in r.j.doc.site), "salvare rev 2, câmp necunoscut aruncat");
  r = await call("GET", "/api/quick"); ok(r.status === 404, "test rapid oprit din panou → 404");
  r = await call("GET", "/api/admin/history", undefined, A); ok(r.j.versions.length === 1, "istoric: " + r.j.versions.length);
  r = await call("POST", "/api/admin/promos", { code: "tot100", type: "percent", percent: 100 }, A); ok(r.j.codes[0].code === "TOT100", "cod 100%");
  r = await call("POST", "/api/admin/promos", { type: "2plus1", max: 1 }, A); const c21 = r.j.codes[0].code; ok(r.j.codes.length === 2, "cod 2+1 generat " + c21);
  r = await call("POST", "/api/admin/promos", { code: "p150", type: "percent", percent: 150 }, A); ok(r.status === 400, "procent 150 refuzat");
  r = await call("POST", "/api/admin/promos", { code: "jum", type: "percent", percent: 50 }, A);

  console.log("plată");
  const items3 = [{ type: "modul", id: "bigfive" }, { type: "modul", id: "iq" }, { type: "modul", id: "tarot" }];
  r = await call("POST", "/api/pay/quote", { items: items3 }, P); ok(r.j.total === 59.97, "3 teste = " + r.j.total);
  r = await call("POST", "/api/pay/quote", { items: items3, code: c21 }, P); ok(r.j.total === 39.98 && r.j.discount === 19.99, "2+1 → " + r.j.total);
  r = await call("POST", "/api/pay/quote", { items: items3.slice(0, 2), code: c21 }, P); ok(r.j.discount === 0 && r.j.codeNote, "2+1 cu două teste: fără reducere");
  r = await call("POST", "/api/pay/quote", { items: items3, code: "JUM" }, P); ok(r.j.total === 29.99 || r.j.total === 29.98, "50% → " + r.j.total);
  r = await call("POST", "/api/pay/quote", { items: items3, code: "NUEXISTA" }, P); ok(r.status === 400, "cod inexistent");
  r = await call("POST", "/api/pay/start", { items: items3, code: c21 }, P); ok(r.j.paid === false && r.j.order, "comandă de test");
  r = await call("POST", "/api/pay/test", { order: r.j.order }, P); ok(r.j.paid, "plată de test");
  r = await call("POST", "/api/pay/quote", { items: [{ type: "modul", id: "emotional" }, { type: "modul", id: "dark" }, { type: "modul", id: "relations" }], code: c21 }, P); ok(r.status === 400, "2+1 folosit de numărul maxim de ori");
  r = await call("GET", "/api/test/bigfive", undefined, P); ok(r.j.questions.length === 50 && Object.keys(r.j.answers).length === 10, "după plată: 50 întrebări, 10 păstrate");
  const all = {}; r.j.questions.forEach((q) => all[q.id] = 4);
  r = await call("POST", "/api/test/bigfive", { answers: all }, P); ok(r.j.status === "done", "bigfive done");
  r = await call("GET", "/api/result/bigfive", undefined, P); ok(r.j.dims.every((d) => !d.locked && d.tip), "toate trăsăturile " + r.j.dims.map((d) => d.score).join(","));
  r = await call("GET", "/api/test/iq", undefined, P); const iq = {}; r.j.questions.forEach((q) => iq[q.id] = TESTS.modules.iq.questions.find((x) => x.id === q.id).correct);
  r = await call("POST", "/api/test/iq", { answers: iq }, P); r = await call("GET", "/api/result/iq", undefined, P); ok(r.j.correct === 60 && r.j.interval.hi === 135 && r.j.review.length === 60, "iq 60/60 → " + JSON.stringify(r.j.interval));
  r = await call("POST", "/api/tarot/personal", { name: "Ana", day: 15, month: 8, year: 1990 }, P); ok(r.j.personal.card.n === 6 && r.j.personal.card.personal, "carte personală: " + r.j.personal.card.name);
  r = await call("POST", "/api/tarot/personal", { name: "Ana", day: 31, month: 2, year: 1990 }, P); ok(r.status === 400, "31 februarie refuzat");
  r = await call("POST", "/api/tarot/spread", {}, P); const s1 = r.j.spread.cards.map((c) => c.card.n).join(); ok(r.j.spread.cards.length === 3 && new Set(s1.split(",")).size === 3, "etalare " + s1);
  r = await call("POST", "/api/tarot/spread", {}, P); ok(r.j.spread.cards.map((c) => c.card.n).join() === s1 && !r.j.spread.canRedraw, "aceeași etalare în aceeași zi");
  r = await call("POST", "/api/pay/start", { items: [{ type: "pachet" }], code: "TOT100" }, P); ok(r.j.paid === true, "pachet gratuit cu cod 100%");
  r = await call("GET", "/api/me", undefined, P); ok(r.j.hasReport && r.j.modules.emotional.unlocked, "pachet deblocat");
  r = await call("GET", "/api/report", undefined, P); ok(!r.j.empty && r.j.missing.length === 4 && r.j.challenge.length === 7 && r.j.iq.hi === 135, "raport: " + r.j.title + " / lipsesc " + r.j.missing.length);

  console.log("cuplu");
  r = await call("POST", "/api/profile", {}); const P2 = { "X-Profile": r.j.token };
  r = await call("POST", "/api/profile", {}); const P3 = { "X-Profile": r.j.token };
  r = await call("POST", "/api/couple", { name: "Radu", consent: true }, P2); const cid = r.j.id; ok(cid.length === 16, "cuplu creat");
  r = await call("POST", "/api/couple", { name: "<b>x</b>", consent: true }, P2); ok(r.status === 400, "nume cu HTML refuzat");
  r = await call("GET", "/api/couple/" + cid + "/questions", undefined, P2); ok(r.j.questions.length === 10, "10 întrebări cuplu");
  const ca = {}; r.j.questions.forEach((q, i) => ca[q.id] = { own: i % 4, guess: 0 });
  r = await call("POST", "/api/couple/" + cid + "/answers", { answers: ca }, P2); ok(r.j.stage === "invite", "stage invite");
  r = await call("GET", "/api/invite/" + cid, undefined, P3); ok(r.j.name === "Radu" && !r.j.full, "invitație");
  r = await call("GET", "/api/couple/" + cid, undefined, P3); ok(r.status === 404, "străin nu vede cuplul");
  r = await call("POST", "/api/couple/join", { id: cid, name: "Ioana", consent: true }, P3); ok(r.j.id === cid, "join");
  r = await call("POST", "/api/couple/join", { id: cid, name: "Altul", consent: true }, P); ok(r.status === 400, "al treilea refuzat");
  const cb = {}; Object.keys(ca).forEach((id, i) => cb[id] = { own: 0, guess: i % 4 });
  r = await call("POST", "/api/couple/" + cid + "/answers", { answers: cb }, P3); ok(r.j.stage === "teaser" && r.j.teaser.total === 10 && !r.j.report, "teaser " + JSON.stringify(r.j.teaser));
  r = await call("POST", "/api/pay/start", { items: [{ type: "cuplu", id: cid }] }, P3); r = await call("POST", "/api/pay/test", { order: r.j.order }, P3);
  r = await call("GET", "/api/couple/" + cid, undefined, P2); ok(r.j.stage === "report" && r.j.report.bKnows === 10 && r.j.report.aKnows === 10 && r.j.report.same === 3 && r.j.mine.total === 30, "raport cuplu pentru amândoi: " + r.j.report.level.title);
  r = await call("POST", "/api/email", { email: "a@b.ro", consent: true }, P2); ok(r.j.email === "a@b.ro", "email salvat");
  r = await call("GET", "/api/admin/stats", undefined, A); ok(r.j.orders === 3 && r.j.emails === 1 && r.j.couples === 1, "statistici " + JSON.stringify({ o: r.j.orders, rev: r.j.revenue }));
  r = await call("DELETE", "/api/profile", undefined, P2); r = await call("GET", "/api/me", undefined, P2); ok(r.j.exists === false, "profil șters");
  r = await call("GET", "/api/me", undefined, P3); ok(r.j.couples.length === 0, "cuplul a dispărut și la partener");

  console.log("blocare + restaurare");
  r = await call("POST", "/api/admin/restore", { id: "implicit" }, A); ok(r.j.doc.site.settings.products.modul.price === 24.99, "restaurare la implicit");
  for (let i = 0; i < 5; i++) r = await call("POST", "/api/admin/login", { email: "test@test.ro", password: "gresit-gresit" });
  ok(r.status === 401 && /minute/.test(r.j.error), "a 5-a greșeală: " + r.j.error);
  r = await call("POST", "/api/admin/login", { email: "test@test.ro", password: PW }); ok(r.status === 429, "blocat chiar cu parola bună");
  const u = JSON.parse(fs.readFileSync(path.join(root, "data-smoke/users.json"), "utf8")).users[0]; ok(u.hash.length === 128 && u.salt.length === 32 && !JSON.stringify(u).includes(PW), "parola stocată doar ca hash");
  r = await call("GET", "/api/admin/audit", undefined, A); ok(r.j.lines.some((l) => l.event === "salvare") && r.j.lines.some((l) => l.event === "autentificare-esuata"), "jurnal " + r.j.lines.length + " rânduri");
  console.log(fails ? "\n" + fails + " PROBLEME" : "\nTOATE AU TRECUT");
  fs.rmSync(path.join(root, "data-smoke"), { recursive: true, force: true });
  server.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
