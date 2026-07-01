/* ============================================================================
   engine/variants.mjs — VARIANT REALIZER (ENGINE v2, tier 2 of the bank).

   A variant re-realizes a verified FAMILY with fresh surface/numbers and carries
   its own verdicts. Cost profile by generator:
     capstone / figcapstone / figure : $0 — reseed the construct-backward builder,
                                       re-run the family's INDEPENDENT resolver.
     cell (LLM)                      : ~4 calls — fresh scenario draw through the
                                       v1 four-agent path, PROVE-gated.
     chain                           : registered by engine/composer.mjs (E2).
   Every realization returns { item, seed, params, verdicts } — family.mjs refuses
   to persist a variant without verdicts, so there is no unverified path.
   ============================================================================ */
import { drawCross, CROSS_TYPES } from "../build/compose.mjs";
import { resolveCapstone } from "../build/_composecheck.mjs";
import { drawAdvFig, FIG_TYPES } from "../build/advfig.mjs";
import { resolveAdvFig } from "../build/_advfigcheck.mjs";
import { drawGraphItem, GRAPH_TASKS } from "../build/graph.mjs";
import { drawSolidFig, SOLID_TASKS } from "../build/solidfig.mjs";
import { drawCircleFig, CIRCLE_TASKS } from "../build/circlefig.mjs";
import { drawCompositeFig, COMPOSITE_TASKS } from "../build/compositefig.mjs";
import { figureCheck } from "../verify/figurecheck.mjs";
import { legibilityCheck } from "../verify/legibility.mjs";
import { drawCell } from "../build/cell.mjs";
import { rationale } from "../build/rationale.mjs";
import { authorItem } from "../build/author2.mjs";
import { verifyAndGate } from "../build/selector.mjs";
import { mathSeg } from "../build/pipeline.mjs";
import { rng } from "./types.mjs";

/* ---- tier-C "numbers" object → render-schema item ---- */
function solutionSegs(sp) {
  if (!Array.isArray(sp) || !sp.length) return [{ t: "text", v: "See answer." }];
  return sp.flatMap((s, i) => [{ t: "text", v: `${s.step ?? i + 1}. ${s.op ? s.op.replace(/_/g, " ") + ": " : ""}` }, ...mathSeg(s.detail || ""), { t: "br" }]);
}
function tierCItem(num, { domain, band, statementId, skill }) {
  const isMcq = !!num.choices || !!num.optionFigures;
  const options = num.optionFigures
    ? num.optionFigures.map((spec, i) => ({ key: "ABCD"[i], fig: { fn: "coordPlane", spec } }))
    : (isMcq ? num.choices.map((c, i) => ({ key: "ABCD"[i], seg: mathSeg(String(c).replace(/^[A-D][).]\s*/, "")) })) : undefined);
  return {
    program: "SAT", domain, band, target_band: band, statementId, skill,
    type: isMcq ? "mcq" : "spr",
    stem: mathSeg(num.statement), options,
    answer: isMcq ? { correct: num.correct_choice } : { accept: [String(num.answer?.answer ?? num.answer)], tol: 0 },
    solution: solutionSegs(num.solve_path),
    figure: num.optionFigures ? null : (num.figure || null),
    fingerprint: num.fingerprint || [],
  };
}

const FIGURE_DRAW = [
  [GRAPH_TASKS, drawGraphItem],
  [SOLID_TASKS, drawSolidFig],
  [CIRCLE_TASKS, drawCircleFig],
  [COMPOSITE_TASKS, drawCompositeFig],
];
const figureDrawFor = (task) => { for (const [tasks, fn] of FIGURE_DRAW) if (tasks.includes(task)) return fn; return null; };

