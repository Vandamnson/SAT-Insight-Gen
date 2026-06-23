/* ============================================================================
   rationale.mjs — AGENT 1 (BUILD_SPEC §2). PromptCoT's key move: before writing
   the problem, write the DESIGN RATIONALE. Forcing the structural reasoning first
   is what pushes the author OFF the canonical instance — the direct fix for the
   "reskins" problem. Cheap model, plain text out, passed verbatim into Agent 2.
   ============================================================================ */
import { llmComplete } from "./llm.mjs";
import { promptPack } from "./prompts.mjs";

const RATIONALE_MODEL = process.env.SIG_RATIONALE_MODEL || "claude-opus-4-8";

// System prompt — verbatim from BUILD_SPEC §2.
const SYSTEM = `You are an expert SAT math item designer. Given a problem SPECIFICATION (the skill to
test, the difficulty band, and structural requirements called "radicals"), write a concise
DESIGN RATIONALE explaining how an expert would construct a problem meeting that spec.

The rationale must:
- name the specific structural features that make the problem land at the target band
  (these are the "radicals" — e.g. number of solve steps, variables on both sides);
- describe the intended solution path step by step (this becomes the answer key);
- NOT write the problem itself yet — only the design reasoning.

Do not invent difficulty the spec did not request. Do not add steps beyond the radicals.
Output 4–8 sentences of plain reasoning, then a numbered intended solution path.`;

/** rationale(cell) -> design-rationale text (Agent 1's output, fed verbatim to Agent 2). */
export async function rationale(cell, { model = RATIONALE_MODEL } = {}) {
  const system = SYSTEM + (promptPack(cell.domain).rationaleExtra || "");   // domain-focused method framing
  const user = JSON.stringify(cell, null, 2);
  const raw = await llmComplete(user, { system, model });
  return String(raw).trim();
}

export default { rationale };
