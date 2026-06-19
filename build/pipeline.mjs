/* ============================================================================
   pipeline.mjs — the HARNESS (BUILD_SPEC §6). A linear four-agent producer + a
   deterministic two-tier selector. For each blueprint cell it over-generates,
   lets the selector reject most, and keeps a band-spread survivor set:

     draw (code) → AGENT 1 rationale → AGENT 2 author → SELECTOR → pick_balanced

   Concurrency: stages 1–2 (draw→rationale→author→verifyAndGate) run in parallel
   per candidate; surface dedup runs sequentially over the growing pool (no race).

   Run:
     node build/pipeline.mjs                       # ship-one-domain test: linear_equations_one_variable
     node build/pipeline.mjs <subdomain> <n> <bandsCSV> <testNum>
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawCell } from "./cell.mjs";
import { rationale } from "./rationale.mjs";
import { authorItem } from "./author2.mjs";
import { verifyAndGate, surfaceDup } from "./selector.mjs";
import { measureFromRadicals, radicalsForBand, BANDS, bandIndex } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cellSchema = (dom) => JSON.parse(readFileSync(join(ROOT, "taxonomy", "cells", `${dom === "algebra" ? "algebra" : dom}.json`), "utf8"));
const OVER = Number(process.env.SIG_OVER || 3);                 // over-generate multiple (§6)
const CAP = Number(process.env.SIG_POOL || 4);                  // candidate concurrency
const DOMAIN_CODE = { algebra: "ALG", advanced_math: "ADV", psda: "PSDA", geometry_trig: "GEO" };

/* ---- concurrency pool ---- */
async function pool(tasks, cap) {
  const out = []; let i = 0;
  const w = async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = null; console.log(`   task ${k} err: ${e.message}`); } } };
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, w));
  return out;
}

/* ---- band spread helpers ---- */
function bandQuota(bands, n) {
  const q = Object.fromEntries(bands.map((b) => [b, Math.floor(n / bands.length)]));
  let rem = n - bands.length * Math.floor(n / bands.length);
  for (let i = 0; rem > 0; i++, rem--) q[bands[i % bands.length]]++;
  return q;
}
// keep n, honoring the per-band quota (by the cell's TARGET band), backfill shortfalls.
function pickBalanced(survivors, n, bands) {
  const quota = bandQuota(bands, n), byBand = {};
  for (const s of survivors) (byBand[`B${s.cell.band}`] ||= []).push(s);
  const kept = [], used = new Set();
  for (const b of bands) for (const s of (byBand[b] || []).slice(0, quota[b])) { kept.push(s); used.add(s); }
  if (kept.length < n) for (const s of survivors) { if (kept.length >= n) break; if (!used.has(s)) { kept.push(s); used.add(s); } }
  return kept.slice(0, n);
}

