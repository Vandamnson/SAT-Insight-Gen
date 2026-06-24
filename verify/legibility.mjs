/* ============================================================================
   legibility.mjs — SELECTOR Tier C, the graph analog of the PLAUSIBILITY gate.

   figurecheck guards math/figure CONSISTENCY; this guards READABILITY: the asked
   feature and every marked point sit inside the window, each line actually crosses
   the window (not entirely off-screen), and the window span is reasonable so the
   integer grid is readable. Spec-level + deterministic. (Pixel-level label-collision
   / frame-clip is the separate `figures/verify-all.mjs` pass, run on the output.)
   ============================================================================ */

export function legibilityCheck(cell) {
  const fig = cell?.incidentals?.numbers?.figure;
  if (!fig || fig.fn !== "coordPlane") return { keep: true };   // not a graph item
  const spec = fig.spec;
  const [xmin, xmax] = spec.xRange, [ymin, ymax] = spec.yRange;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  if (xspan < 4 || yspan < 4) return { keep: false, reason: `window too small (${xspan}×${yspan})` };
  if (xspan > 20 || yspan > 20) return { keep: false, reason: `window too large (${xspan}×${yspan})` };

  const inside = (x, y) => x >= xmin && x <= xmax && y >= ymin && y <= ymax;
  for (const p of (spec.points || [])) if (!inside(p.at[0], p.at[1])) return { keep: false, reason: `marked point ${JSON.stringify(p.at)} off-screen` };

  // every line must actually appear inside the window (enters the box somewhere)
  for (const c of (spec.curves || []).filter((c) => c.type === "line")) {
    const yL = c.m * xmin + c.b, yR = c.m * xmax + c.b;
    const endIn = (yL >= ymin && yL <= ymax) || (yR >= ymin && yR <= ymax);
    const crosses = (yL - ymax) * (yR - ymax) < 0 || (yL - ymin) * (yR - ymin) < 0;
    if (!endIn && !crosses) return { keep: false, reason: `line y=${c.m}x+${c.b} is outside the window` };
  }

  // nonlinear curves (ADV-2): the turning point / asymptote must be on-screen, and the
  // curve must read as a curve (≥3 of 9 samples inside the window — not clipped to a sliver).
  const oneCurve = (spec.curves || []).length === 1;     // sole-focus parabola ⇒ require vertex; a line∩parabola system need not center the vertex
  const sampleVisible = (f) => { let n = 0; for (let i = 0; i <= 8; i++) { const y = f(xmin + (xmax - xmin) * i / 8); if (y >= ymin && y <= ymax) n++; } return n; };
  for (const c of (spec.curves || []).filter((c) => c.type === "quadratic")) {
    const f = (x) => c.a * x * x + c.b * x + c.c;
    if (oneCurve) { const h = -c.b / (2 * c.a); if (!inside(h, f(h))) return { keep: false, reason: `parabola vertex (${h.toFixed(1)}, ${f(h).toFixed(1)}) off-screen` }; }
    if (sampleVisible(f) < 3) return { keep: false, reason: "parabola barely visible in the window" };
  }
  for (const c of (spec.curves || []).filter((c) => c.type === "exponential")) {
    const k = c.k || 0;
    if (k < ymin || k > ymax) return { keep: false, reason: `exponential asymptote y=${k} off-screen` };
    if (sampleVisible((x) => c.a * Math.pow(c.b, x) + k) < 3) return { keep: false, reason: "exponential barely visible in the window" };
  }
  return { keep: true };
}

export default { legibilityCheck };
