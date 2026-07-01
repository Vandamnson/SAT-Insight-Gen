/* ============================================================================
   engine/verify/resolve.mjs — the CHAIN RESOLVER: composition of per-step
   INDEPENDENT resolvers (the _composecheck discipline generalized).

   resolveChain runs each step's resolve() on frozen params + quantities bound
   from PREVIOUS RESOLVERS' outputs (never make's) — end-to-end independence.

   essentialChain = every step's local `essential`
                  ∧ CONSUMPTION SENSITIVITY (perturb each bound value → the final
                    answer must change — the mechanical no-shortcut proof)
                  ∧ LEAK CHECK (the answer must not equal a raw intermediate,
                    else step A alone could accidentally yield it).
   ============================================================================ */
import { step } from "../registry.mjs";
import { applyCoerce } from "../types.mjs";

const freeze = (o) => JSON.parse(JSON.stringify(o));

/** run the resolver pipeline; `perturb` optionally mutates the value bound by
 *  bindings[perturb.bindingIndex] before it feeds downstream. */
function runResolvers(chain, { perturb = null } = {}) {
  const { steps, bindings } = chain;
  const resolved = [];                                     // per-step resolver outputs
  for (let i = 0; i < steps.length; i++) {
    const mod = step(steps[i].id);
    const inputs = {};
    for (let bi = 0; bi < bindings.length; bi++) {
      const b = bindings[bi];
      const [fromIdx, fromName] = parseRef(b.from);
      const [toIdx, toName] = parseRef(b.to);
      if (toIdx !== i) continue;
      let q = resolved[fromIdx]?.outputs?.[fromName];
      if (!q) return { ok: false, reason: `binding ${b.from}→${b.to}: source unresolved` };
      if (b.coerce) q = applyCoerce(b.coerce, q);
      if (perturb && perturb.bindingIndex === bi) q = perturb.fn(q);
      inputs[toName] = q;
    }
    const v = mod.resolve(freeze(steps[i].params), inputs);
    if (!v || !v.outputs) return { ok: false, reason: `step ${steps[i].id}: resolver returned no outputs` };
    resolved.push(v);
    if (!v.ok) return { ok: false, reason: `step ${steps[i].id}: resolver not ok`, resolved };
  }
  return { ok: true, resolved };
}

function parseRef(ref) {                                    // "s0.solution" → [0, "solution"]
  const m = /^s(\d+)\.(\w+)$/.exec(ref);
  if (!m) throw new Error(`bad ref '${ref}'`);
  return [Number(m[1]), m[2]];
}

/** the chain's final answer = the single output of the terminal step (must be scalar). */
function finalAnswer(resolved) {
  const outs = resolved[resolved.length - 1].outputs;
  const names = Object.keys(outs);
  if (names.length !== 1) return null;
  const v = outs[names[0]].value;
  return typeof v === "number" ? v : null;
}

/** perturbation for a bound quantity: nudge every numeric component by +1. */
function nudge(q) {
  const v = JSON.parse(JSON.stringify(q.value));
  const bump = (x) => (typeof x === "number" ? x + 1 : x);
  let nv;
  if (typeof v === "number") nv = v + 1;
  else if (Array.isArray(v)) nv = v.map(bump);
  else { nv = {}; for (const k of Object.keys(v)) nv[k] = bump(v[k]); }
  return { ...q, value: nv };
}

/** resolveChain(chain) → { ok, answer, essentialChain, reasons[] }.
 *  chain = { steps: [{id, params}], bindings: [{from, to, coerce}] } */
export function resolveChain(chain) {
  const reasons = [];
  const base = runResolvers(chain);
  if (!base.ok) return { ok: false, answer: null, essentialChain: false, reasons: [base.reason] };
  const answer = finalAnswer(base.resolved);
  if (answer === null) return { ok: false, answer: null, essentialChain: false, reasons: ["terminal step is not single-scalar"] };

  // 1. local essentials
  const localOk = base.resolved.every((v) => v.essential === true);
  if (!localOk) reasons.push("a step's local essential condition failed");

  // 2. consumption sensitivity: every binding must be load-bearing
  let sensitive = true;
  for (let bi = 0; bi < chain.bindings.length; bi++) {
    const p = runResolvers(chain, { perturb: { bindingIndex: bi, fn: nudge } });
    const pAns = p.ok ? finalAnswer(p.resolved) : null;
    if (p.ok && pAns !== null && Math.abs(pAns - answer) < 1e-9) {
      sensitive = false; reasons.push(`binding #${bi} (${chain.bindings[bi].from}→${chain.bindings[bi].to}) is NOT load-bearing`);
    }
  }

  // 3. leak check: answer must not equal a raw intermediate bound value
  let leak = false;
  for (const b of chain.bindings) {
    const [fromIdx, fromName] = parseRef(b.from);
    const q = base.resolved[fromIdx].outputs[fromName];
    const vals = typeof q.value === "number" ? [q.value] : Array.isArray(q.value) ? q.value : Object.values(q.value);
    if (vals.some((v) => typeof v === "number" && Math.abs(v - answer) < 1e-9)) { leak = true; reasons.push(`answer equals intermediate '${b.from}' (leak)`); }
  }

  return { ok: true, answer, essentialChain: localOk && sensitive && !leak, reasons };
}

export default { resolveChain };
