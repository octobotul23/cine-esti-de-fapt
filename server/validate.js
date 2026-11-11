// Verifică tot ce salvează panoul. Forma documentului e dată de valorile implicite:
// fiecare câmp trebuie să aibă același tip ca în content.js / tests.js. Câmpurile necunoscute se aruncă.
"use strict";

const MAX_TEXT = 3000;
const MAX_LIST = 400;
const ID_RE = /^[A-Za-z0-9_]{1,24}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

function clean(v, tpl, where, errs, inList) {
  const bad = (msg) => { errs.push("„" + where + "”: " + msg); return clone(tpl); };
  if (tpl === null) {
    if (v === null || v === undefined || v === "") return null;
    return typeof v === "string" && v.length <= 40 ? v : bad("trebuie să fie un text scurt sau gol.");
  }
  if (typeof tpl === "string") {
    if (typeof v !== "string") return bad("trebuie să fie text.");
    const s = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
    return s.length > MAX_TEXT ? bad("textul este prea lung (cel mult " + MAX_TEXT + " de caractere). Scurtați-l.") : s;
  }
  if (typeof tpl === "number") return typeof v === "number" && Number.isFinite(v) ? v : bad("trebuie să fie un număr.");
  if (typeof tpl === "boolean") return typeof v === "boolean" ? v : bad("trebuie să fie pornit sau oprit.");
  if (Array.isArray(tpl)) {
    if (!Array.isArray(v)) return bad("trebuie să fie o listă.");
    if (v.length > MAX_LIST) return bad("lista are prea multe rânduri (cel mult " + MAX_LIST + ").");
    const item = tpl.length ? tpl[0] : "";
    return v.map((x, i) => clean(x, item, where + " → rândul " + (i + 1), errs, true));
  }
  if (!isObj(v)) return bad("are o formă greșită. Reîncărcați pagina și încercați din nou.");
  const out = {};
  for (const k of Object.keys(tpl)) {
    if (v[k] === undefined) {
      if (inList && tpl[k] !== null) errs.push("„" + where + "”: lipsește câmpul „" + k + "”.");
      out[k] = clone(tpl[k]);
    } else out[k] = clean(v[k], tpl[k], where + " → " + k, errs, inList);
  }
  return out;
}

function unique(list, key, where, errs) {
  const seen = new Set();
  for (const x of list) {
    if (!ID_RE.test(x[key])) errs.push(where + ": codul „" + x[key] + "” poate conține doar litere fără diacritice, cifre și liniuță de subliniere (cel mult 24).");
    if (seen.has(x[key])) errs.push(where + ": codul „" + x[key] + "” apare de două ori. Fiecare rând are nevoie de un cod diferit.");
    seen.add(x[key]);
  }
  return seen;
}
function options(q, where, errs) {
  if (q.options.length < 2 || q.options.length > 6) errs.push(where + ": are nevoie de 2 până la 6 variante de răspuns.");
  if (q.options.some((o) => !o.trim())) errs.push(where + ": o variantă de răspuns este goală. Completați-o sau ștergeți-o.");
}
function range(v, lo, hi, where, errs) {
  if (!(v >= lo && v <= hi)) errs.push(where + ": trebuie să fie între " + lo + " și " + hi + ".");
}

