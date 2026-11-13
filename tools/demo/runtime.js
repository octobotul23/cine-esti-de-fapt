// Demo fără server. Acest fișier se pune, de către tools/build-demo.js, după codul serverului împachetat
// pentru browser. Serverul adevărat (server/server.js și celelalte) rulează aici neschimbat; doar ce are sub el
// este înlocuit: fișierele devin localStorage, iar cererile către /api/… nu mai pleacă pe rețea.
// Tot ce face un vizitator rămâne în browserul lui. Nu se folosește pe site-ul real.
(function () {
  "use strict";
  const MODULES = window.CUPIDON_DEMO_MODULES;
  delete window.CUPIDON_DEMO_MODULES;
  const PREFIX = "cupidon-demo:";
  const TOKEN_KEY = "cq_profil";
  const realFetch = window.fetch.bind(window);

  // ---- Buffer: atât cât folosește serverul
  class Buf extends Uint8Array {
    toString(enc) {
      if (enc === "hex") return Array.from(this, (b) => b.toString(16).padStart(2, "0")).join("");
      if (enc === "base64" || enc === "base64url") {
        let s = "";
        for (const b of this) s += String.fromCharCode(b);
        s = btoa(s);
        return enc === "base64" ? s : s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      return new TextDecoder().decode(this);
    }
    readUInt32BE(i) { return ((this[i] << 24) | (this[i + 1] << 16) | (this[i + 2] << 8) | this[i + 3]) >>> 0; }
  }
  const Buffer = {
    from(v, enc) {
      if (typeof v !== "string") return new Buf(v);
      if (enc === "hex") return new Buf((v.match(/../g) || []).map((x) => parseInt(x, 16)));
      if (enc === "base64") return new Buf(Array.from(atob(v), (c) => c.charCodeAt(0)));
      return new Buf(new TextEncoder().encode(v));
    },
    concat(list) {
      const out = new Buf(list.reduce((n, b) => n + b.length, 0));
      let at = 0;
      for (const b of list) { out.set(b, at); at += b.length; }
      return out;
    },
    byteLength: (s) => new TextEncoder().encode(String(s)).length
  };

  // ---- SHA-256 (în browser, varianta gata făcută merge doar asincron, iar serverul o cere pe loc)
  const K = [], H0 = [];
  for (let n = 2; K.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (H0.length < 8) H0.push(((Math.sqrt(n) % 1) * 4294967296) >>> 0);
    K.push(((Math.cbrt(n) % 1) * 4294967296) >>> 0);
  }
  function sha256(bytes) {
    const len = bytes.length, total = (((len + 8) >> 6) + 1) << 6;
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[len] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 8, Math.floor(len / 536870912));
    dv.setUint32(total - 4, (len << 3) >>> 0);
    const h = H0.slice(), w = new Uint32Array(64);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
    }
    const out = new Buf(32), odv = new DataView(out.buffer);
    h.forEach((v, i) => odv.setUint32(i * 4, v));
    return out;
  }
  const sha256hex = (s) => sha256(Buffer.from(String(s))).toString("hex");

  const cryptoShim = {
    randomBytes(n) { const b = new Buf(n); window.crypto.getRandomValues(b); return b; },
    randomInt(min, max) {
      if (max === undefined) { max = min; min = 0; }
      const range = max - min, limit = Math.floor(4294967296 / range) * range, x = new Uint32Array(1);
      do { window.crypto.getRandomValues(x); } while (x[0] >= limit);
      return min + (x[0] % range);
    },
    createHash() {
      const parts = [];
      return {
        update(v) { parts.push(typeof v === "string" ? Buffer.from(v) : v); return this; },
        digest(enc) { const d = sha256(Buffer.concat(parts)); return enc ? d.toString(enc) : d; }
      };
    },
    timingSafeEqual(a, b) { let diff = a.length ^ b.length; for (let i = 0; i < a.length && i < b.length; i++) diff |= a[i] ^ b[i]; return diff === 0; },
    createHmac() { throw new Error("Demo: plățile reale nu sunt disponibile."); }
  };

  // ---- „Discul”: localStorage. Dacă browserul nu îl dă (mod privat strict), datele țin până la închiderea paginii.
  const memory = new Map();
  let ls = null;
  try { ls = window.localStorage; ls.setItem(PREFIX + "proba", "1"); ls.removeItem(PREFIX + "proba"); } catch (e) { ls = null; }
  const disk = {
    get: (k) => (ls ? ls.getItem(PREFIX + k) : memory.has(k) ? memory.get(k) : null),
    set(k, v) {
      if (!ls) { memory.set(k, v); return; }
      try { ls.setItem(PREFIX + k, v); }
      catch (e) {
        const err = new Error("Spațiul de stocare al demo-ului din acest browser s-a umplut. Apăsați „Ia-o de la capăt” în bara de sus și încercați din nou.");
        err.status = 400;
        throw err;
      }
    },
    remove(k) { if (ls) ls.removeItem(PREFIX + k); else memory.delete(k); },
    keys() {
      if (!ls) return [...memory.keys()];
      const out = [];
      for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length)); }
      return out;
    }
  };
  const missing = (file) => { const e = new Error("ENOENT: " + file); e.code = "ENOENT"; return e; };
  // Singurul fișier „de pe server” care există în demo: package.json, cu versiunea pusă de tools/build-demo.js.
  const PKG = window.CUPIDON_DEMO_PACKAGE || null;
  const isPkg = (file) => !!PKG && file === "/package.json";
  // Fișierele care nu sunt text (imaginile încărcate din panou) se țin ca base64, cu „b64:” în față.
  // Ora scrierii se ține minte doar cât e deschisă pagina: după o reîncărcare, tot ce a rămas nefolosit pare vechi și se șterge.
  const written = new Map();
  const fsShim = {
    readFileSync(file) { if (isPkg(file)) return JSON.stringify({ version: PKG.version }); const v = disk.get(file); if (v == null) throw missing(file); return v; },
    writeFileSync(file, data) { disk.set(file, data instanceof Uint8Array ? "b64:" + new Buf(data).toString("base64") : String(data)); written.set(file, Date.now()); },
    // Jurnalul: păstrăm doar ultimele 200 de rânduri, fiindcă locul din browser e mic.
    appendFileSync(file, data) { disk.set(file, ((disk.get(file) || "") + data).split("\n").slice(-201).join("\n")); },
    renameSync(from, to) { const v = disk.get(from); if (v == null) throw missing(from); disk.remove(from); disk.set(to, v); written.set(to, written.get(from) || 0); written.delete(from); },
    unlinkSync(file) { if (disk.get(file) == null) throw missing(file); disk.remove(file); },
    mkdirSync() {},
    readdirSync(dir) {
      const pre = dir.replace(/\/+$/, "") + "/";
      const names = new Set();
      for (const k of disk.keys()) if (k.startsWith(pre)) names.add(k.slice(pre.length).split("/")[0]);
      return [...names];
    },
    statSync(file) { if (isPkg(file)) return { size: 0, mtime: new Date(PKG.date), isFile: () => true }; const v = disk.get(file); if (v == null) throw missing(file); return { size: v.length, mtimeMs: written.get(file) || 0, isFile: () => true }; }
  };

  // ---- Căi de fișiere, în stil „/a/b”
  const norm = (p) => {
    const abs = p.startsWith("/"), out = [];
    for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
    return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
  };
  const pathShim = {
    sep: "/",
    normalize: norm,
    join: (...a) => norm(a.join("/")),
    resolve: (...a) => norm(a.reduce((cur, x) => (String(x).startsWith("/") ? x : cur + "/" + x), "/")),
    dirname: (p) => norm(p).replace(/\/[^/]*$/, "") || "/",
    extname: (p) => (/\.[^./]*$/.exec(p.split("/").pop()) || [""])[0],
    relative: (from, to) => (to.startsWith(from + "/") ? to.slice(from.length + 1) : to)
  };

  // ---- Contul de administrare. Un demo static nu poate păzi o parolă, așa că panoul se deschide direct.
  const DEMO_USER = { email: "demo@demo.ro" };
  const SESSION = { email: DEMO_USER.email, csrf: cryptoShim.randomBytes(24).toString("base64url") };
  const httpError = (status, message, extra) => { const e = new Error(message); e.status = status; if (extra) e.extra = extra; return e; };
  const authShim = {
    httpError, sha256: sha256hex, normEmail: (s) => String(s || "").trim().toLowerCase(), MIN_PASSWORD: 12,
    checkPasswordRules: () => null, readUsers: () => [DEMO_USER], findUser: () => DEMO_USER,
    setPassword: async () => { throw httpError(400, "În demo nu există o parolă de schimbat. Pe site-ul real, contul se creează din terminal."); },
    verifyPassword: async () => DEMO_USER,
    lockedFor: () => 0, noteFail() {}, clearFails() {},
    createSession: () => ({ token: "demo", csrf: SESSION.csrf }), getSession: () => SESSION, destroySession() {}, revokeSessions() {},
    sameToken: (a, b) => typeof a === "string" && a === b
  };

  // ---- Încărcarea modulelor serverului
  const site = window.CUPIDON;
  let handler = null;
  const builtin = {
    fs: fsShim, path: pathShim, crypto: cryptoShim, auth: authShim,
    http: { createServer(fn) { handler = fn; return { listen() {} }; } },
    // Serverul primește o copie a valorilor implicite, ca să nu le poată schimba pe cele folosite de pagină.
    content: { SITE: JSON.parse(JSON.stringify(site.SITE)), merge: site.merge }
  };
  const loaded = {};
  const processShim = { pid: 1, argv: [], env: { HISTORY_KEEP: "5" } };
  const noInterval = () => ({ unref() {} });
  function load(name) {
    const key = String(name).replace(/^node:/, "").replace(/^.*\//, "").replace(/\.js$/, "");
    if (builtin[key]) return builtin[key];
    if (loaded[key]) return loaded[key].exports;
    if (!MODULES[key]) throw new Error("Demo: lipsește modulul " + name);
    const module = (loaded[key] = { exports: {} });
    MODULES[key](load, module, module.exports, "/server", processShim, Buffer, noInterval);
    return module.exports;
  }
  load("server");

  // ---- Cererile către /api/… ajung direct la server, fără rețea
  function callApi(url, init) {
    return new Promise((resolve) => {
      const headers = { host: location.host, "sec-fetch-site": "same-origin" };
      new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; });
      const body = init.body == null ? "" : String(init.body);
      const on = {};
      const req = {
        method: String(init.method || "GET").toUpperCase(), url, headers,
        socket: { remoteAddress: "demo", encrypted: location.protocol === "https:" },
        on(ev, cb) {
          on[ev] = cb;
          if (ev === "end") queueMicrotask(() => { if (body && on.data) on.data(Buffer.from(body)); cb(); });
          return req;
        },
        destroy() {}
      };
      let status = 200, head = {}, sent = false;
      const res = {
        get headersSent() { return sent; },
        writeHead(s, h) { status = s; head = h || {}; sent = true; },
        end(text) {
          const keep = {};
          for (const k of ["Content-Type", "Content-Disposition"]) if (head[k]) keep[k] = head[k];
          resolve(new Response(text == null ? "" : text, { status, headers: keep }));
        }
      };
      Promise.resolve(handler(req, res)).catch((e) => { console.error(e); resolve(new Response(JSON.stringify({ error: "Demo-ul a întâmpinat o problemă. Reîncarcă pagina." }), { status: 500, headers: { "Content-Type": "application/json" } })); });
    });
  }
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (typeof url === "string" && url.startsWith("/api/")) return callApi(url, init || {});
    // Fișierele cerute de la rădăcină („/index.html”) se iau de lângă pagină, fiindcă demo-ul stă într-un subfolder.
    if (typeof input === "string" && /^\/[^/]/.test(input)) return realFetch(input.slice(1), init);
    return realFetch(input, init);
  };
  // Linkurile de descărcare din panou (lista de adrese de e-mail) trec și ele pe aici.
  document.addEventListener("click", async (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/api/"]');
    if (!a) return;
    e.preventDefault();
    const res = await callApi(a.getAttribute("href"), {});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(await res.blob());
    link.download = a.getAttribute("download") || "fisier";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  });

  // ---- Bara de sus a demo-ului
  const el = (tag, text, props) => Object.assign(document.createElement(tag), { textContent: text }, props);
  const getLocal = (k) => { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } };
  function restart() {
    if (!window.confirm("Ștergi tot ce ai făcut în acest demo (răspunsuri, plăți de probă, modificări din panou) și o iei de la început?")) return;
    for (const k of disk.keys()) disk.remove(k);
    try { ls.removeItem(TOKEN_KEY); } catch (e) { /* fără stocare locală */ }
    location.href = "./";
  }
  // Testul de cuplu cere doi oameni, pe două telefoane. În demo, a doua persoană răspunde din același browser.
  const person = disk.get("persoana") === "2" ? "2" : "1";
  function switchPerson() {
    const next = person === "1" ? "2" : "1";
    const mine = getLocal(TOKEN_KEY), theirs = disk.get("profil-" + next);
    if (mine) disk.set("profil-" + person, mine); else disk.remove("profil-" + person);
    try { if (theirs) ls.setItem(TOKEN_KEY, theirs); else ls.removeItem(TOKEN_KEY); } catch (e) { /* fără stocare locală */ }
    disk.set("persoana", next);
    // Pe o pagină a testului de cuplu, cealaltă persoană ajunge la invitație, ca și cum ar fi primit linkul.
    const couple = /^#\/noi\/([\w-]{16})/.exec(location.hash);
    location.hash = couple ? "/invitatie/" + couple[1] : "/";
    location.reload();
  }
  function strip() {
    const admin = document.body.classList.contains("adm");
    const bar = el("div", "", { className: "demo-strip" });
    bar.append(el("strong", "Demo"), el("span", admin ? "Panoul e deschis fără parolă, iar ce salvați rămâne doar în acest browser." : "Plățile sunt de probă. Tot ce faci rămâne doar în acest browser."));
    if (!admin && ls) bar.append(el("button", "Ești persoana " + person + ". Treci la persoana " + (person === "1" ? "2" : "1"), { type: "button", onclick: switchPerson, title: "Pentru testul de cuplu: răspunde și în locul partenerului" }));
    bar.append(el("button", "Ia-o de la capăt", { type: "button", onclick: restart }));
    document.body.prepend(bar);
  }
  if (document.body) strip(); else document.addEventListener("DOMContentLoaded", strip);

  // Adresa unei imagini, așa cum o poate arăta pagina în demo. Cele încărcate din panou („/media/…”) stau în browser
  // și se dau ca adresă „data:”; celelalte („/assets/…”) se iau de lângă pagină, fiindcă demo-ul stă într-un subfolder.
  const UPLOADS = load("config").DATA_DIR + "/uploads/";
  const IMAGE_TYPES = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };
  function media(u) {
    u = String(u || "");
    const m = /^\/media\/([A-Za-z0-9-]+\.(webp|png|jpg))$/.exec(u);
    if (!m) return u.replace(/^\/(?!\/)/, "");
    const v = disk.get(UPLOADS + m[1]);
    return v && v.startsWith("b64:") ? "data:" + IMAGE_TYPES[m[2]] + ";base64," + v.slice(4) : "";
  }

  window.CUPIDON_DEMO = { sha256: sha256hex, media };
})();
