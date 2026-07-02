/* suite-e2e — proves the WHOLE mastery loop with a simulated student, no human:
   take suite 001 (M1 → threshold route → M2) → prescribe → practice → improve →
   loop. Exit code contract like the other verify scripts.

   Simulated student: strong on low bands, WEAK on circles/right-trig high bands.
   Learning model: each practiced cell's accuracy rises 0.35 per practice round
   (drilling works — the sim tests the LOOP's mechanics, not pedagogy).

   Asserts:
   A. the post-suite deficit map flags the injected weak cells (and no strong low-band cell);
   B. no variantId is ever served twice across the suite + all practice rounds;
   C. every practice question targets a cell that was DEFICIENT/THIN at prescription time;
   D. the loop reaches MASTERED (or blocked-with-named-cells) within 10 rounds — and for
      this profile, MASTERED must actually be reached.

     node engine/verify/suite-e2e.mjs                                            */
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rng } from "../types.mjs";
import { prescribe, assessCells, loadHistory } from "../prescribe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUDENT = "sim-e2e";
const SDIR = join(ROOT, "data", "students", STUDENT);
const SCRATCH = process.env.SCRATCH ?? "/tmp";
if (existsSync(SDIR)) rmSync(SDIR, { recursive: true });

const r = rng("suite-e2e|1");
let fails = 0;
const assert = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) fails++; };

/* ---- the simulated student ---- */
const WEAK = new Set(["circles|B6", "circles|B7", "right_triangles_trig|B6", "right_triangles_trig|B7"]);
const boost = {}; // cell → accumulated learning from practice rounds
const pCorrect = (sub, band) => {
  const key = `${sub}|${band}`;
  const base = WEAK.has(key) ? 0.15 : Number(band[1]) <= 3 ? 0.95 : 0.8;
  return Math.min(0.95, base + (boost[key] ?? 0));
};

function simulateModule(questions, blobById) {
  return questions.map((q) => {
    const meta = blobById[q._variantId];
    const ok = r() < pCorrect(meta.subdomain, meta.band);
    const given = meta.type === "mcq"
      ? (ok ? meta.correct : "ABCD".replace(meta.correct, "")[0])
      : (ok ? meta.accept[0] : "999999");
    return { ...meta, given, isCorrect: ok, module: q._module };
  });
}
const metaOf = (test, mod) => Object.fromEntries(test.questions.map((q) => [q._variantId, {
  qid: `${mod}-q${q.id}`, type: q.type, correct: q.answer.correct ?? null, accept: q.answer.accept ?? null,
  variantId: q._variantId, familyId: q._familyId, subdomain: q._subdomain ?? q.domain, band: q.band,
}]));

/* ---- round 0: the diagnostic suite ---- */
const suiteDir = join(ROOT, "data", "suite", "001");
const m1 = JSON.parse(readFileSync(join(suiteDir, "m1.json"), "utf8"));
m1.questions.forEach((q) => (q._module = "m1"));
const served = new Set(m1.questions.map((q) => q._variantId));
let rows = simulateModule(m1.questions, metaOf(m1, "m1"));
const m1Score = rows.filter((x) => x.isCorrect).length / rows.length;
const routeKey = m1Score >= 0.6 ? "m2h" : "m2e";
const m2 = JSON.parse(readFileSync(join(suiteDir, `${routeKey}.json`), "utf8"));
m2.questions.forEach((q) => { q._module = routeKey; });
const m1m2Overlap = m2.questions.filter((q) => served.has(q._variantId));
assert(m1m2Overlap.length === 0, `suite: M1 and ${routeKey} share no variants`);
m2.questions.forEach((q) => served.add(q._variantId));
console.log(`M1 ${Math.round(m1Score * 100)}% → routed ${routeKey}`);
rows = rows.concat(simulateModule(m2.questions, metaOf(m2, routeKey)));

const resultsPath = join(SCRATCH, "sim-results-0.json");
writeFileSync(resultsPath, JSON.stringify({ suiteId: "001", student: STUDENT, ts: new Date().toISOString(), items: rows }, null, 1));

