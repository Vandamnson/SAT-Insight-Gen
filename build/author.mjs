/* ============================================================================
   author.mjs — build the author prompt for ONE band-targeted item and call the
   LLM. The author emits a stem + structured params (GIVENS only) + an optional
   figure spec + the claimed answer + a worked solution. It is told to self-check
   but is NEVER trusted: the recompute leash and the blinded verifier re-derive
   the answer independently.
   ============================================================================ */
import { llmComplete, parseJson } from "./llm.mjs";

const SYSTEM = "You are a meticulous Digital SAT Math item writer. You return ONLY one JSON object — no markdown fences, no commentary before or after.";

const SEGMENTS = `A "segment array" mixes prose and math: {"t":"text","v":"words"}, {"t":"math","v":"LaTeX, NO $ delimiters"}, {"t":"mathblock","v":"display LaTeX"}. Use "money" {"t":"money","v":"$3.50"} for currency (never put $ inside math). Include the surrounding spaces in TEXT segments around inline math, e.g. {"t":"text","v":"the value of "}, {"t":"math","v":"y"}, {"t":"text","v":" in the solution"} — so words never collide with the math.`;

const FIGURE_GUIDE = `If a figure is requested, set "figure":{ "fn":..., "spec":..., "caption":"..." }; otherwise "figure": null. Pick the fn that fits the item:
- "coordPlane": { "xRange":[lo,hi], "yRange":[lo,hi], "xStep":n, "yStep":n, "origin":true, "curves":[{"type":"line2pt","p1":[x,y],"p2":[x,y]}] | [{"m":num,"b":num}] | [{"type":"quadratic","a":n,"b":n,"c":n}], "points":[{"at":[x,y],"label":"(x, y)"}] }. EVERY plotted point MUST lie exactly on a drawn curve.
- "table": { "kind":"value"|"frequency"|"twoway", "headers":["x","y"], "rows":[["1","4"],...] }. Use for data / two-way / frequency tables.
- "scatter": { "xRange":[lo,hi], "yRange":[lo,hi], "xStep":n, "yStep":n, "axisLabels":["x name","y name"], "data":[[x,y],...8-10 pts], "marker":"open", "fit":{"m":num,"b":num} }. Points scatter AROUND the fit line.
- "barChart": { "categories":["A","B",...], "values":[n,...], "yMax":n, "xLabel":"...", "yLabel":"..." }.
- "dotPlot": { "axisRange":[lo,hi], "step":n, "series":[{"label":"...","counts":{"value":count,...}}] }.
- "triangle": { "vertices":[[x,y],[x,y],[x,y]] (coords in 0..100), "labels":["A","B","C"], "right":"B" (optional, the right-angle vertex), "sideLabels":{"AB":"15","BC":"20"} }.
- "circle": { "R":num, "center":"O", "pointsOnCircle":[{"angleDeg":n,"label":"P"}], "radii":[angleDeg,...], "chords":[[angleDeg,angleDeg]] }.
A figure must be LOAD-BEARING: at least one quantity needed to solve appears ONLY in the figure, not restated in the stem.`;

// OPEN-LANE prompt: no params contract, no per-cell structure — just the rubric
// statement + "be a real hard SAT item." Gated by deep-verify only. Used to test
// (vs the grid) whether the grid's specificity caps variety/richness.
function buildOpenPrompt(t) {
  const levers = (t.bandLevers || []).map((l) => `  - ${l}`).join("\n");
  return `Write ONE original Digital SAT Math problem for this skill.

DOMAIN: ${t.domain}${t.subdomain ? `  ·  SUBDOMAIN: ${t.subdomain}` : ""}
SKILL (Skills-Insight statement): "${t.statementText}"
QUESTION TYPE: ${t.type === "mcq" ? "multiple choice (exactly 4 options, exactly ONE correct)" : "student-produced response (a single griddable answer)"}
TARGET DIFFICULTY = Band ${t.band.slice(1)} (${t.scaleRange}). Calibrate to THIS band — neither trivial nor harder than it — using:
${levers}

You have FULL FREEDOM over the problem's structure: there is NO fixed template or params contract. Make it authentic and NON-CANONICAL — vary the framing, the setup, and what is given vs. asked; prefer a fresh structure over the textbook-standard version of this skill. Stay at the target band (do not overshoot). Realistic numbers are fine; the answer must be exact and unambiguous.

${SEGMENTS}

Return ONLY this JSON object:
{
  "stem": [segments],
  "type": "${t.type}",
  ${t.type === "mcq" ? `"options": [ {"key":"A","seg":[segments]}, {"key":"B","seg":[segments]}, {"key":"C","seg":[segments]}, {"key":"D","seg":[segments]} ],
  "answer": {"correct":"<A|B|C|D>"},` : `"answer": {"accept":["<the answer>"], "tol":0},`}
  "solution": [segments, the worked steps],
  "figure": null,
  "spec": { "solve_steps": <int>, "inversion": "standard|inverted|constraint", "scaffolding_removed": <bool>, "trap_distractor": <bool>, "number_messiness": <bool> }
}

HARD RULES:
- Exactly one unambiguous correct answer; an independent solver will re-derive it.
- ${t.type === "mcq" ? "Exactly one option is correct; the other three are plausible near-misses." : "A single griddable value."}
- No figure for this experiment ("figure": null).`;
}

