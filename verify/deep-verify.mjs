/* ============================================================================
   deep-verify.mjs — the BLINDED second derivation. A separately-prompted model
   solves the item from scratch (it never sees the author's claimed answer or
   worked solution) and returns a structured verdict. This is the independent
   check on the params themselves: it catches "the params say X but the stem
   actually asks Y", multi-correct MCQs, non-unique SPRs, and figure/stem
   contradictions that the numeric recompute leash cannot see.
   ============================================================================ */
import { llmComplete, parseJson } from "../build/llm.mjs";

const SYSTEM = "You are a scrupulous SAT Math answer-checker. You solve from scratch and never trust any provided answer. You return ONLY one JSON object.";

const segText = (arr) => (Array.isArray(arr) ? arr : [arr]).map((s) => (typeof s === "string" ? s : s?.segs ? segText(s.segs) : `${s?.v ?? ""}`)).join(" ");

export function buildVerifyPrompt(item) {
  const stem = segText(item.stem);
  const opts = item.type === "mcq"
    ? "OPTIONS:\n" + (item.options || []).map((o) => `  (${o.key}) ${segText(o.seg)}`).join("\n")
    : "This is a student-produced response (a single griddable value).";
  const fig = item.figure ? `\nFIGURE: ${item.figure.fn} with spec ${JSON.stringify(item.figure.spec)}` : "";
  return `Solve this Digital SAT Math problem FROM SCRATCH. Do not assume any answer is correct.

STEM: ${stem}
${opts}${fig}

Then return ONLY this JSON:
{
  "independentAnswer": "<your worked answer: the option letter for MCQ, or the value for SPR>",
  "mcqExactlyOne": <true if exactly one option is correct; null if not MCQ>,
  "sprUnique": <true if the answer is a single unambiguous griddable value; null if not SPR>,
  "figureConsistent": <true if the figure's data is consistent with the stem and answer; null if no figure>,
  "ambiguous": <true if the wording admits more than one defensible answer>,
  "verdict": "PASS" | "FAIL"
}
Rules: verdict is "PASS" only if you found a single correct answer, the type-specific check holds, the figure (if any) is consistent, and the wording is unambiguous.`;
}

/** deepVerify(item) -> verdict object. claimedAnswer is compared by the caller. */
export async function deepVerify(item) {
  const raw = await llmComplete(buildVerifyPrompt(item), { system: SYSTEM });
  return parseJson(raw);
}

export default { deepVerify, buildVerifyPrompt };
