/* ============================================================================
   engine/verify/realize-ab.mjs — THE EXPERIMENT: does LLM realization lift a
   composed chain's authenticity past the distribution floor (≥7)?

   For each cataloged chain: draw one verified item → score the TEMPLATE stem →
   LLM-realize (pinned numbers, triple-gated) → score the REALIZED stem → table.
   Honest by construction: same judge, same floor, results reported either way.
   node engine/verify/realize-ab.mjs
   ============================================================================ */
import { enumerateChains, chainSignature, drawChain } from "../composer.mjs";
import { rng } from "../types.mjs";
import { realizeChainLLM } from "../realize/llm.mjs";
import { authenticityScore } from "../authenticity.mjs";
import { FLOORS } from "../bandpass.mjs";

const rows = [];
for (const spec of enumerateChains({})) {
  const sig = chainSignature(spec);
  const item = drawChain(spec, rng(`ab|${sig}`));
  let tScore = null, rScore = null, rWhy = null, tWhy = null, realized = null;
  try { const t = await authenticityScore(item); tScore = t.score; tWhy = t.why; } catch { /* transport */ }
  try { realized = await realizeChainLLM(item, { domain: spec.domain }); } catch (e) { console.error(`  realize failed ${sig}: ${e.message}`); }
  if (realized) { try { const r = await authenticityScore(realized.item); rScore = r.score; rWhy = r.why; } catch { /* transport */ } }
  rows.push({ sig, tScore, rScore, attempts: realized?.attempts ?? null, statement: realized?.statement || null, tWhy, rWhy });
  console.log(`\n■ ${sig}`);
  console.log(`  template  auth ${tScore ?? "—"}  ${tWhy ? "· " + tWhy.slice(0, 110) : ""}`);
  if (realized) {
    console.log(`  realized  auth ${rScore ?? "—"} (attempts ${realized.attempts})  ${rWhy ? "· " + rWhy.slice(0, 110) : ""}`);
    console.log(`  stem: ${realized.statement.slice(0, 220)}`);
  } else console.log(`  realized  FAILED all gates (answer-pin/PROVE) — template stands`);
}

console.log(`\n================ A/B SUMMARY (floor ${FLOORS.authMin}) ================`);
let lifted = 0, passing = 0;
for (const r of rows) {
  const verdict = r.rScore == null ? "realize-failed" : r.rScore >= FLOORS.authMin ? "PASSES floor" : "still below";
  if (r.rScore != null && r.tScore != null && r.rScore > r.tScore) lifted++;
  if (r.rScore != null && r.rScore >= FLOORS.authMin) passing++;
  console.log(`  ${String(r.tScore ?? "—").padStart(2)} → ${String(r.rScore ?? "—").padStart(2)}  ${verdict.padEnd(14)} ${r.sig}`);
}
console.log(`\nlifted: ${lifted}/${rows.length} · passing floor: ${passing}/${rows.length}`);
