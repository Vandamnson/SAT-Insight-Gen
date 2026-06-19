/* ============================================================================
   verify/recompute.js — the recompute "leash" (JS port of SAT-AI
   sat_creative.recompute_check). Independently re-derives the answer from the
   structured `params` (the GIVENS only) and rejects mismatches — never trusts
   the author's prose. As a free byproduct it emits a `feature_trace`: the
   deterministic LLTM difficulty features (solve_steps, number_messiness, …)
   the difficulty engine reads.

   recomputeCheck({params, answer}, skill) -> { errors[], verified, features }
     • answer is the ANSWER VALUE (string/number), not an MCQ letter — the
       orchestrator extracts it (SPR: accept[0]; MCQ: the correct option's text).
     • skill is the recompute branch (taxonomy/skills.json .recompute).
   Phase 1 covers the 5 Algebra branches; other domains land in Phase 3.
   ============================================================================ */
const TOL = 1e-6;

export function toFloat(x) {
  if (typeof x === "number") return x;
  if (x == null) throw new Error("null answer");
  let s = String(x).trim().replace(/^\$+|\$+$/g, "").replace(/\s+/g, "");
  if (s.includes("=")) s = s.split("=").pop();               // "x=12" -> "12"
  // LaTeX \frac{a}{b} / \dfrac / \tfrac (braced)
  let m = s.match(/^(-?)\\[dt]?frac\{(-?\d+\.?\d*)\}\{(-?\d+\.?\d*)\}$/);
  if (m) { const v = parseFloat(m[2]) / parseFloat(m[3]); return m[1] ? -v : v; }
  // KaTeX shorthand \tfrac12 (single-digit numerator & denominator)
  m = s.match(/^(-?)\\[dt]?frac(\d)(\d)$/);
  if (m) { const v = parseFloat(m[2]) / parseFloat(m[3]); return m[1] ? -v : v; }
  s = s.replace(/\\,/g, "").replace(/\\!/g, "");
  if (s.includes("/")) { const [n, d] = s.split("/"); return parseFloat(n) / parseFloat(d); } // "3/4"
  const f = Number(s);
  if (Number.isNaN(f)) throw new Error(`cannot parse answer "${x}"`);
  return f;
}

