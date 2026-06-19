/* ============================================================================
   consistency.mjs — SELECTOR Tier B (BUILD_SPEC §4). For FREE domains where no
   program-verifier is available (geometry, later), Claude solves the problem N
   times INDEPENDENTLY and we keep it only if ≥ ceil(0.8·N) agree on the answer
   (the standard self-consistency selector). Weaker than PROVE, but it's all you
   get without a mechanical checker. Also dual-use: the model success rate over N
   solves is the MEASURED difficulty signal for fitting the LLTM (BUILD_SPEC §5.2).

   Transport note: the `claude` CLI exposes no --temperature, so independence
   across the N solves is induced by varying the prompt per solve (attempt nonce +
   an instruction to reason from scratch) rather than by sampling temperature.
   ============================================================================ */
import { llmComplete } from "../build/llm.mjs";

const SOLVE_MODEL = process.env.SIG_SOLVE_MODEL || "claude-sonnet-4-6";
const SYSTEM = "You are a careful SAT math solver. You solve from scratch and show no work beyond a final line. You never assume any provided answer.";

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/^[(]|[)]$/g, "").replace(/^\+/, "");
function parseFinal(raw, isMcq) {
  const txt = String(raw);
  const m = txt.match(/FINAL:\s*(.+?)\s*$/im);
  let v = m ? m[1] : txt.trim().split(/\n/).pop();
  if (isMcq) { const lm = String(v).match(/\b([A-D])\b/); return lm ? lm[1] : norm(v); }
  return norm(v);
}

async function solveOnce(cand, k) {
  const isMcq = !!cand.choices;
  const choices = isMcq ? `\nCHOICES:\n${cand.choices.join("\n")}` : "";
  const user = `Solve this problem from scratch (independent attempt #${k + 1}). Do not assume any answer.

PROBLEM:
${cand.statement}${choices}

End with one line exactly: "FINAL: <${isMcq ? "the letter A-D" : "the single value"}>".`;
  try { return parseFinal(await llmComplete(user, { system: SYSTEM, model: SOLVE_MODEL }), isMcq); }
  catch { return null; }
}

/** consistencyCheck(cand, {N}) -> {keep, agree, majority, claimedMatches, answers,
 *  successRate}. keep iff ≥ ceil(0.8·N) solves agree AND the majority matches the
 *  claimed answer. successRate (fraction matching the claim) feeds §5.2. */
export async function consistencyCheck(cand, { N = Number(process.env.SIG_CONSISTENCY_N || 5) } = {}) {
  const isMcq = !!cand.choices;
  const answers = (await Promise.all(Array.from({ length: N }, (_, k) => solveOnce(cand, k)))).filter((x) => x != null);
  if (!answers.length) return { keep: false, agree: 0, answers: [], successRate: 0 };
  const tally = {}; for (const a of answers) tally[a] = (tally[a] || 0) + 1;
  const [majority, agree] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const claim = isMcq ? cand.correct_choice : norm(cand.answer);
  const claimedCount = tally[claim] || 0;
  const need = Math.ceil(0.8 * N);
  return {
    keep: agree >= need && norm(majority) === norm(claim),
    agree, majority, claimedMatches: claimedCount, need, answers, successRate: claimedCount / answers.length,
  };
}

export default { consistencyCheck };
