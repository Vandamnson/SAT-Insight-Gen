/* ============================================================================
   engine/composer.mjs — chain assembly + draw + banding (path-composition engine).

   drawChain(chainSpec, r): topologically run each step's make() with quantities
   bound from UPSTREAM MAKE outputs; then verify the whole draw INSIDE the loop
   via engine/verify/resolve.mjs (independent resolvers + essentialChain) — a draw
   that fails independent verification is redrawn, never returned.

   enumerateChains(): DFS from openers along the curated edge allowlist
   (engine/edges.mjs) — the composer NEVER admits on raw type-match alone.
   ============================================================================ */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { step, openers, closers } from "./registry.mjs";
import { EDGES, admissible } from "./edges.mjs";
import { resolveChain } from "./verify/resolve.mjs";
import { applyCoerce } from "./types.mjs";
import { scoreToBand } from "../difficulty/lltm.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEIGHTS = existsSync(join(HERE, "weights.json"))
  ? JSON.parse(readFileSync(join(HERE, "weights.json"), "utf8"))
  : { w0_chain: 350, wLen: 40, wFig: 25 };                 // provisional until weights-fit

const parseRef = (ref) => { const m = /^s(\d+)\.(\w+)$/.exec(ref); return [Number(m[1]), m[2]]; };

/** chainSignature(spec) — the family-level structural identity. */
export const chainSignature = (spec) =>
  spec.steps.join(">") + "[" + spec.bindings.map((b) => `${b.from}→${b.to}${b.coerce ? `~${b.coerce}` : ""}`).join(",") + "]";

/** chainScale(spec) → LLTM scale point (additive path complexity). */
export function chainScale(spec) {
  const stepSum = spec.steps.map((id) => step(id).spec.weight).reduce((a, b) => a + b, 0);
  const hasFig = spec.steps.some((id) => step(id).spec.figure === true);
  return Math.round(WEIGHTS.w0_chain + stepSum + WEIGHTS.wLen * (spec.steps.length - 1) + (hasFig ? WEIGHTS.wFig : 0));
}

/** drawChain(chainSpec, r) → verified item (drawCross-shaped) | throws after maxTries. */
export function drawChain(chainSpec, r, { maxTries = 400 } = {}) {
  const ids = chainSpec.steps;
  outer: for (let t = 0; t < maxTries; t++) {
    // 1. topological make with bindings from MAKE outputs
    const made = [];
    for (let i = 0; i < ids.length; i++) {
      const inputs = {};
      for (const b of chainSpec.bindings) {
        const [fi, fn] = parseRef(b.from), [ti, tn] = parseRef(b.to);
        if (ti !== i) continue;
        let q = made[fi]?.outputs?.[fn];
        if (!q) continue outer;
        if (b.coerce) q = applyCoerce(b.coerce, q);
        inputs[tn] = q;
      }
      const m = step(ids[i]).make(inputs, r);
      if (!m) continue outer;
      made.push(m);
    }
    // 2. the terminal make answer (single scalar)
    const lastOuts = made[made.length - 1].outputs;
    const outName = Object.keys(lastOuts)[0];
    const makeAns = lastOuts[outName].value;
    if (typeof makeAns !== "number") continue outer;
    // 3. INDEPENDENT verification inside the draw loop
    const chain = { steps: ids.map((id, i) => ({ id, params: made[i].params })), bindings: chainSpec.bindings };
    const v = resolveChain(chain);
    if (!v.ok || !v.essentialChain || Math.abs(v.answer - makeAns) > 1e-9) continue outer;
    // 4. assemble (drawCross envelope)
    const scale = chainScale(chainSpec);
    const domain = chainSpec.domain || "algebra";
    const sig = chainSignature(chainSpec);
    return {
      program: "SAT", domain, band: scoreToBand(scale, domain), target_band: scoreToBand(scale, domain),
      statementId: chainSpec.statementId || null, type: "spr", tier: "cross-skill",
      chain: sig, skill: step(ids[0]).spec.subdomain,
      stem: made.flatMap((m) => m.stemSegs),
      answer: { accept: [String(Math.round(makeAns))], tol: 0 },
      solution: made.flatMap((m) => m.solutionSegs),
      difficulty: { scalePoint: scale, band: scoreToBand(scale, domain), method: "lltm_chain_v1" },
      verify: { tier: "cross-skill", correctness: "construct-backward + chain-resolver" },
      fingerprint: ["cross_skill", sig, ...ids.flatMap((id) => step(id).spec.ops)],
      _p: { steps: chain.steps, bindings: chainSpec.bindings },
    };
  }
  throw new Error(`drawChain: ${chainSignature(chainSpec)} exhausted ${maxTries} tries`);
}

/** enumerateChains({len}) → admitted ChainSpec[] (opener→closer along curated edges).
 *  Cross-SKILL rule: the two steps must differ in subdomain OR primary op — C4's
 *  two skills (find-intercept, translate) legitimately share one subdomain. */
export function enumerateChains({ maxLen = 2 } = {}) {
  const out = [];
  for (const o of openers()) {
    for (const c of closers()) {
      if (o.spec.id === c.spec.id) continue;
      if (o.spec.subdomain === c.spec.subdomain && o.spec.ops[0] === c.spec.ops[0]) continue;
      // every closer input must be servable by ONE opener output through an admitted edge
      const bindings = [];
      let okAll = true;
      const inputNames = Object.keys(c.spec.inputs);
      if (!inputNames.length) { okAll = false; }
      for (const inName of inputNames) {
        let bound = null;
        for (const outName of Object.keys(o.spec.outputs)) {
          const adm = admissible(`${o.spec.id}.${outName}`, `${c.spec.id}.${inName}`);
          if (adm.ok) { bound = { from: `s0.${outName}`, to: `s1.${inName}`, coerce: adm.coerce }; break; }
        }
        if (!bound) { okAll = false; break; }
        bindings.push(bound);
      }
      if (!okAll) continue;
      // load-bearing shape: opener's every output consumed; closer yields single scalar
      const consumed = new Set(bindings.map((b) => parseRef(b.from)[1]));
      if (Object.keys(o.spec.outputs).some((n) => !consumed.has(n))) continue;
      if (Object.keys(c.spec.outputs).length !== 1) continue;
      out.push({ steps: [o.spec.id, c.spec.id], bindings, domain: "algebra" });
    }
  }
  return out;
}

/* register the "chain" generator with the variant realizer: a chain family's spec
   is { chainSpec }; a variant = one verified draw (drawChain verifies internally —
   resolver + essentialChain — and throws on exhaust, which we surface as null). */
import { registerGenerator } from "./variants.mjs";
import { rng as engineRng } from "./types.mjs";
registerGenerator("chain", (family, seed) => {
  try {
    const it = drawChain(family.spec.chainSpec, engineRng(seed));
    return { item: it, params: it._p, verdicts: { resolver: { ok: true, essentialChain: true }, answerPin: true } };
  } catch { return null; }
});

export default { chainSignature, chainScale, drawChain, enumerateChains };
