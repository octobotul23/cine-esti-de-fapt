// Face varianta de demo a site-ului: un folder și o arhivă .zip care merg pe orice găzduire de fișiere,
// fără serverul Node (de ex. pe demo.iluz.ro). Serverul este împachetat pentru browser, iar datele
// fiecărui vizitator rămân în browserul lui (vezi tools/demo/runtime.js).
//
//   node tools/build-demo.js                → dist/demo/ și dist/cupidon-demo.zip
//   node tools/build-demo.js --serve=5183   → în plus, deschide demo-ul la http://localhost:5183/
//
// ATENȚIE: în demo, întrebările și cheile de răspuns ajung în browser. Nu se pune pe adresa publică a site-ului.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const vm = require("node:vm");
const http = require("node:http");
const nodeCrypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "dist", "demo");
const ZIP = path.join(ROOT, "dist", "cupidon-demo.zip");
// Fiecare build își păstrează pachetul aici (versions/v0.6.0/…), cu o listă alături. Nu se șterge nimic automat; folderul nu se urcă pe git.
const VERSIONS = path.join(ROOT, "versions");
// Modulele serverului care rulează în browser. auth.js lipsește intenționat: demo-ul nu are parole.
const SERVER_MODULES = ["config", "store", "people", "pay", "scoring", "validate", "tests", "server"];
const PROVIDED = ["fs", "path", "crypto", "http", "auth", "content"];
const SKIP = new Set(["site.webmanifest"]); // demo-ul nu se instalează pe ecranul principal

const fail = (msg) => { console.error("Demo-ul NU a fost făcut: " + msg); process.exit(1); };
function walk(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel)); else out.push(rel);
  }
  return out;
}

// ---- 1. Fișierele publice
fs.rmSync(OUT, { recursive: true, force: true });
for (const rel of walk(PUBLIC)) {
  if (SKIP.has(rel)) continue;
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.copyFileSync(path.join(PUBLIC, rel), path.join(OUT, rel));
}
fs.copyFileSync(path.join(__dirname, "demo", "demo.css"), path.join(OUT, "css", "demo.css"));

