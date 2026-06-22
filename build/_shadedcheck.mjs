// graph-cop regression guard for SHADED inequality regions. Renders coordPlane for
// every (slope × side × strict) combo, parses the actual fig-fill polygon, UN-projects
// it to world coords, and independently verifies every vertex + the centroid lies on
// the correct side of y = mx+b. Catches the steep-boundary clamp bug. `node build/_shadedcheck.mjs`.
import { coordPlane } from "../figures/figures.js";

function projector(spec) {                       // inverse of coordPlane's sx/sy (margin 32, plot 270, equal scale)
  const [xmin, xmax] = spec.xRange, [ymin, ymax] = spec.yRange;
  const unit = (spec.plot || 270) / Math.max((xmax - xmin) || 1, (ymax - ymin) || 1);
  const L = spec.margin || 32, B = (spec.margin || 32) + (ymax - ymin) * unit;
  return { ux: (X) => (X - L) / unit + xmin, uy: (Y) => ymin + (B - Y) / unit };
}
const parseFill = (svg) => { const m = svg.match(/<polygon points="([^"]+)" class="fig-fill"/); return m ? m[1].trim().split(/\s+/).map((p) => p.split(",").map(Number)) : null; };

let bad = 0, n = 0;
for (const m of [1, 2, 3, -1, -2, -3]) for (const ineq of [">", ">=", "<", "<="]) for (const b of [-3, 2, 4]) {
  n++;
  const strict = ineq === ">" || ineq === "<";
  const spec = { xRange: [-6, 6], yRange: [-6, 6], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"], curves: [{ type: "line", m, b, dash: strict }], shaded: { m, b, ineq } };
  const poly = parseFill(coordPlane(spec));
  const tag = `m=${m} b=${b} ${ineq}`;
  if (!poly || poly.length < 3) { console.error(`✗ ${tag}: no/degenerate fill polygon (${poly?.length || 0} pts)`); bad++; continue; }
  const pr = projector(spec), above = ineq === ">" || ineq === ">=";
  const side = (x, y) => (above ? y - (m * x + b) : (m * x + b) - y);   // >= 0 ⇒ correctly inside the shaded half-plane
  const world = poly.map(([X, Y]) => [pr.ux(X), pr.uy(Y)]);
  const offside = world.find(([x, y]) => side(x, y) < -0.05);
  if (offside) { console.error(`✗ ${tag}: vertex (${offside[0].toFixed(1)}, ${offside[1].toFixed(1)}) is on the WRONG side (side=${side(...offside).toFixed(2)})`); bad++; continue; }
  const cx = world.reduce((a, p) => a + p[0], 0) / world.length, cy = world.reduce((a, p) => a + p[1], 0) / world.length;
  if (side(cx, cy) < -0.05) { console.error(`✗ ${tag}: centroid (${cx.toFixed(1)}, ${cy.toFixed(1)}) on the wrong side`); bad++; }
}
console.log(bad ? `\nSHADED CHECK FAILED: ${bad}/${n}` : `shaded-region check: all ${n} half-planes correct ✓`);
process.exit(bad ? 1 : 0);
