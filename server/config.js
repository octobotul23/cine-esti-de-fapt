// Setările serverului. Se pot schimba prin variabile de mediu sau, pentru port și folderul de date,
// prin argumente: node server/server.js --port=8080 --data=/var/lib/cupidon  (vezi README).

const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const env = process.env;
const arg = (name) => { const a = process.argv.find((x) => x.startsWith("--" + name + "=")); return a ? a.slice(name.length + 3) : ""; };
const bool = (v, d) => (v == null || v === "" ? d : /^(1|true|yes|da)$/i.test(v));

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, "public"),
  PORT: Number(arg("port") || env.PORT) || 5180,
  HOST: arg("host") || env.HOST || "0.0.0.0",
  DATA_DIR: path.resolve(ROOT, arg("data") || env.DATA_DIR || "data"),
  // În spatele nginx/Caddy: serverul are încredere în X-Forwarded-For / X-Forwarded-Proto.
  TRUST_PROXY: bool(env.TRUST_PROXY, false),
  // "auto": cookie-ul devine Secure ori de câte ori cererea a venit prin HTTPS.
  COOKIE_SECURE: env.COOKIE_SECURE || "auto",
  SESSION_IDLE_HOURS: Number(env.SESSION_IDLE_HOURS) || 8,
  SESSION_MAX_DAYS: Number(env.SESSION_MAX_DAYS) || 7,
  HISTORY_KEEP: Number(env.HISTORY_KEEP) || 30,
  // Răspunsurile unui vizitator care nu a mai revenit atâtea zile se șterg singure.
  RETENTION_DAYS: Number(env.RETENTION_DAYS) || 365,

  // ---- Plăți. Cheile secrete se dau doar aici, prin variabile de mediu; nu ajung în panou și nici în browser.
  // Adresa publică a site-ului, de ex. https://exemplu.ro. Procesatorii îl întorc pe client la ea după plată.
  PUBLIC_URL: String(env.PUBLIC_URL || "").replace(/\/+$/, ""),
  // Stripe: card, Apple Pay, Google Pay, Link și ce mai porniți din contul Stripe.
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_API: String(env.STRIPE_API || "https://api.stripe.com").replace(/\/+$/, ""),
  // PayPal. PAYPAL_ENV=sandbox pentru probe, live pentru bani adevărați.
  PAYPAL_CLIENT_ID: env.PAYPAL_CLIENT_ID || "",
  PAYPAL_SECRET: env.PAYPAL_SECRET || "",
  PAYPAL_ENV: env.PAYPAL_ENV === "live" ? "live" : "sandbox",
  PAYPAL_API: String(env.PAYPAL_API || (env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com")).replace(/\/+$/, ""),
  PAYPAL_CURRENCY: String(env.PAYPAL_CURRENCY || "EUR").toUpperCase(),
  // SMS: agregatorul apelează /api/hook/sms/<SMS_HOOK_SECRET> la fiecare mesaj primit.
  SMS_HOOK_SECRET: env.SMS_HOOK_SECRET || "",
  // Opțional: doar aceste adrese IP au voie să apeleze (despărțite prin virgulă).
  SMS_HOOK_IPS: String(env.SMS_HOOK_IPS || "").split(",").map((x) => x.trim()).filter(Boolean),
  // Opțional: numele câmpurilor trimise de agregator, dacă diferă de cele obișnuite.
  SMS_TEXT_PARAM: env.SMS_TEXT_PARAM || "",
  SMS_NUMBER_PARAM: env.SMS_NUMBER_PARAM || "",
  // Opțional: câmpul de stare și valoarea care înseamnă „plătit” (de ex. status=OK).
  SMS_STATUS_PARAM: env.SMS_STATUS_PARAM || "",
  SMS_STATUS_OK: env.SMS_STATUS_OK || ""
};
