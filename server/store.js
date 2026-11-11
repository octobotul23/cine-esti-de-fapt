// Stocare mică în fișiere JSON. Orice scriere merge întâi într-un fișier temporar,
// apoi e redenumită peste original, deci o cădere în timpul scrierii nu lasă un fișier pe jumătate.

const fs = require("node:fs");
const path = require("node:path");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw new Error(`Nu pot citi ${file}: ${e.message}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function remove(file) {
  try { fs.unlinkSync(file); } catch (e) { if (e.code !== "ENOENT") throw e; }
}

module.exports = { readJson, writeJson, remove };
