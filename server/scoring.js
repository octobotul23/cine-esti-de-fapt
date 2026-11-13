// Calculul rezultatelor. Funcțiile de aici nu citesc și nu scriu nimic pe disc:
// primesc conținutul curent și răspunsurile și întorc ce are voie să vadă clientul.
"use strict";
const crypto = require("crypto");

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function validAnswer(mod, q, v) {
  return mod.type === "likert" ? isInt(v, 1, 5) : isInt(v, 0, q.options.length - 1);
}
function inScope(mod, unlocked) {
  return mod.questions.filter((q) => unlocked || q.free);
}
function countAnswered(mod, qs, answers) {
  return qs.reduce((n, q) => n + (validAnswer(mod, q, answers[q.id]) ? 1 : 0), 0);
}
function levelOf(score, levels) {
  return score < levels.low ? "low" : score >= levels.high ? "high" : "mid";
}

// Scor 0–100 pe fiecare trăsătură, din întrebările la care s-a răspuns.
function likertDims(mod, qs, answers, levels) {
  const acc = {};
  for (const q of qs) {
    const v = answers[q.id];
    if (!isInt(v, 1, 5)) continue;
    (acc[q.dim] = acc[q.dim] || []).push(q.rev ? 6 - v : v);
  }
  return mod.dims.map((d) => {
    const a = acc[d.id];
    if (!a) return { d, score: null, level: null };
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    const score = Math.round(((mean - 1) / 4) * 100);
    return { d, score, level: levelOf(score, levels) };
  });
}

function quizCount(mod, qs, answers) {
  let correct = 0;
  const areas = mod.areas.map((a) => ({ id: a.id, name: a.name, correct: 0, total: 0 }));
  for (const q of qs) {
    const area = areas.find((a) => a.id === q.area);
    if (area) area.total += 1;
    if (answers[q.id] === q.correct) { correct += 1; if (area) area.correct += 1; }
  }
  return { correct, total: qs.length, areas };
}
function bandFor(mod, correct, total) {
  const pct = total ? (correct / total) * 100 : 0;
  let band = mod.bands[0];
  for (const b of mod.bands) if (pct >= b.min) band = b;
  return { lo: band.lo, hi: band.hi };
}

// Unde a ajuns clientul cu un test: nou, început, rezultat parțial, deblocat (mai are întrebări), terminat.
function moduleStatus(mod, answers, unlocked) {
  if (mod.type === "tarot") return { type: "tarot", unlocked, status: unlocked ? "done" : "new" };
  answers = answers || {};
  const free = mod.questions.filter((q) => q.free);
  const scope = inScope(mod, unlocked);
  const answered = countAnswered(mod, scope, answers);
  let status;
  if (unlocked) status = answered >= scope.length ? "done" : "unlocked";
  else status = answered >= free.length ? "partial" : answered > 0 ? "progress" : "new";
  return { type: mod.type, unlocked, status, answered, total: scope.length, free: free.length, fullTotal: mod.questions.length };
}

function moduleResult(mod, answers, unlocked, tests) {
  answers = answers || {};
  const scope = inScope(mod, unlocked);
  const answered = countAnswered(mod, scope, answers);
  const base = { type: mod.type, unlocked, complete: answered >= scope.length, answered, total: scope.length, fullTotal: mod.questions.length };

  if (mod.type === "likert") {
    const dims = likertDims(mod, scope, answers, tests.levels);
    let top = null;
    for (const x of dims) if (x.score !== null && (!top || x.score > top.score)) top = x;
    base.dims = dims.map((x) => {
      const open = unlocked || x === top;
      if (!open || x.score === null) return { id: x.d.id, name: x.d.name, desc: x.d.desc, locked: true };
      return { id: x.d.id, name: x.d.name, desc: x.d.desc, score: x.score, level: x.level, text: x.d[x.level], tip: unlocked ? x.d.tip : null };
    });
    return base;
  }

  const count = quizCount(mod, scope, answers);
  base.correct = count.correct;
  if (unlocked && base.complete) {
    base.interval = bandFor(mod, count.correct, count.total);
    base.areas = count.areas;
    base.review = scope.map((q) => ({ text: q.text, options: q.options, yours: answers[q.id], right: q.correct, explain: q.explain }));
  }
  return base;
}

