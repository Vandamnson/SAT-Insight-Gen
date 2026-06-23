// independent verifier + non-triviality guard for the cross-skill (C1–C4) items.
// Re-derives every answer from the raw params via a SEPARATE code path (not the
// builder's), and asserts the chain is genuinely two-step. No LLM. `node build/_composecheck.mjs`.
import { drawCross, CROSS_TYPES } from "./compose.mjs";

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isInt = (v) => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;

// independent re-derivation of the final answer + (essential2step) the shortcut guard
function solve(p) {
  if (p.kind === "C1") {
    const det = p.a1 * p.b2 - p.a2 * p.b1;                       // step A: solve the 2×2 system (Cramer)
    const x = (p.c1c * p.b2 - p.b1 * p.c2c) / det, y = (p.a1 * p.c2c - p.c1c * p.a2) / det;
    const a = (p.rr - p.q * y) / x;                              // step B: use (x,y) to find the coefficient
    return { ans: a, ok: det !== 0 && isInt(x) && isInt(y) && isInt(a), essential2step: det !== 0 && x !== 0 };
  }
  if (p.kind === "C2") {
    const k = (p.a1 * p.b2) / p.b1;                              // step A: no-solution ⇒ parallel ⇒ this k
    const scale = p.b2 / p.b1, coincident = p.c2c === scale * p.c1c;
    const x = (p.g - p.e) / (k - p.f);                           // step B: solve the linear equation with that k
    return { ans: x, ok: isInt(k) && !coincident && k !== p.f && isInt(x), essential2step: !coincident && k !== p.f };
  }
  if (p.kind === "C3") {
    const x = (p.R - p.p2 * p.T) / (p.p1 - p.p2), y = p.T - x;   // step A: solve the modeled system
    return { ans: x - y, ok: p.p1 !== p.p2 && isInt(x) && isInt(y) && x > y, essential2step: p.p1 !== p.p2 };  // step B: derived difference
  }
  if (p.kind === "C4") {
    const x0 = -p.d / p.n;                                       // step A: x-intercept of line L
    const k = -(p.m * x0 + p.b);                                 // step B: force g(x0)=0
    const gOK = Math.abs(p.m * x0 + p.b + k) < 1e-9, lOK = Math.abs(p.n * x0 + p.d) < 1e-9;
    return { ans: k, ok: p.n !== 0 && isInt(x0) && isInt(k) && gOK && lOK, essential2step: p.n !== 0 && x0 !== 0 };
  }
  if (p.kind === "C5") {
    const val = (p.B - p.q * p.T) / (p.p - p.q), xMax = Math.floor(val);   // step A: model + cost inequality ; step B: floor
    return { ans: xMax, ok: p.p > p.q && val > xMax && xMax >= 0 && xMax < p.T, essential2step: p.p > p.q && !isInt(val) };
  }
  if (p.kind === "C6") {
    const k = Math.sqrt(p.a * p.d), scale = k / p.a;                       // step A: no-solution ⇒ k² = a·d ⇒ k
    const ans = p.n - k * p.m;                                             // step B: intercept of the slope-k line
    return { ans, ok: isInt(k) && p.c2 !== scale * p.c1 && isInt(ans), essential2step: isInt(k) && p.c2 !== scale * p.c1 && p.m !== 0 };
  }
  if (p.kind === "C7") {
    const gap = p.m1 - p.m2;
    const kCheck = p.q - p.m2 * p.p;                          // step A: recover k from the point on the upper boundary
    let xMax = -Infinity;                                     // step B: greatest x where lower bound ≤ upper bound (brute force)
    for (let x = -60; x <= 90; x++) if (p.m1 * x + p.b1 <= p.m2 * x + p.k) xMax = x;
    const pointFeasible = (p.m1 * p.p + p.b1 <= p.q) && (p.q <= p.m2 * p.p + p.k);
    return { ans: xMax, ok: gap >= 1 && kCheck === p.k && pointFeasible && Number.isFinite(xMax), essential2step: gap >= 1 && kCheck === p.k };
  }
  return { ans: NaN, ok: false, essential2step: false };
}

let n = 0, bad = 0, trivial = 0; const samples = {};
for (const type of CROSS_TYPES) {
  for (let i = 0; i < 80; i++) {
    const it = drawCross(type, rng(`x|${type}|${i}`)); n++;
    const claimed = Number(it.answer.accept[0]);
    const v = solve(it._p);
    if (!v.ok || Math.round(v.ans) !== claimed) { bad++; console.error(`✗ ${type}#${i}: claimed ${claimed}, re-derived ${v.ans} (ok=${v.ok})`); }
    if (!v.essential2step) { trivial++; console.error(`✗ ${type}#${i}: NOT genuinely two-step (shortcut possible)`); }
    if (i === 2) samples[type] = it;
  }
}
console.log(`\ndrawn=${n}  answer-mismatches=${bad}  trivial(shortcut)=${trivial}`);
console.log("\n--- one sample per chain (stem text) ---");
for (const type of CROSS_TYPES) {
  const it = samples[type];
  const stemTxt = it.stem.map((s) => (s.t === "mathblock" ? `[${s.v}]` : (s.segs || []).map((g) => g.v).join(""))).join("  ");
  console.log(`\n${type} (scale ${it.difficulty.scalePoint}): ${stemTxt}`);
  console.log(`   answer: ${it.answer.accept[0]}`);
}
process.exit(bad || trivial ? 1 : 0);
