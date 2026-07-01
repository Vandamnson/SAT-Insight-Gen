/* step: solve a 2×2 linear system → its solution point. Generalizes compose.mjs c1 step A. */
import { mb, lc, validateStep } from "./_iface.mjs";
import { qty, randint } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "sys_solve",
  subdomain: "systems_of_linear_equations",
  inputs: {},
  outputs: { solution: "point" },
  role: "open",
  ops: ["elimination", "solve_single", "back_substitute"],
  weight: 190,
  sensitive: ["c1", "c2", "a1"],
  methods: { make: "construct-backward from a pre-chosen solution (sx, sy)", resolve: "Cramer's rule on the visible coefficients" },
};

export function make(inputs, r) {
  let sx, sy; do { sx = nz(r, -6, 6); sy = nz(r, -6, 6); } while (Math.abs(sx) < 2 || Math.abs(sy) < 2);
  let a1, b1, a2, b2; do { a1 = nz(r, -4, 4); b1 = nz(r, -4, 4); a2 = nz(r, -4, 4); b2 = nz(r, -4, 4); } while (a1 * b2 - a2 * b1 === 0);
  const c1 = a1 * sx + b1 * sy, c2 = a2 * sx + b2 * sy;
  return {
    params: { a1, b1, c1, a2, b2, c2 },
    outputs: { solution: qty("point", [sx, sy], { ref: { segs: [{ t: "text", v: "the solution to the given system of equations" }], prose: "the solution (x, y) of the given system" } }) },
    stemSegs: [mb(`\\begin{cases} ${lc(a1, b1)} = ${c1} \\\\ ${lc(a2, b2)} = ${c2} \\end{cases}`)],
    prose: `a system of two linear equations: ${a1}x + ${b1}y = ${c1} and ${a2}x + ${b2}y = ${c2}, whose solution is (x, y)`,
    solutionSegs: [{ t: "p", segs: [{ t: "text", v: "Solve the system (e.g. by elimination): " }, { t: "math", v: `(x, y) = (${sx}, ${sy})` }, { t: "text", v: "." }] }],
    _secret: { sx, sy },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: Cramer's rule ---- */
export function resolve(params, inputs) {
  const { a1, b1, c1, a2, b2, c2 } = params;
  const det = a1 * b2 - a2 * b1;
  if (det === 0) return { outputs: null, ok: false, essential: false };
  const x = (c1 * b2 - b1 * c2) / det, y = (a1 * c2 - c1 * a2) / det;
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  return { outputs: { solution: qty("point", [x, y]) }, ok: isInt(x) && isInt(y), essential: det !== 0 && x !== 0 };
}

validateStep({ spec, make, resolve }, "sys_solve");
