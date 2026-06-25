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
import { verifyAndGate, surfaceDup, seedBankDedup } from "./selector.mjs";
import { appendToBank } from "./bank.mjs";
import { measureFromRadicals, radicalsForBand, BANDS, bandIndex } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cellSchema = (dom) => JSON.parse(readFileSync(join(ROOT, "taxonomy", "cells", `${dom === "algebra" ? "algebra" : dom}.json`), "utf8"));
const OVER = Number(process.env.SIG_OVER || 3);                 // over-generate multiple (§6)
const CAP = Number(process.env.SIG_POOL || 4);                  // candidate concurrency
const DOMAIN_CODE = { algebra: "ALG", advanced_math: "ADV", psda: "PSDA", geometry_trig: "GEO" };
const MAX_REPAIRS = Number(process.env.SIG_MAX_REPAIRS ?? 1);   // "double gate": 1 repair = 2 gate passes

// turn a failed selector gate into a concrete revision instruction for the author (Agent 2).
function reviseInstruction(g) {
  if (g.stage === "correctness") return "An independent checker could NOT reproduce your answer. Re-solve from scratch and fix the numbers/answer so there is exactly one clearly-correct, unambiguous answer.";
  if (g.stage === "band") return g.gate?.reason === "too hard"
    ? "It measured HARDER than the target band — simplify: fewer solve steps, cleaner numbers, no structure beyond the radicals."
    : "It measured off the target band — match the target difficulty exactly per the radicals, no more and no less.";
  if (g.stage === "plausibility") return `The scenario or numbers aren't realistic enough for a published SAT item${g.issues?.length ? ` (${g.issues.join("; ")})` : ""}. Keep the SAME skill, band, and solve structure, but rewrite with a coherent, realistic scenario and sensible, clean numbers — a real-world-plausible quantity, a whole-number result when it counts discrete things, and no physically/economically broken setup.`;
  if (g.stage === "reskin") return "Too close to the textbook-canonical instance — change the structure so the solve path differs, keeping the same skill and target band (you may choose different numbers and a different answer).";
  if (g.stage === "dedup") return "Too similar to another item — change the context and surface details substantially.";
  return "Revise so the item passes independent verification and lands in the target band.";
}

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
// split a string on \( … \) math delimiters into render segments (render.mjs KaTeX-typesets {t:"math"}).
// \(...\) — NOT $...$ — so a "$5" currency amount is never mistaken for a math span.
function mathSeg(str) {
  const s = String(str ?? ""); const out = [];
  // Split on DISPLAY \[...\] and INLINE \(...\). A system of equations/inequalities
  // uses an array/cases/aligned environment, which is a STACKED display block — render
  // it as a mathblock even if the author inlined it with \(...\), so it never appears
  // as two side-by-side inline spans.
  const SYS = /\\begin\{(?:array|cases|aligned|gathered|bmatrix|pmatrix|split)\}/;
  for (const p of s.split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g)) {
    if (!p) continue;
    const md = p.match(/^\\\[([\s\S]*)\\\]$/);
    const mi = p.match(/^\\\(([\s\S]*?)\\\)$/);
    if (md) out.push({ t: "mathblock", v: md[1].trim() });
    else if (mi) { const v = mi[1].trim(); out.push(SYS.test(v) ? { t: "mathblock", v } : { t: "math", v }); }
    else out.push({ t: "text", v: p });
  }
  return out.length ? out : [{ t: "text", v: s }];
}
// plain griddable form for SPR grading (strip math delimiters + currency, \frac{a}{b} → a/b).
const plainAns = (a) => String(a ?? "").replace(/\\\(|\\\)/g, "").replace(/\\d?frac\s*\{(-?\d+)\}\s*\{(-?\d+)\}/g, "$1/$2").replace(/\\cdot/g, "").replace(/\$/g, "").trim();
function solvePathSegs(sp) {
  if (!Array.isArray(sp) || !sp.length) return txt("See answer.");
  return sp.flatMap((s, i) => [{ t: "text", v: `${s.step ?? i + 1}. ${s.op ? s.op.replace(/_/g, " ") + ": " : ""}` }, ...mathSeg(s.detail || ""), { t: "br" }]);
}
// pull a markdown table out of a statement → a render "table" figure + the prose with the table removed.
const cleanCell = (c) => String(c).replace(/\\\(|\\\)/g, "").replace(/\$/g, "").trim();
const isSep = (c) => /^:?-{2,}:?$/.test(String(c).trim());
function extractTable(statement) {
  const s = String(statement ?? "");
  if (!/\|\s*:?-{2,}/.test(s)) return null;                       // needs a |---| separator row
  const first = s.indexOf("|"), last = s.lastIndexOf("|");
  if (first < 0 || last <= first) return null;
  const before = s.slice(0, first).trim(), region = s.slice(first, last + 1), after = s.slice(last + 1).trim();
  let rows;
  if (/\n/.test(region)) {                                        // newline-delimited rows
    rows = region.split(/\n/).map((l) => l.trim()).filter((l) => l.includes("|")).map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  } else {                                                        // flat inline stream → infer column count from the header
    const cells = region.split("|").map((c) => c.trim()).filter((c) => c !== "");
    const ncol = cells.findIndex(isSep);
    if (ncol < 1) return null;
    const flat = cells.filter((c) => !isSep(c));
    rows = []; for (let i = 0; i < flat.length; i += ncol) rows.push(flat.slice(i, i + ncol));
  }
  rows = rows.filter((r) => r.length && !r.every((c) => isSep(c) || c === "")).map((r) => r.map(cleanCell));
  if (rows.length < 2 || rows[0].length < 2) return null;
  const headers = rows[0], data = rows.slice(1).filter((r) => r.length === headers.length);
  if (!data.length) return null;
  return { figure: { fn: "table", spec: { kind: "value", headers, rows: data } }, cleaned: [before, after].filter(Boolean).join("  ").replace(/\s+/g, " ").trim() };
}
function toRenderItem(s, id) {
  const { cand, cell, gate } = s;
  const optFigs = cell.incidentals?.numbers?.optionFigures || null;   // "which graph" items: each OPTION is a figure
  const isMcq = !!cand.choices || !!optFigs;
  const used = cand.radicals_used && Object.keys(cand.radicals_used).length ? { ...cell.radicals, ...cand.radicals_used } : cell.radicals;
  const diff = measureFromRadicals(used, cell.domain, cell.subdomain);
  const opts = optFigs
    ? optFigs.map((spec, i) => ({ key: "ABCD"[i], fig: { fn: "coordPlane", spec } }))
    : (isMcq ? cand.choices.map((c, i) => ({ key: "ABCD"[i], seg: mathSeg(String(c).replace(/^[A-D][).]\s*/, "")) })) : undefined);
  const harnessFig = optFigs ? null : (cell.incidentals?.numbers?.figure || null);   // single stem figure (graph items)
  const tbl = (harnessFig || optFigs) ? null : extractTable(cand.statement);   // else a markdown table from the prose
  return {
    id, program: "SAT", domain: cell.domain, band: `B${cell.band}`, target_band: `B${cell.band}`,
    statementId: cell.statementId || `${DOMAIN_CODE[cell.domain]}.B${cell.band}.s1`,
    skill: cell.subdomain, type: isMcq ? "mcq" : "spr",
    stem: mathSeg(tbl ? tbl.cleaned : cand.statement),
    options: opts,
    answer: isMcq ? { correct: cand.correct_choice } : { accept: [plainAns(cell.tier === "C" ? (cell.incidentals?.numbers?.answer ?? cand.answer) : cand.answer)], tol: 0 },
    solution: solvePathSegs(cand.solve_path),
    figure: harnessFig || (tbl ? tbl.figure : null),
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
    let cell = drawCell(domain, subdomain, band, ctr.i++);
    // HARNESS-COMPLETE (graph / Tier C): no LLM — the harness built the whole item
    // (figure + answer + distractors). Gate it; on a figure/legibility miss, RE-DRAW
    // a fresh graph item (not an LLM revise) within the repair budget.
    if (cell.incidentals?.numbers?.harness) {
      for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
        const num = cell.incidentals.numbers;
        const cand = { statement: num.statement, choices: num.choices, correct_choice: num.correct_choice, answer: num.answer, solve_path: num.solve_path, fingerprint: num.fingerprint, radicals_used: {} };
        const gate = await verifyAndGate(cand, cell);
        if (gate.keep) return { cand, cell, gate, repairs: attempt };
        reasons.push(`${gate.stage} [${band}] r${attempt} (graph ${attempt < MAX_REPAIRS ? "→ redraw" : "→ drop"})`);
        cell = drawCell(domain, subdomain, band, ctr.i++);
      }
      return null;
    }
    let rat;
    try { rat = await rationale(cell); } catch (e) { reasons.push(`rationale ${e.message}`); return null; }
    let feedback = null;                                          // DOUBLE GATE: gate → repair → gate (don't discard on first fail)
    for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
      const cand = await authorItem(cell, rat, { feedback });
      if (!cand || !cand.statement) { feedback = "Output was not a single valid JSON object with a \"statement\". Return ONLY the JSON object."; reasons.push(`parse [${band}] r${attempt}`); continue; }
      const gate = await verifyAndGate(cand, cell);
      if (gate.keep) return { cand, cell, gate, repairs: attempt };
      feedback = reviseInstruction(gate);                          // feed the failure back to the author
      reasons.push(`${gate.stage} [${band}] r${attempt}${attempt < MAX_REPAIRS ? " → repair" : " → drop"}`);
    }
    return null;
  });
  const verified = (await pool(tasks, CAP)).filter(Boolean);
  // 3 sequential: surface dedup over the growing kept pool. Tier-C figure items also get a
  // PER-STRUCTURE QUOTA: the figure-signature gate only catches an *exact* figure repeat, so
  // "same structure, new numbers" (6 prism-volume boxes, 5 cubes) would all survive — that is
  // a number-reskin, not variety. Cap the count per (structure, band), where structure = the
  // fingerprint with numeric/dimension tokens stripped, so one skill can't flood a band. The
  // honest consequence: a band with only one solid structure is bounded by the quota — earn
  // more by adding STRUCTURES, not numbers. (Surface/structural dedup don't reach these items:
  // the stem is a constant template and a figure's solve-path is one op.)
  const FIG_QUOTA = Number(process.env.SIG_FIG_QUOTA ?? 3);
  // structure = the TASK (the skill), which for a construct-backward figure item IS its
  // structure (prism_volume, arc_length_fig, …). Falls back to the fingerprint minus any
  // number-bearing token (the reskin slot) when a task isn't set. Keyed per band.
  const structKey = (num, band) => (num.task || (Array.isArray(num.fingerprint) ? num.fingerprint.filter((t) => !/\d/.test(String(t))).join("|") : "")) + "@B" + band;
  const unique = [];
  const seenFig = new Set();
  const structCount = new Map();
  for (const s of verified) {
    if (s.cell.tier === "C") {   // figure items: identity is the FIGURE, not the templated stem (surface shingles would falsely collapse them)
      const num = s.cell.incidentals.numbers, sp = num.figure?.spec;
      // figure key: graph curves verbatim; prism/solid dims CANONICALIZED (sorted) so a
      // relabeled/permuted solid (3×4×7 vs 7×3×4) collides, while two distinct boxes that
      // merely share a volume do NOT (answer alone is not the identity).
      const fkey = sp?.curves ? sp.curves
        : sp?.dims ? Object.values(sp.dims).map(String).sort()
        : sp?.sector ? [sp.sector.from, sp.sector.to, sp.sector.radiusLabel]
        : sp?.inscribed ? [sp.inscribed.A, sp.inscribed.B, sp.inscribed.C]
        : (num.optionFigures || []).map((o) => o.curves);
      const sig = JSON.stringify({ f: fkey, a: num.answer, c: num.correct_choice });
      if (seenFig.has(sig)) { reasons.push(`figdup [B${s.cell.band}]`); continue; }
      const sk = structKey(num, s.cell.band);
      if ((structCount.get(sk) || 0) >= FIG_QUOTA) { reasons.push(`figquota [${sk}] ≥${FIG_QUOTA}`); continue; }
      seenFig.add(sig); structCount.set(sk, (structCount.get(sk) || 0) + 1); unique.push(s); continue;
    }
    if (surfaceDup(s.cand, unique.map((u) => u.cand))) { reasons.push(`dedup [B${s.cell.band}]`); continue; }
    unique.push(s);
  }
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
  try { const added = appendToBank(questions, { source: `test-${n}` }); console.log(`  banked ${added} new item(s) → data/item-bank.jsonl`); } catch (e) { console.log(`  bank skip: ${e.message}`); }
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
export async function generateDomain(domain, { perCell = 1, bands = BANDS, testNum = 92, title, targetTotal = null } = {}) {
  const subs = Object.keys(cellSchema(domain).subdomains);
  const ctr = { i: 0 }, kept = [], matrix = {};
  console.log(`\n=== FULL DOMAIN: ${domain} · ${perCell}/cell · bands ${bands.join(",")} ===`);
  // enumerate the defensible (subdomain × band) cells, then generate them CONCURRENTLY.
  // JS is single-threaded, so the only thing that actually overlaps is the per-candidate
  // `claude` subprocess I/O — shared kept[]/ctr/dedup mutations happen synchronously
  // between awaits (no data race). Effective concurrency ≈ CELL_CAP × (candidates/cell).
  const cellList = [];
  for (const sub of subs) { matrix[sub] = {}; for (const band of bands) {
    if (!radicalsForBand(domain, sub, band).length) { matrix[sub][band] = "·"; continue; }   // not defensible at this band
    cellList.push({ sub, band });
  } }
  const CELL_CAP = Number(process.env.SIG_CELL_POOL || 6);
  console.log(`(generating ${cellList.length} cells, up to ${CELL_CAP} concurrently)`);
  const results = await pool(cellList.map(({ sub, band }) => async () => {
    const got = await generateCell(domain, sub, perCell, [band], ctr);
    matrix[sub][band] = got.length;
    return got;
  }), CELL_CAP);
  for (const got of results) if (got) kept.push(...got);
  // coverage matrix (rows = subdomains, cols = bands)
  console.log(`\nCOVERAGE MATRIX (kept / target ${perCell}; · = no defensible cell):`);
  console.log(`  ${"subdomain".padEnd(34)} ${bands.join("   ")}`);
  for (const sub of subs) console.log(`  ${sub.padEnd(34)} ${bands.map((b) => String(matrix[sub][b]).padStart(2)).join("  ")}`);
  let final = kept;
  if (targetTotal && kept.length > targetTotal) {                 // balanced down-select to an exact count, by SUBDOMAIN × BAND
    const byCell = {}; for (const s of kept) (byCell[`${s.cell.subdomain}|${s.cell.band}`] ||= []).push(s);
    const cellsBySub = {}; for (const ck of Object.keys(byCell)) { const sub = ck.split("|")[0]; (cellsBySub[sub] ||= []).push(ck); }
    const subs = Object.keys(cellsBySub); subs.forEach((sub) => cellsBySub[sub].sort());
    const ordered = []; for (let r = 0; ; r++) { let added = false; for (const sub of subs) if (cellsBySub[sub][r]) { ordered.push(cellsBySub[sub][r]); added = true; } if (!added) break; }   // interleave subdomains
    final = []; let progress = true;
    while (final.length < targetTotal && progress) { progress = false; for (const ck of ordered) { if (final.length >= targetTotal) break; if (byCell[ck].length) { final.push(byCell[ck].shift()); progress = true; } } }
    console.log(`  trimmed ${kept.length} → ${final.length} kept (target ${targetTotal}), balanced across subdomain × band`);
  }
  return assemble(final, testNum, title || `BUILD_SPEC · ${domain} (whole domain, B1–B7)`);
}