// Primește ce a trimis panoul și valorile implicite. Întoarce documentul curățat sau lista de greșeli.
function validateDoc(input, defaults) {
  const errs = [];
  if (!isObj(input) || !isObj(input.site) || !isObj(input.tests)) return { errors: ["Datele trimise sunt incomplete. Reîncărcați pagina și încercați din nou."] };
  const site = clean(input.site, defaults.site, "Site", errs, false);
  const tests = clean(input.tests, defaults.tests, "Teste", errs, false);
  if (errs.length) return { errors: errs.slice(0, 12) };

  const s = site.settings;
  if (!s.siteName.trim()) errs.push("Setări: numele site-ului nu poate fi gol.");
  if (!s.currency.trim() || s.currency.length > 8) errs.push("Setări: moneda trebuie să aibă între 1 și 8 caractere (de exemplu „lei”).");
  if (!["test", "real", "oprit"].includes(s.payments)) errs.push("Setări: starea plăților poate fi doar „de probă”, „reale” sau „oprite”.");
  if (!/^[A-Z]{3}$/.test(s.currencyCode)) errs.push("Setări → Plăți: codul monedei are trei litere mari, de exemplu RON, EUR sau USD.");
  if (!(s.eurRate >= 0.01 && s.eurRate <= 100000)) errs.push("Setări → Plăți: cursul euro trebuie să fie un număr mai mare decât zero, de exemplu 5,1.");
  const payIds = ["card", "paypal", "sms"];
  const gotIds = s.pay.methods.map((m) => m.id);
  if (gotIds.length !== payIds.length || payIds.some((id) => !gotIds.includes(id))) errs.push("Setări → Plăți: lista trebuie să conțină cele trei metode (card, PayPal, SMS), fiecare o singură dată. O metodă se oprește din comutator, nu se șterge.");
  s.pay.methods.forEach((m) => { if (!m.name.trim()) errs.push("Setări → Plăți: metoda „" + m.id + "” nu are nume."); });
  for (const [k, t] of Object.entries(s.pay.sms.tariffs)) {
    const w = "Setări → Plăți → SMS pentru „" + ((s.products[k] || {}).name || k) + "”";
    if (!/^\d{0,8}$/.test(t.number)) errs.push(w + ": numărul scurt are doar cifre, cel mult 8 (de exemplu 7415).");
    if (!/^[A-Za-z0-9]{0,20}$/.test(t.keyword)) errs.push(w + ": cuvântul-cheie poate avea doar litere fără diacritice și cifre, fără spații (cel mult 20).");
    if (t.on && !t.number) errs.push(w + ": scrieți numărul scurt primit de la agregator sau opriți tariful.");
    if (t.on && !t.cost.trim()) errs.push(w + ": scrieți costul SMS-ului, cu TVA, așa cum îl vede clientul (de exemplu „5 EUR + TVA”).");
  }
  const usedSms = Object.values(s.pay.sms.tariffs).filter((t) => t.on).map((t) => t.number + " " + t.keyword.toUpperCase());
  if (new Set(usedSms).size !== usedSms.length) errs.push("Setări → Plăți → SMS: două tarife pornite au același număr și același cuvânt-cheie. Altfel un SMS ieftin ar debloca un produs scump.");
  if (s.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contactEmail)) errs.push("Setări: adresa de e-mail de contact nu este validă. Exemplu: contact@exemplu.ro");
  for (const [k, p] of Object.entries(s.products)) {
    if (!(p.price >= 0 && p.price <= 100000) || Math.round(p.price * 100) !== Math.round(p.price * 10000) / 100) errs.push("Prețuri → " + (p.name || k) + ": prețul trebuie să fie între 0 și 100.000, cu cel mult două zecimale.");
    if (!p.name.trim()) errs.push("Prețuri: numele produsului „" + k + "” nu poate fi gol.");
  }

  const ids = Object.keys(defaults.tests.modules);
  const listed = site.modules.map((m) => m.id);
  if (listed.length !== ids.length || ids.some((id) => !listed.includes(id))) errs.push("Teste: lista de teste trebuie să le conțină pe toate cele " + ids.length + ", o singură dată. Un test se ascunde din comutatorul „Se vede pe site”, nu se șterge.");
  site.modules.forEach((m) => { if (!m.name.trim()) errs.push("Teste: testul „" + m.id + "” nu are nume."); });

  if (tests.scale.length !== 5 || tests.scale.some((x) => !x.trim())) errs.push("Teste: scala de răspuns trebuie să aibă exact cinci trepte, toate completate.");
  range(tests.levels.low, 1, 99, "Teste → pragul pentru scor mic", errs);
  range(tests.levels.high, 1, 99, "Teste → pragul pentru scor mare", errs);
  if (tests.levels.low >= tests.levels.high) errs.push("Teste: pragul pentru scor mic trebuie să fie sub pragul pentru scor mare.");

  for (const id of ids) {
    const mod = tests.modules[id];
    const name = (site.modules.find((m) => m.id === id) || {}).name || id;
    const where = "Teste → " + name;
    if (mod.type !== defaults.tests.modules[id].type) { errs.push(where + ": tipul testului nu se poate schimba."); continue; }
    if (mod.type === "tarot") {
      const nums = mod.cards.map((c) => c.n).sort((a, b) => a - b);
      if (nums.length !== 22 || nums.some((n, i) => n !== i)) errs.push("Tarot: trebuie să rămână cele 22 de cărți, numerotate de la 0 la 21. Puteți schimba textele, dar nu numărul cărților.");
      if (mod.positions.length < 1 || mod.positions.length > 5) errs.push("Tarot: etalarea poate avea între 1 și 5 cărți.");
      mod.cards.forEach((c) => { if (!c.name.trim()) errs.push("Tarot: cartea cu numărul " + c.n + " nu are nume."); });
      continue;
    }
    if (!mod.questions.length) errs.push(where + ": are nevoie de cel puțin o întrebare.");
    if (!mod.questions.some((q) => q.free)) errs.push(where + ": cel puțin o întrebare trebuie să fie în varianta gratuită.");
    unique(mod.questions, "id", where + " → întrebări", errs);
    mod.questions.forEach((q, i) => { if (!q.text.trim()) errs.push(where + ": întrebarea " + (i + 1) + " nu are text."); });
    if (mod.type === "likert") {
      const dims = unique(mod.dims, "id", where + " → trăsături", errs);
      if (!mod.dims.length) errs.push(where + ": are nevoie de cel puțin o trăsătură.");
      mod.questions.forEach((q, i) => { if (!dims.has(q.dim)) errs.push(where + ": întrebarea " + (i + 1) + " ține de o trăsătură care nu există („" + q.dim + "”). Alegeți una din listă."); });
      mod.dims.forEach((d) => {
        if (!d.name.trim()) errs.push(where + ": trăsătura „" + d.id + "” nu are nume.");
        if (!mod.questions.some((q) => q.dim === d.id && q.free)) errs.push(where + ": trăsătura „" + (d.name || d.id) + "” nu are nicio întrebare în varianta gratuită. Bifați cel puțin una.");
      });
    } else {
      const areas = unique(mod.areas, "id", where + " → categorii", errs);
      mod.questions.forEach((q, i) => {
        const w = where + " → întrebarea " + (i + 1);
        options(q, w, errs);
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) errs.push(w + ": alegeți care variantă este răspunsul corect.");
        if (!areas.has(q.area)) errs.push(w + ": categoria „" + q.area + "” nu există. Alegeți una din listă.");
      });
      if (!mod.bands.length) errs.push(where + ": are nevoie de cel puțin un interval.");
      mod.bands.forEach((b, i) => {
        const w = where + " → intervalul " + (i + 1);
        range(b.min, 0, 100, w + " (procent)", errs);
        range(b.lo, 40, 200, w + " (de la)", errs);
        range(b.hi, 40, 200, w + " (până la)", errs);
        if (b.lo >= b.hi) errs.push(w + ": „de la” trebuie să fie mai mic decât „până la”.");
        if (i && b.min <= mod.bands[i - 1].min) errs.push(w + ": procentele trebuie să crească de la un rând la altul.");
      });
      if (mod.bands.length && mod.bands[0].min !== 0) errs.push(where + ": primul interval trebuie să pornească de la 0%.");
    }
  }

  const c = tests.couple;
  const cats = unique(c.cats, "id", "Test de cuplu → teme", errs);
  unique(c.questions, "id", "Test de cuplu → întrebări", errs);
  if (!c.questions.some((q) => q.free)) errs.push("Test de cuplu: cel puțin o întrebare trebuie să fie în varianta gratuită.");
  c.questions.forEach((q, i) => {
    const w = "Test de cuplu → întrebarea " + (i + 1);
    if (!q.text.trim()) errs.push(w + ": nu are text.");
    options(q, w, errs);
    if (!cats.has(q.cat)) errs.push(w + ": tema „" + q.cat + "” nu există. Alegeți una din listă.");
  });
  range(c.thresholds.low, 1, 99, "Test de cuplu → pragul de jos", errs);
  range(c.thresholds.high, 1, 99, "Test de cuplu → pragul de sus", errs);
  if (c.thresholds.low >= c.thresholds.high) errs.push("Test de cuplu: pragul de jos trebuie să fie sub pragul de sus.");

  const big = new Set(tests.modules.bigfive.dims.map((d) => d.id));
  tests.report.archetypes.forEach((a, i) => { if (!big.has(a.a) || !big.has(a.b) || a.a === a.b) errs.push("Raport → titlul " + (i + 1) + ": alegeți două trăsături diferite din testul de personalitate."); });

  return errs.length ? { errors: errs.slice(0, 12) } : { doc: { site, tests } };
}

module.exports = { validateDoc };
