/* step: the x-intercept of a given line y = nx + d → the point (x0, 0).
   Generalizes compose.mjs c4 step A. */
import { par, tx, mt, lc1, validateStep } from "./_iface.mjs";
import { qty, randint } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "line_x_intercept",
  subdomain: "linear_equations_two_variables",
  inputs: {},
  outputs: { pt: "point" },
  role: "open",
  ops: ["find_intercept"],
  weight: 160,
  sensitive: ["n", "d"],
  methods: { make: "construct-backward: choose x0, set d = −n·x0", resolve: "solve nx + d = 0 → x0 = −d/n" },
};

export function make(inputs, r) {
  const n = nz(r, -4, 4);
  const x0 = nz(r, -6, 6);
  const d = -n * x0;
  return {
    params: { n, d },
    outputs: { pt: qty("point", [x0, 0], { ref: { segs: [{ t: "text", v: "the " }, { t: "math", v: "x" }, { t: "text", v: "-intercept of " }, { t: "math", v: "\\ell" }], prose: "the x-intercept of line ℓ" } }) },
    stemSegs: [par(tx("In the "), mt("xy"), tx("-plane, the line "), mt("\\ell"), tx(" is the graph of "), mt(`y = ${lc1(n, d)}`), tx("."))],
    prose: `line ℓ is the graph of y = ${n}x ${d < 0 ? "−" : "+"} ${Math.abs(d)}; the relevant point is ℓ's x-intercept`,
    solutionSegs: [par(tx("The "), mt("x"), tx("-intercept of "), mt("\\ell"), tx(":  "), mt(`${lc1(n, d)} = 0`), tx("  ⇒  "), mt(`x = ${x0}`), tx("."))],
    _secret: { x0 },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: root of the visible equation ---- */
export function resolve(params, inputs) {
  const { n, d } = params;
  if (n === 0) return { outputs: null, ok: false, essential: false };
  const x0 = -d / n;
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  return { outputs: { pt: qty("point", [x0, 0]) }, ok: isInt(x0), essential: n !== 0 && x0 !== 0 };
}

validateStep({ spec, make, resolve }, "line_x_intercept");
