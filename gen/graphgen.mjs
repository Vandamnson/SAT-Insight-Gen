/* ============================================================================
   gen/graphgen.mjs — procedural NOVEL graph-intersection question generator.

   The user's recipe, made self-verifying via CONSTRUCT-BACKWARD:
     1. choose "nice" intersection x-values (roots) r1..rd
     2. build two smooth functions f, g whose DIFFERENCE is leading·∏(x - ri)
        → their graphs intersect at EXACTLY x = r1..rd, by construction
     3. hide the roots (present f, g expanded) and ask a derived quantity
        (sum / product / count / a coordinate) — the solver must set f = g and
        solve f − g = 0
     4. obfuscate (give g implicitly, translate, ask a 2-step derived value)
   The generator KNOWS the answer (it built the roots) and DOUBLE-CHECKS it by
   numerically re-finding the roots from the final coefficients. $0, no LLM.

   Variety beyond parabolas: line/quadratic/cubic curves, 1–3 intersections,
   several ask types. (Exponential/log curves need a figures.js renderer — TODO.)
   ============================================================================ */

// DISABLED 2026-06-17: graphgen is too narrow / not SAT-aligned. Off until the
// coordinate-plane rework in FIGURE-PLAN.md (Step 4.3). buildGraphItem() throws.
export const DISABLED = true;

const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const nz = (lo, hi) => { let v = 0; while (v === 0) v = ri(lo, hi); return v; };

/* ---- polynomial coeffs, ascending: c[i] = coefficient of x^i ---- */
const addC = (a, b) => { const n = Math.max(a.length, b.length), o = Array(n).fill(0); for (let i = 0; i < n; i++) o[i] = (a[i] || 0) + (b[i] || 0); return o; };
const evalC = (c, x) => { let s = 0; for (let i = c.length - 1; i >= 0; i--) s = s * x + c[i]; return s; };
const trimC = (c) => { let n = c.length; while (n > 1 && Math.abs(c[n - 1]) < 1e-9) n--; return c.slice(0, n); };
function mulLinear(c, root) { const o = Array(c.length + 1).fill(0); for (let i = 0; i < c.length; i++) { o[i + 1] += c[i]; o[i] += -root * c[i]; } return o; }
function fromRoots(roots, leading) { let c = [leading]; for (const r of roots) c = mulLinear(c, r); return c; }   // leading·∏(x−r)

function polyLatex(c) {
  c = trimC(c); let s = "";
  for (let i = c.length - 1; i >= 0; i--) {
    const k = c[i]; if (Math.abs(k) < 1e-9) continue;
    const pow = i === 0 ? "" : i === 1 ? "x" : `x^{${i}}`;
    const a = Math.abs(k), coef = (a === 1 && i > 0) ? "" : `${a}`;
    s += s === "" ? `${k < 0 ? "-" : ""}${coef}${pow}` : `${k < 0 ? " - " : " + "}${coef}${pow}`;
  }
  return s || "0";
}
function curveSpec(c) {   // -> coordPlane curve object (degree ≤ 3)
  c = trimC(c); const d = c.length - 1;
  if (d <= 1) return { type: "line", m: c[1] || 0, b: c[0] || 0 };
  if (d === 2) return { type: "quadratic", a: c[2], b: c[1], c: c[0] };
  return { type: "cubic", a: c[3], b: c[2], c: c[1], d: c[0] };
}
// numeric self-check: re-find roots of (f−g) in a window; must equal the constructed set
function rootsNumeric(c, lo, hi) {
  const found = [], N = 2000, h = (hi - lo) / N;
  let xp = lo, yp = evalC(c, lo);
  for (let i = 1; i <= N; i++) {
    const x = lo + i * h, y = evalC(c, x);
    if (yp === 0) found.push(xp);
    else if (yp * y < 0) { // bisect for the root in (xp, x)
      let a = xp, b = x;
      for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (evalC(c, m) * evalC(c, a) <= 0) b = m; else a = m; }
      found.push((a + b) / 2);
    }
    xp = x; yp = y;
  }
  return found;
}

/** buildGraphItem() -> { stem, type, answer, solution, figure, params, meta }.
 *  Throws if the numeric self-check disagrees with the construction (never ships a wrong answer). */