/* ---- render-schema adapter (new flat author JSON -> the segment item model) ---- */
const txt = (s) => [{ t: "text", v: String(s) }];
// split a string on $…$ math delimiters into render segments (render.mjs KaTeX-typesets {t:"math"}).
function mathSeg(str) {
  const s = String(str ?? ""); const out = [];
  for (const p of s.split(/(\$[^$]*\$)/g)) { if (!p) continue; if (p.length >= 2 && p[0] === "$" && p[p.length - 1] === "$") out.push({ t: "math", v: p.slice(1, -1) }); else out.push({ t: "text", v: p }); }
  return out.length ? out : [{ t: "text", v: s }];
}
// plain griddable form for SPR grading (strip $, \frac{a}{b} → a/b).
const plainAns = (a) => String(a ?? "").replace(/\$/g, "").replace(/\\d?frac\s*\{(-?\d+)\}\s*\{(-?\d+)\}/g, "$1/$2").replace(/\\cdot/g, "").trim();
function solvePathSegs(sp) {
  if (!Array.isArray(sp) || !sp.length) return txt("See answer.");
  return sp.flatMap((s, i) => [{ t: "text", v: `${s.step ?? i + 1}. ${s.op ? s.op.replace(/_/g, " ") + ": " : ""}` }, ...mathSeg(s.detail || ""), { t: "br" }]);
}
function toRenderItem(s, id) {
  const { cand, cell, gate } = s;
  const isMcq = !!cand.choices;
  const used = cand.radicals_used && Object.keys(cand.radicals_used).length ? { ...cell.radicals, ...cand.radicals_used } : cell.radicals;
  const diff = measureFromRadicals(used, cell.domain, cell.subdomain);
  const opts = isMcq ? cand.choices.map((c, i) => ({ key: "ABCD"[i], seg: mathSeg(String(c).replace(/^[A-D][).]\s*/, "")) })) : undefined;
  return {
    id, program: "SAT", domain: cell.domain, band: `B${cell.band}`, target_band: `B${cell.band}`,
    statementId: cell.statementId || `${DOMAIN_CODE[cell.domain]}.B${cell.band}.s1`,
    skill: cell.subdomain, type: isMcq ? "mcq" : "spr",
    stem: mathSeg(cand.statement),
    options: opts,
    answer: isMcq ? { correct: cand.correct_choice } : { accept: [plainAns(cand.answer)], tol: 0 },
    solution: solvePathSegs(cand.solve_path),
    figure: null,
    difficulty: { scalePoint: diff.scalePoint, band: gate.predictedBand, method: "apriori_v1", feature_vector: diff.feature_vector },
    verify: { tier: cell.tier || "A", correctness: cell.tier === "B" ? `consistency ${s.gate.correctness?.agree}/${s.gate.correctness?.need}` : "prove:pass" },
    radicals: used, fingerprint: gate.fingerprint, reskinDistance: Number(gate.distance?.toFixed?.(3) ?? gate.distance),
    tier: "build-spec",
  };
}

/* ---- generate one cell (subdomain) to n items, band-spread over `bands` ---- */
async function generateCell(domain, subdomain, n, bands, ctr) {
  const draws = OVER * n;
  const reasons = [];
  console.log(`\n■ ${domain}/${subdomain}: need ${n}, over-generate ${draws} (bands ${bands.join(",")})`);
  // 1+2 parallel: draw → rationale → author → verifyAndGate
  const tasks = Array.from({ length: draws }, (_, k) => async () => {
    const band = bands[k % bands.length];
    const cell = drawCell(domain, subdomain, band, ctr.i++);
    let rat, cand;
    try { rat = await rationale(cell); } catch (e) { reasons.push(`rationale ${e.message}`); return null; }
    cand = await authorItem(cell, rat);
    if (!cand || !cand.statement) { reasons.push(`author parse fail [${band}]`); return null; }
    const gate = await verifyAndGate(cand, cell);
    if (!gate.keep) { reasons.push(`${gate.stage} [${band}] ${gate.reason || ""}`.trim()); return null; }
    return { cand, cell, gate };
  });
  const verified = (await pool(tasks, CAP)).filter(Boolean);
  // 3 sequential: surface dedup over the growing kept pool
  const unique = [];
  for (const s of verified) { if (surfaceDup(s.cand, unique.map((u) => u.cand))) { reasons.push(`dedup [B${s.cell.band}]`); continue; } unique.push(s); }
  const kept = pickBalanced(unique, n, bands);
  console.log(`  → ${verified.length}/${draws} passed gate · ${unique.length} unique · keeping ${kept.length}/${n}`);
  reasons.slice(0, 8).forEach((r) => console.log(`     ✗ ${r}`));
  return kept;
}

