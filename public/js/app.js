// Site-ul public. Fără biblioteci externe. Toate textele vin din content.js (plus ce s-a salvat din panou)
// și ajung în pagină doar ca text simplu: nimic nu se pune cu innerHTML.
(function () {
  "use strict";
  const C = window.CUPIDON;
  let S = C.SITE;          // conținutul site-ului (valorile implicite, până răspunde serverul)
  let META = null;         // câte întrebări are fiecare test
  let online = false;
  const TOKEN_KEY = "cq_profil";
  // Adresa paginii, fără „#…”. Linkurile trimise altora pornesc de aici, ca să meargă și când site-ul stă într-un subfolder (de ex. în demo).
  const BASE = location.origin + location.pathname.replace(/[^/]*$/, "");
  const ADMIN_URL = window.CUPIDON_DEMO ? "admin.html" : "/admin";
  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* fără stocare locală */ }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const view = $("#view"), home = $("#home");

  // ---- Unelte mici
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "disabled" || k === "checked" || k === "hidden" || k === "required" || k === "value") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(3)) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  // Iconițele sunt desenate o singură dată în index.html (<symbol id="i-…">); aici doar le chemăm.
  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg"), use = document.createElementNS(NS, "use");
    svg.setAttribute("class", "ico");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#i-" + (document.getElementById("i-" + name) ? name : "any"));
    svg.append(use);
    return svg;
  }
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  // Pune valorile în locul {numelor}. După un număr de la 20 în sus adaugă singur „de” („50 de întrebări”).
  const NO_DE = /^(de|din|la|și|sau|pe|în|cu|până|gratuite|gratis|rămase|corecte|greșite)$/;
  const fmt = (text, vars) => String(text).replace(/\{(\w+)\}( ?)([a-zăâîșț]*)/g, (m, k, sp, word) => {
    if (!vars || vars[k] == null) return m;
    const v = vars[k];
    const de = typeof v === "number" && sp && word.length > 2 && !NO_DE.test(word) && v >= 20 && (v % 100 === 0 || v % 100 >= 20);
    return v + (de ? " de" : "") + sp + word;
  });
  const money = (n) => Number(n).toFixed(2).replace(".", ",") + " " + S.settings.currency;
  const product = (k) => S.settings.products[k];
  const setToken = (t) => { token = t; try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* fără stocare locală */ } };

  let toastTimer = 0;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  async function api(method, path, body) {
    const headers = {};
    if (token) headers["X-Profile"] = token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try { res = await fetch("/api/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error(S.ui.errorServer); }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && token) setToken(null);
      const err = new Error((data && data.error) || S.ui.errorServer);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  async function ensureProfile() {
    if (!online) throw new Error(S.ui.noServer);
    if (!token) setToken((await api("POST", "profile", {})).token);
  }
  async function getMe() {
    if (!token || !online) return { exists: false, modules: {}, couples: [], paid: { pachet: false, modules: {} } };
    const me = await api("GET", "me");
    if (!me.exists) { setToken(null); return { exists: false, modules: {}, couples: [], paid: { pachet: false, modules: {} } }; }
    return me;
  }
  async function copyText(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done || S.ui.copied); }
    catch (e) { window.prompt(S.profil.copy, text); }
  }

  // ---- Navigare
  let seq = 0;
  const go = (path) => { if (location.hash === "#" + path) route(); else location.hash = path; };
  const page = (world, ...kids) => ({ world, node: h("div", { class: "page" }, kids) });
  const head = (title, lead, back) => h("div", { class: "page-head" }, back ? h("a", { class: "back", href: "#" + back }, S.ui.back) : null, h("h1", null, title), lead ? h("p", { class: "lead" }, lead) : null);
  const stateBox = (text, ...kids) => h("div", { class: "state" }, h("p", null, text), kids);
  const btn = (label, href, cls) => h("a", { class: "btn " + (cls || ""), href: "#" + href }, label);
  // Buton cu prețul alături, ca element separat (nu lipit de text).
  const priceBtn = (label, price, href, cls) => h("a", { class: "btn " + (cls || ""), href: "#" + href }, label, h("span", { class: "btn-price" }, money(price)));

  function mount(world, node) {
    document.body.dataset.world = world;
    home.hidden = true;
    view.hidden = false;
    view.replaceChildren(node);
    window.scrollTo(0, 0);
  }
  const routes = [
    [/^\/eu$/, viewEu], [/^\/rapid$/, viewQuick], [/^\/rapid\/rezultat$/, viewQuickResult], [/^\/test\/([\w-]+)$/, viewTest], [/^\/rezultat\/([\w-]+)$/, viewResult], [/^\/tarot$/, viewTarot], [/^\/raport$/, viewReport],
    [/^\/noi$/, viewNoi], [/^\/noi\/([\w-]{16})$/, viewCouple], [/^\/noi\/([\w-]{16})\/test$/, viewCoupleTest], [/^\/invitatie\/([\w-]{16})$/, viewInvite],
    [/^\/plata\/gata\/([\w-]{16})$/, viewPaid], [/^\/plata(?:\/(modul|pachet|cuplu)(?:\/([\w-]+))?)?$/, viewPay], [/^\/profil$/, viewProfile], [/^\/p\/([\w-]{32})$/, adoptToken],
    [/^\/confidentialitate$/, () => viewLegal("privacy")], [/^\/termeni$/, () => viewLegal("terms")]
  ];
  // Arată în meniul de sus pe ce pagină ești.
  function markNav(path) {
    const where = path === "/" || path === "/preturi" || path === "/tarot" ? path
      : /^\/(eu|rapid|test|rezultat|raport)\b/.test(path) ? "/eu" : /^\/(noi|invitatie)\b/.test(path) ? "/noi" : "";
    for (const a of document.querySelectorAll(".nav a")) {
      if (a.getAttribute("href") === "#" + where) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
  }
  async function route() {
    const my = ++seq;
    const path = location.hash.replace(/^#/, "") || "/";
    markNav(path);
    // „Prețuri” din meniu e tot prima pagină, derulată la carduri.
    if (path === "/" || path === "/preturi") {
      document.body.dataset.world = "eu";
      view.hidden = true;
      view.replaceChildren();
      home.hidden = false;
      if (path === "/preturi") $("#preturi").scrollIntoView(); else window.scrollTo(0, 0);
      return;
    }
    let hit = null, args = [];
    for (const [re, fn] of routes) { const m = path.match(re); if (m) { hit = fn; args = m.slice(1); break; } }
    if (!hit) return mount("eu", stateBox(S.ui.notFound, btn(S.ui.home, "/")));
    if (view.hidden) mount(document.body.dataset.world, stateBox(S.ui.loading));
    try {
      const out = await hit(...args);
      if (my === seq && out) mount(out.world, out.node);
    } catch (e) {
      if (my === seq) mount(document.body.dataset.world, stateBox(e.message || S.ui.errorServer, h("button", { class: "btn btn-line", type: "button", onclick: route }, S.ui.retry), btn(S.ui.home, "/", "btn-line")));
    }
  }

  // ---- Prima pagină
  function fillTexts() {
    for (const el of document.querySelectorAll("[data-edit], [data-text]")) {
      const v = get(S, el.dataset.edit || el.dataset.text);
      if (typeof v === "string") el.textContent = v;
    }
    document.title = S.settings.seoTitle;
    const d = $('meta[name="description"]');
    if (d) d.setAttribute("content", S.settings.seoDescription);
  }
  const counts = (id) => {
    const m = META && META.modules[id];
    if (!m) return "";
    return fmt(m.type === "tarot" ? S.ui.cards : S.ui.questions, { n: m.type === "tarot" ? m.cards : m.total });
  };
  // Rândul testului rapid, pus înaintea celorlalte teste. Lipsește când testul e oprit din panou.
  const quickRow = (meta) => (S.quick.on ? h("li", null, h("a", { class: "row", href: "#/rapid" },
    h("span", { class: "row-name" }, S.quick.name), h("span", { class: "row-sub" }, S.quick.tagline), h("span", { class: "row-meta" }, meta))) : null);
  const quickCount = () => (META && META.quick ? fmt(S.ui.questions, { n: META.quick.total }) : "");
  function renderHome() {
    fillTexts();
    const mods = S.modules.filter((m) => m.on);
    const hasTarot = mods.some((m) => m.id === "tarot");
    $("#nav-tarot").hidden = !hasTarot;
    $("#way-tarot").hidden = !hasTarot;
    $("#hero-rapid").hidden = !S.quick.on;
    // Rândul de iconițe: câte una pentru fiecare test pornit, plus testul de cuplu.
    $("#home-topics").replaceChildren(
      ...mods.map((m) => h("li", null, h("a", { href: m.id === "tarot" ? "#/tarot" : "#/test/" + m.id }, icon(m.id), h("span", null, m.name)))),
      h("li", null, h("a", { href: "#/noi" }, icon("cuplu"), h("span", null, S.home.topicCuplu))));
    // Cardurile de preț: numele, suma și descrierea din Prețuri, bifele din Texte.
    for (const el of document.querySelectorAll("[data-plan]")) {
      const k = el.dataset.plan, p = product(k);
      el.hidden = !p.on;
      $(".plan-name", el).textContent = p.name;
      $(".plan-price", el).replaceChildren(Number(p.price).toFixed(2).replace(".", ","), h("small", null, S.settings.currency));
      $(".plan-desc", el).textContent = p.desc;
      const own = (S.home[k + "Puncte"] || []).map((x) => x.text).filter(Boolean);
      const lines = k === "pachet" ? mods.map((m) => m.name).concat(own) : own;
      $(".ticks", el).replaceChildren(...lines.map((t) => h("li", null, icon("check"), h("span", null, t))));
    }
    $(".plan-intro").textContent = fmt(S.home.pachetIntro, { n: mods.length });
    $("#home-steps").replaceChildren(...S.home.pasi.map((p) => h("li", null, h("h3", null, p.title), h("p", null, p.body))));
    $("#home-modules").replaceChildren(...[quickRow([quickCount(), h("br"), S.ui.free])].concat(mods.map((m) => {
      const meta = META && META.modules[m.id];
      return h("li", null, h("a", { class: "row", href: m.id === "tarot" ? "#/tarot" : "#/test/" + m.id },
        h("span", { class: "row-name" }, m.name), h("span", { class: "row-sub" }, m.tagline),
        h("span", { class: "row-meta" }, counts(m.id), meta && meta.free ? h("br") : null, meta && meta.free ? fmt(S.ui.freeQuestions, { n: meta.free }) : null)));
    })).filter(Boolean));
    $("#home-faq").replaceChildren(...S.home.faq.map((f) => h("details", null, h("summary", null, f.q), h("p", null, f.a))));
    $("#year").textContent = new Date().getFullYear();
    const mail = $("#foot-mail");
    mail.hidden = !S.settings.contactEmail;
    if (S.settings.contactEmail) { mail.textContent = S.settings.contactEmail; mail.href = "mailto:" + S.settings.contactEmail; }
  }

  // ---- Lista testelor despre tine
  async function viewEu() {
    const me = await getMe();
    const rows = S.modules.filter((m) => m.on).map((m) => {
      const st = me.modules[m.id] || { status: "new" };
      const isTarot = m.id === "tarot";
      let label = S.ui.startFree, href = "/test/" + m.id, tag = counts(m.id), on = false;
      if (isTarot) { label = S.ui.open; href = "/tarot"; if (st.unlocked) { tag = S.ui.statusUnlocked; on = true; } else tag = S.ui.free; }
      else if (st.status === "progress") { label = S.ui.continueTest; tag = st.answered + " / " + st.total; on = true; }
      else if (st.status === "partial") { label = S.ui.seeResult; href = "/rezultat/" + m.id; tag = S.ui.statusPartial; on = true; }
      else if (st.status === "unlocked") { label = st.answered ? S.ui.continueTest : S.ui.startTest; tag = st.answered ? st.answered + " / " + st.total : S.ui.statusUnlocked; on = true; }
      else if (st.status === "done") { label = S.ui.seeResult; href = "/rezultat/" + m.id; tag = S.ui.statusDone; on = true; }
      return h("li", null, h("a", { class: "row", href: "#" + href },
        h("span", { class: "row-name" }, m.name), h("span", { class: "row-sub" }, m.tagline),
        h("span", { class: "row-meta" }, h("span", { class: "tag" + (on ? " tag-on" : "") }, tag), h("br"), label)));
    });
    const pack = product("pachet");
    const reportBox = h("div", { class: "box box-accent" }, h("h2", null, S.eu.raportTitle), h("p", { class: "muted" }, S.eu.raportLead),
      h("div", { class: "actions" }, me.hasReport ? btn(S.eu.raportCta, "/raport") : pack.on ? priceBtn(S.eu.pachetCta, pack.price, "/plata/pachet") : null));
    const quick = quickRow([h("span", { class: "tag" }, S.ui.free), h("br"), S.ui.startFree]);
    return page("eu", head(S.settings.siteName, S.eu.lead, "/"), online ? null : h("p", { class: "err" }, S.ui.noServer), h("ul", { class: "rows" }, quick, rows), reportBox);
  }

  // ---- Un test: câte o întrebare pe ecran, cu salvare după fiecare răspuns
  function runner(cfg) {
    const screens = [];
    cfg.questions.forEach((q, qi) => cfg.steps(q).forEach((s) => screens.push(Object.assign({ q, qi }, s))));
    const valueOf = (s) => { const a = cfg.answers[s.q.id]; return s.key ? (a ? a[s.key] : undefined) : a; };
    let i = screens.findIndex((s) => valueOf(s) === undefined);
    if (i < 0) i = screens.length - 1;
    let busy = false, pending = Promise.resolve();
    const fill = h("div", { class: "bar-fill" }), count = h("span"), text = h("h1", { class: "q-text" }), prompt = h("p", { class: "q-prompt" }), opts = h("div", { class: "opts" });
    const back = h("button", { class: "back", type: "button", onclick: () => { if (busy) return; if (i > 0) { i -= 1; draw(); } else go(cfg.exit); } }, S.ui.back);
    const complete = (q) => cfg.steps(q).every((s) => valueOf(Object.assign({ q }, s)) !== undefined);

    function draw() {
      const s = screens[i];
      fill.style.width = Math.round((i / screens.length) * 100) + "%";
      count.textContent = fmt(S.test.progress, { n: s.qi + 1, total: cfg.questions.length });
      text.textContent = s.q.text;
      prompt.textContent = s.prompt;
      const current = valueOf(s);
      opts.replaceChildren(...s.options.map((label, k) => {
        const value = k + s.base;
        return h("button", { class: "opt", type: "button", "aria-pressed": String(current === value), onclick: () => choose(s, value) }, label);
      }));
    }
    function choose(s, value) {
      if (busy) return;
      if (s.key) cfg.answers[s.q.id] = Object.assign({}, cfg.answers[s.q.id], { [s.key]: value });
      else cfg.answers[s.q.id] = value;
      if (complete(s.q)) { const one = { [s.q.id]: cfg.answers[s.q.id] }; pending = pending.then(() => cfg.save(one)).catch(() => {}); }
      busy = true;
      draw();
      setTimeout(() => { if (i < screens.length - 1) { busy = false; i += 1; draw(); } else finish(); }, 170);
    }
    async function finish() {
      fill.style.width = "100%";
      prompt.textContent = S.test.sending;
      try {
        await pending;
        const all = {};
        for (const q of cfg.questions) if (complete(q)) all[q.id] = cfg.answers[q.id];
        await cfg.save(all);
        cfg.done();
      } catch (e) { busy = false; toast(e.message); draw(); }
    }
    draw();
    return h("div", { class: "runner" }, h("div", { class: "runner-top" }, back, count), h("div", { class: "bar" }, fill), h("p", { class: "muted small" }, cfg.title), text, prompt, opts);
  }

  async function viewTest(id) {
    if (id === "tarot") { go("/tarot"); return null; }
    await ensureProfile();
    const t = await api("GET", "test/" + id);
    if (t.questions.every((q) => t.answers[q.id] !== undefined)) { go("/rezultat/" + id); return null; }
    const node = runner({
      title: t.name, questions: t.questions, answers: t.answers, exit: "/eu",
      steps: (q) => [t.type === "likert" ? { prompt: S.test.likertPrompt, options: t.scale, base: 1 } : { prompt: S.test.quizPrompt, options: q.options, base: 0 }],
      save: (answers) => api("POST", "test/" + id, { answers }),
      done: () => go("/rezultat/" + id)
    });
    return { world: "eu", node };
  }

  // ---- Testul rapid: gratuit, fără link privat. Răspunsurile stau doar în acest browser, până se închide fila.
  const QUICK_KEY = "cq_rapid";
  let quickMem = null;
  function quickLoad() {
    if (quickMem) return quickMem;
    let v = null;
    try { v = JSON.parse(sessionStorage.getItem(QUICK_KEY) || "{}"); } catch (e) { /* fără stocare sau conținut stricat */ }
    quickMem = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    return quickMem;
  }
  function quickKeep(answers) {
    quickMem = answers;
    try { if (answers) sessionStorage.setItem(QUICK_KEY, JSON.stringify(answers)); else sessionStorage.removeItem(QUICK_KEY); } catch (e) { /* fără stocare: rămân în memorie */ }
  }
  async function viewQuick() {
    if (!online) throw new Error(S.ui.noServer);
    const t = await api("GET", "quick");
    const saved = quickLoad(), answers = {};
    for (const q of t.questions) if (Number.isInteger(saved[q.id]) && saved[q.id] >= 0 && saved[q.id] < q.options.length) answers[q.id] = saved[q.id];
    if (t.questions.every((q) => answers[q.id] !== undefined)) { go("/rapid/rezultat"); return null; }
    const node = runner({
      title: S.quick.name, questions: t.questions, answers, exit: "/eu",
      steps: (q) => [{ prompt: S.test.quizPrompt, options: q.options, base: 0 }],
      save: async () => quickKeep(answers),
      done: () => go("/rapid/rezultat")
    });
    return { world: "eu", node };
  }
  async function viewQuickResult() {
    if (!online) throw new Error(S.ui.noServer);
    let r;
    try { r = await api("POST", "quick", { answers: quickLoad() }); }
    catch (e) { if (e.status === 400) { go("/rapid"); return null; } throw e; }
    const kids = [head(S.quick.name, S.quick.resultLead, "/eu")];
    if (r.score) kids.push(h("section", { class: "box center" }, h("p", { class: "label" }, S.quick.scoreLabel), h("p", { class: "big" }, r.score.correct + " / " + r.score.total),
      h("h2", null, r.score.title), h("p", { class: "muted" }, r.score.text)));
    if (r.choices.length) kids.push(h("section", { class: "box" }, h("h2", null, S.quick.choicesTitle), h("ul", { class: "list" }, r.choices.map((c) =>
      h("li", null, h("span", { class: "muted small" }, c.text), h("b", null, c.answer), c.note ? h("span", null, c.note) : null)))));
    if (r.next) kids.push(h("section", { class: "box box-accent" }, h("h2", null, S.quick.nextTitle), h("p", { class: "muted" }, S.quick.nextLead),
      h("div", null, h("p", { class: "row-name" }, r.next.name), h("p", { class: "muted" }, r.next.tagline)),
      h("div", { class: "actions" }, btn(S.ui.startFree, r.next.id === "tarot" ? "/tarot" : "/test/" + r.next.id), btn(S.quick.allTests, "/eu", "btn-line"))));
    if (r.review.length) kids.push(h("details", { class: "box" }, h("summary", { class: "label" }, S.quick.reviewTitle), h("ol", { class: "review" }, r.review.map((q) => {
      const good = q.yours === q.right;
      return h("li", null, h("b", null, q.text), h("span", { class: good ? "good" : "bad" }, S.rezultat.reviewYours + ": " + q.options[q.yours]),
        good ? null : h("span", { class: "good" }, S.rezultat.reviewRight + ": " + q.options[q.right]), q.explain ? h("span", { class: "muted" }, q.explain) : null);
    }))));
    kids.push(h("div", { class: "actions" }, h("button", { class: "link", type: "button", onclick: () => { quickKeep(null); go("/rapid"); } }, S.quick.again)));
    return page("eu", kids);
  }

  // ---- Rezultatul unui test
  function unlockBox(id) {
    const one = product("modul"), all = product("pachet");
    if (!one.on && !all.on) return null;
    return h("div", { class: "box box-accent" }, h("h2", null, S.rezultat.unlockTitle), h("div", { class: "actions" },
      one.on ? priceBtn(S.rezultat.unlockOne, one.price, "/plata/modul/" + id) : null,
      all.on ? priceBtn(S.rezultat.unlockAll, all.price, "/plata/pachet", one.on ? "btn-line" : "") : null));
  }
  const meter = (score) => { const f = h("div", { class: "meter-fill" }); f.style.width = Math.max(2, score) + "%"; return h("div", { class: "meter" }, f); };

  async function viewResult(id) {
    await ensureProfile();
    const r = await api("GET", "result/" + id);
    if (!r.complete && (!r.unlocked || r.answered === 0)) { go("/test/" + id); return null; }
    const kids = [head(r.name, r.unlocked && r.complete ? S.rezultat.fullTitle : S.rezultat.partialTitle, "/eu")];
    if (!r.unlocked) kids.push(h("p", { class: "muted" }, fmt(S.rezultat.partialNote, { n: r.total, total: r.fullTotal })));
    if (r.unlocked && !r.complete) kids.push(h("div", { class: "actions" }, btn(S.rezultat.continueLong + " (" + r.answered + " / " + r.total + ")", "/test/" + id)));

    if (r.type === "likert") {
      kids.push(h("div", { class: "dims" }, r.dims.map((d) => d.locked
        ? h("div", { class: "dim dim-locked" }, h("div", { class: "dim-head" }, h("span", { class: "dim-name" }, d.name)), h("div", { class: "meter" }), h("p", { class: "small" }, S.rezultat.locked))
        : h("div", { class: "dim" }, h("div", { class: "dim-head" }, h("span", { class: "dim-name" }, d.name), h("span", { class: "dim-score" }, d.score)), meter(d.score),
          h("p", { class: "muted small" }, d.desc), h("p", null, d.text), d.tip ? h("p", { class: "tip" }, h("b", null, S.rezultat.tipLabel + ": "), d.tip) : null))));
    } else {
      kids.push(h("div", { class: "box center" }, h("p", { class: "muted" }, fmt(S.rezultat.iqScore, { n: r.correct, total: r.total })),
        r.interval ? [h("p", { class: "label" }, S.rezultat.iqInterval), h("p", { class: "big" }, r.interval.lo + "–" + r.interval.hi), h("p", { class: "muted small" }, fmt(S.rezultat.iqNote, { total: r.total }))]
          : h("p", null, r.unlocked ? "" : S.rezultat.iqLocked)));
      if (r.areas) kids.push(h("div", { class: "dims" }, r.areas.map((a) => h("div", { class: "dim" }, h("div", { class: "dim-head" }, h("span", { class: "dim-name" }, a.name), h("span", { class: "dim-score" }, a.correct + " / " + a.total)), meter(a.total ? (a.correct / a.total) * 100 : 0)))));
      if (r.review) kids.push(h("details", { class: "box" }, h("summary", { class: "label" }, S.rezultat.reviewTitle), h("ol", { class: "review" }, r.review.map((q) => {
        const good = q.yours === q.right;
        return h("li", null, h("b", null, q.text), h("span", { class: good ? "good" : "bad" }, S.rezultat.reviewYours + ": " + (q.options[q.yours] == null ? "–" : q.options[q.yours])),
          good ? null : h("span", { class: "good" }, S.rezultat.reviewRight + ": " + q.options[q.right]), h("span", { class: "muted" }, q.explain));
      }))));
    }
    if (!r.unlocked) kids.push(unlockBox(id));
    kids.push(h("div", { class: "actions" }, btn(S.rezultat.backToTests, "/eu", "btn-line")));
    return page("eu", kids);
  }

  // ---- Cărțile de tarot. Desenul fiecărei cărți se generează din numărul ei.
  const ROMAN = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  const roman = (n) => { if (!n) return "0"; let out = ""; for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; } return out; };
  function emblem(n) {
    const pts = 5 + (n % 6), prims = [{ t: "c", r: 0.94 }, { t: "c", r: 0.5 + (n % 4) * 0.07 }];
    const poly = (step, rot, r) => { const p = []; for (let i = 0; i < pts; i++) { const a = -Math.PI / 2 + rot + (i * step * 2 * Math.PI) / pts; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return { t: "p", pts: p }; };
    if (pts % 2) prims.push(poly(2, 0, 0.94));
    else { prims.push(poly(1, 0, 0.94)); prims.push(poly(1, Math.PI / pts, 0.94)); }
    if (n % 3 === 0) prims.push(poly(1, Math.PI / pts, 0.3));
    for (let i = 0; i < (n % 5) + 1; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / ((n % 5) + 1); prims.push({ t: "d", x: Math.cos(a) * 0.72, y: Math.sin(a) * 0.72, r: 0.035 }); }
    prims.push({ t: "d", x: 0, y: 0, r: 0.08 });
    return prims;
  }
  function emblemSvg(n) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "-1 -1 2 2");
    svg.setAttribute("class", "tcard-art");
    svg.setAttribute("aria-hidden", "true");
    for (const p of emblem(n)) {
      const el = document.createElementNS(NS, p.t === "p" ? "polygon" : "circle");
      if (p.t === "p") el.setAttribute("points", p.pts.map((x) => x[0].toFixed(3) + "," + x[1].toFixed(3)).join(" "));
      else { el.setAttribute("cx", p.x || 0); el.setAttribute("cy", p.y || 0); el.setAttribute("r", p.r); if (p.t === "d") el.setAttribute("class", "dot"); }
      svg.append(el);
    }
    return svg;
  }
  const cardFace = (card) => h("div", { class: "tcard-side tcard-face" }, h("div", { class: "tcard-num" }, roman(card.n)), emblemSvg(card.n), h("div", { class: "tcard-name" }, card.name));
  const flatCard = (card) => h("div", { class: "tcard tcard-flat", role: "img", "aria-label": card.name }, cardFace(card));
  const cardText = (card) => [h("p", { class: "keys" }, card.keys), h("p", null, card.scurt)];
  const cardFull = (card) => [["sens", card.sens], ["umbra", card.umbra], ["sfat", card.sfat]].map(([k, v]) => h("li", null, h("b", null, S.tarot[k]), h("span", { class: "muted" }, v)));

  async function viewTarot() {
    await ensureProfile();
    const m = S.modules.find((x) => x.id === "tarot");
    const body = h("div", { class: "stack" });
    const draw = (t) => body.replaceChildren(...tarotParts(t, draw));
    draw(await api("GET", "tarot"));
    return page("eu", head(m ? m.name : "Tarot", S.tarot.lead, "/eu"), body, h("p", { class: "muted small" }, S.tarot.note));
  }
  function tarotParts(t, redraw) {
    const parts = [];
    // Cartea zilei: se întoarce la atingere. Dacă a fost întoarsă azi, rămâne întoarsă.
    const key = "cq_carte_" + t.day.date;
    let seen = false;
    try { seen = sessionStorage.getItem(key) === "1"; } catch (e) { /* fără stocare */ }
    const details = h("div", { class: "stack center", hidden: !seen }, cardText(t.day.card),
      t.unlocked ? h("ul", { class: "list" }, cardFull(t.day.card)) : h("p", { class: "muted small" }, S.tarot.sens + ", " + S.tarot.umbra.toLowerCase() + ", " + S.tarot.sfat.toLowerCase() + ": " + S.rezultat.locked.toLowerCase() + "."),
      h("p", { class: "muted small" }, S.tarot.dayAgain));
    const hint = h("p", { class: "muted small", hidden: seen }, S.tarot.dayHint);
    const flip = h("button", { class: "tcard", type: "button", "aria-pressed": String(seen), "aria-label": S.tarot.dayTitle, onclick: () => {
      flip.setAttribute("aria-pressed", "true"); details.hidden = false; hint.hidden = true;
      try { sessionStorage.setItem(key, "1"); } catch (e) { /* fără stocare */ }
    } }, h("div", { class: "tcard-in" }, h("div", { class: "tcard-side tcard-back" }), cardFace(t.day.card)));
    parts.push(h("section", { class: "box center" }, h("h2", null, S.tarot.dayTitle), flip, hint, details));

    if (!t.unlocked) {
      const one = product("modul"), all = product("pachet");
      parts.push(h("section", { class: "box box-accent" }, h("h2", null, S.tarot.personalTitle), h("p", { class: "muted" }, S.tarot.unlockLead), h("div", { class: "actions" },
        one.on ? priceBtn(S.rezultat.unlockOne, one.price, "/plata/modul/tarot") : null, all.on ? priceBtn(S.rezultat.unlockAll, all.price, "/plata/pachet", one.on ? "btn-line" : "") : null)));
      return parts;
    }

    // Cartea personală
    const err = h("p", { class: "err", hidden: true });
    const name = h("input", { class: "input", id: "t-name", maxlength: "30", autocomplete: "given-name", value: t.personal ? t.personal.name : "" });
    const num = (id, ph, max) => h("input", { class: "input", id, inputmode: "numeric", maxlength: String(max), placeholder: ph, "aria-label": ph });
    const d = num("t-d", S.tarot.dayLabel, 2), mo = num("t-m", S.tarot.monthLabel, 2), y = num("t-y", S.tarot.yearLabel, 4);
    const form = h("form", { class: "stack", hidden: !!t.personal, onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      try { redraw(await api("POST", "tarot/personal", { name: name.value, day: Number(d.value), month: Number(mo.value), year: Number(y.value) })); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    } }, h("div", { class: "field" }, h("label", { for: "t-name" }, S.tarot.personalName), name), h("div", { class: "field" }, h("span", { class: "label" }, S.tarot.personalDate), h("div", { class: "date" }, d, mo, y)), err, h("button", { class: "btn", type: "submit" }, S.tarot.personalBtn));
    const personal = h("section", { class: "box" }, h("h2", null, S.tarot.personalTitle), h("p", { class: "muted" }, S.tarot.personalLead));
    if (t.personal) {
      const c = t.personal.card;
      const card = { kind: "tarot", n: c.n, title: c.name, sub: c.keys, name: t.personal.name };
      personal.append(h("div", { class: "stack center" }, flatCard(c), h("p", { class: "keys" }, c.keys), h("p", null, c.personal)), h("ul", { class: "list" }, cardFull(c)),
        h("div", { class: "actions" }, shareButtons(card, "cartea-mea.png", S.tarot.personalShare, S.tarot.personalDownload), h("button", { class: "btn btn-line", type: "button", onclick: () => { form.hidden = false; name.focus(); } }, S.tarot.personalChange)));
    }
    personal.append(form);
    parts.push(personal);

    // Etalarea
    const spread = h("section", { class: "box" }, h("h2", null, S.tarot.spreadTitle), h("p", { class: "muted" }, S.tarot.spreadLead));
    if (t.spread) spread.append(h("div", { class: "spread" }, t.spread.cards.map((x) => h("div", { class: "spread-item" }, h("b", null, x.position.name), h("span", { class: "muted small" }, x.position.hint), flatCard(x.card), h("p", { class: "keys" }, x.card.keys), h("p", { class: "small" }, x.card.sens), h("p", { class: "tip small" }, x.card.sfat)))));
    if (!t.spread || t.spread.canRedraw) spread.append(h("button", { class: "btn", type: "button", onclick: async () => { try { redraw(await api("POST", "tarot/spread", {})); } catch (ex) { toast(ex.message); } } }, S.tarot.spreadBtn));
    else spread.append(h("p", { class: "muted small" }, S.tarot.spreadAgain));
    parts.push(spread);
    return parts;
  }

  // ---- Cardul de distribuit (imagine 1080 × 1350, desenată în browser)
  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = String(text).split(/\s+/);
    let line = "", lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines += 1;
        if (lines === maxLines) { ctx.fillText(line.replace(/[ ,.]*$/, "…"), x, y); return y + lineH; }
        ctx.fillText(line, x, y); y += lineH; line = words[i];
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lineH; }
    return y;
  }
  async function makeCard(d) {
    const W = 1080, H = 1350, P = 90;
    try { await Promise.all([document.fonts.load("500 96px Fraunces"), document.fonts.load("600 36px Figtree")]); } catch (e) { /* se desenează cu fontul de rezervă */ }
    const c = h("canvas", { class: "sharecard", width: W, height: H });
    const x = c.getContext("2d");
    const accent = d.kind === "noi" ? "#FF2D55" : "#9D6BFF";
    const serif = (px, w) => (w || 500) + " " + px + "px Fraunces, Georgia, serif", sans = (px, w) => (w || 400) + " " + px + "px Figtree, system-ui, sans-serif";
    x.fillStyle = "#0A0612"; x.fillRect(0, 0, W, H);
    x.lineWidth = 2;
    for (const [cx, col] of [[W * 0.36, "#9D6BFF"], [W * 0.64, "#FF2D55"]]) { x.strokeStyle = col; x.globalAlpha = 0.35; x.beginPath(); x.arc(cx, H * 0.36, 420, 0, Math.PI * 2); x.stroke(); }
    x.globalAlpha = 1;
    x.textBaseline = "top";
    x.fillStyle = "#A79DBB"; x.font = sans(34, 600);
    x.fillText(d.kind === "noi" ? S.settings.coupleName : S.settings.siteName, P, P);
    let y = 230;
    if (d.kind === "tarot") {
      const cx = W / 2, cy = 520, R = 250;
      x.strokeStyle = accent; x.fillStyle = accent; x.lineWidth = 3;
      for (const p of emblem(d.n)) {
        x.beginPath();
        if (p.t === "p") { p.pts.forEach((q, i) => (i ? x.lineTo(cx + q[0] * R, cy + q[1] * R) : x.moveTo(cx + q[0] * R, cy + q[1] * R))); x.closePath(); x.stroke(); }
        else { x.arc(cx + (p.x || 0) * R, cy + (p.y || 0) * R, p.r * R, 0, Math.PI * 2); if (p.t === "d") x.fill(); else x.stroke(); }
      }
      x.textAlign = "center";
      x.font = serif(54); x.fillText(roman(d.n), cx, 170);
      x.fillStyle = "#F6F2FA"; x.font = serif(104); x.fillText(d.title, cx, 840);
      x.fillStyle = accent; x.font = sans(40, 500); x.fillText(d.sub, cx, 980);
      x.fillStyle = "#A79DBB"; x.font = sans(38); x.fillText(S.tarot.personalTitle, cx, 1052); if (d.name) x.fillText(d.name, cx, 1104);
      x.textAlign = "left";
    } else {
      if (d.big) { x.fillStyle = accent; x.font = serif(280); x.fillText(d.big, P - 8, y); y += 330; }
      x.fillStyle = "#F6F2FA"; x.font = serif(d.big ? 84 : 112);
      y = wrap(x, d.title, P, y, W - 2 * P, d.big ? 96 : 122, 3) + 20;
      x.fillStyle = "#A79DBB"; x.font = sans(42);
      y = wrap(x, d.sub || "", P, y, W - 2 * P, 58, 3) + 50;
      for (const b of d.bars || []) {
        x.fillStyle = "#F6F2FA"; x.font = sans(36, 600); x.fillText(b.name, P, y);
        x.textAlign = "right"; x.fillStyle = accent; x.fillText(String(b.score), W - P, y); x.textAlign = "left";
        x.fillStyle = "#2E2244"; x.fillRect(P, y + 54, W - 2 * P, 14);
        x.fillStyle = accent; x.fillRect(P, y + 54, ((W - 2 * P) * Math.max(2, b.score)) / 100, 14);
        y += 104;
      }
    }
    x.fillStyle = "#F6F2FA"; x.font = serif(50);
    x.fillText(d.question || "", P, H - P - 120);
    x.fillStyle = "#A79DBB"; x.font = sans(34);
    x.fillText(location.host, P, H - P - 40);
    return c;
  }
  function shareButtons(data, filename, shareLabel, downloadLabel) {
    const blobOf = async () => { const c = await makeCard(data); return new Promise((ok) => c.toBlob(ok, "image/png")); };
    const save = async () => {
      const url = URL.createObjectURL(await blobOf());
      const a = h("a", { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    const share = async () => {
      try {
        const file = new File([await blobOf()], filename, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: data.question || "" });
        else await save();
      } catch (e) { if (e.name !== "AbortError") toast(S.ui.errorServer); }
    };
    return [navigator.share ? h("button", { class: "btn", type: "button", onclick: share }, shareLabel) : null, h("button", { class: "btn " + (navigator.share ? "btn-line" : ""), type: "button", onclick: save }, downloadLabel)];
  }

  // ---- Raportul care leagă testele
  async function viewReport() {
    await ensureProfile();
    let r;
    try { r = await api("GET", "report"); } catch (e) { if (e.status === 402) { go("/plata/pachet"); return null; } throw e; }
    const kids = [head(r.empty ? S.raport.title : r.title, r.empty ? S.raport.empty : r.tagline, "/eu")];
    if (r.missing.length) kids.push(h("p", { class: "muted noprint" }, fmt(S.raport.missing, { lista: r.missing.join(", ") })));
    if (r.empty) { kids.push(h("div", { class: "actions" }, btn(S.rezultat.backToTests, "/eu"))); return page("eu", kids); }
    const list = (title, intro, items) => (items.length ? h("section", { class: "box" }, h("h2", null, title), intro ? h("p", { class: "muted" }, intro) : null, h("ul", { class: "list" }, items.map((i) => h("li", null, h("b", null, i.name, i.score != null ? h("span", { class: "num" }, i.score) : null), h("span", { class: "muted" }, i.text))))) : null);
    if (r.profile.length) kids.push(h("div", { class: "dims" }, r.profile.map((p) => h("div", { class: "dim" }, h("div", { class: "dim-head" }, h("span", { class: "dim-name" }, p.name), h("span", { class: "dim-score" }, p.score)), meter(p.score)))));
    kids.push(list(S.raport.strengths, "", r.strengths), list(S.raport.growth, r.intro.growth, r.growth), list(S.raport.work, r.intro.work, r.work), list(S.raport.love, r.intro.love, r.love));
    if (r.iq) kids.push(h("section", { class: "box" }, h("h2", null, S.raport.iq), h("p", { class: "big" }, r.iq.lo + "–" + r.iq.hi), h("p", { class: "muted" }, fmt(S.rezultat.iqScore, { n: r.iq.correct, total: r.iq.total }) + ". " + fmt(S.rezultat.iqNote, { total: r.iq.total }))));
    if (r.challenge.length) kids.push(h("section", { class: "box" }, h("h2", null, S.raport.challenge), h("ol", { class: "days" }, r.challenge.map((c, i) => h("li", null, h("b", null, fmt(S.raport.day, { n: i + 1 })), h("span", null, c))))));
    const card = { kind: "eu", title: r.title, sub: r.tagline, bars: r.profile, question: S.raport.cardQuestion };
    const holder = h("div", { class: "stack center" });
    makeCard(card).then((c) => holder.append(c));
    kids.push(h("section", { class: "box noprint" }, h("h2", null, S.raport.cardTitle), holder, h("div", { class: "actions" }, shareButtons(card, "profilul-meu.png", S.raport.share, S.raport.download))),
      h("div", { class: "actions" }, h("button", { class: "btn btn-line", type: "button", onclick: () => window.print() }, S.raport.pdf)));
    return page("eu", kids);
  }

  // ---- Testul de cuplu
  const inviteUrl = (id) => BASE + "#/invitatie/" + id;
  function nameForm(label, consent, button, submit) {
    const err = h("p", { class: "err", hidden: true });
    const name = h("input", { class: "input", id: "c-name", maxlength: "30", autocomplete: "given-name", required: true });
    const ok = h("input", { type: "checkbox", required: true });
    return h("form", { class: "box", onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      try { await ensureProfile(); await submit(name.value, ok.checked); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    } }, h("div", { class: "field" }, h("label", { for: "c-name" }, label), name), h("label", { class: "check" }, ok, h("span", null, consent)), err, h("button", { class: "btn", type: "submit" }, button));
  }
  async function viewNoi() {
    const me = await getMe();
    const mine = me.couples.length ? h("section", { class: "stack" }, h("h2", null, S.noi.mine), h("ul", { class: "rows" }, me.couples.map((c) => h("li", null, h("a", { class: "row", href: "#/noi/" + c.id },
      h("span", { class: "row-name" }, c.partner || S.noi.waitingPartner), h("span", { class: "row-meta" }, S.noi.open)))))) : null;
    const price = product("cuplu");
    return page("noi", head(S.settings.coupleName, S.noi.lead, "/"), online ? null : h("p", { class: "err" }, S.ui.noServer), mine,
      h("ol", { class: "steps" }, S.noi.pasi.map((p) => h("li", null, h("h3", null, p.title), h("p", null, p.body)))),
      nameForm(S.noi.nameLabel, S.noi.consent, S.noi.start, async (name, consent) => { const r = await api("POST", "couple", { name, consent }); go("/noi/" + r.id + "/test"); }),
      price.on ? h("p", { class: "muted small" }, price.name + ": " + money(price.price) + ". " + S.noi.unlockNote) : null);
  }
  function inviteBox(id, title, lead) {
    const url = inviteUrl(id);
    return h("section", { class: "box box-accent" }, h("h2", null, title), h("p", { class: "muted" }, lead), h("p", { class: "linkbox" }, url), h("div", { class: "actions" },
      h("a", { class: "btn", href: "https://wa.me/?text=" + encodeURIComponent(fmt(S.noi.inviteMsg, { link: url })), target: "_blank", rel: "noopener" }, S.noi.whatsapp),
      h("button", { class: "btn btn-line", type: "button", onclick: () => copyText(url, S.noi.copied) }, S.noi.copy)));
  }
  async function viewCouple(id) {
    await ensureProfile();
    const c = await api("GET", "couple/" + id);
    const kids = [head(S.settings.coupleName, c.partnerName ? c.myName + " & " + c.partnerName : "", "/noi")];
    const left = c.mine.total - c.mine.answered;
    if (c.stage === "answer") kids.push(h("section", { class: "box" }, h("h2", null, S.noi.yourTurn), h("div", { class: "actions" }, btn(S.noi.answer, "/noi/" + id + "/test"))));
    else if (c.stage === "invite") kids.push(inviteBox(id, S.noi.inviteTitle, S.noi.inviteLead), h("p", { class: "muted small" }, S.noi.waitingPartner));
    else if (c.stage === "wait") kids.push(inviteBox(id, fmt(S.noi.waiting, { nume: c.partnerName }), S.noi.inviteLead));
    else if (c.stage === "teaser") {
      const price = product("cuplu");
      kids.push(h("section", { class: "box center" }, h("p", { class: "big" }, c.teaser.same + " / " + c.teaser.total), h("h2", null, fmt(S.noi.teaserTitle, { n: c.teaser.same, total: c.teaser.total })), h("p", { class: "muted" }, S.noi.teaserLead)),
        price.on ? h("section", { class: "box box-accent" }, h("div", { class: "actions" }, priceBtn(S.noi.unlock, price.price, "/plata/cuplu/" + id)), h("p", { class: "muted small" }, S.noi.unlockNote)) : null);
    } else {
      const r = c.report, n = c.names;
      kids[0] = head(S.noi.reportTitle, n.a + " & " + n.b, "/noi");
      if (left > 0) kids.push(h("div", { class: "actions" }, btn(fmt(S.noi.continueLong, { n: left }), "/noi/" + id + "/test")));
      if (left > 0 || (c.theirs && c.theirs.answered < c.theirs.total)) kids.push(h("p", { class: "muted small" }, S.noi.paidWaiting));
      kids.push(h("section", { class: "box center" }, h("p", { class: "big" }, r.percent + "%"), h("h2", null, r.level.title), h("p", { class: "muted" }, r.level.text), h("p", null, fmt(S.noi.same, { n: r.same, total: r.total }))),
        h("div", { class: "versus" }, [["a", "b", r.aKnows], ["b", "a", r.bKnows]].map(([who, whom, k]) => h("div", { class: "box" }, h("p", { class: "big" }, k + " / " + r.total), h("p", { class: "muted small" }, fmt(S.noi.knows, { a: n[who], b: n[whom], n: k, total: r.total }))))));
      const close = r.cats.filter((x) => x.close), talk = r.cats.filter((x) => !x.close);
      if (close.length) kids.push(h("section", { class: "box" }, h("h2", null, S.noi.close), h("ul", { class: "list" }, close.map((x) => h("li", null, h("b", null, x.name, h("span", { class: "num" }, x.same + " / " + x.total)), h("span", { class: "muted" }, x.text))))));
      if (talk.length) kids.push(h("section", { class: "box" }, h("h2", null, S.noi.talk), h("ul", { class: "list" }, talk.map((x) => h("li", null, h("b", null, x.name, h("span", { class: "num" }, x.same + " / " + x.total)), h("span", { class: "muted" }, x.text), h("span", { class: "tip" }, h("b", null, S.noi.talkAsk + ": "), x.question))))));
      kids.push(h("section", { class: "box" }, h("h2", null, S.noi.surprises), r.surprises.length ? h("ul", { class: "list" }, r.surprises.map((s) => {
        const a = s.who === "a" ? n.a : n.b, b = s.who === "a" ? n.b : n.a;
        return h("li", null, h("b", null, s.text), h("span", { class: "muted" }, fmt(S.noi.surprise, { a, b, ghicit: s.guess, real: s.real })));
      })) : h("p", { class: "muted" }, S.noi.noSurprises)));
      const card = { kind: "noi", big: r.percent + "%", title: r.level.title, sub: n.a + " & " + n.b, question: S.noi.cardLine };
      kids.push(h("div", { class: "actions" }, shareButtons(card, "cat-ne-cunoastem.png", S.raport.share, S.raport.download)));
    }
    return page("noi", kids);
  }
  async function viewCoupleTest(id) {
    await ensureProfile();
    const t = await api("GET", "couple/" + id + "/questions");
    const done = (q) => t.answers[q.id] && t.answers[q.id].own !== undefined && t.answers[q.id].guess !== undefined;
    if (t.questions.every(done)) { go("/noi/" + id); return null; }
    const who = t.partnerName || S.noi.partnerWord;
    const node = runner({
      title: S.settings.coupleName, questions: t.questions, answers: t.answers, exit: "/noi/" + id,
      steps: (q) => [{ key: "own", prompt: S.test.ownPrompt, options: q.options, base: 0 }, { key: "guess", prompt: fmt(S.test.guessPrompt, { nume: who }), options: q.options, base: 0 }],
      save: (answers) => api("POST", "couple/" + id + "/answers", { answers }),
      done: () => go("/noi/" + id)
    });
    return { world: "noi", node };
  }
  async function viewInvite(id) {
    if (!online) throw new Error(S.ui.noServer);
    let inv;
    try { inv = await api("GET", "invite/" + id); } catch (e) { return page("noi", stateBox(S.noi.inviteBad, btn(S.ui.home, "/", "btn-line"))); }
    if (inv.mine === "b") { go("/noi/" + id); return null; }
    if (inv.mine === "a") return page("noi", stateBox(S.noi.inviteSelf, btn(S.noi.open, "/noi/" + id)));
    if (inv.full) return page("noi", stateBox(S.noi.inviteBad, btn(S.ui.home, "/", "btn-line")));
    return page("noi", head(fmt(S.noi.inviteHead, { nume: inv.name }), S.noi.inviteBody),
      nameForm(S.noi.nameLabel, S.noi.consent, S.noi.join, async (name, consent) => { await api("POST", "couple/join", { id, name, consent }); go("/noi/" + id + "/test"); }));
  }

  // ---- Plată: alegi ce deblochezi, pui un cod, vezi totalul
  async function viewPay(type, id) {
    await ensureProfile();
    const me = await getMe();
    const world = type === "cuplu" ? "noi" : "eu";
    const backTo = type === "cuplu" ? "/noi/" + id : type === "modul" ? (id === "tarot" ? "/tarot" : "/rezultat/" + id) : "/eu";
    const pack = product("pachet"), one = product("modul"), duo = product("cuplu");
    const sel = { pachet: type === "pachet" && pack.on && !me.paid.pachet, modules: new Set(type === "modul" && id ? [id] : []), couple: type === "cuplu" ? id : null };
    let code = "", quote = null, method = "";

    const list = h("div", { class: "stack" }), sum = h("div", { class: "sum" }), hint = h("p", { class: "muted small", hidden: true }, S.plata.packHint);
    const codeMsg = h("p", { class: "small", hidden: true }), err = h("p", { class: "err", hidden: true });
    const codeInput = h("input", { class: "input", id: "p-code", maxlength: "24", autocapitalize: "characters", autocomplete: "off", spellcheck: "false" });
    const pay = h("button", { class: "btn btn-wide", type: "button", onclick: doPay });
    const methods = h("fieldset", { class: "methods", hidden: true });
    const box = h("div", { class: "box" });
    const payLabel = () => (!quote || !(quote.total > 0) ? S.plata.payFree : method === "sms" ? S.plata.paySms : fmt(S.plata.pay, { suma: money(quote.total) }));
    // Metodele vin de la server, odată cu totalul: doar cele pornite din panou și care au cheile puse.
    function drawMethods() {
      const all = quote && quote.total > 0 ? quote.methods || [] : [];
      if (!all.some((m) => m.id === method)) method = all.length ? all[0].id : "";
      methods.hidden = !all.length;
      methods.replaceChildren(h("legend", null, S.plata.methodTitle), ...all.map((m) => h("label", { class: "pick" },
        h("input", { type: "radio", name: "metoda", checked: m.id === method, onchange: () => { method = m.id; pay.textContent = payLabel(); } }),
        h("span", null, m.name, m.note ? h("small", null, m.note) : null), h("span", { class: "muted small" }, m.detail || ""))));
    }
    const items = () => (sel.pachet ? [{ type: "pachet" }] : [...[...sel.modules].map((m) => ({ type: "modul", id: m })), ...(sel.couple ? [{ type: "cuplu", id: sel.couple }] : [])]);

    function drawList() {
      const rows = [];
      const pick = (checked, name, sub, price, onchange, off) => h("label", { class: "pick" + (off ? " pick-off" : "") }, h("input", { type: "checkbox", checked, disabled: off, onchange }), h("span", null, name, sub ? h("small", null, sub) : null), h("span", null, off ? S.plata.owned : money(price)));
      if (pack.on && !me.paid.pachet) rows.push(pick(sel.pachet, pack.name, pack.desc, pack.price, (e) => { sel.pachet = e.target.checked; drawList(); refresh(); }));
      if (sel.couple && duo.on) rows.push(pick(!sel.pachet, S.settings.coupleName, duo.desc, duo.price, () => drawList(), true === sel.pachet));
      if (one.on && type !== "cuplu") for (const m of S.modules.filter((x) => x.on)) {
        const owned = me.paid.pachet || (me.modules[m.id] && me.modules[m.id].unlocked);
        rows.push(pick(owned || (!sel.pachet && sel.modules.has(m.id)), m.name, "", one.price, (e) => { if (e.target.checked) sel.modules.add(m.id); else sel.modules.delete(m.id); sel.pachet = false; drawList(); refresh(); }, owned));
      }
      list.replaceChildren(...rows);
    }
    async function refresh() {
      err.hidden = true;
      const its = items();
      if (!its.length) { quote = null; sum.replaceChildren(h("p", { class: "muted" }, S.plata.nothing)); pay.disabled = true; pay.textContent = fmt(S.plata.pay, { suma: money(0) }); hint.hidden = true; drawMethods(); return; }
      try { quote = await api("POST", "pay/quote", { items: its, code }); }
      catch (e) {
        if (code) { code = ""; codeMsg.textContent = e.message; codeMsg.className = "err small"; codeMsg.hidden = false; return refresh(); }
        quote = null; err.textContent = e.message; err.hidden = false; pay.disabled = true; drawMethods(); return;
      }
      sum.replaceChildren(...quote.items.map((i) => h("div", null, h("span", null, i.label), h("span", null, money(i.price)))),
        ...(quote.discount ? [h("div", { class: "good" }, h("span", null, S.plata.discount + " (" + quote.codeText + ")"), h("span", null, "−" + money(quote.discount)))] : []),
        h("div", { class: "total" }, h("span", null, S.plata.total), h("span", null, money(quote.total))));
      if (quote.code) { codeMsg.textContent = quote.codeNote || fmt(S.plata.codeOk, { text: quote.codeText }); codeMsg.className = (quote.codeNote ? "muted" : "okmsg") + " small"; codeMsg.hidden = false; }
      drawMethods();
      // În modul de probă se poate „plăti” și fără nicio metodă pornită. Altfel, fără metode nu se poate plăti.
      const off = quote.total > 0 && !method && S.settings.payments !== "test";
      pay.disabled = off;
      pay.textContent = payLabel();
      if (off) { err.textContent = S.plata.off; err.hidden = false; }
      hint.hidden = sel.pachet || !pack.on || me.paid.pachet || quote.subtotal < pack.price;
    }
    async function doPay() {
      if (!quote) return;
      pay.disabled = true;
      err.hidden = true;
      try {
        const r = await api("POST", "pay/start", { items: items(), code, method });
        if (r.redirect) {
          // Plata se face pe pagina procesatorului (Stripe, PayPal). Clientul se întoarce la /?plata=<comanda>.
          if (!/^https?:\/\//.test(r.redirect)) throw new Error(S.ui.errorServer);
          pay.textContent = S.plata.redirecting;
          location.href = r.redirect;
          return;
        }
        if (r.sms) return showSms(r);
        if (!r.paid) await api("POST", "pay/test", { order: r.order });
        toast(S.plata.done);
        go(backTo);
      } catch (e) { err.textContent = e.message; err.hidden = false; pay.disabled = false; pay.textContent = payLabel(); }
    }
    // Plata prin SMS: arătăm ce are de trimis și întrebăm serverul din când în când dacă a sosit mesajul.
    function showSms(r) {
      const mine = seq, started = Date.now();
      const state = h("p", { class: "muted small", role: "status" }, S.plata.smsWait);
      const again = h("button", { class: "btn btn-line", type: "button", hidden: true, onclick: () => { again.hidden = true; state.textContent = S.plata.smsWait; check(true); } }, S.plata.checkAgain);
      const done = () => { toast(S.plata.done); go(backTo); };
      async function check(once) {
        if (seq !== mine) return; // clientul a plecat de pe pagină
        try { if ((await api("GET", "pay/status?order=" + r.order)).paid) return done(); } catch (e) { /* încercăm iar la următoarea verificare */ }
        if (seq !== mine) return;
        if (once !== true && Date.now() - started < 15 * 60000) return setTimeout(check, 4000);
        state.textContent = S.plata.notYet;
        again.hidden = false;
      }
      list.hidden = true;
      hint.hidden = true;
      box.replaceChildren(h("h2", null, S.plata.smsTitle),
        h("dl", { class: "sms" }, h("dt", null, S.plata.smsNumber), h("dd", null, r.sms.number), h("dt", null, S.plata.smsText), h("dd", null, r.sms.text)),
        h("p", null, fmt(S.plata.smsStep, { text: r.sms.text, numar: r.sms.number })),
        r.sms.cost ? h("p", { class: "muted" }, fmt(S.plata.smsCost, { cost: r.sms.cost })) : "",
        h("a", { class: "btn btn-wide", href: "sms:" + r.sms.number + "?&body=" + encodeURIComponent(r.sms.text) }, S.plata.smsOpen),
        state, again,
        r.mode === "test" ? h("button", { class: "btn btn-line", type: "button", onclick: async (e) => { e.target.disabled = true; try { await api("POST", "pay/test", { order: r.order }); done(); } catch (x) { state.textContent = x.message; e.target.disabled = false; } } }, S.plata.smsSimulate) : "",
        h("button", { class: "link", type: "button", onclick: route }, S.plata.backToPay));
      window.scrollTo(0, 0);
      setTimeout(check, 4000);
    }
    drawList();
    await refresh();
    const codeForm = h("form", { class: "field", onsubmit: (e) => { e.preventDefault(); code = codeInput.value.trim(); codeMsg.hidden = true; refresh(); } },
      h("label", { for: "p-code" }, S.plata.codeLabel), h("div", { class: "inline" }, codeInput, h("button", { class: "btn btn-line", type: "submit" }, S.plata.codeApply)), codeMsg);
    box.append(codeForm, sum, methods, err, pay, S.settings.payments === "test" ? h("p", { class: "muted small" }, S.plata.testNote) : "");
    return page(world, head(S.plata.title, S.plata.pickLead, backTo), list, hint, box);
  }

  // ---- Întoarcerea de la procesatorul de plăți: serverul îl întreabă pe acesta dacă plata a intrat
  async function viewPaid(id) {
    const my = seq;
    if (!token) return page("eu", stateBox(S.plata.notYet, btn(S.plata.backToPay, "/plata", "btn-line")));
    mount(document.body.dataset.world, stateBox(S.plata.confirming));
    // Unele metode confirmă cu câteva secunde întârziere, așa că întrebăm de câteva ori.
    for (let i = 0; i < 4; i++) {
      const r = await api("POST", "pay/confirm", { order: id });
      if (my !== seq) return null;
      if (r.paid) { toast(S.plata.done); go(r.next || "/eu"); return null; }
      await new Promise((ok) => setTimeout(ok, 2500));
      if (my !== seq) return null;
    }
    return page("eu", stateBox(S.plata.notYet, h("button", { class: "btn", type: "button", onclick: route }, S.plata.checkAgain), btn(S.plata.backToPay, "/plata", "btn-line")));
  }

  // ---- Linkul privat, adresa de e-mail opțională, ștergerea datelor
  let flash = ""; // mesaj arătat o singură dată pe pagina „Linkul meu”
  async function viewProfile() {
    const me = await getMe();
    if (!me.exists) {
      const lead = flash || S.profil.empty;
      flash = "";
      return page("eu", head(S.profil.title, lead, "/"), h("div", { class: "actions" }, btn(S.home.euCta, "/eu"), btn(S.home.noiCta, "/noi", "btn-line")));
    }
    const url = BASE + "#/p/" + token;
    const kids = [head(S.profil.title, S.profil.lead, "/"), h("div", { class: "box" }, h("p", { class: "linkbox" }, url), h("div", { class: "actions" },
      h("button", { class: "btn", type: "button", onclick: () => copyText(url) }, S.profil.copy),
      h("a", { class: "btn btn-line", href: "mailto:?subject=" + encodeURIComponent(S.profil.mailSubject) + "&body=" + encodeURIComponent(url) }, S.profil.mail)))];
    if (S.settings.askEmail) {
      const msg = h("p", { class: "small", hidden: true });
      const say = (text, good) => { msg.textContent = text; msg.className = (good ? "okmsg" : "err") + " small"; msg.hidden = false; };
      const box = h("div", { class: "box" });
      const drawEmail = (email) => {
        const input = h("input", { class: "input", id: "e-mail", type: "email", autocomplete: "email", required: true });
        const ok = h("input", { type: "checkbox", required: true });
        box.replaceChildren(h("h2", null, S.profil.emailTitle), h("p", { class: "muted" }, S.profil.emailLead), email
          ? h("div", { class: "stack" }, h("p", null, email), h("div", { class: "actions" }, h("button", { class: "btn btn-line", type: "button", onclick: async () => { try { await api("DELETE", "email"); drawEmail(""); say(S.profil.emailRemoved, true); } catch (e) { say(e.message); } } }, S.profil.emailRemove)))
          : h("form", { class: "stack", onsubmit: async (e) => { e.preventDefault(); try { const r = await api("POST", "email", { email: input.value, consent: ok.checked }); drawEmail(r.email); say(S.profil.emailSaved, true); } catch (ex) { say(ex.message); } } },
            h("div", { class: "field" }, h("label", { for: "e-mail" }, S.profil.emailLabel), input), h("label", { class: "check" }, ok, h("span", null, S.profil.emailConsent)), h("button", { class: "btn", type: "submit" }, S.profil.emailSave)), msg);
      };
      drawEmail(me.email);
      kids.push(box);
    }
    kids.push(h("div", { class: "box" }, h("h2", null, S.profil.deleteTitle), h("p", { class: "muted" }, S.profil.deleteLead), h("div", { class: "actions" },
      h("button", { class: "btn btn-line", type: "button", onclick: async () => {
        if (!window.confirm(S.profil.deleteConfirm)) return;
        try { await api("DELETE", "profile"); setToken(null); toast(S.profil.deleted); go("/"); } catch (e) { toast(e.message); }
      } }, S.profil.deleteBtn))));
    return page("eu", kids);
  }
  // Deschiderea linkului privat pe alt dispozitiv.
  async function adoptToken(t) {
    history.replaceState(null, "", location.pathname + "#/profil");
    if (!online) throw new Error(S.ui.noServer);
    if (t !== token) {
      const old = token;
      token = t;
      let me;
      try { me = await api("GET", "me"); } finally { token = old; }
      // Link greșit sau șters: adresa din bară e deja „Linkul meu”, deci arătăm chiar pagina aceea, cu explicația.
      if (!me.exists) { if (old) toast(S.profil.badLink); else flash = S.profil.badLink; return viewProfile(); }
      if (old && !window.confirm(S.profil.switchConfirm)) { go("/profil"); return null; }
      setToken(t);
      toast(S.profil.welcomeBack);
    }
    go("/eu");
    return null;
  }
  function viewLegal(kind) {
    return page("eu", head(S.legal[kind + "Title"], "", "/"), h("div", { class: "legal" }, S.legal[kind].map((x) => h("section", null, h("h3", null, x.title), h("p", null, x.body)))));
  }

  // ---- Intrarea ascunsă în panou: tastați „admin” oriunde sau atingeți de 5 ori semnul © din subsol.
  let typed = "", taps = [];
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "admin") location.href = ADMIN_URL;
  });
  $("#copy").addEventListener("click", () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 3000).concat(now);
    if (taps.length >= 5) location.href = ADMIN_URL;
  });

  // ---- Pornire: se cer de la server textele salvate. Dacă serverul lipsește, rămân valorile implicite.
  (async function start() {
    try {
      const res = await fetch("/api/site");
      if (res.ok) { const data = await res.json(); S = data.site; META = data.meta; online = true; }
    } catch (e) { /* fără server: site-ul merge cu valorile implicite */ }
    // Procesatorul îl întoarce pe client la /?plata=<comanda> (sau ?plata_anulata=…). Mutăm asta în adresa paginii.
    const back = new URLSearchParams(location.search);
    if (/^[\w-]{16}$/.test(back.get("plata") || "")) history.replaceState(null, "", location.pathname + "#/plata/gata/" + back.get("plata"));
    else if (back.has("plata_anulata") || back.has("plata")) history.replaceState(null, "", location.pathname + "#/plata");
    renderHome();
    window.addEventListener("hashchange", route);
    route();
  })();
})();