// Raportul care leagă testele. Intră doar testele terminate complet.
function buildReport(tests, siteModules, answersByModule) {
  const pool = [];
  const missing = [];
  let done = 0, iq = null, bigfive = null;
  for (const m of siteModules) {
    const mod = tests.modules[m.id];
    if (!m.on || !mod || mod.type === "tarot") continue;
    const answers = answersByModule[m.id] || {};
    if (countAnswered(mod, mod.questions, answers) < mod.questions.length) { missing.push(m.name); continue; }
    done += 1;
    if (mod.type === "likert") {
      const dims = likertDims(mod, mod.questions, answers, tests.levels);
      for (const x of dims) pool.push({ module: m.id, name: x.d.name, score: x.score, d: x.d });
      if (m.id === "bigfive") bigfive = dims;
    } else {
      const count = quizCount(mod, mod.questions, answers);
      const best = count.areas.slice().sort((a, b) => b.correct / (b.total || 1) - a.correct / (a.total || 1))[0];
      iq = { ...bandFor(mod, count.correct, count.total), correct: count.correct, total: count.total, best: best ? best.name : "", areas: count.areas };
    }
  }
  const r = tests.report;
  const out = { empty: done === 0, missing, title: r.fallbackTitle, tagline: r.fallbackTagline, profile: [], strengths: [], growth: [], work: [], love: [], iq, challenge: [], intro: { work: r.workIntro, love: r.loveIntro, growth: r.growthIntro } };
  if (out.empty) return out;

  if (bigfive) {
    const sorted = bigfive.slice().sort((a, b) => b.score - a.score);
    const pair = [sorted[0].d.id, sorted[1].d.id];
    const hit = r.archetypes.find((a) => pair.includes(a.a) && pair.includes(a.b) && a.a !== a.b);
    if (hit) { out.title = hit.title; out.tagline = hit.tagline; }
    out.profile = bigfive.map((x) => ({ name: x.d.name, score: x.score }));
  }
  const strong = pool.filter((x) => x.d.strength);
  const desc = strong.slice().sort((a, b) => b.score - a.score);
  const asc = strong.slice().sort((a, b) => a.score - b.score);
  out.strengths = desc.slice(0, 5).map((x) => ({ name: x.name, score: x.score, text: x.d.forte }));
  out.growth = asc.slice(0, 3).map((x) => ({ name: x.name, score: x.score, text: x.d.tip }));
  out.work = desc.filter((x) => x.d.area === "munca").slice(0, 3).map((x) => ({ name: x.name, text: x.d.forte }));
  out.love = desc.filter((x) => x.d.area === "relatii").slice(0, 3).map((x) => ({ name: x.name, text: x.d.forte }));
  const days = asc.slice(0, 3).map((x) => x.d.provocare).filter(Boolean);
  for (const c of r.challenges) if (days.length < 7) days.push(c);
  out.challenge = days.slice(0, 7);
  return out;
}

// ---- Testul rapid. Nu se păstrează nimic: rezultatul se calculează din răspunsurile trimise.
function quickComplete(qs, answers) {
  return qs.every((q) => isInt(answers[q.id], 0, q.options.length - 1));
}
// modules: testele care se văd pe site, în ordinea lor. Testul recomandat e cel spre care trag cele mai multe
// răspunsuri; la egalitate câștigă cel care apare primul pe site.
function quickResult(quick, answers, modules) {
  const choices = [], review = [], votes = {};
  let correct = 0;
  for (const q of quick.questions) {
    const v = answers[q.id];
    const right = q.options.findIndex((o) => o.right);
    if (right >= 0) {
      if (v === right) correct += 1;
      review.push({ topic: q.topic, text: q.text, options: q.options.map((o) => o.text), yours: v, right, explain: q.explain });
    } else {
      const o = q.options[v];
      choices.push({ topic: q.topic, text: q.text, answer: o.text, note: o.note });
      if (o.module) votes[o.module] = (votes[o.module] || 0) + 1;
    }
  }
  let next = null;
  for (const m of modules) if (!next || (votes[m.id] || 0) > (votes[next.id] || 0)) next = m;
  let score = null;
  if (review.length) {
    const pct = (correct / review.length) * 100;
    const level = quick.levels[pct < quick.thresholds.low ? "low" : pct >= quick.thresholds.high ? "high" : "mid"];
    score = { correct, total: review.length, title: level.title, text: level.text };
  }
  return { total: quick.questions.length, score, choices, review, next: next ? { id: next.id, name: next.name, tagline: next.tagline } : null };
}

