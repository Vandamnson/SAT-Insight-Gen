/* ============================================================================
   engine/edges.mjs — the CURATED typed edge allowlist (the new edge table).

   The type system PROPOSES (types must be bindable); a reviewed edge ADMITS.
   The composer never chains on raw type-match alone — every cross-step hop in
   production is one of these reviewed lines. Growing the engine = adding a line.
   `note` names the proven capstone the edge generalizes (or the review rationale).
   ============================================================================ */
import { step } from "./registry.mjs";
import { bindable } from "./types.mjs";

export const EDGES = [
  { from: "sys_solve.solution",   to: "coeff_from_point.pt",             coerce: null, note: "C1: system solution feeds the missing-coefficient equation" },
  { from: "sys_nosol_param.k",    to: "linear_solve_with_param.k",       coerce: null, note: "C2: no-solution k reused as the linear equation's coefficient" },
  { from: "line_x_intercept.pt",  to: "vertical_shift_through_point.pt", coerce: null, note: "C4: shift g to pass through ℓ's x-intercept" },
  { from: "sys_solve.solution",   to: "vertical_shift_through_point.pt", coerce: null, note: "NEW: shift a line to pass through a system's solution point (reviewed: both skills load-bearing)" },
  { from: "line_x_intercept.pt",  to: "coeff_from_point.pt",             coerce: null, note: "NEW: ℓ's x-intercept satisfies an equation with unknown coefficient (reviewed; y=0 kills the q-term → resolver's essential guard rejects if degenerate)" },
];

/** admissible(fromRef, toRef) → { ok, coerce } — edge must be listed AND type-sound. */
export function admissible(fromRef, toRef) {
  const e = EDGES.find((e) => e.from === fromRef && e.to === toRef);
  if (!e) return { ok: false };
  const [fs, fo] = fromRef.split("."), [ts, ti] = toRef.split(".");
  const fromType = step(fs).spec.outputs[fo], toType = step(ts).spec.inputs[ti];
  const c = e.coerce ?? bindable(fromType, toType);
  if (c === false) return { ok: false };
  return { ok: true, coerce: c || null };
}

export default { EDGES, admissible };
