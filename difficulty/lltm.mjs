/* ============================================================================
   lltm.mjs — the LLTM (Linear Logistic Test Model) difficulty engine for the
   BUILD_SPEC pipeline. Difficulty is an ADDITIVE function of the item's RADICALS
   (the difficulty-determining structural features the harness sets). This is
   established psychometrics (Embretson's cognitive design system; Gierl item
   models) — you FIT the weights, you don't derive them. We bootstrap with
   hand-set weights (taxonomy/cells/*.json) and refit against measured
   consistency-difficulty in BUILD_SPEC step 5.

   Why this is NOT the brittle estimator we deleted earlier: that one INFERRED
   structural features from generated TEXT (is_parametric flagged any lettered
   string). Here the harness SETS the radicals and passes them in — the feature
   vector is ground truth, not a guess.
   ============================================================================ */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CELLS_DIR = join(ROOT, "taxonomy", "cells");

// load every cell-schema file (algebra.json, …) keyed by domain
const SCHEMA = {};
for (const f of readdirSync(CELLS_DIR).filter((f) => f.endsWith(".json"))) {
  const g = JSON.parse(readFileSync(join(CELLS_DIR, f), "utf8"));
  SCHEMA[g.domain] = g;
}

export const BANDS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"];
export const bandIndex = (b) => BANDS.indexOf(typeof b === "number" ? `B${b}` : b);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function schemaFor(domain, subdomain) {
  const dom = SCHEMA[domain];
  if (!dom) throw new Error(`lltm: no cell schema for domain ${domain}`);
  const sub = dom.subdomains[subdomain];
  if (!sub) throw new Error(`lltm: no subdomain ${subdomain} in ${domain}`);
  return { dom, sub };
}

/** scoreToBand(scale) — bucket a 200-800 scale score to a band via the official
 *  Skills-Insight cut scores (the lower edge of each band; below the first => B1). */
export function scoreToBand(scale, domain = "algebra") {
  const edges = SCHEMA[domain].band_cuts.edges;   // [370,420,470,550,610,680]
  let i = 0;
  while (i < edges.length && scale >= edges[i]) i++;
  return BANDS[i];
}

/** predictDifficulty(radicals, domain, subdomain) — the additive LLTM, returns a
 *  200-800 scale score (the RP67 location estimate from structure alone). */
export function predictDifficulty(radicals, domain, subdomain) {
  const { sub } = schemaFor(domain, subdomain);
  const w = sub.lltm.weights;
  // Data-driven additive model. Each weight entry is interpreted by type:
  //   number  → numeric feature (n_steps) or boolean flag (has_*): adds w·value / w
  //   object  → CATEGORICAL feature (task): adds w[value]
  //   "answer_is_fraction" is an alias for radicals.answer_type === "fraction".
  let s = w.w0 || 0;
  for (const [feat, weight] of Object.entries(w)) {
    if (feat === "w0") continue;
    if (feat === "answer_is_fraction") { if (radicals.answer_type === "fraction") s += weight; continue; }
    const val = radicals[feat];
    if (val === undefined || val === null) continue;
    if (typeof weight === "number") s += (val === true ? weight : typeof val === "number" ? weight * val : 0);
    else if (typeof weight === "object") s += Number(weight[String(val)]) || 0;
  }
  return Math.round(clamp(s, 200, 800));
}

export function predictBand(radicals, domain, subdomain) {
  return scoreToBand(predictDifficulty(radicals, domain, subdomain), domain);
}

/** enumerateRadicals(domain, subdomain) — the full cartesian product of the
 *  radical axes (small: e.g. 3·2·2·2·2 = 48 for one-variable linear). */
export function enumerateRadicals(domain, subdomain) {
  const { sub } = schemaFor(domain, subdomain);
  const axes = Object.entries(sub.radical_axes);
  let out = [{}];
  for (const [name, values] of axes) {
    const next = [];
    for (const partial of out) for (const v of values) next.push({ ...partial, [name]: v });
    out = next;
  }
  return out;
}