// ---- 2. Paginile: adrese relative (demo-ul stă într-un subfolder) și scriptul demo-ului înaintea site-ului
function patchPage(name) {
  let html = fs.readFileSync(path.join(OUT, name), "utf8");
  const swap = (from, to) => { const next = html.replace(from, to); if (next === html) fail("în " + name + " nu am găsit " + from); html = next; };
  html = html.replace(/^\s*<link rel="manifest"[^>]*>\r?\n/m, "");
  swap(/\b(href|src)="\/(?!\/)/g, '$1="');
  html = html.replace(/href=""/g, 'href="./"');
  if (!/name="robots"/.test(html)) swap(/(<meta name="viewport"[^>]*>)/, '$1\n  <meta name="robots" content="noindex, nofollow">');
  swap("</head>", '  <link rel="stylesheet" href="css/demo.css">\n</head>');
  swap('<script src="js/content.js"></script>', '<script src="js/content.js"></script>\n  <script src="js/demo-server.js"></script>');
  fs.writeFileSync(path.join(OUT, name), html);
}
patchPage("index.html");
patchPage("admin.html");

// ---- 3. Serverul, împachetat pentru browser
let bundle = "// Fișier generat de tools/build-demo.js. Nu se modifică de mână.\nwindow.CUPIDON_DEMO_MODULES = {};\n";
// Versiunea din package.json și data la care a fost făcut demo-ul: apar în panou, la Setări.
bundle += "window.CUPIDON_DEMO_PACKAGE = " + JSON.stringify({ version: require(path.join(ROOT, "package.json")).version, date: new Date().toISOString() }) + ";\n";
for (const name of SERVER_MODULES) {
  const src = fs.readFileSync(path.join(ROOT, "server", name + ".js"), "utf8");
  for (const m of src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
    const key = m[1].replace(/^node:/, "").replace(/^.*\//, "").replace(/\.js$/, "");
    if (!SERVER_MODULES.includes(key) && !PROVIDED.includes(key)) fail("server/" + name + ".js cere „" + m[1] + "”, care nu există în demo. Adăugați-l în tools/build-demo.js sau în tools/demo/runtime.js.");
  }
  bundle += "window.CUPIDON_DEMO_MODULES[" + JSON.stringify(name) + "] = function (require, module, exports, __dirname, process, Buffer, setInterval) {\n" + src + "\n};\n";
}
bundle += fs.readFileSync(path.join(__dirname, "demo", "runtime.js"), "utf8");
fs.writeFileSync(path.join(OUT, "js", "demo-server.js"), bundle);

// ---- 4. Probă: pornim demo-ul aici, fără browser, și trecem printr-un test, o plată de probă și o salvare din panou
async function selfCheck() {
  const mem = new Map();
  const win = {
    console, URL, URLSearchParams, Response, Headers, TextEncoder, TextDecoder, btoa, atob, queueMicrotask, setTimeout,
    crypto: nodeCrypto.webcrypto, fetch: () => Promise.reject(new Error("fără rețea")),
    location: { host: "demo.test", protocol: "https:", hash: "", href: "" },
    document: { body: null, addEventListener() {} },
    localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); }, key: (i) => [...mem.keys()][i], get length() { return mem.size; } }
  };
  win.window = win;
  vm.createContext(win);
  for (const f of ["content.js", "demo-server.js"]) vm.runInContext(fs.readFileSync(path.join(OUT, "js", f), "utf8"), win, { filename: f });
  const need = (ok, what) => { if (!ok) throw new Error(what); };
  let profile = "", csrf = "";
  const call = async (method, url, body) => {
    const headers = {};
    if (profile) headers["X-Profile"] = profile;
    if (csrf && method !== "GET") headers["X-CSRF"] = csrf;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await win.fetch("/api/" + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json();
    need(res.ok, method + " " + url + " → " + res.status + " " + (data && data.error));
    return data;
  };
  for (const text of ["", "abc", "ă".repeat(200)]) need(win.CUPIDON_DEMO.sha256(text) === nodeCrypto.createHash("sha256").update(text).digest("hex"), "SHA-256 greșit");
  const site = await call("GET", "site");
  const mod = site.site.modules.find((m) => m.on && site.meta.modules[m.id] && site.meta.modules[m.id].type !== "tarot");
  need(mod, "niciun test pornit");
  profile = (await call("POST", "profile", {})).token;
  need((await call("GET", "me")).exists, "profilul nu a fost găsit");
  const short = await call("GET", "test/" + mod.id);
  need(short.questions.length > 0 && !short.unlocked, "varianta gratuită nu are întrebări");
  const order = await call("POST", "pay/start", { items: [{ type: "modul", id: mod.id }], code: "" });
  need(order.mode === "test" && !order.paid, "plata nu este de probă");
  need((await call("POST", "pay/test", { order: order.order })).paid, "plata de probă nu a deblocat");
  const long = await call("GET", "test/" + mod.id);
  need(long.unlocked && long.questions.length > short.questions.length, "varianta completă nu s-a deschis");
  csrf = (await call("GET", "admin/me")).csrf;
  const saved = await call("GET", "admin/doc");
  saved.doc.site.settings.siteName = "Nume schimbat din panou";
  need((await call("PUT", "site", { doc: saved.doc, rev: saved.rev, note: "probă" })).rev === saved.rev + 1, "salvarea din panou nu a mers");
  need((await call("GET", "site")).site.settings.siteName === "Nume schimbat din panou", "ce s-a salvat din panou nu apare pe site");
  // O imagine încărcată din panou: rămâne în browser și pagina o primește ca adresă „data:”.
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const up = await call("POST", "admin/image", { slot: "logo", data: png });
  need(/^\/media\/logo-[a-f0-9]{16}\.png$/.test(up.url), "imaginea încărcată nu a primit o adresă");
  need(win.CUPIDON_DEMO.media(up.url) === "data:image/png;base64," + png, "imaginea încărcată nu se poate arăta în demo");
  need(win.CUPIDON_DEMO.media("/assets/logo.webp") === "assets/logo.webp", "imaginile de la început nu au adresă relativă în demo");
  const withImage = await call("GET", "admin/doc");
  withImage.doc.site.images.logo = up.url;
  await call("PUT", "site", { doc: withImage.doc, rev: withImage.rev, note: "probă imagine" });
  need((await call("GET", "site")).site.images.logo === up.url, "imaginea salvată din panou nu apare pe site");
}

