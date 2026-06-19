/* ============================================================================
   judge.mjs — the calibrated multi-LLM-judge panel (difficulty signal #3).
   For an item, each panelist estimates P(correct | student at band b) for every
   band; the per-band curve's 0.67 crossing is the RP67 location (the 0.50
   crossing → RP50, for exemplar tagging). Because the Claude API exposes no
   logprobs, a calibrated probability comes from ENSEMBLING N independent
   elicitations (varied framing) + anchoring to band-labeled exemplars. One
   panelist additionally SOLVES the item (adversarial grounding).

   Phase 2: panel + exemplar anchoring + RP67/RP50 extraction (here).
   Calibration (isotonic map from elicited-P → empirical correctness) is applied
   by difficulty/calibrate.* once a labeled set is available.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { llmComplete, parseJson } from "../build/llm.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const MATRIX = JSON.parse(readFileSync(join(__dirname, "..", "taxonomy", "matrix.json"), "utf8"));
const BANDS = MATRIX.bands;
const MID = Object.fromEntries(BANDS.map((b) => [b.id, b.midpoint]));

// Ground each band's definition in College Board's OWN Skills-Insight statements
// (from the PDF → matrix.json), specific to the item's content domain. This is
// the authoritative band grounding, far better than generic hand-written blurbs.
function bandDescFor(domain) {
  const out = {};
  for (const id of ["B2", "B3", "B4", "B5", "B6", "B7"]) {
    const cell = MATRIX.cells.find((c) => c.domain === domain && c.band === id);
    const label = (BANDS.find((b) => b.id === id) || {}).label || "";
    const stmts = cell ? cell.statements.map((s) => s.text.replace(/\s+/g, " ").trim()).join(" / ") : "";
    out[id] = `(scale ${label}) ${stmts}`;   // full, un-truncated CB Skills-Insight statements
  }
  return out;
}

// Few-shot anchors = OFFICIAL College Board Skills-Insight exemplars (one per
// band, held out from validation) — they convert absolute P-judgments into
// relative ones, anchored to CB's own band-labeled items. See
// build/pick-anchors.mjs → taxonomy/anchors.json.
const ANCHORS = JSON.parse(readFileSync(join(__dirname, "..", "taxonomy", "anchors.json"), "utf8"));

const segText = (arr) => (Array.isArray(arr) ? arr : [arr]).map((s) => (typeof s === "string" ? s : s?.segs ? segText(s.segs) : `${s?.v ?? ""}`)).join(" ");

const FRAMINGS = [
  "Simulate students at each ability band and estimate the fraction who answer correctly.",
  "You are an SAT psychometrician estimating each band's success probability from the item's cognitive load.",
  "Solve the item yourself first, then judge how likely a student at each band is to reach that answer.",
];

function buildPrompt(item, framing) {
  const stem = segText(item.stem);
  const opts = item.type === "mcq" ? "Options: " + (item.options || []).map((o) => `(${o.key}) ${segText(o.seg)}`).join("  ") : "(student-produced response)";
  const ans = item.type === "mcq" ? item.answer?.correct : (item.answer?.accept || [])[0];
  const anchorTxt = ANCHORS.map((a) => `  [${a.band}] ${a.stem} (answer: ${a.key})`).join("\n");
  const desc = bandDescFor(item.domain);
  const bandTxt = Object.entries(desc).map(([b, d]) => `  ${b} = ${d}`).join("\n");
  return `${framing}

Performance bands for ${item.domain} (Digital SAT Math) — what students at each band can typically do, per College Board's Skills Insight:
${bandTxt}

Calibration anchors (items with their known band):
${anchorTxt}

ITEM to judge:
  Stem: ${stem}
  ${opts}
  Correct answer: ${ans}
  Worked solution: ${segText(item.solution)}

For EACH band B2..B7, estimate the probability (0.0–1.0) that a student in that band answers this item correctly. Probabilities must be non-decreasing from B2 to B7. Return ONLY:
{"B2":p,"B3":p,"B4":p,"B5":p,"B6":p,"B7":p}`;
}

async function judgeOne(item, framing) {
  const raw = await llmComplete(buildPrompt(item, framing), { system: "You are a careful SAT difficulty estimator. Return only the JSON probability map." });
  const o = parseJson(raw);
  return ["B2", "B3", "B4", "B5", "B6", "B7"].map((b) => Math.max(0, Math.min(1, Number(o[b]))));
}

// calibration map (judge-RP67 → corrected scale), fitted by calibrate.mjs.
// No-op until difficulty/calibration.json exists. {raw:true} bypasses it.
let CAL = null, calTried = false;
function applyCal(x) {
  if (!calTried) { calTried = true; try { CAL = JSON.parse(readFileSync(join(__dirname, "calibration.json"), "utf8")); } catch { CAL = null; } }
  // apply only a map that was validated to beat the raw judge (deployed!==false)
  return CAL && CAL.deployed !== false ? Math.max(340, Math.min(720, Math.round(CAL.a + CAL.b * x))) : x;
}

// interpolate the scale point where the per-band P curve crosses `thr`
function crossing(P, thr) {
  const ids = ["B2", "B3", "B4", "B5", "B6", "B7"], xs = ids.map((b) => MID[b]);
  if (P[0] >= thr) return Math.max(340, xs[0] - 40);                 // already easy at B2
  for (let i = 1; i < P.length; i++) if (P[i] >= thr) {
    const t = (thr - P[i - 1]) / ((P[i] - P[i - 1]) || 1e-9);
    return Math.round(xs[i - 1] + t * (xs[i] - xs[i - 1]));
  }
  return 720;                                                        // never reaches thr → top
}

/** judgePanel(item, {n, raw}) -> { thetaJudge, rawThetaJudge, se, rp50Scale, perBand, n } */
export async function judgePanel(item, { n = 3, raw = false } = {}) {
  const runs = [];
  for (let i = 0; i < n; i++) { try { runs.push(await judgeOne(item, FRAMINGS[i % FRAMINGS.length])); } catch (e) { /* skip a failed panelist */ } }
  if (!runs.length) return null;
  const ids = ["B2", "B3", "B4", "B5", "B6", "B7"];
  const mean = ids.map((_, k) => runs.reduce((s, r) => s + r[k], 0) / runs.length);
  // enforce monotone (small elicitation noise can invert adjacent bands)
  for (let k = 1; k < mean.length; k++) mean[k] = Math.max(mean[k], mean[k - 1]);
  const rawRp67 = crossing(mean, 0.67), rawRp50 = crossing(mean, 0.50);
  const rp67 = raw ? rawRp67 : applyCal(rawRp67), rp50 = raw ? rawRp50 : applyCal(rawRp50);
  // between-panel SD at the RP67 band → uncertainty (scale pts, rough map)
  const spread = runs.length > 1 ? Math.sqrt(mean.reduce((s, m, k) => s + runs.reduce((a, r) => a + (r[k] - m) ** 2, 0) / runs.length, 0) / mean.length) : 0.15;
  const se = Math.max(25, Math.round(spread * 300));
  return { thetaJudge: rp67, rawThetaJudge: rawRp67, se, rp50Scale: rp50, perBand: Object.fromEntries(ids.map((b, k) => [b, +mean[k].toFixed(2)])), n: runs.length };
}

