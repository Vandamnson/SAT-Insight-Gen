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
  // EMPIRICAL stem-length targets — measured from official College Board items
  // (Skills-Insight exemplars + practice test #10): median ≈18 words, ~half < 20,
  // only ~10% > 50 (those are higher-band modeling), hard max ≈ 80.
  const WBAND = ({ 1: "8–16", 2: "10–20", 3: "15–32", 4: "20–40", 5: "20–42", 6: "25–48", 7: "25–55" })[cell.band] || "15–40";
  const user = `SPECIFICATION:
${JSON.stringify(cell, null, 2)}

DESIGN RATIONALE (from the item designer — realize THIS exact design):
${rationaleText}
${numbersDirective}

FORMAT: ${fmt}

STYLE (SAT items are tight — follow exactly):
- LENGTH: this is a Band ${cell.band} item — target a STEM of ${WBAND} words. (Measured from official SAT Math: median ≈18 words, ~half under 20, only ~10% exceed 50 — and those are higher-band modeling items. Never exceed ~60 words unless the math genuinely requires a modeling setup.)
- Be CONCISE. At MOST one short sentence of context, then the question. No backstory, no scene-setting, no flavor padding (e.g. NOT "A wildlife researcher monitors salmon migration by counting fish as they pass through a river ladder…"). Lower bands (B1–B3) especially terse; an abstract item is just the equation/expression and the ask.
- Write ALL mathematics as LaTeX wrapped in $...$ — e.g. $3x + 5 = 20$, $\\frac{16}{5}$, $y = \\frac{3}{2}x + 7$, $-3n + 1 > -24$. Use \\frac for fractions, \\le \\ge for ≤ ≥, \\cdot or juxtaposition for multiply. Plain prose stays OUTSIDE the $...$. Put each MCQ choice's math in $...$ too.
- The "answer" field (free-response) must be the PLAIN griddable value (e.g. -29/2 or 4.5), NOT LaTeX.
Use op names in solve_path drawn from this vocabulary where they apply: ${JSON.stringify(cell.opVocab || cell.op_vocab || [])}.`;
  const raw = await llmComplete(user, { system: SYSTEM, model });
  try { return parseJson(raw); } catch { return null; }
}

export default { authorItem, modelForBand };