// ---- Tarot
function cardOfDay(cards, profileHash, day) {
  const h = crypto.createHash("sha256").update(profileHash + "|" + day).digest();
  return cards[h.readUInt32BE(0) % cards.length];
}
// Suma cifrelor datei de naștere, redusă până încape între 1 și 22. 22 este Nebunul (0).
function personalNumber(day, month, year) {
  const digits = (n) => String(n).split("").reduce((s, c) => s + Number(c), 0);
  let n = digits(day) + digits(month) + digits(year);
  while (n > 22) n = digits(n);
  return n === 22 ? 0 : n;
}
function drawSpread(cards, count) {
  const pool = cards.map((c) => c.n);
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(crypto.randomInt(pool.length), 1)[0]);
  return out;
}
function publicCard(card, full) {
  const c = { n: card.n, name: card.name, keys: card.keys, scurt: card.scurt };
  if (full) { c.sens = card.sens; c.umbra = card.umbra; c.sfat = card.sfat; }
  return c;
}

// ---- Cuplu
function pairAnswerOk(q, v) {
  return !!v && isInt(v.own, 0, q.options.length - 1) && isInt(v.guess, 0, q.options.length - 1);
}
function pairCount(qs, answers) {
  return qs.reduce((n, q) => n + (pairAnswerOk(q, (answers || {})[q.id]) ? 1 : 0), 0);
}
function pairSame(qs, a, b) {
  let same = 0, total = 0;
  for (const q of qs) {
    if (!pairAnswerOk(q, a[q.id]) || !pairAnswerOk(q, b[q.id])) continue;
    total += 1;
    if (a[q.id].own === b[q.id].own) same += 1;
  }
  return { same, total };
}
function pairReport(couple, qs, a, b) {
  const cats = couple.cats.map((c) => ({ id: c.id, name: c.name, same: 0, total: 0, c }));
  const surprises = [];
  let same = 0, total = 0, aKnows = 0, bKnows = 0;
  for (const q of qs) {
    const x = a[q.id], y = b[q.id];
    if (!pairAnswerOk(q, x) || !pairAnswerOk(q, y)) continue;
    total += 1;
    const cat = cats.find((c) => c.id === q.cat);
    if (cat) cat.total += 1;
    if (x.own === y.own) { same += 1; if (cat) cat.same += 1; }
    if (x.guess === y.own) aKnows += 1; else surprises.push({ who: "a", text: q.text, guess: q.options[x.guess], real: q.options[y.own] });
    if (y.guess === x.own) bKnows += 1; else surprises.push({ who: "b", text: q.text, guess: q.options[y.guess], real: q.options[x.own] });
  }
  const pct = total ? ((aKnows + bKnows) / (2 * total)) * 100 : 0;
  const key = pct < couple.thresholds.low ? "low" : pct >= couple.thresholds.high ? "high" : "mid";
  return {
    total, same, aKnows, bKnows, percent: Math.round(pct), level: couple.levels[key],
    cats: cats.filter((c) => c.total > 0).map((c) => {
      const close = c.same * 2 >= c.total;
      return { name: c.name, same: c.same, total: c.total, close, text: close ? c.c.apropie : c.c.discuta, question: close ? "" : c.c.intrebare };
    }),
    surprises: surprises.slice(0, 14)
  };
}

module.exports = {
  isInt, validAnswer, inScope, countAnswered, moduleStatus, moduleResult, buildReport, quickComplete, quickResult,
  cardOfDay, personalNumber, drawSpread, publicCard, pairAnswerOk, pairCount, pairSame, pairReport
};
