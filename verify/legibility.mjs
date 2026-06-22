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
  return { keep: true };
}

export default { legibilityCheck };
