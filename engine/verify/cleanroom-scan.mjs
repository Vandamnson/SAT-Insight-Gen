/* cleanroom-scan — novelty/convergence scanner for a clean-room authored set.
   Committed version of the scale-test's ad-hoc analyzer (SCALE-TEST-50.md), generalized:

     node engine/verify/cleanroom-scan.mjs <setDir> [--prior a1,a2,...] [--emit <workDir>]

   <setDir> holds items.json ([{n, band, type, skill, stem, figure, answer, ...}]).
   Reports: (1) in-set pairwise surface collisions (≥0.45 floor / ≥0.60 dup / ≥0.82 near-identical)
   + structural clusters (≥0.55 on blanked shingles); (2) skill-label repeats + CANON-SUSPECT flags
   (regex screen against the banned modal structures of the steered protocol — suspects need
   adjudication by reading the item, they are NOT verdicts); (3) nearest-surface novelty vs the
   engine corpus (v1 bank + engine tiers) AND vs prior clean-room sets; (4) band/type spread;
   (5) with --emit: blind-solve batches (no answers) + key.json into <workDir>. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, nearestSurface, shingles } from "../distance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const setDir = args[0];
if (!setDir) { console.error("usage: node engine/verify/cleanroom-scan.mjs <setDir> [--prior a1,a2] [--emit <dir>]"); process.exit(2); }
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const priorNames = (opt("--prior") ?? "a1,a2,a3,a4,a5").split(",").filter(Boolean);
const emitDir = opt("--emit");

const items = JSON.parse(readFileSync(join(setDir, "items.json"), "utf8"))
  .map((it, i) => ({ id: `set#${it.n ?? i + 1}`, ...it }));
console.log(`loaded ${items.length} items from ${setDir}\n`);

/* ---- 1. in-set pairwise collisions + structural clusters ---- */
const jac = (A, B) => { let i = 0; for (const x of A) if (B.has(x)) i++; const u = A.size + B.size - i; return u ? i / u : 0; };
const sh = items.map((it) => shingles(it.stem + " " + (it.figure || "")));
const pairs = { p45: [], p60: [], p82: [] };
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const s = jac(sh[i], sh[j]);
  const rec = { a: items[i].id, b: items[j].id, sim: +s.toFixed(2) };
  if (s >= 0.82) pairs.p82.push(rec); else if (s >= 0.6) pairs.p60.push(rec); else if (s >= 0.45) pairs.p45.push(rec);
}
const nPairs = (items.length * (items.length - 1)) / 2;
console.log(`SURFACE collisions in-set (${nPairs} pairs):`);
console.log(`  ≥0.82 near-identical: ${pairs.p82.length}  ${pairs.p82.map((p) => `${p.a}~${p.b}(${p.sim})`).join(" ")}`);
console.log(`  0.60–0.82 dup-level:  ${pairs.p60.length}  ${pairs.p60.map((p) => `${p.a}~${p.b}(${p.sim})`).join(" ")}`);
console.log(`  0.45–0.60 floor-level: ${pairs.p45.length}  ${pairs.p45.slice(0, 10).map((p) => `${p.a}~${p.b}(${p.sim})`).join(" ")}`);

const parent = items.map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (jac(sh[i], sh[j]) >= 0.55) parent[find(i)] = find(j);
const clusters = {};
items.forEach((it, i) => { const r = find(i); (clusters[r] ||= []).push(it.id); });
const multi = Object.values(clusters).filter((c) => c.length > 1);
console.log(`\nSTRUCTURAL clusters in-set (≥0.55 blanked): ${multi.length} clusters covering ${multi.reduce((a, c) => a + c.length, 0)} items`);
multi.forEach((c) => console.log(`  [${c.length}] ${c.join(", ")}`));

/* ---- 2. skill repeats + canon-suspect screen (screen, not verdict) ---- */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => w.length > 3).sort().join("-").slice(0, 60);
const skillCount = {};
for (const it of items) { const k = norm(it.skill); skillCount[k] = (skillCount[k] || 0) + 1; }
const repeated = Object.entries(skillCount).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
console.log(`\nSKILL-label repeats in-set: ${repeated.length}`);
repeated.forEach(([k, v]) => console.log(`  ${v}× ${k}`));

