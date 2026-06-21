/* ============================================================================
   author2.mjs — AGENT 2 (BUILD_SPEC §3). Writes the actual problem conditioned on
   the cell + Agent 1's rationale, and emits STRUCTURED JSON so the selector can
   read the solve. The typed `solve_path` is the structural fingerprint used for
   both verification and reskin detection. The author is the PRODUCER — nothing it
   says is trusted until the deterministic selector (PROVE) re-derives the answer.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { llmComplete, parseJson } from "./llm.mjs";

// Opus for all bands (quality over cost). Overridable per env.
const AUTHOR_MODEL = process.env.SIG_AUTHOR_MODEL || "claude-opus-4-8";
const AUTHOR_MODEL_HARD = process.env.SIG_AUTHOR_MODEL_HARD || "claude-opus-4-8";
export const modelForBand = (band) => (Number(String(band).replace("B", "")) >= 6 ? AUTHOR_MODEL_HARD : AUTHOR_MODEL);

// FEW-SHOT VOICE ANCHORS — real released SAT items (College Board Skills-Insight
// exemplars) anchor the author to the SAT's terse, natural phrasing. Algebra only;
// two scrape-corrupted stems dropped. fewShot(band) returns 2 items from OTHER
// bands, so the same-band authenticity-judge pairing is never leaked to the author.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXEMPLARS = (() => {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, "taxonomy/exemplars.clean.json"), "utf8"));
    const arr = Array.isArray(raw) ? raw : (raw.items || raw.exemplars || Object.values(raw).find(Array.isArray) || []);
    return arr.filter((e) => /alg/i.test(e.domain || "") && e.stem && !/ax\+8|x\+613/.test(e.stem));
  } catch { return []; }
})();
function fewShot(band) {
  const n = Number(String(band).replace("B", ""));
  return EXEMPLARS.filter((e) => e.band !== `B${n}`).map((e) => [e, Math.abs(Number(e.band.slice(1)) - n)]).sort((a, b) => a[1] - b[1]).slice(0, 2).map((x) => x[0]);
}

// System prompt — verbatim from BUILD_SPEC §3 (incl. the exact output contract).
const SYSTEM = `You are an SAT math item writer. Given a SPECIFICATION and a DESIGN RATIONALE (including an
intended solution path), write ONE complete SAT-style problem that realizes that design.

Requirements:
- The problem must match the rationale's structure exactly (same radicals, same intended
  solve path). Do not add or remove solve steps.
- Use the incidentals provided (context, variable name) for surface detail, and CHOOSE YOUR OWN
  specific, realistic numbers that fit the situation. The equation/relationship must ARISE
  naturally from the scenario — never pasted onto a pre-set equation. (An independent checker
  re-derives your answer from the statement, so your numbers and answer must be correct.)
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
export async function authorItem(cell, rationaleText, { model = modelForBand(cell.band), feedback = null } = {}) {
  const fmt = cell.incidentals?.format === "mcq"
    ? `Write this as MULTIPLE CHOICE: include "choices" (exactly 4, "A) ".."D) ") and "correct_choice"; exactly one is correct, the other three are plausible near-misses.`
    : `Write this as FREE-RESPONSE (student-produced): OMIT "choices"; put the single value in "answer". Do not include "correct_choice".`;
  const nums = cell.incidentals?.numbers;
  const numbersDirective = nums?.directive ? `\n${nums.directive}\n` : "";
  // EMPIRICAL stem-length targets — measured from official College Board items
  // (Skills-Insight exemplars + practice test #10): median ≈18 words, ~half < 20,
  // only ~10% > 50 (those are higher-band modeling), hard max ≈ 80.
  const WBAND = ({ 1: "8–16", 2: "10–20", 3: "15–32", 4: "20–40", 5: "20–42", 6: "25–48", 7: "25–55" })[cell.band] || "15–40";
  const shots = fewShot(cell.band);
  const voice = shots.length ? `\nVOICE ANCHORS — these are REAL released SAT Math items. Match their VOICE: terse, plain, at most one short clause of context, the question asked directly. Do NOT reuse their scenarios, numbers, or structure — invent your own.\n${shots.map((e, i) => `  ${i + 1}. ${e.stem}`).join("\n")}\n` : "";
  const user = `SPECIFICATION:
${JSON.stringify(cell, null, 2)}

DESIGN RATIONALE (from the item designer — realize THIS exact design):
${rationaleText}
${numbersDirective}${voice}

FORMAT: ${fmt}

STYLE (SAT items are tight — follow exactly):
- LENGTH: this is a Band ${cell.band} item — target a STEM of ${WBAND} words. (Measured from official SAT Math: median ≈18 words, ~half under 20, only ~10% exceed 50 — and those are higher-band modeling items. Never exceed ~60 words unless the math genuinely requires a modeling setup.)
- Be CONCISE. At MOST one short sentence of context, then the question. No backstory, no scene-setting, no flavor padding (e.g. NOT "A wildlife researcher monitors salmon migration by counting fish as they pass through a river ladder…"). Lower bands (B1–B3) especially terse; an abstract item is just the equation/expression and the ask.
- PHRASE LIKE THE REAL TEST: no redundant clauses (don't restate what is already implied — e.g. if a point off a line is given, do NOT add "which does not lie on the line"); no pile-ups of proper nouns or place-names.
- DEFINE THE VARIABLE CLEANLY — this is the #1 authenticity tell. Introduce it in its own clause ("…, where \\(w\\) is the number of liters filtered") OR keep it out of the question entirely ("How many tickets were sold?" — NEVER "How many tickets \\(h\\) were sold?"). Never drop an undefined letter into the ask, and never jam a variable into a noun phrase ("removes 14 grams per liter \\(w\\)"). For a free-response numeric item the cleanest form often names no variable at all.
- NUMBERS SHOULD FEEL REAL: when a fraction is required prefer common ones (1/2, 2/3, 3/4, 5/2) over arbitrary ratios like 12/5; avoid implausible real-world values (e.g. a 12.5-pound "bag" or "14 grams per liter").
- Write ALL mathematics as LaTeX wrapped in \\( ... \\) — e.g. \\(3x + 5 = 20\\), \\(\\frac{16}{5}\\), \\(y = \\frac{3}{2}x + 7\\), \\(-3n + 1 > -24\\). Use \\frac for fractions, \\le \\ge for ≤ ≥, \\cdot for multiply. Prose stays OUTSIDE the \\(...\\). Put each MCQ choice's math in \\(...\\) too. Do NOT use $ as a math delimiter.
- CURRENCY: write money as ordinary text — $5, $3.50 — NEVER inside \\(...\\) (a dollar sign is money, not math).
- TABLES: if the item shows a table of values, emit it as a clean markdown table with a header-separator row, each row on its OWN line (newline-separated), e.g.  | x | y |\\n| --- | --- |\\n| 0 | 5 |\\n| 1 | -2 |  . Keep cells PLAIN — bare numbers/letters, no \\(...\\), no $. Do not also restate the table values in prose.
- The "answer" field (free-response) must be the PLAIN griddable value (e.g. -29/2 or 4.5), NOT LaTeX.
Use op names in solve_path drawn from this vocabulary where they apply: ${JSON.stringify(cell.opVocab || cell.op_vocab || [])}.${feedback ? `\n\n⚠ REVISION — your previous attempt for THIS exact cell was REJECTED by an independent gate. Reason: ${feedback}\nFix precisely that. Keep the same skill, target band, and format (and any figure or answer fixed in the directive above); you may otherwise choose different numbers. Return the corrected item as JSON.` : ""}`;
  const raw = await llmComplete(user, { system: SYSTEM, model });
  try { return parseJson(raw); } catch { return null; }
}

export default { authorItem, modelForBand };
