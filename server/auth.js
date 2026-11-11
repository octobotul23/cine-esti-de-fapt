// Conturi de administrare, parole, sesiuni și blocarea după parole greșite.
"use strict";
const crypto = require("crypto");
const path = require("path");
const cfg = require("./config");
const store = require("./store");

const USERS_FILE = path.join(cfg.DATA_DIR, "users.json");
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEY_LEN = 64;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;
const MAX_FAILS = 5;
const FIRST_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

function httpError(status, message, extra) {
  const e = new Error(message);
  e.status = status;
  if (extra) e.extra = extra;
  return e;
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const normEmail = (s) => String(s || "").trim().toLowerCase();

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password).normalize("NFKC"), salt, KEY_LEN, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return { salt: salt.toString("hex"), hash: key.toString("hex") };
}

function checkPasswordRules(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return "Parola trebuie să aibă cel puțin " + MIN_PASSWORD + " caractere.";
  if (password.length > MAX_PASSWORD) return "Parola este prea lungă (cel mult " + MAX_PASSWORD + " de caractere).";
  return null;
}

function readUsers() {
  const data = store.readJson(USERS_FILE, null);
  return data && Array.isArray(data.users) ? data.users : [];
}
function findUser(email) {
  const e = normEmail(email);
  return readUsers().find((u) => u.email === e) || null;
}
async function setPassword(email, password) {
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 120) throw httpError(400, "Adresa de e-mail nu este validă.");
  const problem = checkPasswordRules(password);
  if (problem) throw httpError(400, problem);
  const users = readUsers();
  const secret = await hashPassword(password);
  const now = new Date().toISOString();
  const existing = users.find((u) => u.email === e);
  if (existing) Object.assign(existing, secret, { changed: now });
  else users.push({ email: e, ...secret, created: now, changed: now });
  store.writeJson(USERS_FILE, { users });
  return !existing;
}

// Un hash fals, ca verificarea să dureze la fel și pentru un e-mail care nu există.
let dummy = null;
async function verifyPassword(email, password) {
  const user = findUser(email);
  if (!dummy) dummy = await hashPassword(crypto.randomBytes(18).toString("hex"));
  const ref = user || dummy;
  if (typeof password !== "string" || password.length > MAX_PASSWORD) password = "";
  const key = await scrypt(password, Buffer.from(ref.salt, "hex"));
  const good = Buffer.from(ref.hash, "hex");
  const same = key.length === good.length && crypto.timingSafeEqual(key, good);
  return same && !!user ? user : null;
}

// ---- Blocare după parole greșite: se ține minte separat pentru IP și pentru cont.
const fails = new Map();
function lockedFor(key) {
  const f = fails.get(key);
  if (!f || !f.until) return 0;
  const left = f.until - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}
function noteFail(key) {
  const f = fails.get(key) || { count: 0, lock: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) {
    f.lock = f.lock ? Math.min(f.lock * 2, MAX_LOCK_MS) : FIRST_LOCK_MS;
    f.until = Date.now() + f.lock;
  }
  f.last = Date.now();
  fails.set(key, f);
}
function clearFails(key) { fails.delete(key); }

// ---- Sesiuni: în memorie, după hash-ul tokenului. Repornirea serverului cere o nouă autentificare.
const sessions = new Map();
const IDLE_MS = cfg.SESSION_IDLE_HOURS * 3600 * 1000;
const MAX_MS = cfg.SESSION_MAX_DAYS * 24 * 3600 * 1000;

function createSession(email) {
  const token = crypto.randomBytes(32).toString("base64url");
  const csrf = crypto.randomBytes(24).toString("base64url");
  const now = Date.now();
  sessions.set(sha256(token), { email: normEmail(email), csrf, created: now, seen: now });
  return { token, csrf };
}
function getSession(token) {
  if (!token || typeof token !== "string" || token.length > 200) return null;
  const key = sha256(token);
  const s = sessions.get(key);
  if (!s) return null;
  const now = Date.now();
  if (now - s.seen > IDLE_MS || now - s.created > MAX_MS || !findUser(s.email)) { sessions.delete(key); return null; }
  s.seen = now;
  return s;
}
function destroySession(token) { if (token) sessions.delete(sha256(token)); }
function revokeSessions(email, exceptToken) {
  const keep = exceptToken ? sha256(exceptToken) : null;
  for (const [key, s] of sessions) if (s.email === normEmail(email) && key !== keep) sessions.delete(key);
}
function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) if (now - s.seen > IDLE_MS || now - s.created > MAX_MS) sessions.delete(key);
  for (const [key, f] of fails) if (now - (f.last || 0) > 2 * MAX_LOCK_MS) fails.delete(key);
}, 10 * 60 * 1000).unref();

module.exports = {
  httpError, sha256, normEmail, MIN_PASSWORD, checkPasswordRules, readUsers, findUser, setPassword, verifyPassword,
  lockedFor, noteFail, clearFails, createSession, getSession, destroySession, revokeSessions, sameToken
};
