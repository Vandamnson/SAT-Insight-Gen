/* ============================================================================
   plausibility.mjs — SELECTOR real-world PLAUSIBILITY gate.

   PROVE (Tier A) checks the MATH is correct; this checks the SCENARIO and the
   NUMBERS are ones a real published SAT item would actually ship. It targets the
   exact failure mode behind the blind judge's 3–4 "tells" — every one of which
   was a *realism* miss on a CONTEXT item, not a math miss:
     - real-world-implausible quantities (a 12.5-lb "bag", 19/7 % per mile)
     - incoherent models (perpendicular to a rate, a nonsensical zero-intercept)
     - wrong answer TYPE for the context (a fractional count of discrete things)
     - self-contradiction between stem and answer

   Abstract items (bare equations / "how many solutions") have no scenario, so
   they SKIP this gate (no extra call). A failure feeds the double-gate (revise),
   it does not discard. Fail-OPEN on judge transport error — never block a correct
   item because the plausibility call itself failed.
   ============================================================================ */
import { llmComplete, parseJson } from "../build/llm.mjs";

const PLAUSIBILITY_MODEL = process.env.SIG_PLAUSIBILITY_MODEL || "claude-opus-4-8";

const SYSTEM = "You are a senior College Board SAT Math item reviewer doing the FINAL real-world plausibility pass before publication. You are strict about realism but you pass ordinary clean textbook scenarios.";

/** plausibilityCheck(cand, cell) -> {keep, issues, skipped?, error?}.
 *  Only judges CONTEXT items; abstract items pass unconditionally. */
export async function plausibilityCheck(cand, cell, { model = PLAUSIBILITY_MODEL } = {}) {
  if ((cell?.incidentals?.context ?? "none") === "none") return { keep: true, skipped: "abstract" };
  const ans = cand.answer ?? (cand.correct_choice ? `choice ${cand.correct_choice}` : "");
  const user = `A generated SAT Math item. Its MATH is already independently verified correct — do NOT re-solve it. Judge ONLY the OBJECTIVE REAL-WORLD COHERENCE of the scenario and numbers. Reject (plausible=false) if ANY of these hold:
- a quantity is real-world implausible or absurd (e.g. a 12.5-pound "bag", "removes 4 liters of reserve per liter filtered", "19/7 % per mile")
- the model is physically or economically incoherent (e.g. a line "perpendicular" to a rate-of-change model; a nonzero y-intercept that makes no sense at zero)
- the answer's TYPE is wrong for the context (e.g. a fractional count of discrete objects, a negative count)
- the stem is internally self-contradictory, or a stated quantity contradicts the answer

CRITICAL — judge coherence ONLY. A NOVEL scenario or an unusual problem structure is perfectly fine and DESIRABLE. Do NOT consider whether the item resembles a known released item, uses "standard"/"canonical" phrasing, or is a familiar template — novelty is NOT a defect and recognizability is NOT a virtue. An ordinary, sensible scenario with tidy numbers PASSES regardless of how novel it is. Flag ONLY a genuine logical/physical/numerical defect, never a stylistic or familiarity nitpick.

ITEM: ${cand.statement || ""}
ANSWER: ${ans}

Respond with ONLY this JSON: {"plausible": true or false, "issues": ["short phrase", ...]}`;
  let v;
  try { v = parseJson(await llmComplete(user, { system: SYSTEM, model })); }
  catch (e) { return { keep: true, error: `plausibility judge unavailable — passing (${e.message})` }; }   // fail-open
  return { keep: v.plausible !== false, issues: Array.isArray(v.issues) ? v.issues : [] };
}

export default { plausibilityCheck };
