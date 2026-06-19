/* ============================================================================
   tests.mjs — assemble a BATCH of Digital SAT Math practice tests (default 20 × 22)
   from the VARIETY GRIDS (taxonomy/grids/{algebra,advanced,psda,geometry}.json),
   organized DOMAIN → SUBDOMAIN → cell, PLUS an OPEN lane (band-calibrated, free-
   structure, deep-verified) for richness. The grid-vs-open A/B showed the grid wins
   variety + carries the recompute-leash core, while the open lane adds the richness/
   realism ceiling — so each test is a HYBRID: ~(1−SIG_OPEN_FRAC) grid + ~SIG_OPEN_FRAC open.

   Per test: SAT domain mix (8 alg / 8 adv / 3 psda / 3 geo), easy→hard band spread,
   over-generated (SIG_OVERGEN) and balanced to 22. Anti-repeat is PER-TEST. Resumable.

   Run:  SIG_LLM_TIMEOUT=300000 SIG_PANEL_N=3 SIG_MAX_REPAIRS=2 SIG_POOL=4 SIG_LLM_CONCURRENCY=3 \
         node build/tests.mjs [numTests=20] [bandsCSV=B1,B2,B3,B4]
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateOne, resolveGridCell, resolveOpenTarget, flattenGrid } from "./generate.mjs";
import { Ledger } from "./ledger.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(readFileSync(join(ROOT, "taxonomy", "matrix.json"), "utf8"));
const BANDS = matrix.bands.map((b) => b.id);
const bandIdx = (b) => BANDS.indexOf(b);
const CAP = Number(process.env.SIG_POOL || 4);

const numTests = Number(process.argv[2] || 20);
const bandSet = (process.argv[3] || "B1,B2,B3,B4").split(",");
const KEEP = 22;                                       // a Digital SAT Math module = 22 items
const OVER = Number(process.env.SIG_OVERGEN || 32);    // over-generate this many; keep the best 22
const OPEN_FRAC = Number(process.env.SIG_OPEN_FRAC || 0.3);   // fraction of slots from the OPEN lane
const OPEN_STEP = Math.max(2, Math.round(1 / OPEN_FRAC));

// SAT domain mix (≈35/35/15/15) + an easy→hard band spread.
const DOMAIN_PAIRS = [["algebra", 8], ["advanced_math", 8], ["psda", 3], ["geometry_trig", 3]];
const DOMAIN_QUOTA = Object.fromEntries(DOMAIN_PAIRS);
// easy-leaning target mix; with asymmetric accept (SIG_TOL_UP=0) it counters the
// judge's ~+1 upward drift so a "B1–B4" test actually spans B1–B4 instead of B3–B4.
const BAND_PAIRS = { "B1,B2,B3,B4": [["B1", 6], ["B2", 8], ["B3", 6], ["B4", 3]] }[bandSet.join(",")] || bandSet.map((b) => [b, Math.ceil(KEEP / bandSet.length)]);
const spread = (pairs, len) => {
  const tot = pairs.reduce((s, [, n]) => s + n, 0), out = [];
  for (const [v, n] of pairs) out.push(...Array(Math.round((n / tot) * len)).fill(v));
  while (out.length < len) out.push(pairs[out.length % pairs.length][0]);
  return out.slice(0, len);
};
const DOMAINS = spread(DOMAIN_PAIRS, OVER), BANDSEQ = spread(BAND_PAIRS, OVER);

// ---- load the variety grids → cells indexed by domain→band, + per-band levers ----
const GRID_FILE = { algebra: "algebra", advanced_math: "advanced", psda: "psda", geometry_trig: "geometry" };
const CELLS_BY_BAND = {}, LEVERS = {}, STMTS_BY_BAND = {};
for (const [dom, file] of Object.entries(GRID_FILE)) {
  const g = JSON.parse(readFileSync(join(ROOT, "taxonomy", "grids", `${file}.json`), "utf8"));
  LEVERS[dom] = g.levers || {};
  CELLS_BY_BAND[dom] = {};
  for (const c of flattenGrid(g).sort((a, b) => (a.subdomain < b.subdomain ? -1 : 1))) (CELLS_BY_BAND[dom][c.band] ||= []).push(c);
}
// statements per domain→band (the OPEN lane authors against a rubric statement directly)
for (const c of matrix.cells) { (STMTS_BY_BAND[c.domain] ||= {}); (STMTS_BY_BAND[c.domain][c.band] ||= []).push(...c.statements.map((s) => s.id)); }

// nearest band (within ±range) that actually has content for this domain
function nearestBand(map, band) {
  if (map[band]?.length) return band;
  const i = bandIdx(band);
  for (let d = 1; d < BANDS.length; d++) for (const b of [BANDS[i + d], BANDS[i - d]]) if (b && map[b]?.length) return b;
  return null;
}
const rot = (a, k) => a.slice(k % a.length).concat(a.slice(0, k % a.length));

// blueprint(testNum) — OVER targets: each slot is GRID (a grid cell) or OPEN (a free
// item against a rubric statement). rotc is a batch-wide rotation counter per
// (lane,domain,band) so cells/statements + their variants/contexts advance across tests.
function blueprint(testNum, rotc) {
  const dom = rot(DOMAINS, testNum * 3), band = rot(BANDSEQ, testNum * 5);
  const out = [];
  for (let i = 0; i < OVER; i++) {
    const d = dom[i], want = band[i];
    const g = (rotc._g = (rotc._g ?? -1) + 1);   // GLOBAL slot counter → spreads CONTEXTS across the whole batch (cell/statement still picked by the per-pool counter)
    const isOpen = ((i + testNum) % OPEN_STEP) === 0;
    if (isOpen) {
      const b = nearestBand(STMTS_BY_BAND[d], want), pool = STMTS_BY_BAND[d][b] || [];
      if (!pool.length) { i--; continue; }
      const k = (rotc["O|" + d + "|" + b] = (rotc["O|" + d + "|" + b] ?? -1) + 1);
      out.push(resolveOpenTarget({ statementId: pool[k % pool.length], type: g % 2 ? "spr" : "mcq", bandLevers: (LEVERS[d] || {})[b] || [], idx: g }));
    } else {
      const b = nearestBand(CELLS_BY_BAND[d], want), pool = CELLS_BY_BAND[d][b] || [];
      if (!pool.length) { i--; continue; }
      const k = (rotc["G|" + d + "|" + b] = (rotc["G|" + d + "|" + b] ?? -1) + 1);
      out.push(resolveGridCell(pool[k % pool.length], { varIdx: g }));   // varIdx=global → context rotates per slot, not per pool
    }
  }
  return out;
}

// keep up to KEEP honoring the SAT domain mix; backfill domain shortfalls from leftovers.
function pickBalanced(passes, n = KEEP) {
  const byDom = {}; for (const p of passes) (byDom[p.domain] ||= []).push(p);
  const kept = [], used = new Set();
  for (const [d, q] of Object.entries(DOMAIN_QUOTA)) for (const p of (byDom[d] || []).slice(0, q)) { kept.push(p); used.add(p); }
  if (kept.length < n) for (const p of passes) { if (kept.length >= n) break; if (!used.has(p)) { kept.push(p); used.add(p); } }
  return kept.slice(0, n);
}

async function pool(tasks, cap) {
  const out = []; let i = 0;
  const w = async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = null; console.log(`   task ${k} err: ${e.message}`); } } };
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, w));
  return out;
}

const isOpenItem = (it) => typeof it.skill === "string" && it.skill.startsWith("open_");

async function main() {
  console.log(`Batch: ${numTests} tests × ${KEEP} (over-generating ${OVER}, ~${Math.round(OPEN_FRAC * 100)}% open lane), bands [${bandSet}], ${CAP} parallel/test\n`);
  const repairs = Number(process.env.SIG_MAX_REPAIRS ?? 2);
  const rotc = {};   // batch-wide rotation (persists across tests → cross-test variety)
  for (let t = 1; t <= numTests; t++) {
    const n = String(t).padStart(2, "0"), fp = join(ROOT, "data", `test-${n}.json`);
    if (existsSync(fp) && (JSON.parse(readFileSync(fp, "utf8")).questions || []).length >= KEEP) { console.log(`• test ${n}: already full, skipping (resume)`); continue; }
    const targets = blueprint(t, rotc);
    const ledger = new Ledger(null);   // PER-TEST anti-repeat (no skill/stem repeats within a test; skills recur across tests with new numbers)
    const holes = [];
    const tasks = targets.map((tg) => async () => {
      const { item, log } = await generateOne(tg, 0, ledger, repairs, bandSet);   // bandSet clamps measured band to range
      if (!item) holes.push(`${tg.band}/${tg.domain.slice(0, 4)}/${tg.skill} — ${log[log.length - 1] || "no attempts"}`);
      return item;
    });
    const passes = (await pool(tasks, CAP)).filter(Boolean);
    const kept = pickBalanced(passes, KEEP);
    kept.sort((a, b) => bandIdx(a.difficulty.band) - bandIdx(b.difficulty.band));
    kept.forEach((it, i) => { it.id = i + 1; });
    writeFileSync(fp, JSON.stringify({ number: t, title: `Practice Test ${n} — Digital SAT Math`, questions: kept }, null, 2));
    const by = {}; kept.forEach((q) => by[q.difficulty.band] = (by[q.difficulty.band] || 0) + 1);
    const dm = {}; kept.forEach((q) => dm[q.domain.slice(0, 3)] = (dm[q.domain.slice(0, 3)] || 0) + 1);
    const nOpen = kept.filter(isOpenItem).length;
    console.log(`✓ test ${n}: ${kept.length}/${KEEP} kept (${passes.length}/${OVER} passed; ${nOpen} open + ${kept.length - nOpen} grid)  bands ${JSON.stringify(by)}  dom ${JSON.stringify(dm)}`);
    if (kept.length < KEEP) holes.slice(0, 6).forEach((h) => console.log(`   ○ hole ${h}`));
  }
  console.log(`\nDone. Render with: node build/render.mjs`);
}

export { blueprint, pickBalanced, CELLS_BY_BAND, STMTS_BY_BAND };
// run main() only when executed directly (so a dry-run can import blueprint)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
