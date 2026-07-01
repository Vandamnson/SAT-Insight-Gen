/* step: a point satisfies ax + qy = rr with unknown coefficient a → find a.
   Generalizes compose.mjs c1 step B (the "missing coefficient" close). */
import { par, tx, mt, yt, validateStep } from "./_iface.mjs";
import { qty, randint } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "coeff_from_point",
  subdomain: "linear_equations_two_variables",
  inputs: { pt: "point" },
  outputs: { a: "value" },
  role: "close",
  ops: ["substitute", "isolate_variable", "compare_coefficients"],
  weight: 240,
  sensitive: ["q", "rr"],
  methods: { make: "pick the answer a first, build rr = a·x + q·y from the incoming point", resolve: "solve rr − q·y = a·x for a using the UPSTREAM resolver's point" },
};

export function make(inputs, r) {
  const [x, y] = inputs.pt.value;
  if (x === 0) return null;                                   // a would be indeterminate
  const a = nz(r, -5, 5), q = nz(r, -5, 5);
  const rr = a * x + q * y;
  const ref = inputs.pt.ref || { segs: [tx("the given point")], prose: "the given point" };
  const refSegs = ref.segs.map((s, i) => (i === 0 && s.t === "text" ? { ...s, v: s.v.charAt(0).toUpperCase() + s.v.slice(1) } : s));
  return {
    params: { q, rr },
    outputs: { a: qty("value", a) },
    stemSegs: [par(...refSegs, tx(" is "), mt("(x, y)"), tx(". If "), mt(`ax ${yt(q)} = ${rr}`), tx(", what is the value of "), mt("a"), tx("?"))],
    prose: `${ref.prose} is (x, y) and satisfies ax ${q < 0 ? "−" : "+"} ${Math.abs(q)}y = ${rr} for a constant a; find a`,
    solutionSegs: [par(tx("Substitute the solution into "), mt(`ax ${yt(q)} = ${rr}`), tx(":  "), mt(`a = ${a}`), tx("."))],
    _secret: { a },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: isolate a from the visible equation ---- */
export function resolve(params, inputs) {
  const { q, rr } = params;
  const [x, y] = inputs.pt.value;
  if (x === 0) return { outputs: null, ok: false, essential: false };
  const a = (rr - q * y) / x;
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  return { outputs: { a: qty("value", a) }, ok: isInt(a), essential: x !== 0 };
}

validateStep({ spec, make, resolve }, "coeff_from_point");