/* ---- assemble survivors → data/test-NN.json (+ report) ---- */
function assemble(kept, testNum, title) {
  kept.sort((a, b) => bandIndex(`B${a.cell.band}`) - bandIndex(`B${b.cell.band}`) || (a.cell.subdomain < b.cell.subdomain ? -1 : 1));
  const questions = kept.map((s, i) => toRenderItem(s, i + 1));
  const n = String(testNum).padStart(2, "0");
  const fp = join(ROOT, "data", `test-${n}.json`);
  writeFileSync(fp, JSON.stringify({ number: testNum, title: title || `BUILD_SPEC pipeline — test ${n}`, questions }, null, 2));
  const by = {}; questions.forEach((q) => (by[q.target_band] = (by[q.target_band] || 0) + 1));
  const bySub = {}; questions.forEach((q) => (bySub[q.skill] = (bySub[q.skill] || 0) + 1));
  console.log(`\n✓ ${questions.length} items → ${fp}`);
  console.log(`  by band:      ${JSON.stringify(by)}`);
  console.log(`  by subdomain: ${JSON.stringify(bySub)}`);
  console.log(`  render: node build/render.mjs data/test-${n}.json`);
  return { fp, questions };
}

/** generateTest(blueprint, …) — blueprint: [[ "domain/subdomain", n ], …]. */
export async function generateTest(blueprint, { bands = ["B1", "B2", "B3", "B4"], testNum = 90, title } = {}) {
  const ctr = { i: 0 };
  const kept = [];
  for (const [key, n] of blueprint) { const [d, sd] = key.split("/"); kept.push(...await generateCell(d, sd, n, bands, ctr)); }
  return assemble(kept, testNum, title);
}

/** generateDomain(domain, perCell, bands) — N items per VALID (subdomain × band)
 *  cell across B1–B7; cells with no defensible radical combo are skipped (e.g.
 *  systems at B1–B3). Prints the coverage matrix so the holes are explicit. */
export async function generateDomain(domain, { perCell = 1, bands = BANDS, testNum = 92, title } = {}) {
  const subs = Object.keys(cellSchema(domain).subdomains);
  const ctr = { i: 0 }, kept = [], matrix = {};
  console.log(`\n=== FULL DOMAIN: ${domain} · ${perCell}/cell · bands ${bands.join(",")} ===`);
  for (const sub of subs) {
    matrix[sub] = {};
    for (const band of bands) {
      if (!radicalsForBand(domain, sub, band).length) { matrix[sub][band] = "·"; continue; }   // not defensible at this band
      const got = await generateCell(domain, sub, perCell, [band], ctr);
      kept.push(...got); matrix[sub][band] = got.length;
    }
  }
  // coverage matrix (rows = subdomains, cols = bands)
  console.log(`\nCOVERAGE MATRIX (kept / target ${perCell}; · = no defensible cell):`);
  console.log(`  ${"subdomain".padEnd(34)} ${bands.join("   ")}`);
  for (const sub of subs) console.log(`  ${sub.padEnd(34)} ${bands.map((b) => String(matrix[sub][b]).padStart(2)).join("  ")}`);
  return assemble(kept, testNum, title || `BUILD_SPEC · ${domain} (whole domain, B1–B7)`);
}

async function main() {
  console.log(`BUILD_SPEC four-agent pipeline — over-generate ×${OVER}, concurrency ${CAP}`);
  if (process.argv[2] === "--domain") {
    const domain = process.argv[3] || "algebra";
    const perCell = Number(process.argv[4] || 1);
    const testNum = Number(process.argv[5] || 92);
    const bands = (process.argv[6] || BANDS.join(",")).split(",");
    await generateDomain(domain, { perCell, bands, testNum });
  } else {
    const sub = process.argv[2] || "linear_equations_one_variable";
    const n = Number(process.argv[3] || 6);
    const bands = (process.argv[4] || "B1,B2,B3,B4").split(",");
    const testNum = Number(process.argv[5] || 90);
    await generateTest([[`algebra/${sub}`, n]], { bands, testNum, title: `BUILD_SPEC · ${sub} (band-targeted)` });
  }
}

export { toRenderItem, pickBalanced, generateCell };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
