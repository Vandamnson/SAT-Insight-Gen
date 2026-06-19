/* ============================================================================
   demo-loop.mjs — demonstrate the critique→revise loop on a hard (B7) target,
   where attempt 0 usually under-shoots the band so the judge's retarget hint
   kicks in. Prints each attempt + the retarget instruction fed back to the author.
   Run: SIG_LLM_TIMEOUT=300000 node build/demo-loop.mjs
   ============================================================================ */
import { generateOne, resolveTarget } from "./generate.mjs";
import { Ledger } from "./ledger.mjs";

// Algebra B7 reliably under-shoots (linear skills are hard to push to B7); run with
// SIG_BAND_TOL=0 so any miss triggers the critique→revise loop.
const target = resolveTarget({ statementId: "ALG.B7.s1", skill: "lin_create_solve", type: "mcq", figureReq: "none", program: "SAT" });
console.log(`Target: ${target.statementId} ${target.skill} [${target.band}] — watch the loop…\n`);
const { item, log } = await generateOne(target, 1, new Ledger(null), 2);
log.forEach((l) => console.log(l));
console.log(item
  ? `\n✓ FINAL: measured ${item.difficulty.band} @${item.difficulty.scalePoint} after ${log.filter(l => /retarget/.test(l)).length} judge-guided revision(s)`
  : `\n✗ no item within the repair budget`);