export function buildAuthorPrompt(t, feedback) {
  if (t.open) return buildOpenPrompt(t);
  const levers = (t.bandLevers || []).map((l) => `  - ${l}`).join("\n");
  const variation = [
    t.structure ? `STRUCTURE — build THIS specific variant of the skill (NOT its textbook-default phrasing): ${t.structure}` : "",
    t.context ? `CONTEXT — set the scenario around: ${t.context}. Make it concrete and specific; do not reword a generic template.` : "",
  ].filter(Boolean).join("\n");
  const figLine = t.figureReq === "none"
    ? `Do NOT include a figure ("figure": null).`
    : `${t.figureReq === "req" ? "This item REQUIRES" : "This item MAY use"} a figure.\n${FIGURE_GUIDE}`;
  return `Write ONE original Digital SAT Math problem.

DOMAIN: ${t.domain}
SKILL (Skills-Insight statement, Band ${t.band.slice(1)}, scale ${t.scaleRange}): "${t.statementText}"
TEMPLATE: ${t.skill} — ${t.hint}
QUESTION TYPE: ${t.type === "mcq" ? "multiple choice (exactly 4 options, exactly ONE correct)" : "student-produced response (a single griddable answer)"}

TARGET DIFFICULTY = Band ${t.band.slice(1)} (${t.scaleRange}). Make it sit in this band by applying these levers:
${levers}
${variation ? `\n${variation}\n` : ""}
STRUCTURED PARAMS — emit "params" matching EXACTLY this contract, carrying ONLY the GIVENS (never the asked value), so an external grader can recompute the answer:
  ${t.paramsContract}

${SEGMENTS}

${figLine}

${feedback ? `\n⚠ REVISION — your previous attempt for this cell measured the WRONG difficulty band. The single most effective fix, per an examiner panel: ${feedback}\nApply exactly that change, then regenerate the item (still hitting the skill above).\n` : ""}
Return ONLY this JSON object:
{
  "stem": [segments],
  "type": "${t.type}",
  ${t.type === "mcq" ? `"options": [ {"key":"A","seg":[segments]}, {"key":"B","seg":[segments]}, {"key":"C","seg":[segments]}, {"key":"D","seg":[segments]} ],
  "answer": {"correct":"<A|B|C|D>"},` : `"answer": {"accept":["<the answer>"], "tol":0},`}
  "params": { ... the contract above ... },
  "solution": [segments, the worked steps],
  "figure": ${t.figureReq === "none" ? "null" : "{...} or null"},
  "spec": { "solve_steps": <int>, "inversion": "standard|inverted|constraint", "scaffolding_removed": <bool>, "trap_distractor": <bool>, "number_messiness": <bool> }
}

HARD RULES:
- Use clean numbers; intermediate work should be doable by hand in ~1–2 minutes.
- ${t.type === "mcq" ? "EXACTLY one option is correct; the other three are plausible near-misses. Put the actual answer VALUE as the correct option's text." : "The answer must be a single unambiguous griddable value."}
- The answer VALUE must be recomputable from "params" alone via the contract.
- If the contract has a "report" (or similar selector) field, set it to EXACTLY the quantity your question asks the student to find: "slope" when you ask for a rate of change, "intercept" when you ask for a starting/initial value, "value" when you ask for an output. The grader recomputes precisely that quantity — a "report" that doesn't match what you asked will fail verification.
- VARIETY: realize the STRUCTURE/CONTEXT directive above exactly. Do NOT emit the most generic, oft-seen instance of this skill — an item that merely renumbers a standard template is a reskin and will be rejected.
- "spec" should honestly describe the structure you built (used to verify the target band).`;
}

/** author(target, feedback?) -> parsed draft item (throws on transport/parse failure).
 *  feedback = a one-line retarget instruction from the judge (critique→revise loop). */
export async function author(target, feedback) {
  const raw = await llmComplete(buildAuthorPrompt(target, feedback), { system: SYSTEM });
  return parseJson(raw);
}

export default { author, buildAuthorPrompt };
