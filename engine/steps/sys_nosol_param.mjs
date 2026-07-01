/* step: find k so a 2×2 system has NO solution → the parameter k.
   Generalizes compose.mjs c2 step A. */
import { mb, par, tx, mt, lc, yt, validateStep } from "./_iface.mjs";
import { qty, randint, pick } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "sys_nosol_param",
  subdomain: "systems_of_linear_equations",
  inputs: {},
  outputs: { k: "param" },
  role: "open",
  ops: ["compare_slopes", "compare_coefficients"],
  weight: 250,
  sensitive: ["a1", "b2"],
  methods: { make: "choose b1 dividing a1·b2 so k is a clean integer; force non-coincidence", resolve: "parallel-slope proportionality k = a1·b2 / b1 + non-coincidence guard" },
};

export function make(inputs, r) {
  let a1, b1, b2, k;
  do { a1 = nz(r, -4, 4); b1 = pick(r, [-2, -1, 1, 2]); b2 = nz(r, -4, 4); k = (a1 * b2) / b1; }
  while (!Number.isInteger(k) || k === 0 || Math.abs(k) > 9);
  const scale = b2 / b1;
  const c1 = nz(r, -9, 9); let c2; do { c2 = nz(r, -9, 9); } while (c2 === scale * c1);
  return {
    params: { a1, b1, c1, b2, c2 },
    outputs: { k: qty("param", k) },
    stemSegs: [
      mb(`\\begin{cases} ${lc(a1, b1)} = ${c1} \\\\ kx ${yt(b2)} = ${c2} \\end{cases}`),
      par(tx("In the given system of equations, "), mt("k"), tx(" is a constant and the system has no solution.")),
    ],
    prose: `a system ${a1}x ${b1 < 0 ? "−" : "+"} ${Math.abs(b1)}y = ${c1} and kx ${b2 < 0 ? "−" : "+"} ${Math.abs(b2)}y = ${c2} with constant k has no solution (k must make the lines parallel)`,
    solutionSegs: [par(tx("No solution ⇒ parallel lines (equal slopes, constants not proportional):  "), mt(`k = ${k}`), tx("."))],
    _secret: { k },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: slope proportionality + coincidence guard ---- */
export function resolve(params, inputs) {
  const { a1, b1, c1, b2, c2 } = params;
  if (b1 === 0) return { outputs: null, ok: false, essential: false };
  const k = (a1 * b2) / b1;
  const coincident = c2 === (b2 / b1) * c1;
  return { outputs: { k: qty("param", k) }, ok: Number.isInteger(k) && !coincident, essential: !coincident && k !== 0 };
}

validateStep({ spec, make, resolve }, "sys_nosol_param");