export function close(a, b, tol = TOL) {
  try { return Math.abs(toFloat(a) - toFloat(b)) <= tol; } catch { return false; }
}
const isInt = (v) => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** @returns {{errors:string[], verified:boolean, deferred:boolean}} */
export function recomputeCheck(problem, skill) {
  const p = problem.params;
  const ans = problem.answer;
  const errors = [];
  if (!p) return { errors: ["no structured params to recompute against"], verified: false, deferred: false };
  if (ans == null) return { errors: ["no answer value to check"], verified: false, deferred: false };

  const scaled = (nat) => nat * (p.answer_scale ?? 1) + (p.answer_offset ?? 0);
  const check = (nat, label) => {
    if (!close(ans, scaled(nat))) errors.push(`${label} mismatch: said ${ans}, got ${scaled(nat)}`);
  };

  // If the answer isn't numeric (an interpretation / "which is true" /
  // identify-the-coefficients / parametric item), the numeric leash can't
  // certify it — defer to the blinded verifier instead of falsely rejecting.
  let _ansNum = null; try { _ansNum = toFloat(ans); } catch { /* non-numeric */ }
  if (_ansNum === null && skill !== "needs-deep-verify") return { errors: [], verified: false, deferred: true };

  let verified = true, deferred = false;
  switch (skill) {
    case "alg_linear_eq_1var": {
      const { a, b, c } = p;            // a x + b = c -> x = (c-b)/a
      if (a === 0) errors.push("a=0 (no unique solution) unless constraint-type");
      else check((c - b) / a, "linear-1var");
      break;
    }
    case "alg_linear_eq_2var":
    case "alg_linear_func": {
      const { m, b } = p;               // y = m x + b
      const rep = p.report || "value";      if (rep === "slope") check(m, "slope");
      else if (rep === "intercept") check(b, "y-intercept");
      else check(m * p.x0 + b, "linear eval");
      break;
    }
    case "alg_linear_systems": {
      const { a1, b1, c1, a2, b2, c2 } = p;      const det = a1 * b2 - a2 * b1;
      if (det === 0) errors.push("degenerate system (det=0) — invalid unless constraint-type");
      else {
        const x = (c1 * b2 - c2 * b1) / det;
        const y = (a1 * c2 - a2 * c1) / det;
        check(p.solve_for === "x" ? x : y, "system answer");
      }
      break;
    }
    case "alg_linear_inequalities": {
      const { a, b, c } = p;            // a x + b (op) c
      const op = p.op || "le", report = p.report || "boundary";      if (a === 0) { errors.push("not a linear inequality (a=0)"); break; }
      const boundary = (c - b) / a;
      const flip = { le: "ge", ge: "le", lt: "gt", gt: "lt" };
      const eff = a < 0 ? flip[op] : op;
      if (report === "boundary") check(boundary, "inequality boundary");
      else if (report === "max_int") {
        if (!["le", "lt"].includes(eff)) errors.push("max_int needs an upper-bounded solution set");
        else { let v = Math.floor(boundary); if (eff === "lt" && close(v, boundary)) v -= 1; check(v, "inequality max_int"); }
      } else if (report === "min_int") {
        if (!["ge", "gt"].includes(eff)) errors.push("min_int needs a lower-bounded solution set");
        else { let v = Math.ceil(boundary); if (eff === "gt" && close(v, boundary)) v += 1; check(v, "inequality min_int"); }
      } else errors.push(`unrecognized report '${report}' — unverified`);
      break;
    }
    case "adv_nonlinear_eq": {            // a·x² + b·x + c = 0
      const { a, b, c } = p; const sel = p.root_select || "plus";
      if (!isNum(a) || a === 0) { errors.push("a=0 or missing (not quadratic)"); break; }
      const disc = b * b - 4 * a * c;
      if (sel === "count") { check(disc > TOL ? 2 : (Math.abs(disc) <= TOL ? 1 : 0), "real-root count"); break; }
      if (sel === "sum") { check(-b / a, "sum of roots"); break; }
      if (sel === "product") { check(c / a, "product of roots"); break; }
      if (disc < -TOL) { errors.push("claimed a real root but discriminant < 0"); break; }
      const r = Math.sqrt(Math.max(disc, 0)), plus = (-b + r) / (2 * a), minus = (-b - r) / (2 * a);
      if (!(close(ans, scaled(plus)) || close(ans, scaled(minus)))) errors.push(`root mismatch: said ${ans}, got one of {${plus}, ${minus}}`);
      break;
    }
    case "adv_quadratic_func": {           // f(x) = a·x² + b·x + c
      const { a, b, c } = p; const tgt = p.target || "vertex_y";
      if (!isNum(a) || a === 0) { errors.push("a=0 or missing (not quadratic)"); break; }
      const disc = b * b - 4 * a * c, vx = -b / (2 * a), vy = c - (b * b) / (4 * a);
      if (tgt === "vertex_x") check(vx, "vertex x / axis of symmetry");
      else if (tgt === "vertex_y") check(vy, "vertex y / extreme value");
      else if (tgt === "discriminant") check(disc, "discriminant");
      else if (tgt === "y_intercept") check(c, "y-intercept");
      else if (tgt === "roots") {
        if (disc < -TOL) { errors.push("no real roots"); break; }
        const r = Math.sqrt(Math.max(disc, 0)), pl = (-b + r) / (2 * a), mi = (-b - r) / (2 * a);
        if (!(close(ans, scaled(pl)) || close(ans, scaled(mi)))) errors.push(`root mismatch: said ${ans}, got one of {${pl}, ${mi}}`);
      } else errors.push(`unknown quadratic target '${tgt}'`);
      break;
    }
    case "adv_radical_rational": {
      const mode = p.mode || "solve_radical";
      if (mode === "solve_radical") {                 // √(a·x + b) = c  ⇒  x = (c²−b)/a, c ≥ 0
        const { a, b, c } = p;
        if (!isNum(a) || a === 0) { errors.push("a=0 (no unique solution)"); break; }
        if (c < -TOL) { errors.push("radical set equal to a negative (no real solution)"); break; }
        check((c * c - b) / a, "radical solution");
      } else if (mode === "eval_radical") {            // root-th root of `under`
        const under = p.under, root = p.root || 2;
        if (under < 0 && root % 2 === 0) { errors.push("even root of a negative"); break; }
        check(Math.sign(under) * Math.abs(under) ** (1 / root), "radical value");
      } else if (mode === "eval_rational") {           // num(x0)/den(x0); num,den = coef arrays hi→lo
        const ev = (co, x) => co.reduce((s, k, i) => s + k * x ** (co.length - 1 - i), 0);
        const den = ev(p.den || [1], p.x0);
        if (Math.abs(den) < TOL) { errors.push("rational undefined (denominator 0)"); break; }
        check(ev(p.num || [0], p.x0) / den, "rational value");
      } else { verified = false; deferred = true; }    // unknown mode → defer
      break;
    }
    case "adv_polynomial_func": {
      const ev = (co, x) => co.reduce((s, k, i) => s + k * x ** (co.length - 1 - i), 0);
      let coefs = Array.isArray(p.coefs) ? p.coefs : null;
      if (!coefs && Array.isArray(p.roots)) {          // expand leading·∏(x − root) → coefs hi→lo
        coefs = [p.leading ?? 1];
        for (const rt of p.roots) { const next = new Array(coefs.length + 1).fill(0); for (let i = 0; i < coefs.length; i++) { next[i] += coefs[i]; next[i + 1] += coefs[i] * -rt; } coefs = next; }
      }
      if (!Array.isArray(coefs)) { verified = false; deferred = true; break; }
      const n = coefs.length - 1, tgt = p.target || "value_at";
      if (tgt === "value_at") check(ev(coefs, p.x0), "polynomial value");
      else if (tgt === "zero") { if (Math.abs(ev(coefs, _ansNum)) > 1e-4) errors.push(`claimed zero ${ans}, but P(${ans})=${ev(coefs, _ansNum)}`); }
      else if (tgt === "sum_of_zeros") check(-coefs[1] / coefs[0], "sum of zeros");
      else if (tgt === "product_of_zeros") check(((-1) ** n) * coefs[n] / coefs[0], "product of zeros");
      else { verified = false; deferred = true; }      // end_behavior / qualitative → defer
      break;
    }
    case "geo_measure": {                  // plane/solid mensuration + clean triangle facts
      const s = p.shape, r = p.report || "area";
      if (s === "rectangle") {
        if (r === "area") check(p.l * p.w, "rectangle area");
        else if (r === "perimeter") check(2 * (p.l + p.w), "rectangle perimeter");
        else if (r === "side_from_area") check(p.area / p.l, "rectangle side");
        else if (r === "side_from_perimeter") check(p.perimeter / 2 - p.l, "rectangle side");
        else errors.push(`unknown rectangle report '${r}'`);
      } else if (s === "triangle") {
        if (r === "area") check(0.5 * p.base * p.height, "triangle area");
        else if (r === "angle_sum") check(180 - p.a - p.b, "third angle");
        else errors.push(`unknown triangle report '${r}'`);
      } else if (s === "right_triangle") {
        if (r === "hyp") check(Math.hypot(p.leg1, p.leg2), "hypotenuse");
        else if (r === "leg") check(Math.sqrt(p.hyp * p.hyp - p.leg * p.leg), "leg");
        else errors.push(`unknown right-triangle report '${r}'`);
      } else if (s === "prism") check(p.l * p.w * p.h, "prism volume");
      else if (s === "cube") check(p.s ** 3, "cube volume");
      else if (s === "pyramid") check((p.l * p.w * p.h) / 3, "pyramid volume");
      else if (s === "circle") {
        if (r === "area") check(Math.PI * p.r * p.r, "circle area");
        else if (r === "circumference") check(2 * Math.PI * p.r, "circumference");
        else errors.push(`unknown circle report '${r}'`);
      } else { verified = false; deferred = true; }   // unknown shape → defer
      break;
    }
    case "psda_stats": {                   // statistics / percent / rate / probability
      const m = p.mode;
      if (m === "median") { const v = [...(p.values || [])].sort((x, y) => x - y), n = v.length; if (!n) { errors.push("no values"); break; } check(n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2, "median"); }
      else if (m === "mean") { const v = p.values || []; if (!v.length) { errors.push("no values"); break; } check(v.reduce((s, x) => s + x, 0) / v.length, "mean"); }
      else if (m === "mean_missing") check(p.mean * p.n - (p.known || []).reduce((s, x) => s + x, 0), "missing value");
      else if (m === "percent_of") check(p.whole * p.percent / 100, "percent of");
      else if (m === "find_percent") check(p.part / p.whole * 100, "percent");
      else if (m === "percent_change") check((p.end - p.start) / p.start * 100, "percent change");
      else if (m === "apply_change") check(p.base * (1 + p.percent / 100), "amount after change");
      else if (m === "unit_rate") check(p.total / p.units, "unit rate");
      else if (m === "probability") { if (!p.total) { errors.push("total=0"); break; } check(p.favorable / p.total, "probability"); }
      else { verified = false; deferred = true; }   // unknown mode → defer
      break;
    }
    case "needs-deep-verify":
      verified = false; deferred = true; // qualitative — defers to the blinded SymPy/LLM verifier
      break;
    default:
      verified = false; deferred = true; // branch not yet ported (Phase 3) — defer to deep-verify
  }
  return { errors, verified: verified && errors.length === 0, deferred };
}

export default { recomputeCheck, toFloat, close };