/* ---- generator registry: realize(family, seedString) → {item, params, verdicts} ---- */
const GENERATORS = {
  /** spec: { crossType: "C1".."C7" } — algebra B7 capstones (compose.mjs). */
  capstone(family, seed) {
    const it = drawCross(family.spec.crossType, rng(seed));
    const v = resolveCapstone(it._p);
    const ok = v.ok && Math.round(v.ans) === Number(it.answer.accept[0]) && v.essential2step;
    return { item: it, params: it._p, verdicts: { resolver: { ok, essentialChain: v.essential2step }, answerPin: ok } };
  },
  /** spec: { figType: "G1".."G5" } — advanced B7 figure capstones (advfig.mjs). */
  figcapstone(family, seed) {
    const it = drawAdvFig(family.spec.figType, rng(seed));
    const v = resolveAdvFig(it._p);
    const leg = legibilityCheck({ incidentals: { numbers: { figure: it.figure, task: "read_feature", answer: it.answer.accept[0], fingerprint: [] } } });
    const ok = v.ok && Math.round(v.ans) === Number(it.answer.accept[0]) && v.essential && leg.keep;
    return { item: it, params: it._p, verdicts: { resolver: { ok, essentialChain: v.essential, legible: leg.keep }, answerPin: ok } };
  },
  /** spec: { task, subdomain, domain, band } — tier-C figure builders (graph/solid/circle/composite). */
  figure(family, seed) {
    const { task, band } = family.spec;
    const draw = figureDrawFor(task);
    if (!draw) throw new Error(`figure generator: no builder for task '${task}'`);
    const bandNum = Number(String(band).replace("B", ""));
    const num = draw(task, bandNum, rng(seed));
    const cell = { incidentals: { numbers: num } };
    const fc = figureCheck(cell), leg = legibilityCheck(cell);
    const ok = fc.keep && leg.keep;
    const item = tierCItem(num, { domain: family.domain, band: family.difficulty?.band || band, statementId: family.statementId, skill: family.spec.subdomain });
    return { item, params: { figureSpec: num.figure?.spec ?? null, composite: num.composite ?? null }, verdicts: { resolver: { ok, figureCheck: fc.keep, legible: leg.keep }, answerPin: true } };
  },
  /** spec: { domain, subdomain, band, taskPin? } — LLM cell families: fresh scenario
   *  through the v1 four-agent path (draw → rationale → author → verifyAndGate incl.
   *  PROVE + plausibility). ~4 LLM calls per variant. */
  async cell(family, seed, { idx = 0 } = {}) {
    const { domain, subdomain, band } = family.spec;
    const bandNum = Number(String(band).replace("B", ""));
    let cellObj = null;
    for (let t = 0; t < 12; t++) {                       // redraw until the pinned task comes up
      const c = drawCell(domain, subdomain, bandNum, idx * 12 + t + hashInt(seed));
      if (!family.spec.taskPin || c.radicals.task === family.spec.taskPin) { cellObj = c; break; }
    }
    if (!cellObj) throw new Error(`cell generator: task '${family.spec.taskPin}' not drawn in 12 tries`);
    const rat = await rationale(cellObj);
    const cand = await authorItem(cellObj, rat);
    if (!cand || !cand.statement) return { item: null, verdicts: { resolver: null, prove: { keep: false }, answerPin: false } };
    const gate = await verifyAndGate(cand, cellObj);
    const item = gate.keep ? {
      program: "SAT", domain, band: family.difficulty?.band || band, target_band: band,
      statementId: family.statementId, skill: subdomain, type: cand.choices ? "mcq" : "spr",
      stem: mathSeg(cand.statement),
      options: cand.choices ? cand.choices.map((c, i) => ({ key: "ABCD"[i], seg: mathSeg(String(c).replace(/^[A-D][).]\s*/, "")) })) : undefined,
      answer: cand.choices ? { correct: cand.correct_choice } : { accept: [String(cand.answer)], tol: 0 },
      solution: solutionSegs(cand.solve_path), figure: null, fingerprint: gate.fingerprint || [],
    } : null;
    return { item, params: { radicals: cellObj.radicals }, verdicts: { prove: { keep: gate.keep }, answerPin: gate.keep, stage: gate.stage } };
  },
};

function hashInt(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 1000; }

/** registerGenerator(name, fn) — used by engine/composer.mjs to add "chain". */
export function registerGenerator(name, fn) { GENERATORS[name] = fn; }

/** realizeVariant(family, n) → { item, seed, params, verdicts, realization } | null.
 *  Deterministic seed per (family, n); verdicts always attached. */
export async function realizeVariant(family, n, opts = {}) {
  const gen = GENERATORS[family.generator];
  if (!gen) throw new Error(`no generator '${family.generator}'`);
  const seed = `${family.familyId}|v${n}`;
  const out = await gen(family, seed, { idx: n, ...opts });
  if (!out || !out.item) return null;
  return { familyId: family.familyId, seed, ...out, realization: { mode: family.generator === "cell" ? "llm" : "reseed", n } };
}

/** mintVariants(family, count) → persisted variant records. Retries with salted
 *  seeds when a draw collides with already-banked content (small param spaces DO
 *  collide — the content-dedup catches it; this loop turns the reject into a redraw). */
export async function mintVariants(family, count, { maxSalt = 8, addVariant } = {}) {
  const add = addVariant ?? (await import("./family.mjs")).addVariant;
  const out = [];
  for (let n = 1; n <= count; n++) {
    let persisted = null;
    for (let salt = 0; salt <= maxSalt && !persisted; salt++) {
      const seed = `${family.familyId}|v${n}${salt ? `r${salt}` : ""}`;
      const gen = GENERATORS[family.generator];
      const o = await gen(family, seed, { idx: n * (salt + 1) });
      if (!o || !o.item) continue;
      const rec = { familyId: family.familyId, seed, item: o.item, params: o.params, verdicts: o.verdicts, answer: o.item.answer, realization: { mode: family.generator === "cell" ? "llm" : "reseed", n, salt } };
      const res = add(rec);
      if (res.added) persisted = { ...rec, variantId: res.variantId };
    }
    if (persisted) out.push(persisted); else console.log(`  mintVariants: family ${family.familyId} v${n} exhausted ${maxSalt} salts (space saturated?)`);
  }
  return out;
}

export { CROSS_TYPES, FIG_TYPES, tierCItem };
export default { realizeVariant, registerGenerator, mintVariants };
