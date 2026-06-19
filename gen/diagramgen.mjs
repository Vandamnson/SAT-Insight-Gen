/* ============================================================================
   gen/diagramgen.mjs — procedural NOVEL diagram question generator.
   Vertex-angle questions on a convex polygon (quadrilateral / pentagon — variety
   beyond triangles), the user's "intersect lines → polygon → vertex angles,
   disappear data you can compute" recipe, made self-verifying via
   CONSTRUCT-BACKWARD:
     1. pick the true x and true INTEGER interior angles summing to (N−2)·180
     2. present each angle as a linear expression aᵢx+bᵢ that equals its true
        value at x (so the solver must use the angle-sum to solve for x, then
        evaluate the target) — a B7-style multi-step obfuscation
     3. hide the target angle's value; ask for it. Answer exact by construction.
   Figure: a representative convex N-gon ("not to scale") with the expressions
   marked. $0, no LLM, self-checked (Σ expressions = (N−2)·180 at x).
   ============================================================================ */
// DISABLED 2026-06-17: stopgap, not yet truly SAT-aligned. Off pending the
// unified SAT-aligned figure generator (FIGURE-PLAN.md). buildDiagramItem() throws.
export const DISABLED = true;

const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Figure labels are SVG <text> (NOT KaTeX), so use plain text + a Unicode degree
// sign — never LaTeX (which would show as literal source in the figure).
function angleExpr(a, b) {                 // a·x + b → "(2x - 5)°"
  if (a === 0) return `${b}°`;
  const ax = a === 1 ? "x" : `${a}x`;
  if (b === 0) return `${ax}°`;
  return `(${ax} ${b < 0 ? "-" : "+"} ${Math.abs(b)})°`;
}
function regularish(N) {                    // representative convex N-gon (jittered), not to scale
  const V = [];
  for (let i = 0; i < N; i++) { const t = Math.PI / 2 + i * 2 * Math.PI / N, r = 40 + ri(-6, 6); V.push([Math.round(50 + r * Math.cos(t)), Math.round(50 + r * Math.sin(t))]); }
  return V;
}

export function buildDiagramItem() {
  if (DISABLED) throw new Error("diagramgen is disabled pending SAT-alignment rework — see FIGURE-PLAN.md");
  const N = pick([4, 4, 5]);
  const total = (N - 2) * 180;
  const x0 = ri(6, 16);
  // true integer interior angles in [45,155] summing to total
  let ang = null;
  for (let t = 0; t < 300 && !ang; t++) {
    const a = []; let s = 0;
    for (let i = 0; i < N - 1; i++) { const v = ri(45, 150); a.push(v); s += v; }
    const last = total - s; if (last >= 40 && last <= 155) { a.push(last); ang = a; }
  }
  if (!ang) return buildDiagramItem();
  const coefs = ang.map(() => pick([1, 1, 2, 2, 3]));   // all ≥1 ⇒ every angle is an x-expression; Σa≠0
  const exprs = ang.map((v, i) => ({ a: coefs[i], b: v - coefs[i] * x0, val: v }));
  const sumA = coefs.reduce((p, q) => p + q, 0), sumB = exprs.reduce((p, e) => p + e.b, 0);
  // self-check: the expressions must sum to `total` at x0
  const chk = exprs.reduce((p, e) => p + (e.a * x0 + e.b), 0);
  if (chk !== total) throw new Error(`angle-sum self-check failed: ${chk} ≠ ${total}`);

  const labels = "ABCDE".slice(0, N).split("");
  const ti = ri(0, N - 1);                  // target vertex
  const angleLabels = {}; exprs.forEach((e, i) => { angleLabels[labels[i]] = angleExpr(e.a, e.b); });
  const shape = N === 4 ? "quadrilateral" : "pentagon";
  const fmtB = (b) => (b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`);
  return {
    skill: "angles_polygon", domain: "geometry_trig", type: "spr",
    stem: [
      { t: "text", v: `In ${shape} ${labels.join("")} shown, the interior angle measures are as marked (the figure is not drawn to scale). What is the measure, in degrees, of ` },
      { t: "math", v: `\\angle ${labels[ti]}` }, { t: "text", v: "?" },
    ],
    solution: [{ t: "text", v: `The interior angles of a ${shape} sum to ${total}°. Adding the marked expressions: ${sumA}x ${fmtB(sumB)} = ${total}, so x = ${x0}. Then ∠${labels[ti]} = ${exprs[ti].a === 1 ? "" : exprs[ti].a}(${x0}) ${fmtB(exprs[ti].b)} = ${ang[ti]}°.` }],
    answer: { accept: [String(ang[ti])], tol: 0 },
    params: { shape, x: x0, angles: ang, total },
    figure: { fn: "polygon", caption: `${shape[0].toUpperCase() + shape.slice(1)} ${labels.join("")} (not to scale)`, spec: { vertices: regularish(N), labels, angleLabels } },
    meta: { selfChecked: true, N, x: x0, target: labels[ti], answer: ang[ti] },
  };
}
export default { buildDiagramItem };
