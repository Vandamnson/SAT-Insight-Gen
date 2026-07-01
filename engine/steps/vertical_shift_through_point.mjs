/* step: the graph of g(x) = f(x) + k passes through the incoming point → find k.
   Generalizes compose.mjs c4 step B (vertical translation meeting a target point). */
import { par, tx, mt, lc1, validateStep } from "./_iface.mjs";
import { qty, randint } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "vertical_shift_through_point",
  subdomain: "linear_equations_two_variables",
  inputs: { pt: "point" },
  outputs: { k: "param" },
  role: "close",
  ops: ["translate_function", "substitute", "isolate_variable"],
  weight: 260,
  sensitive: ["m", "b"],
  methods: { make: "pick f(x) = mx + b, force g(pt.x) = pt.y by construction", resolve: "k = pt.y − (m·pt.x + b), independent substitution" },
};

export function make(inputs, r) {
  const [x0, y0] = inputs.pt.value;
  const m = nz(r, -4, 4), b = nz(r, -6, 6);
  const k = y0 - (m * x0 + b);
  if (k === 0) return null;                                    // a zero shift is not a translation item
  const ref = inputs.pt.ref || { segs: [tx("the given point")], prose: "the given point" };
  return {
    params: { m, b },
    outputs: { k: qty("param", k) },
    stemSegs: [par(
      tx("The graph of "), mt(`g(x) = f(x) + k`), tx(", where "), mt(`f(x) = ${lc1(m, b)}`),
      tx(" and "), mt("k"), tx(" is a constant, passes through "), ...ref.segs,
      tx(". What is the value of "), mt("k"), tx("?")
    )],
    prose: `g(x) = f(x) + k with f(x) = ${m}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} passes through ${ref.prose}; find the constant k`,
    solutionSegs: [par(tx("At that point, "), mt(`g(x_0) = y_0`), tx(":  "), mt(`k = ${k}`), tx("."))],
    _secret: { k },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: substitution into g at the resolved point ---- */
export function resolve(params, inputs) {
  const { m, b } = params;
  const [x0, y0] = inputs.pt.value;
  const k = y0 - (m * x0 + b);
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  return { outputs: { k: qty("param", k) }, ok: isInt(k) && k !== 0, essential: x0 !== 0 };
}

validateStep({ spec, make, resolve }, "vertical_shift_through_point");