// the 14 banned modal structures of the steered protocol (STEERED-35.md)
const CANON = [
  ["prism/cyl volume", /\b(prism|cylinder)\b[\s\S]*\bvolume\b|\bvolume\b[\s\S]*\b(prism|cylinder)\b/i],
  ["pyramid/cone volume", /\b(pyramid|cone)\b[\s\S]*\bvolume\b|\bvolume\b[\s\S]*\b(pyramid|cone)\b/i],
  ["transversal", /transversal|parallel lines/i],
  ["circle equation xy", /equation[\s\S]{0,40}circle|circle[\s\S]{0,40}equation/i],
  ["pythag main-event", /pythagorean|hypotenuse/i],
  ["special right", /30.?60.?90|45.?45.?90|special right/i],
  ["altitude-to-hyp", /altitude[\s\S]{0,40}hypotenuse|geometric mean/i],
  ["similar via parallel seg", /parallel to (side|segment|[A-Z]{2})/],
  ["tangent length", /tangent/i],
  ["cyl+cone/hemisphere", /(cylinder[\s\S]{0,80}(cone|hemisphere))|((cone|hemisphere)[\s\S]{0,80}cylinder)/i],
  ["sector/arc plug-in", /sector|arc length/i],
  ["inscribed angle", /inscribed/i],
  ["intersecting chords", /chord/i],
  ["angle-sum chase", /vertical angles|sum of [\s\S]{0,20}angles|exterior angle/i],
];
console.log(`\nCANON-SUSPECT screen (regex over skill+stem+figure — adjudicate by reading, not by flag):`);
let flagged = 0;
for (const it of items) {
  const hay = `${it.skill || ""} | ${it.stem || ""} | ${it.figure || ""}`;
  const hits = CANON.filter(([, re]) => re.test(hay)).map(([name]) => name);
  if (hits.length) { flagged++; console.log(`  ${it.id} (${it.band}, ${it.skill}): ${hits.join(", ")}`); }
}
console.log(`  ${flagged}/${items.length} items touch a canon keyword`);

/* ---- 3. novelty vs engine corpus + prior clean-room sets ---- */
const corpus = loadCorpus();
const prior = [];
for (const name of priorNames) {
  const p = join(ROOT, "tests", "cleanroom", name, "items.json");
  if (!existsSync(p)) { console.log(`  (prior set ${name}: no items.json — skipped)`); continue; }
  JSON.parse(readFileSync(p, "utf8")).forEach((it, i) =>
    prior.push({ id: `${name}#${it.n ?? i + 1}`, sh: shingles(it.stem + " " + (it.figure || "")) }));
}
let maxBank = { sim: 0, id: null, item: null }, maxPrior = { sim: 0, id: null, item: null }, overBank = 0, overPrior = 0;
for (let i = 0; i < items.length; i++) {
  const ns = nearestSurface(items[i].stem, corpus);
  if (ns.sim > maxBank.sim) maxBank = { ...ns, item: items[i].id };
  if (ns.sim >= 0.45) overBank++;
  let best = { sim: 0, id: null };
  for (const pr of prior) { const s = jac(sh[i], pr.sh); if (s > best.sim) best = { sim: s, id: pr.id }; }
  if (best.sim > maxPrior.sim) maxPrior = { ...best, item: items[i].id };
  if (best.sim >= 0.45) overPrior++;
}
console.log(`\nNOVELTY vs engine corpus (${corpus.surface.length} surfaces): max ${maxBank.sim.toFixed(2)} (${maxBank.item}~${maxBank.id}) · over 0.45 floor: ${overBank}/${items.length}`);
console.log(`NOVELTY vs prior clean-room (${prior.length} items): max ${maxPrior.sim.toFixed(2)} (${maxPrior.item}~${maxPrior.id}) · over 0.45: ${overPrior}/${items.length}`);

/* ---- 4. spread ---- */
const bands = {}, types = {};
for (const it of items) { bands[it.band] = (bands[it.band] || 0) + 1; types[it.type] = (types[it.type] || 0) + 1; }
console.log(`\nbands: ${JSON.stringify(bands)} · types: ${JSON.stringify(types)}`);

/* ---- 5. blind-solve batches ---- */
if (emitDir) {
  mkdirSync(emitDir, { recursive: true });
  const blind = items.map((it) => ({ id: it.id, stem: it.stem, figure: it.figure || null, type: it.type }));
  const half = Math.ceil(blind.length / 2);
  writeFileSync(join(emitDir, "solve-1.json"), JSON.stringify(blind.slice(0, half), null, 1));
  writeFileSync(join(emitDir, "solve-2.json"), JSON.stringify(blind.slice(half), null, 1));
  writeFileSync(join(emitDir, "key.json"), JSON.stringify(items.map((it) => ({ id: it.id, answer: it.answer, band: it.band })), null, 1));
  console.log(`\nblind-solve batches (${half}+${blind.length - half}) + key → ${emitDir}`);
}
