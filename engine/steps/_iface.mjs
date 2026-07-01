/* ============================================================================
   engine/steps/_iface.mjs — the STEP contract (path-composition engine).

   A step is one verified structural move. Each step module exports:

     export const spec = {
       id, subdomain,                  // owning taxonomy subdomain
       inputs:  { name: type, ... },   // {} ⇒ role "open"
       outputs: { name: type, ... },
       role: "open" | "close",         // (mid = consumes AND is consumed; v1 chains are open→close)
       ops: [...],                     // op_vocab tokens (chain fingerprint material)
       weight: <int>,                  // chain-LLTM marginal (bootstrapped from cell LLTM)
       sensitive: [...paramKeys],      // perturbing these MUST move resolve's output
       methods: { make: "...", resolve: "..." },   // NAMED distinct algorithms (review aid)
     };

     export function make(inputs, r)
       // → { params, outputs, stemSegs, prose, solutionSegs, _secret } | null
       //   params    = ONLY student-visible numbers (the _p discipline)
       //   _secret   = construction-time choices (answers picked first) — NEVER
       //               passed to resolve (the firewall that keeps resolve honest)

     // ---- INDEPENDENT RESOLVER — different method: <name it> ----
     export function resolve(params, inputs)
       // → { outputs, ok, essential }  — re-derives outputs from params + UPSTREAM
       //   RESOLVER outputs only, via a different algorithm than make.

   Independence is enforced mechanically by engine/verify/selftest.mjs:
     · agreement (200 draws: resolve(params) must reproduce make's outputs)
     · sensitivity (perturb each spec.sensitive param → output must move)
     · anti-delegation lint (no `make(` / `_secret` tokens after the resolver divider)
   ============================================================================ */

/* render-segment helpers shared by steps (compose.mjs voice) */
export const mb = (v) => ({ t: "mathblock", v });
export const tx = (v) => ({ t: "text", v });
export const mt = (v) => ({ t: "math", v });
export const par = (...segs) => ({ t: "p", segs });

/* LaTeX mini-formatters (verbatim from compose.mjs) */
export const xt = (c) => (c === 1 ? "x" : c === -1 ? "-x" : `${c}x`);
export const signed = (n) => (n < 0 ? `- ${-n}` : `+ ${n}`);
export const yt = (c) => `${c < 0 ? "-" : "+"} ${Math.abs(c) === 1 ? "" : Math.abs(c)}y`;
export const lc = (a, b) => `${xt(a)} ${yt(b)}`;
export const lc1 = (m, b) => `${xt(m)}${b === 0 ? "" : " " + signed(b)}`;

/** validate a step module shape at registry load time (loud, not silent). */
export function validateStep(mod, file) {
  const errs = [];
  const s = mod.spec;
  if (!s?.id) errs.push("spec.id missing");
  if (!s?.subdomain) errs.push("spec.subdomain missing");
  if (!s?.outputs || !Object.keys(s.outputs).length) errs.push("spec.outputs empty");
  if (!["open", "close", "mid"].includes(s?.role)) errs.push(`spec.role '${s?.role}'`);
  if (!Array.isArray(s?.sensitive) || !s.sensitive.length) errs.push("spec.sensitive empty");
  if (!s?.methods?.make || !s?.methods?.resolve) errs.push("spec.methods.make/resolve must NAME two algorithms");
  if (typeof mod.make !== "function") errs.push("make() missing");
  if (typeof mod.resolve !== "function") errs.push("resolve() missing");
  if (errs.length) throw new Error(`step ${file}: ${errs.join("; ")}`);
  return true;
}
