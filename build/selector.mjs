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
import { predictBand, bandGate } from "../difficulty/lltm.mjs";
import { fingerprint, structuralDistance } from "./fingerprint.mjs";

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

/** verifyAndGate(cand, cell) -> { keep, stage, ... }. The per-candidate gate:
 *  Tier-A/B correctness → LLTM band gate → reskin distance (logged, gate off by
 *  default). Does NOT do surface dedup (that needs the cross-candidate pool). */
export async function verifyAndGate(cand, cell, { tier = cell.tier || "A", reskinFloor = null } = {}) {
  // 1. correctness — the trusted gate.
  let correctness;
  if (tier === "A") correctness = await proveCheck(cand);
  else correctness = await consistencyCheck(cand);
  if (!correctness.keep) return { keep: false, stage: "correctness", correctness, reason: correctness.error || `agree ${correctness.agree}/${correctness.need}` };

  // 2. LLTM band gate (§5) on what the author ACTUALLY built (radicals_used),
  //    asymmetric: reject anything harder than the cell's target band.
  const used = cand.radicals_used && Object.keys(cand.radicals_used).length ? { ...cell.radicals, ...cand.radicals_used } : cell.radicals;
  const pBand = predictBand(used, cell.domain, cell.subdomain);
  const gate = bandGate(pBand, `B${cell.band}`);
  if (!gate.ok) return { keep: false, stage: "band", predictedBand: pBand, gate, correctness, reason: `${gate.reason} (pred ${pBand} vs target B${cell.band})` };

  // 3. reskin structural distance (§4.3) — measured + returned for logging; the
  //    ε(c) floor is OFF unless reskinFloor is supplied.
  const fp = fingerprint(cand.solve_path);
  const distance = structuralDistance(fp, cell.canonical_fingerprint);
  if (reskinFloor != null && distance < reskinFloor) return { keep: false, stage: "reskin", distance, fingerprint: fp, correctness, predictedBand: pBand, reason: `reskin: dist ${distance.toFixed(2)} < ε ${reskinFloor}` };

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
