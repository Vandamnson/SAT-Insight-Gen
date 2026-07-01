/* ============================================================================
   engine/authenticity.mjs — the DISTRIBUTION floor's scorer: rates ONE item 1–10
   for how authentically it reads as an officially released College Board item.
   Programmatic refactor of build/_absjudge.mjs `rate()` — same prompt, same
   normalization, same anti-recognition discipline (absolute, never matched-pairs;
   a DEFECT DETECTOR / floor, never a score to chase). Official mean ≈ 8.0.
   ============================================================================ */
import { llmComplete, parseJson } from "../build/llm.mjs";

export const texToPlain = (s) => String(s ?? "")
  .replace(/\\\(|\\\)/g, "")
  .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
  .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
  .replace(/\\le(?![a-z])/g, "≤").replace(/\\ge(?![a-z])/g, "≥").replace(/\\neq/g, "≠")
  .replace(/\\ell\b/g, "ℓ").replace(/\\pi\b/g, "π").replace(/\\circ\b/g, "°").replace(/\\%/g, "%")
  .replace(/\\begin\{[a-z]*\}(\{[^}]*\})?/g, " ").replace(/\\end\{[a-z]*\}/g, " ").replace(/\\\\/g, ";  ")
  .replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();   // KEEP $ (currency)

export function itemToPlain(item) {
  const stem = texToPlain((item.stem || []).map((s) => (s.segs ? s.segs.map((g) => g.v).join("") : s.v || "")).join(" "));
  if (item.options?.length && item.options[0].seg) {
    return `${stem}\nAnswer choices: ${item.options.map((o) => texToPlain(o.seg.map((s) => s.v).join(""))).join("  ;  ")}`;
  }
  return stem;
}

const SYS = "You are a veteran Digital SAT Math content expert who has reviewed thousands of officially released College Board items.";
const PROMPT = (text) => `Below is a single Digital SAT Math item. Rate how authentically it reads as an OFFICIALLY RELEASED College Board item — judging by wording, phrasing, scenario realism, and economy. Do NOT judge difficulty, and IGNORE formatting (such as how answer choices are displayed).

ITEM:
${text}

Respond with ONLY this JSON: {"score": 1-10 (10 = indistinguishable from a genuine released item), "why": "one sentence on the main reason"}`;

/** authenticityScore(itemOrText) → { score, why }. Accepts a render-schema item or plain text. */
export async function authenticityScore(itemOrText) {
  const text = typeof itemOrText === "string" ? itemOrText : itemToPlain(itemOrText);
  const v = parseJson(await llmComplete(PROMPT(text), { system: SYS }));
  return { score: Number(v.score), why: v.why };
}

export default { authenticityScore, itemToPlain, texToPlain };