async function main() {
  console.log(`BUILD_SPEC four-agent pipeline — over-generate ×${OVER}, concurrency ${CAP}`);
  if (process.env.SIG_BANK_DEDUP === "1") {
    const bankFile = join(ROOT, "data", "item-bank.jsonl");
    const bankItems = existsSync(bankFile) ? readFileSync(bankFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    const seeded = seedBankDedup(bankItems);
    console.log(`bank-dedup ON — seeded ${seeded.surface} surface shingles + ${seeded.structural} structural fingerprints from ${bankItems.length} bank items`);
  }
  if (process.argv[2] === "--domain") {
    const domain = process.argv[3] || "algebra";
    const perCell = Number(process.argv[4] || 1);
    const testNum = Number(process.argv[5] || 92);
    const bands = (process.argv[6] || BANDS.join(",")).split(",");
    const targetTotal = Number(process.argv[7]) || null;
    await generateDomain(domain, { perCell, bands, testNum, targetTotal });
  } else {
    const sub = process.argv[2] || "linear_equations_one_variable";
    const n = Number(process.argv[3] || 6);
    const bands = (process.argv[4] || "B1,B2,B3,B4").split(",");
    const testNum = Number(process.argv[5] || 90);
    await generateTest([[`algebra/${sub}`, n]], { bands, testNum, title: `BUILD_SPEC · ${sub} (band-targeted)` });
  }
}

export { toRenderItem, pickBalanced, generateCell, mathSeg, extractTable };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
