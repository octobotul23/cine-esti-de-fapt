// Panoul de administrare. Ține o copie de lucru a conținutului; nimic nu ajunge pe site până la „Salvați”.
// Tot ce se afișează se pune ca text simplu (textContent), niciodată cu innerHTML.
(function () {
  "use strict";
  const DEF = window.CUPIDON.SITE;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const main = $("#adm"), nav = $("#nav"), bar = $("#savebar"), barMsg = $("#save-msg"), saveBtn = $("#save");
  const BAR_TEXT = barMsg.textContent;
  const SECTIONS = [["texte", "Texte"], ["preturi", "Prețuri"], ["teste", "Teste"], ["cuplu", "Test de cuplu"], ["tarot", "Tarot"], ["raport", "Raport"], ["coduri", "Coduri promo"], ["setari", "Setări"]];

  let csrf = "", rev = 0, doc = null, origJson = "", section = "texte", curMod = "", query = "", pageMap = null, uid = 0, version = null;
  const open = new Set(["g:Prima pagină"]);   // ce grupuri și rânduri sunt deschise
  const shapes = {};                          // forma unui rând nou, pentru fiecare listă

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
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const short = (s, n) => { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const when = (iso) => (iso ? new Date(iso).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" }) : "");
  const day = (iso) => { const d = new Date(iso), two = (n) => String(n).padStart(2, "0"); return two(d.getDate()) + "." + two(d.getMonth() + 1) + "." + d.getFullYear(); };
  const money = (n) => Number(n).toFixed(2).replace(".", ",") + " " + doc.site.settings.currency;
  const many = (n, one, more) => (n === 1 ? "1 " + one : n + (n % 100 === 0 || n % 100 >= 20 ? " de " : " ") + more);
  const newId = (p) => p + "_" + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
  const swap = (a, i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
  function blank(v) {
    if (Array.isArray(v)) return [];
    if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = blank(v[k]); return o; }
    return typeof v === "number" ? 0 : typeof v === "boolean" ? false : "";
  }
  let toastTimer = 0;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Am copiat: " + text); } catch (e) { window.prompt("Copiați de aici:", text); }
  }

  async function api(method, path, body) {
    const headers = {};
    if (method !== "GET") headers["X-CSRF"] = csrf;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try { res = await fetch("/api/" + path, { method, headers, credentials: "same-origin", body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error("Nu am putut ajunge la server. Verificați conexiunea la internet și încercați din nou."); }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.error) || "Serverul nu a putut face asta. Încercați din nou peste un minut.");
      err.status = res.status;
      err.errors = data && data.errors;
      if (res.status === 401 && path !== "admin/login") showLogin("Sesiunea a expirat. Intrați din nou în cont.");
      throw err;
    }
    return data;
  }

  // ---- Bara de jos: apare când copia de lucru diferă de ce e salvat
  function touch() {
    const dirty = !!doc && JSON.stringify(doc) !== origJson;
    bar.hidden = !dirty;
    if (!dirty) barMsg.replaceChildren(BAR_TEXT);
    return dirty;
  }
  const changed = () => { touch(); render(); };
  const barErrors = (list) => barMsg.replaceChildren(h("ul", { class: "errlist" }, list.map((e) => h("li", null, e))));
  function setDoc(d) { rev = d.rev; doc = clone(d.doc); origJson = JSON.stringify(doc); touch(); }

  saveBtn.addEventListener("click", async () => {
    const wrong = $('[aria-invalid="true"]', main);
    if (wrong) { barErrors(["Un câmp marcat cu roșu nu este completat corect. Corectați-l, apoi apăsați din nou „Salvați”."]); wrong.focus(); return; }
    saveBtn.disabled = true;
    try {
      setDoc(await api("PUT", "site", { rev, doc }));
      toast("Am salvat. Modificările sunt acum pe site.");
      render();
    } catch (e) { barErrors(e.errors && e.errors.length ? e.errors : [e.message]); }
    saveBtn.disabled = false;
  });
  $("#discard").addEventListener("click", () => {
    if (!window.confirm("Renunțați la toate modificările nesalvate?")) return;
    doc = JSON.parse(origJson);
    changed();
  });
  window.addEventListener("beforeunload", (e) => { if (doc && JSON.stringify(doc) !== origJson) e.preventDefault(); });
  $("#logout").addEventListener("click", async () => {
    if (touch() && !window.confirm("Aveți modificări nesalvate. Dacă ieșiți acum, se pierd. Ieșiți din cont?")) return;
    try { await api("POST", "admin/logout", {}); } catch (e) { /* oricum arătăm pagina de intrare */ }
    showLogin("");
  });

  // ---- Câmpuri legate direct de copia de lucru
  function wrapField(label, el, hint) {
    el.id = "f" + (++uid);
    return h("div", { class: "field" }, h("label", { for: el.id }, label), el, hint ? h("p", { class: "hint" }, hint) : null);
  }
  function text(obj, key, label, o) {
    o = o || {};
    const val = String(obj[key] == null ? "" : obj[key]);
    const long = o.long || val.length > 60 || val.includes("\n");
    const el = h(long ? "textarea" : "input", { class: "input", maxlength: o.max || 3000, rows: long ? 3 : null, placeholder: o.placeholder, autocomplete: "off" });
    el.value = val;
    el.addEventListener("input", () => { obj[key] = el.value; touch(); });
    return wrapField(label, el, o.hint);
  }
  function num(obj, key, label, o) {
    const el = h("input", { class: "input", inputmode: o.int ? "numeric" : "decimal", autocomplete: "off" });
    el.value = String(obj[key]).replace(".", ",");
    const msg = h("p", { class: "err", hidden: true }, "Scrieți un număr " + (o.int ? "întreg " : "") + "între " + o.min + " și " + o.max + (o.int ? "." : ", cu cel mult două zecimale. Exemplu: 24,99"));
    el.addEventListener("input", () => {
      const raw = el.value.trim().replace(",", ".");
      const v = Number(raw);
      const ok = (o.int ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(raw) && v >= o.min && v <= o.max;
      el.setAttribute("aria-invalid", String(!ok));
      msg.hidden = ok;
      if (ok) { obj[key] = v; touch(); }
    });
    const f = wrapField(label, el, o.hint);
    f.append(msg);
    return f;
  }
  function toggle(obj, key, label, sub) {
    const el = h("input", { type: "checkbox", checked: !!obj[key] });
    el.addEventListener("change", () => { obj[key] = el.checked; touch(); });
    return h("label", { class: "check" }, el, h("span", null, label, sub ? h("small", null, sub) : null));
  }
  function pick(obj, key, label, options, hint) {
    const el = h("select", { class: "input" }, options.map(([v, t]) => h("option", { value: v }, t)));
    if (!options.some(([v]) => v === obj[key])) el.append(h("option", { value: obj[key] }, "Lipsește din listă: " + obj[key]));
    el.value = obj[key];
    el.addEventListener("change", () => { obj[key] = el.value; touch(); });
    return wrapField(label, el, hint);
  }
  const mini = (label, disabled, onclick, cls, aria) => h("button", { class: "mini " + (cls || ""), type: "button", disabled: !!disabled, onclick, "aria-label": aria }, label);
  const labeled = (label, node, hint) => h("div", { class: "field" }, h("span", { class: "label" }, label), hint ? h("p", { class: "hint" }, hint) : null, node);

  // Un grup care se deschide. Conținutul se construiește abia la prima deschidere.
  function group(key, title, sub, build) {
    const d = h("details", { class: "adm-group", open: open.has(key) }, h("summary", null, title, sub ? h("small", null, sub) : null));
    let built = false;
    d.make = () => { if (built) return; built = true; d.append(h("div", { class: "adm-body" }, build())); };
    if (open.has(key)) d.make();
    d.addEventListener("toggle", () => { if (d.open) { open.add(key); d.make(); } else open.delete(key); });
    return d;
  }
  // O listă de rânduri cu mai multe câmpuri: fiecare rând se deschide, se mută, se șterge.
  // o: { id, items, title(item, i), body(item, i), make(blank), addLabel, fixed, noMove, min, max }
  function list(o) {
    const named = (it) => it && typeof it === "object" && (it.id != null || it.n != null);
    const keyOf = (it, i) => o.id + ":" + (named(it) ? (it.id != null ? it.id : "n" + it.n) : i);
    const forget = () => { if (!named(o.items[0])) for (const k of [...open]) if (k.startsWith(o.id + ":")) open.delete(k); };
    if (o.items.length && typeof o.items[0] === "object") shapes[o.id] = blank(o.items[0]);
    const box = h("div", { class: "adm-list" });
    o.items.forEach((item, i) => {
      const key = keyOf(item, i);
      const sum = h("summary", null, o.title(item, i));
      const d = h("details", { class: "adm-item", open: open.has(key) }, sum);
      let built = false;
      const build = () => {
        if (built) return;
        built = true;
        const tools = [
          o.noMove ? null : mini("Mutați mai sus", i === 0, () => { swap(o.items, i, i - 1); forget(); changed(); }),
          o.noMove ? null : mini("Mutați mai jos", i === o.items.length - 1, () => { swap(o.items, i, i + 1); forget(); changed(); }),
          o.fixed ? null : mini("Ștergeți", o.items.length <= (o.min || 0), () => {
            if (!window.confirm("Ștergeți „" + short(o.title(item, i), 80) + "”? Ștergerea ajunge pe site abia după ce salvați.")) return;
            o.items.splice(i, 1); forget(); changed();
          }, "mini-danger")
        ].filter(Boolean);
        d.append(h("div", { class: "adm-body" }, o.body(item, i), tools.length ? h("div", { class: "adm-tools" }, tools) : null));
      };
      if (open.has(key)) build();
      d.addEventListener("toggle", () => { if (d.open) { open.add(key); build(); } else open.delete(key); });
      const retitle = () => { sum.textContent = o.title(item, i); };
      d.addEventListener("input", retitle);
      d.addEventListener("change", retitle);
      box.append(d);
    });
    if (!o.fixed) box.append(h("div", { class: "adm-tools" }, mini(o.addLabel, o.max && o.items.length >= o.max, () => {
      const it = o.make(clone(shapes[o.id] || {}));
      o.items.push(it);
      open.add(keyOf(it, o.items.length - 1));
      changed();
    })));
    return box;
  }
  // O listă de texte simple. Cu o.correct = { obj, key } fiecare rând are și un buton „răspuns corect”.
  function strings(o) {
    const box = h("div", { class: "adm-list" });
    const c = o.correct, name = "r" + (++uid);
    o.items.forEach((val, i) => {
      const el = h("input", { class: "input", maxlength: 3000, "aria-label": o.label(i), placeholder: o.label(i), autocomplete: "off" });
      el.value = val;
      el.addEventListener("input", () => { o.items[i] = el.value; touch(); });
      const radio = c ? h("input", { type: "radio", name, checked: c.obj[c.key] === i, "aria-label": "Răspunsul corect este varianta " + (i + 1), title: "Răspunsul corect" }) : null;
      if (radio) radio.addEventListener("change", () => { c.obj[c.key] = i; touch(); });
      const move = (j) => { swap(o.items, i, j); if (c) { if (c.obj[c.key] === i) c.obj[c.key] = j; else if (c.obj[c.key] === j) c.obj[c.key] = i; } changed(); };
      box.append(h("div", { class: "srow" }, radio, el, o.fixed ? null : h("div", { class: "adm-tools" },
        mini("↑", i === 0, () => move(i - 1), "", "Mutați mai sus"), mini("↓", i === o.items.length - 1, () => move(i + 1), "", "Mutați mai jos"),
        mini("✕", o.items.length <= (o.min || 0), () => { o.items.splice(i, 1); if (c) { if (c.obj[c.key] === i) c.obj[c.key] = 0; else if (c.obj[c.key] > i) c.obj[c.key] -= 1; } changed(); }, "mini-danger", "Ștergeți"))));
    });
    if (!o.fixed) box.append(h("div", { class: "adm-tools" }, mini(o.addLabel, o.max && o.items.length >= o.max, () => { o.items.push(""); changed(); })));
    return box;
  }

  // ---- Intrarea în cont
  function showLogin(note) {
    doc = null;
    bar.hidden = true;
    nav.hidden = true;
    $("#who").hidden = true;
    const err = h("p", { class: "err", hidden: true });
    const mail = h("input", { class: "input", id: "l-mail", type: "email", autocomplete: "username", required: true });
    const pass = h("input", { class: "input", id: "l-pass", type: "password", autocomplete: "current-password", required: true });
    const go = h("button", { class: "btn btn-wide", type: "submit" }, "Intrați în panou");
    main.replaceChildren(h("form", { class: "box login", onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      go.disabled = true;
      try {
        const r = await api("POST", "admin/login", { email: mail.value, password: pass.value });
        csrf = r.csrf;
        await enter(r.email);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; pass.value = ""; go.disabled = false; }
    } }, h("h1", null, "Intrați în cont"), note ? h("p", { class: "muted" }, note) : null,
      h("div", { class: "field" }, h("label", { for: "l-mail" }, "Adresa de e-mail"), mail), h("div", { class: "field" }, h("label", { for: "l-pass" }, "Parola"), pass), err, go));
  }
  async function enter(email) {
    $("#who-mail").textContent = email;
    $("#who").hidden = false;
    const d = await api("GET", "admin/doc");
    version = d.version || null;
    setDoc(d);
    nav.hidden = false;
    route();
  }

  // ---- Navigare între secțiuni
  function route() {
    const id = location.hash.replace(/^#/, "");
    const next = SECTIONS.some((s) => s[0] === id) ? id : "texte";
    if (next !== section) { section = next; window.scrollTo(0, 0); }
    render();
  }
  window.addEventListener("hashchange", () => { if (doc) route(); });
  function render() {
    if (!doc) return;
    const y = window.scrollY;
    nav.replaceChildren(...SECTIONS.map(([id, name]) => h("a", { href: "#" + id, "aria-current": id === section ? "page" : null }, name)));
    main.replaceChildren(...VIEWS[section]().flat(3).filter(Boolean));
    window.scrollTo(0, y);
    const cur = nav.querySelector("[aria-current]");
    if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - nav.clientWidth / 2 + cur.offsetWidth / 2;
  }

  // ---- Texte: câmpurile se iau din index.html (data-edit, data-edit-list, data-edit-all), nu dintr-o listă scrisă de mână
  const WORDS = { title: "Titlul", body: "Textul", q: "Întrebarea", a: "Răspunsul", name: "Numele", desc: "Descrierea" };
  async function loadPageMap() {
    const res = await fetch("/index.html", { cache: "no-store" });
    if (!res.ok) throw new Error("Nu am putut citi pagina site-ului ca să găsesc textele. Reîncărcați panoul.");
    const dom = new DOMParser().parseFromString(await res.text(), "text/html");
    const groups = new Map(), claimed = new Set();
    const put = (el, entry) => {
      const holder = el.closest("[data-group]");
      const g = holder ? holder.dataset.group : "Alte texte";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(entry);
    };
    for (const el of dom.querySelectorAll("[data-edit], [data-edit-list], [data-edit-all]")) {
      const d = el.dataset;
      if (d.edit) { claimed.add(d.edit); put(el, { kind: "text", path: d.edit, label: d.label || d.edit }); }
      else if (d.editList) {
        claimed.add(d.editList);
        put(el, { kind: "list", path: d.editList, label: d.label || d.editList, fields: (d.fields || "").split("|").filter(Boolean).map((f) => { const i = f.indexOf(":"); return [f.slice(0, i), f.slice(i + 1)]; }) });
      } else put(el, { kind: "all", section: d.editAll });
    }
    pageMap = { groups, claimed };
  }
  // Toate textele unei secțiuni din content.js care nu au deja un câmp cu etichetă proprie.
  function expand(sectionKey) {
    const out = [];
    (function walk(def, path) {
      for (const k of Object.keys(def || {})) {
        const p = path + "." + k, v = def[k];
        if (pageMap.claimed.has(p)) continue;
        if (typeof v === "string") out.push({ kind: "text", path: p, label: "Textul „" + short(v, 90) + "”" });
        else if (Array.isArray(v)) {
          if (v.length && typeof v[0] === "object") {
            const keys = Object.keys(v[0]).filter((x) => typeof v[0][x] === "string");
            out.push({ kind: "list", path: p, label: "Lista care începe cu „" + short(v[0][keys[0]], 60) + "”", fields: keys.map((x) => [x, WORDS[x] || x]) });
          }
        } else if (v && typeof v === "object") walk(v, p);
      }
    })(DEF[sectionKey], sectionKey);
    return out;
  }
  function at(root, path) {
    const parts = path.split(".");
    let o = root;
    for (const k of parts.slice(0, -1)) o = o == null ? o : o[k];
    const key = parts[parts.length - 1];
    return o && typeof o === "object" && key in o ? { obj: o, key } : null;
  }
  function entryNode(e) {
    const ref = at(doc.site, e.path);
    if (!ref) return null;
    let node;
    if (e.kind === "text") {
      const dref = at(DEF, e.path);
      const holes = (String(dref ? dref.obj[dref.key] : "").match(/\{\w+\}/g) || []).join(", ");
      node = text(ref.obj, ref.key, e.label, { hint: holes ? "Păstrați neschimbat: " + holes + ". Site-ul pune singur valoarea potrivită în loc." : "" });
    } else {
      node = labeled(e.label, list({
        id: "t:" + e.path, items: ref.obj[ref.key], addLabel: "Adăugați un rând", make: (b) => b,
        title: (it, i) => (i + 1) + ". " + (short(it[e.fields[0][0]], 70) || "Rând nou"),
        body: (it) => e.fields.map(([k, l]) => text(it, k, l))
      }));
    }
    node.classList.add("entry");
    node.dataset.find = e.label;
    return node;
  }
  function viewTexte() {
    const head = [h("h1", null, "Texte"), h("p", { class: "lead" }, "Toate textele de pe site, grupate după pagina pe care apar. Prețurile, întrebările și textele din rezultate au secțiunile lor.")];
    if (!pageMap) {
      loadPageMap().then(() => { if (section === "texte") render(); }, (e) => main.replaceChildren(...head, h("p", { class: "err" }, e.message)));
      return [head, h("p", { class: "state" }, "Se încarcă…")];
    }
    const groups = [...pageMap.groups].map(([name, entries]) => {
      const all = entries.flatMap((e) => (e.kind === "all" ? expand(e.section) : [e]));
      return group("g:" + name, name, many(all.length, "text", "texte"), () => all.map(entryNode));
    });
    const none = h("p", { class: "muted", hidden: true }, "Niciun text nu conține ce ați scris. Încercați cu un cuvânt mai scurt.");
    const filter = () => {
      const q = query.trim().toLowerCase();
      let found = 0;
      for (const g of groups) {
        if (q.length < 2) { g.hidden = false; for (const e of g.querySelectorAll(".entry")) e.hidden = false; found += 1; continue; }
        g.make();
        let hits = 0;
        for (const e of g.querySelectorAll(".entry")) {
          const hay = (e.dataset.find + " " + Array.from(e.querySelectorAll("input, textarea"), (x) => x.value).join(" ")).toLowerCase();
          e.hidden = !hay.includes(q);
          if (!e.hidden) hits += 1;
        }
        g.hidden = !hits;
        if (hits) g.open = true;
        found += hits;
      }
      none.hidden = found > 0;
    };
    const search = h("input", { class: "input", type: "search", placeholder: "Căutați un text de pe site", "aria-label": "Căutați un text de pe site", value: query });
    search.addEventListener("input", () => { query = search.value; filter(); });
    if (query.trim().length >= 2) filter();
    return [head, search, none, groups];
  }

  // ---- Prețuri
  const PRODUCTS = [["modul", "Un singur test", "Deblochează un test, la alegerea omului."], ["pachet", "Toate testele", "Deblochează toate testele, tarotul, raportul care le leagă și testul de cuplu."], ["cuplu", "Testul de cuplu", "Deblochează raportul de cuplu. Plătește unul singur, pentru amândoi."]];
  function viewPreturi() {
    const s = doc.site.settings, P = s.products;
    const pct = h("input", { class: "input", id: "bulk-pct", inputmode: "decimal", placeholder: "10", autocomplete: "off" });
    const nn = h("input", { type: "checkbox" });
    const err = h("p", { class: "err", hidden: true }, "Scrieți un procent între -90 și 500. Exemplu: 10 pentru o scumpire de 10%, -10 pentru o ieftinire.");
    const apply = () => {
      const x = Number(pct.value.trim().replace(",", "."));
      err.hidden = pct.value.trim() !== "" && Number.isFinite(x) && x >= -90 && x <= 500;
      if (!err.hidden) return;
      for (const k in P) {
        if (!P[k].price) continue;
        const v = P[k].price * (1 + x / 100);
        P[k].price = Math.round((nn.checked ? Math.floor(v) + 0.99 : v) * 100) / 100;
      }
      toast("Am recalculat prețurile. Verificați-le, apoi apăsați „Salvați”.");
      changed();
    };
    return [h("h1", null, "Prețuri"), h("p", { class: "lead" }, "Ce se vinde pe site și cu cât. Prețurile apar pe prima pagină, sub rezultate și la plată."),
      PRODUCTS.map(([k, title, what]) => h("section", { class: "box" }, h("h2", null, title), h("p", { class: "muted" }, what),
        h("div", { class: "cols" }, text(P[k], "name", "Numele afișat pe site și la plată"), num(P[k], "price", "Prețul, în " + s.currency, { min: 0, max: 100000, hint: "La 0, produsul se deblochează fără plată." })),
        text(P[k], "desc", "Descrierea scurtă de sub nume", { long: true }), toggle(P[k], "on", "Se vinde pe site", "Când e oprit, nu mai apare nici în lista de prețuri, nici la plată."))),
      h("section", { class: "box" }, h("h2", null, "Schimbați toate prețurile deodată"), h("p", { class: "muted" }, "Mărește sau micșorează cele trei prețuri cu același procent."),
        h("div", { class: "cols" }, h("div", { class: "field" }, h("label", { for: "bulk-pct" }, "Procentul"), pct), h("label", { class: "check" }, nn, h("span", null, "Prețurile se termină în ,99", h("small", null, "De exemplu 27,49 devine 27,99.")))),
        err, h("div", { class: "actions" }, h("button", { class: "btn btn-line", type: "button", onclick: apply }, "Recalculați prețurile"))),
      h("section", { class: "box" }, h("h2", null, "Moneda"), text(s, "currency", "Cuvântul afișat după fiecare preț", { max: 8, hint: "De exemplu: lei" }))];
  }

  // ---- Teste
  const qTitle = (q, i) => (i + 1) + ". " + (short(q.text, 80) || "Întrebare nouă") + (q.free ? " (gratis)" : "");
  const freeBox = (q) => toggle(q, "free", "Face parte din varianta gratuită", "Întrebările gratuite se pun primele; restul apar după plată.");
  function likertEditor(id, mod) {
    const dims = () => mod.dims.map((d) => [d.id, d.name || "Trăsătură fără nume"]);
    return [
      group("m:" + id + ":dims", "Trăsături", many(mod.dims.length, "trăsătură", "trăsături") + ". Ce măsoară testul și ce text primește omul.", () => list({
        id: "dims:" + id, items: mod.dims, min: 1, addLabel: "Adăugați o trăsătură", make: (b) => Object.assign(b, { id: newId("d"), strength: true }),
        title: (d) => d.name || "Trăsătură nouă",
        body: (d) => [
          text(d, "name", "Numele trăsăturii, așa cum apare în rezultat"),
          text(d, "desc", "Explicația scurtă de sub nume", { long: true }),
          text(d, "low", "Textul afișat la scor mic", { long: true }), text(d, "mid", "Textul afișat la scor mediu", { long: true }), text(d, "high", "Textul afișat la scor mare", { long: true }),
          text(d, "tip", "Sfatul de sub rezultat", { long: true, hint: "Apare și în raport, la „Ce merită să dezvolți”, când scorul e printre cele mai mici." }),
          text(d, "forte", "Textul din raport, când trăsătura e printre punctele forte", { long: true }),
          text(d, "provocare", "Sarcina din „Provocarea de 7 zile”", { long: true, hint: "Se folosește când scorul la această trăsătură e printre cele mai mici trei." }),
          pick(d, "area", "Unde mai apare în raport", [["", "Doar la punctele forte"], ["munca", "Și la „La muncă”"], ["relatii", "Și la „În relații”"]]),
          toggle(d, "strength", "Se numără în raport", "Debifați pentru trăsăturile care nu trebuie să apară la puncte forte sau la ce e de dezvoltat.")
        ]
      })),
      group("m:" + id + ":q", "Întrebări", many(mod.questions.length, "întrebare", "întrebări") + ", din care " + mod.questions.filter((q) => q.free).length + " în varianta gratuită.", () => list({
        id: "q:" + id, items: mod.questions, min: 1, addLabel: "Adăugați o întrebare", make: (b) => Object.assign(b, { id: newId("q"), dim: mod.dims[0] ? mod.dims[0].id : "" }), title: qTitle,
        body: (q) => [
          text(q, "text", "Afirmația la care răspunde omul", { long: true }),
          pick(q, "dim", "Trăsătura pe care o măsoară", dims()),
          toggle(q, "rev", "Afirmație inversă", "Bifați dacă acordul cu afirmația înseamnă un scor mai mic la trăsătură."),
          freeBox(q)
        ]
      }))
    ];
  }
  function quizEditor(id, mod) {
    return [
      group("m:" + id + ":areas", "Categorii", "Felurile de întrebări. Rezultatul arată câte a nimerit omul la fiecare.", () => list({
        id: "areas:" + id, items: mod.areas, min: 1, addLabel: "Adăugați o categorie", make: (b) => Object.assign(b, { id: newId("a") }),
        title: (a) => a.name || "Categorie nouă", body: (a) => text(a, "name", "Numele categoriei, așa cum apare în rezultat")
      })),
      group("m:" + id + ":bands", "Intervale orientative", "Ce interval se afișează, în funcție de câte răspunsuri sunt corecte.", () => list({
        id: "bands:" + id, items: mod.bands, min: 1, noMove: true, addLabel: "Adăugați un interval", make: (b) => Object.assign(b, { min: 0, lo: 90, hi: 100 }),
        title: (b) => "De la " + b.min + "% răspunsuri corecte: " + b.lo + "–" + b.hi,
        body: (b) => h("div", { class: "cols" },
          num(b, "min", "Se aplică de la acest procent de răspunsuri corecte", { int: true, min: 0, max: 100, hint: "Primul rând pornește de la 0. Procentele cresc de la un rând la altul." }),
          num(b, "lo", "Intervalul afișat: de la", { int: true, min: 40, max: 200 }), num(b, "hi", "Intervalul afișat: până la", { int: true, min: 40, max: 200 }))
      })),
      group("m:" + id + ":q", "Întrebări", many(mod.questions.length, "întrebare", "întrebări") + ", din care " + mod.questions.filter((q) => q.free).length + " în varianta gratuită.", () => list({
        id: "q:" + id, items: mod.questions, min: 1, addLabel: "Adăugați o întrebare", title: qTitle,
        make: (b) => Object.assign(b, { id: newId("q"), options: ["", ""], correct: 0, area: mod.areas[0] ? mod.areas[0].id : "" }),
        body: (q) => [
          text(q, "text", "Întrebarea", { long: true }),
          labeled("Variantele de răspuns", strings({ items: q.options, min: 2, max: 6, addLabel: "Adăugați o variantă", label: (i) => "Varianta " + (i + 1), correct: { obj: q, key: "correct" } }), "Bifați cercul din dreptul răspunsului corect. Între 2 și 6 variante."),
          pick(q, "area", "Categoria întrebării", mod.areas.map((a) => [a.id, a.name || "Categorie fără nume"])),
          text(q, "explain", "Explicația răspunsului corect", { long: true, hint: "Apare după plată, la „Vezi răspunsurile”." }),
          freeBox(q)
        ]
      }))
    ];
  }
  function viewTeste() {
    const T = doc.tests, mods = doc.site.modules;
    const ids = mods.map((m) => m.id).filter((id) => T.modules[id] && T.modules[id].type !== "tarot");
    if (!ids.includes(curMod)) curMod = ids[0];
    const mod = T.modules[curMod], nameOf = (id) => (mods.find((m) => m.id === id) || {}).name || id;
    return [h("h1", null, "Teste"), h("p", { class: "lead" }, "Numele și ordinea testelor, întrebările și textele pe care le primește omul la rezultat."),
      group("teste:lista", "Lista de teste", "Numele, ordinea și ce teste se văd pe site.", () => list({
        id: "mods", items: mods, fixed: true, title: (m) => (m.name || m.id) + (m.on ? "" : " (ascuns)"),
        body: (m) => [text(m, "name", "Numele testului, așa cum apare pe site"), text(m, "tagline", "Rândul scurt de sub nume", { long: true }), toggle(m, "on", "Se vede pe site", "Un test ascuns nu mai apare în listele de pe site.")]
      })),
      group("teste:scala", "Scala de răspuns și pragurile", "Cele cinci răspunsuri de la testele cu afirmații și când un scor e mic sau mare.", () => [
        labeled("Cele cinci răspunsuri, de la dezacord la acord", strings({ items: T.scale, fixed: true, label: (i) => "Răspunsul " + (i + 1) })),
        h("div", { class: "cols" }, num(T.levels, "low", "Scor mic: sub această valoare", { int: true, min: 1, max: 99, hint: "Scorurile merg de la 0 la 100." }), num(T.levels, "high", "Scor mare: de la această valoare în sus", { int: true, min: 1, max: 99 }))
      ]),
      h("h2", null, "Întrebări și rezultate"),
      h("div", { class: "pills" }, ids.map((id) => mini(nameOf(id), false, () => { curMod = id; render(); }, "", null)).map((b, i) => { b.setAttribute("aria-pressed", String(ids[i] === curMod)); return b; })),
      mod.type === "likert" ? likertEditor(curMod, mod) : quizEditor(curMod, mod)];
  }

  // ---- Test de cuplu
  function viewCuplu() {
    const C = doc.tests.couple;
    const level = (k, title) => h("section", { class: "stack" }, h("span", { class: "label" }, title), text(C.levels[k], "title", "Titlul afișat sub procent"), text(C.levels[k], "text", "Textul de sub titlu", { long: true }));
    return [h("h1", null, "Test de cuplu"), h("p", { class: "lead" }, "Întrebările la care răspund cei doi și textele din raportul lor."),
      group("c:q", "Întrebări", many(C.questions.length, "întrebare", "întrebări") + ", din care " + C.questions.filter((q) => q.free).length + " în varianta gratuită.", () => list({
        id: "cq", items: C.questions, min: 1, addLabel: "Adăugați o întrebare", title: qTitle,
        make: (b) => Object.assign(b, { id: newId("c"), options: ["", ""], cat: C.cats[0] ? C.cats[0].id : "" }),
        body: (q) => [
          text(q, "text", "Întrebarea", { long: true, hint: "Fiecare răspunde o dată pentru sine și o dată ghicind răspunsul celuilalt." }),
          labeled("Variantele de răspuns", strings({ items: q.options, min: 2, max: 6, addLabel: "Adăugați o variantă", label: (i) => "Varianta " + (i + 1) }), "Între 2 și 6 variante."),
          pick(q, "cat", "Tema întrebării", C.cats.map((c) => [c.id, c.name || "Temă fără nume"])),
          freeBox(q)
        ]
      })),
      group("c:cats", "Teme", "Raportul arată, pe fiecare temă, cât de bine s-au ghicit cei doi.", () => list({
        id: "ccats", items: C.cats, min: 1, addLabel: "Adăugați o temă", make: (b) => Object.assign(b, { id: newId("t") }), title: (c) => c.name || "Temă nouă",
        body: (c) => [text(c, "name", "Numele temei, așa cum apare în raport"), text(c, "apropie", "Textul afișat când s-au ghicit bine la această temă", { long: true }),
          text(c, "discuta", "Textul afișat când s-au ghicit mai rar", { long: true }), text(c, "intrebare", "Întrebarea propusă pentru o discuție în doi", { long: true })]
      })),
      group("c:levels", "Concluzia raportului", "Titlul și textul de sub procentul mare, pe trei trepte.", () => [
        h("div", { class: "cols" }, num(C.thresholds, "low", "Treapta de jos: sub acest procent", { int: true, min: 1, max: 99 }), num(C.thresholds, "high", "Treapta de sus: de la acest procent", { int: true, min: 1, max: 99 })),
        level("low", "Treapta de jos"), level("mid", "Treapta de mijloc"), level("high", "Treapta de sus")
      ])];
  }

  // ---- Tarot
  function viewTarot() {
    const T = doc.tests.modules.tarot;
    return [h("h1", null, "Tarot"), h("p", { class: "lead" }, "Textele celor 22 de cărți și pozițiile din etalare. Numele secțiunii de tarot se schimbă din „Teste”, iar celelalte texte ale paginii din „Texte”."),
      group("tarot:cards", "Cele 22 de cărți", "Numărul cărților rămâne fix; puteți schimba toate textele.", () => list({
        id: "cards", items: T.cards, fixed: true, noMove: true, title: (c) => c.n + ". " + (c.name || "Carte fără nume"),
        body: (c) => [text(c, "name", "Numele cărții"), text(c, "keys", "Cuvintele-cheie de sub nume"), text(c, "scurt", "Textul scurt, gratuit, de la cartea zilei", { long: true }),
          text(c, "sens", "Ce înseamnă (apare după plată)", { long: true }), text(c, "umbra", "Partea de umbră (apare după plată)", { long: true }),
          text(c, "sfat", "Sfatul cărții (apare după plată)", { long: true }), text(c, "personal", "Textul de la „Cartea ta personală”", { long: true })]
      })),
      group("tarot:pos", "Etalarea", "Pozițiile în care se așază cărțile trase. Câte poziții, atâtea cărți (între 1 și 5).", () => list({
        id: "pos", items: T.positions, min: 1, max: 5, addLabel: "Adăugați o poziție", make: (b) => b, title: (p, i) => (i + 1) + ". " + (p.name || "Poziție nouă"),
        body: (p) => [text(p, "name", "Numele poziției"), text(p, "hint", "Explicația scurtă de sub nume", { long: true })]
      }))];
  }

  // ---- Raport
  function viewRaport() {
    const R = doc.tests.report;
    const dims = doc.tests.modules.bigfive.dims.map((d) => [d.id, d.name || d.id]);
    return [h("h1", null, "Raport"), h("p", { class: "lead" }, "Raportul care leagă toate testele: titlul profilului, introducerile și provocarea de 7 zile."),
      group("r:arch", "Titlurile de profil", "Titlul se alege după cele două trăsături de personalitate cu scorul cel mai mare.", () => [
        list({
          id: "arch", items: R.archetypes, addLabel: "Adăugați un titlu", make: (b) => Object.assign(b, { a: dims[0] ? dims[0][0] : "", b: dims[1] ? dims[1][0] : "" }), title: (a) => a.title || "Titlu nou",
          body: (a) => [h("div", { class: "cols" }, pick(a, "a", "Prima trăsătură", dims), pick(a, "b", "A doua trăsătură", dims)), text(a, "title", "Titlul profilului"), text(a, "tagline", "Rândul de sub titlu", { long: true })]
        }),
        text(R, "fallbackTitle", "Titlul folosit când nicio pereche nu se potrivește"), text(R, "fallbackTagline", "Rândul de sub acel titlu", { long: true })
      ]),
      group("r:intro", "Introducerile capitolelor", "Rândul de sub titlul fiecărui capitol din raport.", () => [
        text(R, "growthIntro", "Sub „Ce merită să dezvolți”", { long: true }), text(R, "workIntro", "Sub „La muncă”", { long: true }), text(R, "loveIntro", "Sub „În relații”", { long: true }),
        text(R, "iqLine", "Rândul despre testul de logică", { long: true, hint: "Păstrați neschimbat: {lo}, {hi}, {zona}. Site-ul pune singur valorile în loc." })
      ]),
      group("r:days", "Provocarea de 7 zile", "Primele zile vin din trăsăturile cu scor mic. Restul se completează de aici, în ordine.", () =>
        strings({ items: R.challenges, min: 4, max: 20, addLabel: "Adăugați o sarcină", label: (i) => "Sarcina " + (i + 1) }))];
  }

  // ---- Coduri promoționale (se salvează pe loc, nu prin bara de jos)
  function viewCoduri() {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
    const box = h("div", { class: "table" }, h("p", { class: "muted" }, "Se încarcă…"));
    const err = h("p", { class: "err", hidden: true });
    const call = async (fn) => {
      err.hidden = true;
      try { draw((await fn()).codes); return true; } catch (e) { err.textContent = e.message; err.hidden = false; return false; }
    };
    const row = (c) => {
      const state = !c.active ? "oprit" : c.expires && c.expires < today ? "expirat" : c.max && c.used >= c.max ? "epuizat" : "activ";
      const path = "admin/promos/" + encodeURIComponent(c.code);
      return h("div", { class: "trow" }, h("b", { class: "code" }, c.code),
        h("span", { class: "muted" }, [c.type === "2plus1" ? "2+1 gratis" : c.percent + "% reducere", "folosit de " + c.used + (c.max ? " din " + c.max : "") + " ori", c.expires ? "expiră la " + c.expires : "fără dată de expirare", state, c.note].filter(Boolean).join(", ")),
        h("div", { class: "adm-tools" }, mini("Copiați", false, () => copy(c.code)), mini(c.active ? "Opriți" : "Porniți", false, () => call(() => api("PUT", path, { active: !c.active }))),
          mini("Ștergeți", false, () => { if (window.confirm("Ștergeți codul " + c.code + "? Cine îl are nu îl va mai putea folosi.")) call(() => api("DELETE", path)); }, "mini-danger")));
    };
    const draw = (codes) => box.replaceChildren(...(codes.length ? codes.map(row) : [h("p", { class: "muted" }, "Nu aveți încă niciun cod. Creați primul din formularul de mai sus.")]));

    const code = h("input", { class: "input", id: "pc-code", maxlength: 24, autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "Se generează singur" });
    const type = h("select", { class: "input", id: "pc-type" }, h("option", { value: "percent" }, "Reducere în procente"), h("option", { value: "2plus1" }, "2+1 gratis"));
    const percent = h("input", { class: "input", id: "pc-pct", inputmode: "numeric", value: "10", autocomplete: "off" });
    const max = h("input", { class: "input", id: "pc-max", inputmode: "numeric", value: "0", autocomplete: "off" });
    const expires = h("input", { class: "input", id: "pc-exp", type: "date", min: today });
    const note = h("input", { class: "input", id: "pc-note", maxlength: 120, autocomplete: "off" });
    const pctField = h("div", { class: "field" }, h("label", { for: "pc-pct" }, "Reducerea, în procente"), percent, h("p", { class: "hint" }, "Un număr întreg de la 0 la 100. La 100, comanda e gratuită."));
    const plusHint = h("p", { class: "hint", hidden: true }, "La trei produse în coș, cel mai ieftin e gratuit (la șase, două). Pachetul „toate testele” nu se numără.");
    type.addEventListener("change", () => { pctField.hidden = type.value !== "percent"; plusHint.hidden = type.value !== "2plus1"; });
    const form = h("form", { class: "box", onsubmit: async (e) => {
      e.preventDefault();
      const ok = await call(() => api("POST", "admin/promos", { code: code.value, type: type.value, percent: Number(percent.value), max: Number(max.value), expires: expires.value, note: note.value }));
      if (ok) { code.value = ""; note.value = ""; toast("Codul a fost creat și se poate folosi de acum."); }
    } }, h("h2", null, "Cod nou"),
      h("div", { class: "cols" }, h("div", { class: "field" }, h("label", { for: "pc-code" }, "Codul"), code, h("p", { class: "hint" }, "Lăsați gol pentru un cod generat. Altfel: litere fără diacritice, cifre și liniuță, 3–24 de caractere.")),
        h("div", { class: "field" }, h("label", { for: "pc-type" }, "Ce oferă"), type, plusHint)),
      h("div", { class: "cols" }, pctField, h("div", { class: "field" }, h("label", { for: "pc-max" }, "De câte ori se poate folosi"), max, h("p", { class: "hint" }, "Scrieți 0 pentru nelimitat."))),
      h("div", { class: "cols" }, h("div", { class: "field" }, h("label", { for: "pc-exp" }, "Ultima zi în care merge"), expires, h("p", { class: "hint" }, "Lăsați gol dacă nu expiră.")),
        h("div", { class: "field" }, h("label", { for: "pc-note" }, "Notă pentru dumneavoastră"), note, h("p", { class: "hint" }, "Nu se vede pe site. De exemplu: campania de Crăciun."))),
      h("div", { class: "actions" }, h("button", { class: "btn", type: "submit" }, "Creați codul")));
    call(() => api("GET", "admin/promos"));
    return [h("h1", null, "Coduri promo"), h("p", { class: "lead" }, "Codurile se introduc la plată. Un cod nou merge imediat, fără „Salvați”."), form, err, h("h2", null, "Codurile dumneavoastră"), box];
  }

  // ---- Setări
  const EVENTS = { autentificare: "Intrare în cont", "autentificare-esuata": "Parolă greșită", iesire: "Ieșire din cont", "parola-schimbata": "Parolă schimbată", salvare: "Salvare", restaurare: "Restaurare", "cod-creat": "Cod promo creat", "cod-schimbat": "Cod promo schimbat", "cod-sters": "Cod promo șters", "export-email": "Descărcare adrese de e-mail" };
  function viewSetari() {
    const s = doc.site.settings;
    const lazy = (load, draw) => { const box = h("div", { class: "table" }, h("p", { class: "muted" }, "Se încarcă…")); load().then((d) => box.replaceChildren(...[draw(d)].flat(3).filter(Boolean)), (e) => box.replaceChildren(h("p", { class: "err" }, e.message))); return box; };
    const restore = async (id, label) => {
      const lose = touch() ? " Modificările nesalvate de acum se pierd." : "";
      if (!window.confirm("Reveniți la " + label + "?" + lose + " Versiunea de acum rămâne în listă și o puteți readuce oricând.")) return;
      try { setDoc(await api("POST", "admin/restore", { id })); toast("Am revenit la " + label + ". Schimbarea este deja pe site."); render(); } catch (e) { toast(e.message); }
    };
    // Ce metode de plată sunt pregătite pe server. Vine o singură dată; cheile secrete nu ajung niciodată aici.
    let payInfo = null;
    const payStatus = (draw) => lazy(() => payInfo || (payInfo = api("GET", "admin/pay")), draw);
    const line = (ok, t, extra) => h("p", { class: "pstat " + (ok ? "pstat-ok" : "pstat-no") }, t, extra || null);
    const addr = (t) => h("button", { class: "copy", type: "button", title: "Copiați adresa", onclick: () => copy(t) }, t);
    const needs = (list) => "Nu este pregătită. Pe server " + (list.length === 1 ? "lipsește setarea " : "lipsesc setările ") + list.join(" și ") + ". Până atunci nu apare pe site în modul „plăți reale”. Pașii sunt în README, la „Plăți”.";
    const methodStatus = (id) => payStatus((d) => {
      const m = d[id];
      if (id === "card") return [
        m.missing.length ? line(false, needs(m.missing)) : line(true, m.live ? "Stripe este legat cu o cheie reală: se încasează bani adevărați." : "Stripe este legat cu o cheie de probă: se poate încerca toată plata, dar nu se încasează bani adevărați."),
        m.missing.length ? null : line(m.webhook, m.webhook ? "Stripe ne anunță singur când o plată a intrat (webhook pornit)." : "Lipsește STRIPE_WEBHOOK_SECRET. Fără el, dacă un client închide pagina imediat după plată, accesul nu se deblochează singur."),
        h("p", { class: "hint" }, "Adresa de pus în Stripe, la Webhooks: ", addr(m.hook))
      ];
      if (id === "paypal") return [m.missing.length ? line(false, needs(m.missing)) : line(true, (m.live ? "PayPal este legat cu contul real" : "PayPal este legat cu contul de probă (sandbox): nu se încasează bani adevărați") + ". Încasează în " + m.currency + ".")];
      return [
        m.missing.length ? line(false, needs(m.missing)) : line(true, "Serverul este gata să primească SMS-urile de la agregator" + (m.ips ? ", doar de la adresele IP permise." : ".")),
        h("p", { class: "hint" }, "Adresa pe care o dați agregatorului de SMS: ", addr(m.hook), " În loc de SECRETUL puneți valoarea din SMS_HOOK_SECRET.")
      ];
    });
    const tariff = (k) => {
      const t = s.pay.sms.tariffs[k];
      const sum = h("summary");
      const name = () => { sum.textContent = ((s.products[k] || {}).name || k) + (t.on ? ": " + (t.cost || "fără cost scris") + ", la " + (t.number || "?") : " (fără SMS)"); };
      name();
      const d = h("details", { class: "adm-item", open: open.has("sms:" + k) }, sum, h("div", { class: "adm-body" },
        toggle(t, "on", "Se poate plăti prin SMS", "Doar când clientul cumpără acest produs singur, fără cod de reducere."),
        h("div", { class: "cols" }, text(t, "number", "Numărul scurt", { max: 8, hint: "Numărul primit de la agregator. Exemplu: 7415", placeholder: "7415" }),
          text(t, "keyword", "Cuvântul-cheie", { max: 20, hint: "Primul cuvânt din SMS, dacă agregatorul v-a dat unul. Altfel lăsați gol.", placeholder: "TEST" })),
        text(t, "cost", "Costul SMS-ului, așa cum îl vede clientul", { max: 60, hint: "Scrieți-l exact ca în contractul cu agregatorul, cu TVA. Exemplu: 5 EUR + TVA", placeholder: "5 EUR + TVA" })));
      d.addEventListener("toggle", () => { if (d.open) open.add("sms:" + k); else open.delete("sms:" + k); });
      d.addEventListener("input", name);
      d.addEventListener("change", name);
      return d;
    };

    const cur = h("input", { class: "input", id: "pw-cur", type: "password", autocomplete: "current-password", required: true });
    const next = h("input", { class: "input", id: "pw-new", type: "password", autocomplete: "new-password", required: true, minlength: 12 });
    const again = h("input", { class: "input", id: "pw-again", type: "password", autocomplete: "new-password", required: true });
    const pwMsg = h("p", { class: "err", hidden: true });
    const say = (t, good) => { pwMsg.textContent = t; pwMsg.className = good ? "okmsg" : "err"; pwMsg.hidden = false; };

    return [h("h1", null, "Setări"),
      group("s:general", "Date generale", "Numele site-ului, adresa de contact și ce apare în Google.", () => [
        text(s, "siteName", "Numele site-ului", { hint: "Apare în antet, pe prima pagină și pe cardurile distribuite." }),
        text(s, "coupleName", "Numele testului de cuplu"),
        text(s, "contactEmail", "Adresa de e-mail de contact", { hint: "Apare în subsol. Lăsați gol dacă nu vreți să fie afișată.", placeholder: "contact@exemplu.ro" }),
        text(s, "seoTitle", "Titlul paginii în Google și în fila browserului"),
        text(s, "seoDescription", "Descrierea paginii în Google", { long: true }),
        toggle(s, "askEmail", "Oamenii își pot lăsa adresa de e-mail", "Pe pagina „Linkul meu”, opțional și doar cu acord.")
      ]),
      group("s:pay", "Plăți", "Cum se plătește pe site: card, PayPal sau SMS. Cheile secrete nu se pun aici, ci pe server.", () => [
        pick(s, "payments", "Starea plăților", [["test", "De probă: plata e simulată, nu se încasează nimic"], ["real", "Reale: se încasează bani prin metodele pornite mai jos"], ["oprit", "Oprite: nu se poate plăti nimic"]],
          "În modul de probă, oricine apasă „Plătește” primește acces fără să plătească. Folosiți-l doar la teste. Înainte să treceți pe „Reale”, uitați-vă mai jos că fiecare metodă pornită este pregătită."),
        payStatus((d) => (d.publicUrl ? null : line(false, "Pe server nu este pusă adresa site-ului (PUBLIC_URL). Până atunci, clientul este întors după plată la adresa din care a venit. Merge, dar e mai sigur să o puneți."))),
        h("div", { class: "cols" },
          text(s, "currencyCode", "Moneda în care se încasează", { max: 3, hint: "Codul din trei litere mari: RON, EUR sau USD. Trebuie să fie aceeași monedă ca la prețuri." }),
          num(s, "eurRate", "Câți lei face un euro", { min: 0.01, max: 1000, hint: "Folosit doar la PayPal, care încasează în euro. Schimbați-l când se schimbă cursul." })),
        labeled("Metodele de plată", list({ id: "pm", items: s.pay.methods, fixed: true, title: (m) => m.name + (m.on ? "" : " (oprită)"),
          body: (m) => [methodStatus(m.id), toggle(m, "on", "Apare pe pagina de plată"), text(m, "name", "Numele arătat clientului", { max: 60 }), text(m, "note", "Explicația de sub nume", { long: true, max: 200 })] }),
          "Ordinea de aici este ordinea de pe pagina de plată. Prima metodă este cea aleasă din start."),
        labeled("Tarifele de SMS", h("div", { class: "adm-list" }, Object.keys(s.pay.sms.tariffs).map(tariff)),
          "Un SMS are preț fix, stabilit cu agregatorul. De aceea SMS-ul apare ca metodă doar când clientul cumpără un singur produs, fără reducere. Clientul trimite cuvântul-cheie urmat de un cod de 6 caractere, pe care i-l arată pagina de plată."),
        text(s.pay.sms, "reply", "SMS-ul de răspuns când plata a reușit", { max: 160, hint: "Fără diacritice, cel mult 160 de caractere." }),
        text(s.pay.sms, "replyBad", "SMS-ul de răspuns când codul nu a fost recunoscut", { max: 160, hint: "Fără diacritice, cel mult 160 de caractere." })
      ]),
      group("s:ver", "Versiuni salvate", "Fiecare salvare păstrează versiunea dinainte. Se țin ultimele 30.", () => [
        lazy(() => api("GET", "admin/history"), (d) => [
          d.versions.length ? d.versions.map((v) => h("div", { class: "trow" }, h("b", null, "Versiunea " + v.rev), h("span", { class: "muted" }, [when(v.updated), v.by, v.note].filter(Boolean).join(", ")),
            h("div", { class: "adm-tools" }, mini("Reveniți la ea", false, () => restore(v.id, "versiunea " + v.rev))))) : h("p", { class: "muted" }, "Încă nu există versiuni mai vechi. Prima apare după a doua salvare.")
        ]),
        h("div", { class: "adm-tools" }, mini("Reveniți la valorile implicite", false, () => restore("implicit", "valorile implicite, cele cu care a pornit site-ul"), "mini-danger"))
      ]),
      group("s:stats", "Cifre și comenzi", "Câți oameni au folosit site-ul și ce s-a comandat.", () => lazy(() => api("GET", "admin/stats"), (d) => [
        h("div", { class: "stats" }, [[d.profiles, d.profiles === 1 ? "om a deschis un test" : "oameni au deschis un test"], [d.started, d.started === 1 ? "a răspuns la cel puțin o întrebare" : "au răspuns la cel puțin o întrebare"], [d.couples, d.couples === 1 ? "test de cuplu pornit" : "teste de cuplu pornite"], [d.orders, d.orders === 1 ? "comandă" : "comenzi"], [money(d.revenue), "încasări din plăți reale"], [d.emails, d.emails === 1 ? "adresă de e-mail lăsată" : "adrese de e-mail lăsate"]].map(([n, t]) => h("div", { class: "stat" }, h("b", null, String(n)), h("span", null, t)))),
        d.recent.length ? d.recent.map((o) => h("div", { class: "trow" }, h("b", null, money(o.total)), h("span", { class: "muted" }, [when(o.at), o.items.join(" + "), o.code ? "cod " + o.code : "", { card: "card", paypal: "PayPal", sms: "SMS" }[o.method] || "", o.mode === "test" ? "plată de probă" : ""].filter(Boolean).join(", ")))) : h("p", { class: "muted" }, "Nicio comandă până acum."),
        d.emails ? h("div", { class: "adm-tools" }, h("a", { class: "mini", href: "/api/admin/emails.csv", download: "adrese-email.csv" }, "Descărcați adresele de e-mail (CSV)")) : null
      ])),
      group("s:pw", "Parola", "Schimbați parola contului cu care ați intrat.", () => h("form", { class: "stack", onsubmit: async (e) => {
        e.preventDefault();
        if (next.value.length < 12) return say("Parola nouă are nevoie de cel puțin 12 caractere.");
        if (next.value !== again.value) return say("Cele două parole noi nu sunt la fel. Scrieți-le din nou.");
        try { await api("POST", "admin/password", { current: cur.value, next: next.value }); cur.value = next.value = again.value = ""; say("Parola a fost schimbată. Celelalte dispozitive au fost scoase din cont.", true); }
        catch (ex) { say(ex.message); }
      } }, h("div", { class: "field" }, h("label", { for: "pw-cur" }, "Parola de acum"), cur), h("div", { class: "field" }, h("label", { for: "pw-new" }, "Parola nouă"), next, h("p", { class: "hint" }, "Cel puțin 12 caractere.")),
        h("div", { class: "field" }, h("label", { for: "pw-again" }, "Parola nouă, încă o dată"), again), pwMsg, h("div", { class: "actions" }, h("button", { class: "btn btn-line", type: "submit" }, "Schimbați parola")))),
      group("s:log", "Jurnal", "Ultimele intrări în cont, salvări și restaurări.", () => lazy(() => api("GET", "admin/audit"), (d) =>
        d.lines.length ? d.lines.map((l) => h("div", { class: "trow" }, h("b", null, EVENTS[l.event] || l.event), h("span", { class: "muted" }, [when(l.at), l.email, l.cod ? "cod " + l.cod : "", l.din ? "s-a revenit la " + l.din : "", l.rev ? (l.din ? "a rezultat versiunea " : "versiunea ") + l.rev : "", "IP " + l.ip].filter(Boolean).join(", ")))) : h("p", { class: "muted" }, "Jurnalul este gol."))),
      // Versiunea care rulează pe server, din package.json. Apare doar aici, niciodată pe site.
      version && version.number ? h("p", { class: "adm-version" }, "v" + version.number + (version.date ? " · urcată pe " + day(version.date) : "")) : null];
  }

  const VIEWS = { texte: viewTexte, preturi: viewPreturi, teste: viewTeste, cuplu: viewCuplu, tarot: viewTarot, raport: viewRaport, coduri: viewCoduri, setari: viewSetari };

  // ---- Pornire
  (async function start() {
    let me;
    try { me = await api("GET", "admin/me"); }
    catch (e) { main.replaceChildren(h("p", { class: "state" }, e.message)); return; }
    if (!me.email) return showLogin(me.hasAccount ? "" : "Nu există încă un cont de administrare. Se creează din terminal, în folderul proiectului, cu comanda: node server/manage.js create-admin adresa@exemplu.ro");
    csrf = me.csrf;
    try { await enter(me.email); } catch (e) { main.replaceChildren(h("p", { class: "state" }, e.message)); }
  })();
})();
