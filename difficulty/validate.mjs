/* ============================================================================
   validate.mjs — validate the difficulty engine against REAL labeled data:
   College Board's own Skills-Insight exemplars (taxonomy/exemplars.clean.json),
   each carrying its true performance band. Runs the LLM-judge panel on a
   stratified sample and reports band-match accuracy + Spearman ρ + bias.
   Anchors (hand-curated, in judge.mjs) are DISJOINT from these exemplars → a
   legitimate held-out check. MAKES LLM CALLS.

   Run: SIG_LLM_TIMEOUT=300000 SAMPLE_PER_BAND=1 node difficulty/validate.mjs
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { judgePanel } from "./judge.mjs";
import { bandOf, bandIndex } from "./index.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const items = JSON.parse(readFileSync(join(ROOT, "taxonomy", "exemplars.clean.json"), "utf8"));

const BANDS = ["B1","B2","B3","B4","B5","B6","B7"];
const perBand = Number(process.env.SAMPLE_PER_BAND || 1);
// HELD OUT: exclude the items used as judge few-shot anchors (no leakage).
let anchorKeys = new Set();
try { anchorKeys = new Set(JSON.parse(readFileSync(join(ROOT, "taxonomy", "anchors.json"), "utf8")).map((a) => a.stem.slice(0, 50))); } catch {}
const pool = items.filter((i) => !anchorKeys.has(i.stem.slice(0, 50)));
// stratified sample: first `perBand` items of each band
const sample = BANDS.flatMap((b) => pool.filter((i) => i.band === b).slice(0, perBand));

const toItem = (it) => {
  const mcq = /^[A-D]$/.test(String(it.key || ""));
  return { stem: it.stem, domain: it.domain, type: mcq ? "mcq" : "spr",
    answer: mcq ? { correct: it.key } : { accept: [String(it.key)] }, options: [], solution: "" };
};

console.log(`Validating against ${sample.length} official Skills-Insight exemplars (${perBand}/band)…\n`);
const rows = [];
for (const it of sample) {
  const panel = await judgePanel(toItem(it), { n: 3 });
  if (!panel) { console.log(`  · ${it.domain} ${it.band}: judge failed`); continue; }
  const measured = bandOf(panel.thetaJudge);
  const err = bandIndex(measured) - bandIndex(it.band);
  rows.push({ true: it.band, measured, scale: panel.thetaJudge, err, domain: it.domain });
  console.log(`  ${Math.abs(err) <= 1 ? "✓" : "✗"} ${it.domain.padEnd(14)} true=${it.band} measured=${measured} (~${panel.thetaJudge})  ${err === 0 ? "exact" : (err > 0 ? "+" : "") + err + " band"}`);
}

// metrics
const n = rows.length;
const exact = rows.filter((r) => r.err === 0).length;
const within1 = rows.filter((r) => Math.abs(r.err) <= 1).length;
const bias = rows.reduce((s, r) => s + r.err, 0) / n;
// Spearman ρ between true-band-index and measured scale
const tr = rows.map((r) => bandIndex(r.true)), me = rows.map((r) => r.scale);
const rank = (a) => { const s = [...a].map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const rk = Array(a.length); s.forEach(([_, i], r) => rk[i] = r); return rk; };
const rt = rank(tr), rm = rank(me), mt = rt.reduce((a, b) => a + b, 0) / n, mm = rm.reduce((a, b) => a + b, 0) / n;
const cov = rt.reduce((s, _, i) => s + (rt[i] - mt) * (rm[i] - mm), 0);
const rho = cov / Math.sqrt(rt.reduce((s, v) => s + (v - mt) ** 2, 0) * rm.reduce((s, v) => s + (v - mm) ** 2, 0) || 1);

console.log(`\n── validation (n=${n}) ──`);
console.log(`  exact-band:   ${exact}/${n} (${(100*exact/n).toFixed(0)}%)`);
console.log(`  within ±1:    ${within1}/${n} (${(100*within1/n).toFixed(0)}%)   [target ≥90%]`);
console.log(`  Spearman ρ:   ${rho.toFixed(2)}   [target ≥0.70]`);
console.log(`  band bias:    ${bias > 0 ? "+" : ""}${bias.toFixed(2)} bands (judge rates ${bias < -0.2 ? "EASIER" : bias > 0.2 ? "HARDER" : "≈ same"} than CB's labels)`);
console.log(`\nNote: anchors are hand-curated & disjoint from these exemplars (held-out). Scale SAMPLE_PER_BAND up for a tighter estimate.`);
