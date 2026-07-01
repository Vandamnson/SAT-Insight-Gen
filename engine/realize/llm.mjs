/* ============================================================================
   engine/realize/llm.mjs — LLM REALIZATION of a composed chain (the designated
   fix for the distribution-floor finding: template chains score 3–6 authenticity
   because the "For that value of k…" scaffolding reads as a manufactured
   composite; the judge wants ONE economical, single-focus item).

   THE COMPOSE DISCIPLINE, KEPT: the harness owns structure AND numbers — the
   LLM owns only wording (and scenario when requested). Verification is tripled:
     1. the chain resolver already verified the structure INSIDE drawChain;
     2. ANSWER PIN — the authored item must claim exactly the pinned answer;
     3. PROVE — sympy re-derives the answer from the authored text alone
        (proves the rephrasing preserved the math and is solvable as posed).
   ============================================================================ */
import { authorItem } from "../../build/author2.mjs";
import { proveCheck } from "../../verify/prove.mjs";
import { mathSeg } from "../../build/pipeline.mjs";

function solutionSegs(sp) {
  if (!Array.isArray(sp) || !sp.length) return null;
  return sp.flatMap((s, i) => [{ t: "text", v: `${s.step ?? i + 1}. ${s.op ? s.op.replace(/_/g, " ") + ": " : ""}` }, ...mathSeg(s.detail || ""), { t: "br" }]);
}

/** chainDirective(item, {context}) — the pinned-numbers realization contract. */
export function chainDirective(item, { context = "none" } = {}) {
  const parts = (item._prose || []).map((p, i) => `- Given (part ${i + 1}): ${p}`).join("\n");
  const inters = (item._intermediates || []).map((x) => `${x.name} = ${JSON.stringify(x.value)}`).join(", ");
  const ctxLine = context === "none"
    ? "- Pose it ABSTRACTLY (equations only, no real-world story) — most released items of this kind are abstract."
    : `- Ground it in ONE believable situation about: ${context}. The math must arise from the situation.`;
  return `STRUCTURE AND NUMBERS ARE FIXED — realize them EXACTLY as ONE coherent SAT item; you choose ONLY the wording${context === "none" ? "" : " and the scenario"}.
${parts}
- Ask for EXACTLY one quantity; the single correct answer is ${item.answer.accept[0]}. Do not change any number.
- Do NOT state, reveal, or separately ask for the intermediate quantity (${inters}) — the item must force the solver to derive it.
- PHRASE LIKE A RELEASED COLLEGE BOARD ITEM: economical, single focus, one fluent ask. Do NOT use scaffolding phrases like "For that value of ..." or "Using your answer from ..." — fuse the parts so the dependency is implicit in the mathematics, not narrated.
${ctxLine}`;
}

/** realizeChainLLM(item, {domain, context, maxRepairs}) →
 *  { item: renderItem, statement, verdicts {answerPin, prove}, attempts } | null */
export async function realizeChainLLM(item, { domain = "algebra", context = "none", maxRepairs = 1 } = {}) {
  const pinned = String(item.answer.accept[0]);
  const cell = {
    domain, subdomain: item.skill, band: 7, target: "cross-skill composed item",
    radicals: { task: "cross_skill_chain" },
    incidentals: { format: "spr", context, numbers: { answer: pinned, directive: chainDirective(item, { context }) } },
    op_vocab: item.fingerprint.slice(2),
  };
  const rationaleText = `Realize the FIXED two-part structure below as one economical, officially-voiced item. The intended solution path: first derive the intermediate from part 1, then use it in part 2. Do not add or remove solve steps.`;
  let feedback = null, attempts = 0;
  for (let a = 0; a <= maxRepairs; a++) {
    attempts++;
    const cand = await authorItem(cell, rationaleText, { feedback });
    if (!cand || !cand.statement) { feedback = "Return ONLY one valid JSON object with a \"statement\"."; continue; }
    // 2. answer pin
    const plain = String(cand.answer ?? "").replace(/\\\(|\\\)/g, "").trim();
    if (plain !== pinned && Number(plain) !== Number(pinned)) { feedback = `Your item's answer must be exactly ${pinned} — keep every given number unchanged and ask for the pinned quantity.`; continue; }
    // 3. PROVE from the authored text alone
    const pv = await proveCheck(cand, { domain });
    if (!pv.keep) { feedback = `An independent solver could NOT derive ${pinned} from your statement alone (${(pv.error || "verification failed").slice(0, 90)}). Make every given explicit and unambiguous; change no numbers.`; continue; }
    return {
      statement: cand.statement,
      item: {
        program: "SAT", domain, band: item.band, target_band: item.target_band,
        statementId: item.statementId, skill: item.skill, type: "spr", tier: "cross-skill",
        chain: item.chain, stem: mathSeg(cand.statement),
        answer: { accept: [pinned], tol: 0 },
        solution: solutionSegs(cand.solve_path) || item.solution,
        difficulty: item.difficulty, verify: { tier: "cross-skill", correctness: "construct-backward + chain-resolver + prove" },
        fingerprint: item.fingerprint, _p: item._p,
      },
      verdicts: { resolver: { ok: true, essentialChain: true }, answerPin: true, prove: { keep: true } },
      attempts,
    };
  }
  return null;
}

export default { realizeChainLLM, chainDirective };