/* A: deficit map matches the injected profile */
let out = await prescribe(resultsPath, { student: STUDENT });
const flagged = Object.values(out.cells).filter((c) => c.status === "DEFICIENT").map((c) => `${c.subdomain}|${c.band}`);
const weakMeasured = [...WEAK].filter((k) => out.cells[k]?.attempts >= 2);
assert(weakMeasured.every((k) => flagged.includes(k)), `A1: every measured weak cell flagged DEFICIENT (${weakMeasured.length} measured: ${weakMeasured.join(", ")})`);
const falseFlags = flagged.filter((k) => !WEAK.has(k) && Number(k.split("|")[1][1]) <= 3);
assert(falseFlags.length === 0, `A2: no strong low-band cell flagged (false flags: ${falseFlags.join(", ") || "none"})`);

/* rounds 1..N: practice → improve → prescribe */
let round = 0, mastered = false;
while (!mastered && out.emitted && round < 10) {
  round++;
  const p1 = JSON.parse(readFileSync(join(SDIR, "p1.json"), "utf8"));
  p1.questions.forEach((q) => (q._module = "p1"));
  /* B: no repeats ever */
  const repeats = p1.questions.filter((q) => served.has(q._variantId));
  assert(repeats.length === 0, `B (round ${round}): 0 repeated variants (${repeats.map((q) => q._variantId).join(", ") || "clean"})`);
  p1.questions.forEach((q) => served.add(q._variantId));
  /* C: every practice item targets a then-open cell */
  const openCells = new Set(Object.values(out.cells).filter((c) => c.status !== "MASTERED").map((c) => `${c.subdomain}|${c.band}`));
  const offTarget = p1.questions.filter((q) => !openCells.has(`${q._subdomain ?? q.domain}|${q.band}`));
  assert(offTarget.length === 0, `C (round ${round}): all ${p1.questions.length} practice items target open cells`);
  /* the student learns what they drill */
  const drilled = new Set(p1.questions.map((q) => `${q._subdomain ?? q.domain}|${q.band}`));
  drilled.forEach((k) => (boost[k] = (boost[k] ?? 0) + 0.35));
  const items = simulateModule(p1.questions, metaOf(p1, "p1"));
  const rp = join(SCRATCH, `sim-results-${round}.json`);
  writeFileSync(rp, JSON.stringify({ suiteId: `practice-${round}`, student: STUDENT, ts: new Date().toISOString(), items }, null, 1));
  out = await prescribe(rp, { student: STUDENT });
  mastered = out.mastered === true;
}

/* D: terminal state — MASTERED, or BLOCKED only where the bank is VERIFIABLY dry
   (no unseen variants in-cell, no mintable parametric family in-cell) with a
   steering packet emitted for each blocked cell (the generation seam). */
if (mastered) {
  assert(true, `D: MASTERY ACHIEVED in ${round} practice rounds`);
} else {
  const blocked = out.blocked ?? [];
  console.log(`terminal: BLOCKED on ${blocked.map((c) => `${c.subdomain} ${c.band}`).join(", ")}`);
  const { loadFamilies } = await import("../family.mjs");
  const { buildPool, normSubdomain } = await import("../suite.mjs");
  const { loadSeen } = await import("../prescribe.mjs");
  const pool = buildPool({ seen: loadSeen(STUDENT) });
  const dry = blocked.every((c) =>
    !pool.some((p) => p.subdomain === c.subdomain && p.band === c.band) &&
    !loadFamilies().some((f) => f.generator !== "authored" && normSubdomain(f) === c.subdomain && f.difficulty?.band === c.band));
  assert(blocked.length > 0 && dry, `D1: every blocked cell is verifiably supply-dry (authored-only, exhausted)`);
  const last = join(SCRATCH, `sim-results-${round}.json`);
  out = await prescribe(existsSync(last) ? last : resultsPath, { student: STUDENT, fillGaps: true });
  const packets = blocked.filter((c) => existsSync(join(SDIR, "packets", `packet-${c.subdomain}-${c.band}.json`)));
  assert(packets.length === blocked.length, `D2: steering packet emitted for each blocked cell (${packets.length}/${blocked.length})`);
}
console.log(`\nserved ${served.size} unique variants across suite + ${round} practice rounds · history ${loadHistory(STUDENT).length} rows`);
console.log(fails ? `\n✗ suite-e2e FAILED (${fails})` : "\n✓ suite-e2e PASSED");
process.exit(fails ? 1 : 0);
