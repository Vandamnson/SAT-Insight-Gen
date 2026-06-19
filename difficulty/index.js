/* ============================================================================
   difficulty/index.js — Subsystem A: difficulty quantification, LLM-JUDGE based.

   Difficulty = the RP67 location (scale score where P(correct)=0.67), estimated
   by the multi-LLM-judge panel (difficulty/judge.mjs): N panelists estimate
   P(correct) per band — grounded in College Board's own Skills-Insight
   statements per domain + anchored to band-labeled exemplars — and the per-band
   curve's 0.67 crossing is the scale point. The band is derived from it via the
   official cut scores. Validated vs CB's own labels: ρ=0.90, ±1-band 88%.

   (The old deterministic anchor+structural-feature estimator was removed — it
   was a brittle proxy: a figure ≠ hard, a "triangle"/"perimeter" param string
   tripped the parametric flag, etc. The judge reads the actual task instead.)
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { judgePanel } from "./judge.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const BANDS = JSON.parse(readFileSync(join(__dirname, "..", "taxonomy", "matrix.json"), "utf8")).bands;

export const bandIndex = (id) => BANDS.findIndex((b) => b.id === id);
export const midpoint = (id) => (BANDS.find((b) => b.id === id) || {}).midpoint;
export function bandOf(scale) {
  for (let i = BANDS.length - 1; i >= 0; i--) if (scale >= BANDS[i].scaleMin) return BANDS[i].id;
  return BANDS[0].id;
}

/**
 * measure(item, opts?) -> { scalePoint, band, se_scale, band_ambiguous, is_exemplar,
 *                           method, rp67_statement, signals } — ASYNC (calls the judge).
 * opts.n = panel size (default SIG_PANEL_N or 2). On judge transport failure,
 * falls back to the target-band midpoint (so generation degrades gracefully).
 */
export async function measure(item, opts = {}) {
  const n = opts.n ?? Number(process.env.SIG_PANEL_N || 2);
  let panel = null;
  try { panel = await judgePanel(item, { n }); } catch { /* fall through */ }
  if (!panel) {
    const tb = item.target_band || item.band;
    const sp = midpoint(tb) ?? 500;
    return { scalePoint: sp, band: bandOf(sp), se_scale: 9999, band_ambiguous: false, is_exemplar: false,
      method: "anchor-fallback", rp67_statement: `(judge unavailable) anchored at Band ${(tb || "").slice(1)}`, signals: { judge: null } };
  }
  const scalePoint = panel.thetaJudge, band = bandOf(scalePoint), se_scale = panel.se;
  const lo = bandOf(scalePoint - se_scale), hi = bandOf(scalePoint + se_scale);
  const is_exemplar = bandIndex(bandOf(panel.rp50Scale)) >= bandIndex(band);
  return {
    scalePoint, band, se_scale, band_ambiguous: lo !== hi, is_exemplar, method: "llm-judge",
    rp67_statement: `A student scoring ~${scalePoint} has ~67% chance correct (Band ${band.slice(1)}).`,
    signals: { judge: { scale: panel.thetaJudge, se: panel.se, perBand: panel.perBand, rp50Scale: panel.rp50Scale, n: panel.n } },
  };
}

/** accept(targetBand, measured, tol=1) — keep iff measured band is within tol of target. */
export function accept(targetBand, measured, tol = 1) {
  return Math.abs(bandIndex(measured.band) - bandIndex(targetBand)) <= tol;
}

export default { measure, accept, bandOf, bandIndex, midpoint };