// ---- 5. Arhiva .zip (nume cu „/”, fără foldere goale, index.html sus: așa o cere demo.iluz.ro)
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function writeZip(files) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks = [], central = [];
  let offset = 0;
  for (const rel of files) {
    const raw = fs.readFileSync(path.join(OUT, rel)), name = Buffer.from(rel, "utf8");
    const packed = zlib.deflateRawSync(raw, { level: 9 });
    const stored = packed.length >= raw.length, data = stored ? raw : packed;
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0); common.writeUInt16LE(0x0800, 2); common.writeUInt16LE(stored ? 0 : 8, 4);
    common.writeUInt16LE(time, 6); common.writeUInt16LE(date, 8); common.writeUInt32LE(crc32(raw), 10);
    common.writeUInt32LE(data.length, 14); common.writeUInt32LE(raw.length, 18); common.writeUInt16LE(name.length, 22);
    const local = Buffer.alloc(4); local.writeUInt32LE(0x04034b50);
    const cd = Buffer.alloc(6); cd.writeUInt32LE(0x02014b50); cd.writeUInt16LE(20, 4);
    const tail = Buffer.alloc(14); tail.writeUInt32LE(offset, 10);
    chunks.push(local, common, name, data);
    central.push(cd, common, tail, name);
    offset += 30 + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(ZIP, Buffer.concat([...chunks, cdBuf, end]));
}

// ---- Imitația găzduirii de demo: un subfolder cu nume secret, doar citire, fără niciun /api
function serve(port) {
  const PREFIX = "/demo-local-0123456789ab/";
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
  http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    if (pathname === "/") { res.writeHead(302, { Location: PREFIX }); return res.end(); }
    if (!pathname.startsWith(PREFIX)) { res.writeHead(404); return res.end("Not found"); }
    let rel = pathname.slice(PREFIX.length) || "index.html";
    if (!path.extname(rel)) rel = "index.html";
    const file = path.join(OUT, rel);
    if (!file.startsWith(OUT + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(fs.readFileSync(file));
  }).listen(port, "127.0.0.1", () => console.log("Demo deschis la: http://localhost:" + port + PREFIX));
}

(async () => {
  try { await selfCheck(); } catch (e) { fail("proba nu a trecut: " + e.message); }
  const files = walk(OUT).sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a < b ? -1 : 1));
  writeZip(files);
  console.log("Demo făcut și probat: " + files.length + " fișiere.");
  console.log("Folder:  " + OUT);
  console.log("Arhivă:  " + ZIP + "  (" + Math.round(fs.statSync(ZIP).size / 1024) + " KB)");
  const v = "v" + require(path.join(ROOT, "package.json")).version, kept = path.join(VERSIONS, v, "cupidon-demo.zip");
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  fs.copyFileSync(ZIP, kept);
  const listFile = path.join(VERSIONS, "versions.txt");
  let lines = [];
  try { lines = fs.readFileSync(listFile, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith(v + "\t")); } catch (e) { /* prima versiune păstrată */ }
  lines.push([v, new Date().toISOString().slice(0, 16).replace("T", " "), v + "/cupidon-demo.zip", Math.round(fs.statSync(kept).size / 1024) + " KB"].join("\t"));
  fs.writeFileSync(listFile, lines.join("\n") + "\n");
  console.log("Păstrat: " + kept);
  const arg = process.argv.find((a) => a.startsWith("--serve"));
  if (arg) serve(Number(arg.split("=")[1]) || 5183);
})();
