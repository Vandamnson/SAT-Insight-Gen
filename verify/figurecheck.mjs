/* ============================================================================
   figurecheck.mjs — SELECTOR Tier C, per-type figure SELF-CONSISTENCY.

   Graph items are construct-backward (answer known by construction), so there is no
   text to PROVE. This guards drawer bugs: it asserts the coordPlane spec is internally
   consistent for its task — marked points lie on their line(s), a system's intersection
   lies on BOTH lines (or parallel lines are truly parallel), an inequality's boundary
   matches its shaded region, and a system's pinned count matches its geometry.
   Pure (spec-level, no SVG render). Generalizes the old single-curve figureCheck.
   ============================================================================ */

const EPS = 1e-9;
const lines = (spec) => (spec.curves || []).filter((c) => c.type === "line");
const onLine = (c, x, y) => Math.abs(c.m * x + c.b - y) < EPS;

export function figureCheck(cell) {
  const fig = cell?.incidentals?.numbers?.figure;
  if (!fig || fig.fn !== "coordPlane") return { keep: false, reason: "graph item missing coordPlane figure" };
  const spec = fig.spec, ls = lines(spec);
  if (!ls.length) return { keep: false, reason: "graph figure has no line" };
  for (const c of ls) if (typeof c.m !== "number" || typeof c.b !== "number") return { keep: false, reason: "line missing m/b" };

  const num = cell.incidentals.numbers, task = num.task;

  // marked points must lie on a line; a system's intersection on BOTH lines
  for (const p of (spec.points || [])) {
    const hits = ls.filter((c) => onLine(c, p.at[0], p.at[1])).length;
    if (hits === 0) return { keep: false, reason: `point ${JSON.stringify(p.at)} off every line` };
    if (task === "system_read" && hits < 2) return { keep: false, reason: `intersection ${JSON.stringify(p.at)} not on both lines` };
  }

  if (task === "system_count") {
    if (ls.length !== 2) return { keep: false, reason: "system needs exactly 2 lines" };
    const [a, b] = ls, parallel = a.m === b.m;
    if (parallel && a.b === b.b) return { keep: false, reason: "two identical lines (degenerate)" };
    if (parallel && num.answer !== "No solution") return { keep: false, reason: "parallel lines but answer != 'No solution'" };
    if (!parallel && num.answer !== "Exactly one solution") return { keep: false, reason: "intersecting lines but answer != 'Exactly one solution'" };
  }

  if (task === "system_read") {
    if (ls.length !== 2) return { keep: false, reason: "system needs exactly 2 lines" };
    if (ls[0].m === ls[1].m) return { keep: false, reason: "system lines are parallel (no unique solution)" };
    if (!(spec.points || []).length) return { keep: false, reason: "system_read has no marked intersection" };
  }

  if (task === "inequality_region") {
    if (!spec.shaded) return { keep: false, reason: "inequality_region has no shaded region" };
    const { m, b } = spec.shaded;
    if (!ls.some((c) => c.m === m && c.b === b)) return { keep: false, reason: "boundary line does not match the shaded line" };
  }

  return { keep: true };
}

export default { figureCheck };
