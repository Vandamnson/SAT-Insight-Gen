/* ============================================================================
   author2.mjs — AGENT 2 (BUILD_SPEC §3). Writes the actual problem conditioned on
   the cell + Agent 1's rationale, and emits STRUCTURED JSON so the selector can
   read the solve. The typed `solve_path` is the structural fingerprint used for
   both verification and reskin detection. The author is the PRODUCER — nothing it
   says is trusted until the deterministic selector (PROVE) re-derives the answer.
   ============================================================================ */
import { llmComplete, parseJson } from "./llm.mjs";

// sonnet for most bands; opus for the hardest (B6-B7), per BUILD_SPEC §3.
const AUTHOR_MODEL = process.env.SIG_AUTHOR_MODEL || "claude-sonnet-4-6";
const AUTHOR_MODEL_HARD = process.env.SIG_AUTHOR_MODEL_HARD || "claude-opus-4-8";
export const modelForBand = (band) => (Number(String(band).replace("B", "")) >= 6 ? AUTHOR_MODEL_HARD : AUTHOR_MODEL);

// System prompt — verbatim from BUILD_SPEC §3 (incl. the exact output contract).
const SYSTEM = `You are an SAT math item writer. Given a SPECIFICATION and a DESIGN RATIONALE (including an
intended solution path), write ONE complete SAT-style problem that realizes that design.

Requirements:
- The problem must match the rationale's structure exactly (same radicals, same intended
  solve path). Do not add or remove solve steps.
- Use the incidentals provided (context, variable name, number ranges) for surface detail.
- Produce a single unambiguous correct answer.

Output ONLY valid JSON, no prose, no markdown fences:
{
  "statement": "the full problem text as a student would see it",
  "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],   // omit if free-response
  "correct_choice": "B",                                  // or "answer" for free-response
  "answer": "the correct numeric/expression answer",
  "solve_path": [
    {"step": 1, "op": "distribute", "detail": "..."},
    {"step": 2, "op": "collect_like_terms", "detail": "..."}
  ],
  "radicals_used": { ...echo the radicals... },
  "claimed_band": 3
}`;

/** authorItem(cell, rationaleText) -> parsed candidate JSON (throws on transport;
 *  returns null on unparseable output so the harness just drops that draw). */
export async function authorItem(cell, rationaleText, { model = modelForBand(cell.band) } = {}) {
  const fmt = cell.incidentals?.format === "mcq"
    ? `Write this as MULTIPLE CHOICE: include "choices" (exactly 4, "A) ".."D) ") and "correct_choice"; exactly one is correct, the other three are plausible near-misses.`
    : `Write this as FREE-RESPONSE (student-produced): OMIT "choices"; put the single value in "answer". Do not include "correct_choice".`;
  const nums = cell.incidentals?.numbers;
  const numbersDirective = nums?.directive ? `\n${nums.directive}\n` : "";
  const user = `SPECIFICATION:
${JSON.stringify(cell, null, 2)}

DESIGN RATIONALE (from the item designer — realize THIS exact design):
${rationaleText}
${numbersDirective}

FORMAT: ${fmt}
Use op names in solve_path drawn from this vocabulary where they apply: ${JSON.stringify(cell.opVocab || cell.op_vocab || [])}.`;
  const raw = await llmComplete(user, { system: SYSTEM, model });
  try { return parseJson(raw); } catch { return null; }
}

export default { authorItem, modelForBand };
