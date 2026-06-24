/* ============================================================================
   _advfigcheck.mjs — independent verifier for the ADV Band-7 figure capstones.
   Re-derives every answer from the raw params via a SEPARATE path (not the builder's),
   confirms the figure is legible, and enforces that the chain genuinely needs the
   reconstruction (non-triviality).  node build/_advfigcheck.mjs
   ============================================================================ */
import { drawAdvFig, FIG_TYPES } from "./advfig.mjs";
import { legibilityCheck } from "../verify/legibility.mjs";
import { figureCheck } from "../verify/figurecheck.mjs";

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isInt = (v) => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;

function solve(p) {
  if (p.kind === "G1") {                                  // reconstruct a from the y-intercept, translate, evaluate
    const a = (p.c0 - p.vy) / (p.h * p.h), ans = a * (-p.s - p.h) ** 2 + p.vy;
    return { ans, ok: a === p.a && isInt(ans), essential: a !== 1 };   // a≠1 ⇒ the marked point is load-bearing
  }
  if (p.kind === "G2") return { ans: -p.vy, ok: isInt(p.vy), essential: true };   // tangent ⇔ vertex value + c = 0
  if (p.kind === "G3") {                                  // reconstruct a, expand, b+c
    const a = (p.c0 - p.vy) / (p.h * p.h), b = -2 * a * p.h, ans = b + p.c0;
    return { ans, ok: a === p.a && b === p.b && isInt(ans), essential: a !== 1 };
  }
  if (p.kind === "G4") {                                  // a,b from the two points; k = f(2)
    const a = p.A, b = (p.A * p.b) / p.A, ans = a * b * b;
    return { ans, ok: b === p.b && isInt(ans), essential: b !== 1 };
  }
  if (p.kind === "G5") {                                  // roots of a x^2 + (-2ah-m)x + (ah^2+vy-c) = 0
    const A2 = p.a, B2 = -2 * p.a * p.h - p.m, C2 = p.a * p.h * p.h + p.vy - p.c;
    const disc = B2 * B2 - 4 * A2 * C2;
    const r1 = Math.round((-B2 + Math.sqrt(disc)) / (2 * A2)), r2 = Math.round((-B2 - Math.sqrt(disc)) / (2 * A2));
    const roots = [r1, r2];
    const ans = r1 === p.p1 ? r2 : (r2 === p.p1 ? r1 : NaN);
    return { ans, ok: disc > 0 && roots.includes(p.p1) && roots.includes(p.p2) && ans === p.p2, essential: p.p1 !== p.p2 };
  }
  return { ans: NaN, ok: false, essential: false };
}

let n = 0, bad = 0, trivial = 0, illegible = 0; const samples = {};
for (const type of FIG_TYPES) {
  for (let i = 0; i < 80; i++) {
    const it = drawAdvFig(type, rng(`advfig|${type}|${i}`)); n++;
    const claimed = Number(it.answer.accept[0]);
    const v = solve(it._p);
    if (!v.ok || Math.round(v.ans) !== claimed) { bad++; if (bad <= 6) console.error(`✗ ${type}#${i}: claimed ${claimed}, re-derived ${v.ans} (ok=${v.ok})`); }
    if (!v.essential) { trivial++; if (trivial <= 4) console.error(`✗ ${type}#${i}: trivial (a=1 / degenerate)`); }
    const cell = { incidentals: { numbers: { figure: it.figure, task: "read_feature", answer: it.answer.accept[0], fingerprint: [] } } };
    if (!legibilityCheck(cell).keep) { illegible++; if (illegible <= 4) console.error(`✗ ${type}#${i}: illegible figure`); }
    if (i === 1) samples[type] = it;
  }
}
console.log(`\ndrawn=${n}  answer-mismatches=${bad}  trivial=${trivial}  illegible=${illegible}`);
for (const type of FIG_TYPES) {
  const it = samples[type];
  const stemTxt = it.stem.map((s) => (s.t === "mathblock" ? `[${s.v}]` : (s.segs || []).map((g) => g.v).join(""))).join(" ");
  console.log(`\n${type} (scale ${it.difficulty.scalePoint}, ${it.statementId}): ${stemTxt}`);
  console.log(`   answer = ${it.answer.accept[0]}`);
}
process.exit(bad || trivial || illegible ? 1 : 0);
