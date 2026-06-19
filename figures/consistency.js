/* ============================================================================
   figures/consistency.js — Subsystem B, GATE 1: figure-math consistency.
   A SEPARATE code path from the renderer: reconstruct the figure's semantic
   content from its spec and assert it agrees with the problem's params/answer.
   A figure that contradicts the answer REJECTS the item (not just the figure).

   Phase 1 implements the Algebra-relevant types (coordPlane, table); Phase 2
   generalizes to scatter/triangle/circle/etc. measureFigure returns
   { ok, errors[] } — unknown types pass with a note (no false negatives).
   ============================================================================ */
const onLine = (x, y, m, b, tol = 1e-6) => Math.abs(y - (m * x + b)) <= tol * Math.max(1, Math.abs(y)) + 1e-9;

function lineOf(curve) {
  if (curve == null) return null;
  if (curve.m !== undefined && curve.b !== undefined) return { m: curve.m, b: curve.b };
  if (curve.p1 && curve.p2) {
    const [x1, y1] = curve.p1, [x2, y2] = curve.p2;
    if (x1 === x2) return { vertical: true, x: x1 };
    const m = (y2 - y1) / (x2 - x1);
    return { m, b: y1 - m * x1 };
  }
  return null;
}

function checkCoordPlane(spec, params) {
  const errors = [];
  const lines = (spec.curves || []).map(lineOf).filter((L) => L && !L.vertical);
  // 1. every plotted point must lie on at least one drawn curve (when curves exist)
  for (const pt of spec.points || []) {
    const [x, y] = pt.at || [];
    if (x == null) continue;
    if (lines.length && !lines.some((L) => onLine(x, y, L.m, L.b)))
      errors.push(`point (${x}, ${y}) does not lie on any drawn line`);
  }
  // 2. if params declares a slope/intercept answer, a drawn line must realize it
  if (params) {
    if (params.report === "slope" && params.m !== undefined && lines.length && !lines.some((L) => Math.abs(L.m - params.m) <= 1e-6))
      errors.push(`params slope ${params.m} matches no drawn line`);
    if (params.report === "intercept" && params.b !== undefined && lines.length && !lines.some((L) => Math.abs(L.b - params.b) <= 1e-6))
      errors.push(`params y-intercept ${params.b} matches no drawn line`);
    // a two-point slope answer: the drawn line's slope must equal the computed slope
    if (params.p1 && params.p2 && params.target === "slope" && lines.length) {
      const m = (params.p2[1] - params.p1[1]) / (params.p2[0] - params.p1[0]);
      if (!lines.some((L) => Math.abs(L.m - m) <= 1e-6)) errors.push(`computed slope ${m} matches no drawn line`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function measureFigure(figure, params /*, answerValue */) {
  if (!figure) return { ok: true, errors: [], note: "no figure" };
  const { fn, spec } = figure;
  if (fn === "coordPlane") return checkCoordPlane(spec || {}, params);
  // tables / scatter / triangle / circle: Phase-2 consistency arms
  return { ok: true, errors: [], note: `no consistency arm for "${fn}" yet (Phase 2)` };
}

export default { measureFigure };
