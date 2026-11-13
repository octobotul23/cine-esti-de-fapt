// Unelte din terminal pentru contul de administrare.
//   node server/manage.js create-admin adresa@exemplu.ro   – creează contul (sau îi schimbă parola)
//   node server/manage.js list                              – arată conturile existente
//   node server/manage.js remove adresa@exemplu.ro          – șterge un cont
// Parola se tastează ascuns. Pentru scripturi și teste se poate da prin variabila CUPIDON_PASSWORD.
"use strict";
const path = require("path");
const cfg = require("./config");
const store = require("./store");
const auth = require("./auth");

function askHidden(label) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) return reject(new Error("Parola nu poate fi cerută aici. Rulați comanda într-un terminal sau setați variabila CUPIDON_PASSWORD."));
    process.stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const done = (fn, arg) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); process.stdout.write("\n"); fn(arg); };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(resolve, value);
        if (ch === "\u0003") return done(reject, new Error("Anulat."));
        if (ch === "\u0008" || ch === "\u007f") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    }
    stdin.on("data", onData);
  });
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "create-admin") {
    if (!arg) throw new Error("Lipsește adresa de e-mail. Exemplu: node server/manage.js create-admin adresa@exemplu.ro");
    let password = process.env.CUPIDON_PASSWORD;
    if (!password) {
      password = await askHidden("Parola (cel puțin " + auth.MIN_PASSWORD + " caractere, nu se vede când tastați): ");
      const again = await askHidden("Repetați parola: ");
      if (password !== again) throw new Error("Cele două parole nu sunt la fel. Rulați din nou comanda.");
    }
    const created = await auth.setPassword(arg, password);
    console.log((created ? "Contul a fost creat: " : "Parola a fost schimbată pentru: ") + auth.normEmail(arg));
    console.log("Datele se păstrează în: " + cfg.DATA_DIR);
  } else if (cmd === "list") {
    const users = auth.readUsers();
    if (!users.length) console.log("Nu există niciun cont. Creați unul cu: node server/manage.js create-admin adresa@exemplu.ro");
    users.forEach((u) => console.log(u.email + "  (creat " + u.created.slice(0, 10) + ")"));
  } else if (cmd === "remove") {
    const email = auth.normEmail(arg);
    const users = auth.readUsers();
    if (!users.some((u) => u.email === email)) throw new Error("Nu există niciun cont cu adresa " + email + ".");
    store.writeJson(path.join(cfg.DATA_DIR, "users.json"), { users: users.filter((u) => u.email !== email) });
    console.log("Contul a fost șters: " + email);
  } else {
    console.log("Comenzi:\n  create-admin <e-mail>   creează contul sau îi schimbă parola\n  list                    arată conturile\n  remove <e-mail>         șterge un cont");
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
