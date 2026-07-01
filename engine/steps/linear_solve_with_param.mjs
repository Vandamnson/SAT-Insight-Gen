/* step: with the recovered k, solve the linear equation kx + e = fx + g → x.
   Generalizes compose.mjs c2 step B. */
import { par, tx, mt, xt, signed, validateStep } from "./_iface.mjs";
import { qty, randint } from "../types.mjs";

const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };

export const spec = {
  id: "linear_solve_with_param",
  subdomain: "linear_equations_one_variable",
  inputs: { k: "param" },
  outputs: { x: "value" },
  role: "close",
  ops: ["move_variable_term", "subtract_constant", "divide_coefficient"],
  weight: 200,
  sensitive: ["e", "g"],
  methods: { make: "pick the target x first, build g = e + (k − f)·x", resolve: "isolate x = (g − e)/(k − f) with k from the UPSTREAM resolver" },
};

export function make(inputs, r) {
  const k = inputs.k.value;
  let f; do { f = nz(r, -5, 5); } while (f === k);
  const e = nz(r, -6, 6), xT = nz(r, -6, 6);
  const g = e + (k - f) * xT;
  return {
    params: { e, f, g },
    outputs: { x: qty("value", xT) },
    stemSegs: [par(tx("For that value of "), mt("k"), tx(", what value of "), mt("x"), tx(" satisfies "), mt(`kx ${signed(e)} = ${xt(f)} ${signed(g)}`), tx("?"))],
    prose: `for that k, solve kx ${e < 0 ? "−" : "+"} ${Math.abs(e)} = ${f}x ${g < 0 ? "−" : "+"} ${Math.abs(g)} for x`,
    solutionSegs: [par(tx("Substitute "), mt(`k`), tx(" and isolate:  "), mt(`x = ${xT}`), tx("."))],
    _secret: { xT },
  };
}

/* ---- INDEPENDENT RESOLVER — different method: closed-form isolation ---- */
export function resolve(params, inputs) {
  const { e, f, g } = params;
  const k = inputs.k.value;
  if (k === f) return { outputs: null, ok: false, essential: false };
  const x = (g - e) / (k - f);
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  return { outputs: { x: qty("value", x) }, ok: isInt(x), essential: k !== f };
}

validateStep({ spec, make, resolve }, "linear_solve_with_param");