export function buildGraphItem() {
  if (DISABLED) throw new Error("graphgen is disabled pending SAT-alignment rework — see FIGURE-PLAN.md");
  const d = pick([2, 2, 3]);                         // # of intersections (skew harder)
  const roots = []; while (roots.length < d) { const r = ri(-4, 5); if (!roots.includes(r)) roots.push(r); }
  roots.sort((a, b) => a - b);
  const leading = nz(-2, 2);
  const diff = fromRoots(roots, leading);            // f − g
  const gDeg = d >= 3 ? 1 : pick([1, 2]);            // keep f degree ≤ 3 and on-screen
  const g = gDeg === 1 ? [ri(-3, 5), nz(-3, 3)] : [ri(-3, 5), nz(-3, 3), nz(-2, 2)];
  const f = addC(g, diff);
  const fDeg = trimC(f).length - 1, gDegT = trimC(g).length - 1;
  if (fDeg > 3 || fDeg < 2) return buildGraphItem();  // want an interesting f (deg 2–3)

  // self-check: the numeric roots of f−g must match the constructed roots
  const lo = Math.min(...roots) - 3, hi = Math.max(...roots) + 3;
  const nr = rootsNumeric(diff, lo, hi).sort((a, b) => a - b);
  const ok = nr.length === roots.length && roots.every((r, i) => Math.abs(r - nr[i]) < 1e-4);
  if (!ok) throw new Error(`self-check failed: constructed ${roots} vs numeric ${nr.map(x => x.toFixed(2))}`);

  // ---- ask type (obfuscated: must equate f=g and solve f−g=0) ----
  const ask = pick(d >= 2 ? ["sum_x", "count", "product_x"] : ["count"]);
  let answer, prompt, work;
  if (ask === "sum_x") { answer = roots.reduce((a, b) => a + b, 0); prompt = "what is the sum of the x-coordinates of the points where the graphs of f and g intersect"; work = `Set f(x)=g(x): f(x)-g(x)=${polyLatex(diff)}=0, with roots x=${roots.join(", ")}. Their sum is ${answer}.`; }
  else if (ask === "product_x") { answer = roots.reduce((a, b) => a * b, 1); prompt = "what is the product of the x-coordinates of the intersection points of the graphs of f and g"; work = `f(x)-g(x)=${polyLatex(diff)}=0 has roots x=${roots.join(", ")}; their product is ${answer}.`; }
  else { answer = roots.length; prompt = "at how many points do the graphs of f and g intersect"; work = `f(x)-g(x)=${polyLatex(diff)}=0 has ${roots.length} real solutions, so the graphs meet at ${answer} points.`; }

  // figure window: tight x around the intersections; y CAPPED so cubics don't
  // blow the aspect ratio (axes are equal-scaled) — curve tails clip cleanly.
  const xR = [Math.min(...roots) - 2, Math.max(...roots) + 2];
  const xspan = xR[1] - xR[0];
  const intYs = roots.map((r) => evalC(g, r));
  const yc = Math.round((Math.min(...intYs) + Math.max(...intYs)) / 2);
  const yspan = Math.min(30, Math.max(16, Math.round(2.2 * xspan)));   // ≤ ~2.2× xspan
  const ylo = yc - Math.round(yspan / 2), yhi = yc + Math.round(yspan / 2);
  const figure = {
    fn: "coordPlane", caption: "The graphs of f and g",
    spec: { xRange: xR, yRange: [ylo, yhi], xStep: 1, yStep: Math.max(2, Math.round((yhi - ylo) / 8)), origin: true,
      curves: [curveSpec(f), curveSpec(g)], points: [] },   // intersections deliberately NOT marked (hidden)
  };
  return {
    skill: "nonlinear_intersection", domain: "advanced_math", type: "spr",
    stem: [
      { t: "text", v: "The functions " }, { t: "math", v: `f(x) = ${polyLatex(f)}` }, { t: "text", v: " and " },
      { t: "math", v: `g(x) = ${polyLatex(g)}` }, { t: "text", v: ` are graphed in the xy-plane. ${prompt[0].toUpperCase() + prompt.slice(1)}?` },
    ],
    solution: [{ t: "text", v: work }],
    answer: { accept: [String(answer)], tol: 0 },
    params: { construction: "f-g roots", roots, ask },
    figure,
    meta: { selfChecked: true, ask, roots, fDeg, gDeg: gDegT },
  };
}

export default { buildGraphItem };