/** radicalsForBand(domain, subdomain, band) — all radical vectors whose predicted
 *  band == the target. This is how the harness "picks radicals whose predicted
 *  difficulty matches the requested band" (BUILD_SPEC §1). May be empty (then the
 *  caller falls back to nearest). */
export function radicalsForBand(domain, subdomain, band) {
  const want = typeof band === "number" ? `B${band}` : band;
  return enumerateRadicals(domain, subdomain).filter((r) => predictBand(r, domain, subdomain) === want);
}

/** nearestRadicals — closest radical vector by |scale − band anchor| (fallback
 *  when a band has no exact match). */
export function nearestRadicals(domain, subdomain, band) {
  const { dom } = schemaFor(domain, subdomain);
  const want = typeof band === "number" ? `B${band}` : band;
  const anchor = dom.band_anchors[want];
  return enumerateRadicals(domain, subdomain)
    .map((r) => ({ r, d: Math.abs(predictDifficulty(r, domain, subdomain) - anchor) }))
    .sort((a, b) => a.d - b.d)[0].r;
}

/** bandGate — the ASYMMETRIC LLTM band gate (BUILD_SPEC §5). drift = predicted −
 *  target (in band steps). Default: reject anything HARDER than target (tolUp=0)
 *  and more than one band EASIER (tolDown=1). This is the deterministic analog of
 *  the old judge gate — now exact, because radicals are known, not inferred. */
export function bandGate(predictedBand, targetBand, {
  tolUp = Number(process.env.SIG_TOL_UP ?? 0),
  tolDown = Number(process.env.SIG_TOL_DOWN ?? 1),
} = {}) {
  const drift = bandIndex(predictedBand) - bandIndex(targetBand);   // + = harder than target
  const ok = drift <= tolUp && -drift <= tolDown;
  return { ok, drift, predictedBand, targetBand, reason: ok ? "" : drift > tolUp ? "too hard" : "too easy" };
}

/** measureFromRadicals — the per-item difficulty record (render-schema shape). */
export function measureFromRadicals(radicals, domain, subdomain) {
  const scalePoint = predictDifficulty(radicals, domain, subdomain);
  return { scalePoint, band: scoreToBand(scalePoint, domain), method: "apriori_v1", feature_vector: { ...radicals } };
}

/* ---- BUILD_SPEC step 5 (optional research): refit weights from measured data --
   Ordinary least squares of measured difficulty (e.g. from Tier-B consistency:
   scale ≈ a − b·success_rate) on the radical feature matrix. Pure-JS normal
   equations; tiny system (≤6 features), so no deps. Off the critical path. */
export function fitWeights(samples) {
  // samples: [{ radicals, measured }]  (measured = a 200-800 scale score)
  const feat = (r) => [1, Number(r.n_steps) || 0, r.has_variable_both_sides ? 1 : 0, r.has_distribution ? 1 : 0, r.has_fractions ? 1 : 0, r.answer_type === "fraction" ? 1 : 0];
  const names = ["w0", "n_steps", "has_variable_both_sides", "has_distribution", "has_fractions", "answer_is_fraction"];
  const X = samples.map((s) => feat(s.radicals)), y = samples.map((s) => s.measured), p = names.length;
  // normal equations: (XᵀX) w = Xᵀy, solved by Gauss-Jordan
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((a, row) => a + row[i] * row[j], 0)));
  const b = Array.from({ length: p }, (_, i) => X.reduce((a, row, k) => a + row[i] * y[k], 0));
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    const d = A[c][c] || 1e-9;
    for (let j = c; j < p; j++) A[c][j] /= d; b[c] /= d;
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c]; for (let j = c; j < p; j++) A[r][j] -= f * A[c][j]; b[r] -= f * b[c]; }
  }
  return Object.fromEntries(names.map((n, i) => [n, Math.round(b[i] * 100) / 100]));
}

export default { predictDifficulty, predictBand, scoreToBand, enumerateRadicals, radicalsForBand, nearestRadicals, bandGate, measureFromRadicals, fitWeights, BANDS, bandIndex };
