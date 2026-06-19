/* Unit tests for the recompute leash. Run: node verify/recompute.test.mjs */
import { recomputeCheck, toFloat } from "./recompute.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("  ✗", m); } };
const verifies = (params, skill, answer) => recomputeCheck({ params, answer }, skill).verified;

// toFloat parsing
ok(toFloat("x=9") === 9, "toFloat x=9");
ok(toFloat("-2") === -2, "toFloat -2");
ok(Math.abs(toFloat("3/4") - 0.75) < 1e-9, "toFloat 3/4");
ok(Math.abs(toFloat("\\tfrac12") - 0.5) < 1e-9, "toFloat \\tfrac12");
ok(Math.abs(toFloat("-\\frac{3}{2}") + 1.5) < 1e-9, "toFloat -\\frac{3}{2}");
ok(toFloat("$12$") === 12, "toFloat $12$");

// alg_linear_eq_1var: 5x-7=3x+11 -> 2x-7=11 -> x=9   (a=2,b=-7,c=11)
ok(verifies({ a: 2, b: -7, c: 11 }, "alg_linear_eq_1var", "9"), "eq_1var correct");
ok(!verifies({ a: 2, b: -7, c: 11 }, "alg_linear_eq_1var", "8"), "eq_1var rejects wrong");
ok(!verifies({ a: 0, b: 1, c: 2 }, "alg_linear_eq_1var", "0"), "eq_1var rejects a=0");

// alg_linear_eq_2var: slope / intercept / value
ok(verifies({ m: -2, b: 3, report: "slope" }, "alg_linear_eq_2var", "-2"), "eq_2var slope");
ok(verifies({ m: 3, b: 1, x0: 4, report: "value" }, "alg_linear_func", "13"), "func eval");
ok(!verifies({ m: 3, b: 1, x0: 4, report: "value" }, "alg_linear_func", "12"), "func eval rejects wrong");

// alg_linear_systems: x+y=5, x-y=1 -> x=3,y=2
ok(verifies({ a1: 1, b1: 1, c1: 5, a2: 1, b2: -1, c2: 1, solve_for: "x" }, "alg_linear_systems", "3"), "system x");
ok(verifies({ a1: 1, b1: 1, c1: 5, a2: 1, b2: -1, c2: 1, solve_for: "y" }, "alg_linear_systems", "2"), "system y");
ok(!verifies({ a1: 1, b1: 1, c1: 1, a2: 2, b2: 2, c2: 2, solve_for: "x" }, "alg_linear_systems", "0"), "system rejects degenerate");

// alg_linear_inequalities: 2x <= 10 -> boundary 5, max_int 5 ; 2x < 10 -> max_int 4
ok(verifies({ a: 2, b: 0, c: 10, op: "le", report: "boundary" }, "alg_linear_inequalities", "5"), "ineq boundary");
ok(verifies({ a: 2, b: 0, c: 10, op: "le", report: "max_int" }, "alg_linear_inequalities", "5"), "ineq max_int (le)");
ok(verifies({ a: 2, b: 0, c: 10, op: "lt", report: "max_int" }, "alg_linear_inequalities", "4"), "ineq max_int (lt strict)");
// negative coefficient flips: -2x <= 10 -> x >= -5 -> min_int -5
ok(verifies({ a: -2, b: 0, c: 10, op: "le", report: "min_int" }, "alg_linear_inequalities", "-5"), "ineq flip min_int");

// non-numeric answer (interpretation / parametric / "which is true") → DEFER to the
// blinded verifier, not a false reject
const dfr = recomputeCheck({ params: { a: 2, b: 0, c: 5 }, answer: "the cost rises by $3 per item" }, "alg_linear_eq_1var");
ok(dfr.deferred === true && dfr.verified === false, "non-numeric answer defers to deep-verify");
const num = recomputeCheck({ params: { a: 2, b: 0, c: 6 }, answer: "3" }, "alg_linear_eq_1var");
ok(num.deferred === false && num.verified === true, "numeric answer is verified, not deferred");

console.log(`\nrecompute leash: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