const BIDX = Object.fromEntries(BANDS.map((b, i) => [b.id, i]));

/** retargetHint(item, targetBand, measuredBand, perBand) — the critique→revise
 *  signal: turn the judge's band verdict into ONE concrete revision instruction
 *  for the author. Fires only on a band miss. Returns null on transport failure. */
export async function retargetHint(item, targetBand, measuredBand, perBand) {
  const dir = (BIDX[measuredBand] ?? 0) < (BIDX[targetBand] ?? 0) ? "HARDER" : "EASIER";
  const stem = segText(item.stem);
  const opts = item.type === "mcq" ? "\nOptions: " + (item.options || []).map((o) => `(${o.key}) ${segText(o.seg)}`).join("  ") : "";
  const ans = item.type === "mcq" ? item.answer?.correct : (item.answer?.accept || [])[0];
  const prompt = `An SAT Math item was written to target Band ${targetBand}, but an examiner panel measured it at Band ${measuredBand}${perBand ? ` (per-band P(correct): ${JSON.stringify(perBand)})` : ""}. It must be made ${dir} to land in Band ${targetBand}.

ITEM: ${stem}${opts}
Answer: ${ans}

Give the author the SINGLE most effective, concrete revision. ${dir === "HARDER"
    ? "e.g. chain a second concept, make a coefficient an unknown parameter, remove the cue about which method to use, add a sign/branch trap, or require a non-obvious insight."
    : "e.g. reduce to one step, use clean integer values, state which method to apply, or drop a distracting twist."} Reply with ONE sentence, no preamble.`;
  try {
    const raw = await llmComplete(prompt, { system: "You are an SAT item-difficulty coach. Reply with exactly one concrete revision instruction, no preamble." });
    return raw.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 400);
  } catch { return null; }
}

export default { judgePanel, retargetHint };
