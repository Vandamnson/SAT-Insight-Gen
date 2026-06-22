/* ============================================================================
   selector.mjs — the SELECTOR (BUILD_SPEC §4). The deterministic gate; all trust
   lives here, nothing the producer made is trusted until it passes. Two tiers:
     Tier A (anchored, e.g. algebra): PROVE program-verifier.
     Tier B (free, e.g. geometry):    self-consistency.
   Plus the LLTM band gate (§5), surface dedup, and the reskin structural-distance
   gate (§4.3 — LOG ONLY at first; enable the ε(c) floor once the histogram is in).

   Split for concurrency: verifyAndGate() is the per-candidate, LLM-bearing part
   (parallel-safe); surfaceDup() is the cross-candidate part (run sequentially in
   the assembler so the growing pool is consistent — no dedup race).
   ============================================================================ */
import { proveCheck } from "../verify/prove.mjs";
import { consistencyCheck } from "../verify/consistency.mjs";
import { plausibilityCheck } from "../verify/plausibility.mjs";
import { predictBand, bandGate } from "../difficulty/lltm.mjs";
import { fingerprint, structuralDistance } from "./fingerprint.mjs";

// run-level structural-clone tracker (Fix 2): no two KEPT items share an exact
// solve-path; a clone is routed to the double-gate to be revised into a different
// structure. Enabled by SIG_STRUCT_DEDUP=1 (or whenever SIG_RESKIN_FLOOR is set).
const seenFingerprints = new Set();
const STRUCT_DEDUP = process.env.SIG_STRUCT_DEDUP === "1" || process.env.SIG_RESKIN_FLOOR != null;
// real-world plausibility gate (context items only) — ON by default; SIG_PLAUSIBILITY=0 disables.
const PLAUSIBILITY = process.env.SIG_PLAUSIBILITY !== "0";

// ---- surface dedup: numeric/letter-blanked shingles + Jaccard (port of the
// ledger's normalization, but operating on the flat author `statement` string) --
function shingles(text) {
  const norm = String(text).toLowerCase().replace(/-?\d+\.?\d*/g, "#").replace(/[^a-z0-9#\s]/g, " ").replace(/\b[a-z]\b/g, "v").split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 4 <= norm.length; i++) set.add(norm.slice(i, i + 4).join(" "));
  if (!set.size) norm.forEach((w) => set.add(w));
  return set;
}
function jaccard(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 0; }

/** surfaceDup(cand, kept, threshold) -> true if too close to an already-kept item. */
export function surfaceDup(cand, kept, threshold = Number(process.env.SIG_DEDUP ?? 0.6)) {
  const sh = shingles(cand.statement || "");
  return kept.some((k) => jaccard(sh, k._sh || (k._sh = shingles(k.statement || ""))) >= threshold);
}

// tier C (graph items): the harness drew the figure AND pinned the answer, so there is
// no text-solvable check — verify the figure is self-consistent (well-formed line, any
// marked point lies on it). Construction guarantees the answer; this guards drawer bugs.
function figureCheck(cell) {
  const fig = cell?.incidentals?.numbers?.figure;
  if (!fig || fig.fn !== "coordPlane") return { keep: false, reason: "graph item missing coordPlane figure" };
  const curve = (fig.spec?.curves || [])[0];
  if (!curve || curve.m === undefined || curve.b === undefined) return { keep: false, reason: "graph figure has no line" };
  for (const p of (fig.spec.points || [])) { const [x, y] = p.at; if (Math.abs(curve.m * x + curve.b - y) > 1e-9) return { keep: false, reason: `point ${JSON.stringify(p.at)} off the line` }; }
  return { keep: true };
}

/** verifyAndGate(cand, cell) -> { keep, stage, ... }. The per-candidate gate:
 *  Tier-A/B correctness → LLTM band gate → reskin distance (logged, gate off by
 *  default). Does NOT do surface dedup (that needs the cross-candidate pool). */
export async function verifyAndGate(cand, cell, { tier = cell.tier || "A", reskinFloor = (process.env.SIG_RESKIN_FLOOR ? Number(process.env.SIG_RESKIN_FLOOR) : null) } = {}) {
  // 1. correctness — the trusted gate.
  let correctness;
  if (tier === "A") correctness = await proveCheck(cand);
  else if (tier === "C") correctness = figureCheck(cell);          // graph item: harness-constructed, figure self-consistency
  else correctness = await consistencyCheck(cand);
  if (!correctness.keep) return { keep: false, stage: "correctness", correctness, reason: correctness.error || `agree ${correctness.agree}/${correctness.need}` };

  // 2. LLTM band gate (§5) on what the author ACTUALLY built (radicals_used),
  //    asymmetric: reject anything harder than the cell's target band.
  const used = cand.radicals_used && Object.keys(cand.radicals_used).length ? { ...cell.radicals, ...cand.radicals_used } : cell.radicals;
  const pBand = predictBand(used, cell.domain, cell.subdomain);
  const gate = bandGate(pBand, `B${cell.band}`);
  if (!gate.ok) return { keep: false, stage: "band", predictedBand: pBand, gate, correctness, reason: `${gate.reason} (pred ${pBand} vs target B${cell.band})` };

  // 2.5 real-world plausibility (context items only; abstract items pass inside
  //     the check) — the scenario/numbers a real published item would ship.
  //     Targets the judge's 3–4 realism tells; feeds the double-gate on failure.
  if (PLAUSIBILITY) {
    const plaus = await plausibilityCheck(cand, cell);
    if (!plaus.keep) return { keep: false, stage: "plausibility", issues: plaus.issues, correctness, predictedBand: pBand, reason: `implausible: ${(plaus.issues || []).join("; ") || "scenario/numbers a real item would not ship"}` };
  }

  // 3. reskin structural distance (§4.3) — measured + returned for logging; the
  //    ε(c) floor is OFF unless reskinFloor is supplied.
  const fp = fingerprint(cand.solve_path), fpKey = fp.join(">");
  const distance = structuralDistance(fp, cell.canonical_fingerprint);
  if (reskinFloor != null && distance < reskinFloor) return { keep: false, stage: "reskin", distance, fingerprint: fp, correctness, predictedBand: pBand, reason: `reskin: dist ${distance.toFixed(2)} < ε ${reskinFloor}` };
  if (STRUCT_DEDUP && fp.length && seenFingerprints.has(fpKey)) return { keep: false, stage: "reskin", distance, fingerprint: fp, correctness, predictedBand: pBand, reason: `structural clone of a kept item: [${fpKey}]` };
  if (STRUCT_DEDUP && fp.length) seenFingerprints.add(fpKey);
  return { keep: true, stage: "kept", predictedBand: pBand, fingerprint: fp, distance, correctness };
}

/** selector(cand, cell, pool, opts) — the full §6 gate (correctness → band →
 *  dedup → reskin). Composes verifyAndGate + surfaceDup; for sequential use/tests.
 *  (The assembler uses verifyAndGate in parallel then surfaceDup sequentially.) */
export async function selector(cand, cell, pool = [], opts = {}) {
  const g = await verifyAndGate(cand, cell, opts);
  if (!g.keep) return g;
  if (surfaceDup(cand, pool, opts.dedup)) return { ...g, keep: false, stage: "dedup", reason: "surface duplicate" };
  return g;
}

export default { selector, verifyAndGate, surfaceDup };
