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
// nonlinear curves (ADV-2)
const quads = (spec) => (spec.curves || []).filter((c) => c.type === "quadratic");
const exps = (spec) => (spec.curves || []).filter((c) => c.type === "exponential");
const onQuad = (c, x, y) => Math.abs(c.a * x * x + c.b * x + c.c - y) < 1e-6;
const onExp = (c, x, y) => Math.abs(c.a * Math.pow(c.b, x) + (c.k || 0) - y) < 1e-6 * Math.max(1, Math.abs(y));
const vtxOf = (c) => { const h = -c.b / (2 * c.a); return [h, c.a * h * h + c.b * h + c.c]; };
const NONLINEAR = new Set(["read_yint", "read_feature", "interpret_feature_graph", "connect_translation_graph"]);

export function figureCheck(cell) {
  const num0 = cell?.incidentals?.numbers;

  // "which graph" items (Phase B): the ANSWER OPTIONS are figures. Distractor-
  // validity — EXACTLY ONE option figure matches the target equation/inequality,
  // it is the keyed one, and the other three measurably differ.
  if (num0?.optionFigures) {
    const opts = num0.optionFigures, t = num0.target || {}, ci = "ABCD".indexOf(num0.correct_choice);
    if (opts.length !== 4) return { keep: false, reason: `expected 4 option figures, got ${opts.length}` };
    if (ci < 0 || ci > 3) return { keep: false, reason: `bad correct_choice "${num0.correct_choice}"` };
    const matches = (spec) => {
      if (t.kind === "parabola") {   // graph_from_eq (parabola): match leading sign + vertex
        const q = (spec.curves || []).find((c) => c.type === "quadratic"); if (!q) return false;
        const [h, k] = vtxOf(q); return q.a === t.a && Math.abs(h - t.h) < EPS && Math.abs(k - t.k) < EPS;
      }
      if (t.kind === "exp") {        // graph_from_eq (exponential): match coefficient, base, asymptote
        const e = (spec.curves || []).find((c) => c.type === "exponential"); if (!e) return false;
        return e.a === t.a && e.b === t.b && (e.k || 0) === (t.k || 0);
      }
      const cs = (spec.curves || []).filter((c) => c.type === "line");
      if (t.lines) {   // system_to_graph: the line SET must match (unordered)
        return cs.length === t.lines.length
          && t.lines.every((tl) => cs.some((c) => c.m === tl.m && c.b === tl.b))
          && cs.every((c) => t.lines.some((tl) => tl.m === c.m && tl.b === c.b));
      }
      const c = cs[0];
      if (!c || c.m !== t.m || c.b !== t.b) return false;
      if (t.ineq !== undefined) return !!spec.shaded && spec.shaded.ineq === t.ineq && spec.shaded.m === t.m && spec.shaded.b === t.b;
      return true;
    };
    const hit = opts.map((s, i) => (matches(s) ? i : -1)).filter((i) => i >= 0);
    if (hit.length !== 1) return { keep: false, reason: `${hit.length} option figures match the target (need exactly 1)` };
    if (hit[0] !== ci) return { keep: false, reason: `correct_choice is ${num0.correct_choice} but the matching graph is option ${"ABCD"[hit[0]]}` };
    return { keep: true };
  }

  // 3D-solid figure items (GEO-2): a labeled prism/cube — verify the labels yield the answer.
  if (num0?.figure?.fn === "prism") return checkPrism(cell.incidentals.numbers);

  const fig = num0?.figure;
  if (!fig || fig.fn !== "coordPlane") return { keep: false, reason: "graph item missing coordPlane figure" };
  const spec = fig.spec;
  const num = cell.incidentals.numbers, task = num.task;

  // nonlinear graph tasks (ADV-2): parabola / exponential — no line required
  if (NONLINEAR.has(task)) return checkNonlinear(task, num, spec);

  const ls = lines(spec);
  if (!ls.length) return { keep: false, reason: "graph figure has no line" };
  for (const c of ls) if (typeof c.m !== "number" || typeof c.b !== "number") return { keep: false, reason: "line missing m/b" };

  // "which point is a solution" (point_in_region / feasible_region): the figure shows
  // the shaded region(s); the OPTIONS are points. Each region's boundary must be drawn,
  // and EXACTLY ONE option point must satisfy every region — the keyed one.
  if (num.regions) {
    const regions = num.regions;
    const shaded = Array.isArray(spec.shaded) ? spec.shaded : (spec.shaded ? [spec.shaded] : []);
    if (shaded.length !== regions.length) return { keep: false, reason: `${shaded.length} shaded vs ${regions.length} regions` };
    for (const rg of regions) if (!ls.some((c) => c.m === rg.m && c.b === rg.b)) return { keep: false, reason: `region boundary m=${rg.m} b=${rg.b} not drawn` };
    const sat = (p) => regions.every((rg) => { const v = p[1] - (rg.m * p[0] + rg.b); return (rg.ineq === ">" || rg.ineq === ">=") ? v > 1e-9 : v < -1e-9; });
    const ci = "ABCD".indexOf(num.correct_choice);
    const hits = (num.optionPoints || []).map((p, i) => (sat(p) ? i : -1)).filter((i) => i >= 0);
    if (hits.length !== 1) return { keep: false, reason: `${hits.length} option points satisfy all regions (need exactly 1)` };
    if (hits[0] !== ci) return { keep: false, reason: `correct_choice ${num.correct_choice} but the solution point is option ${"ABCD"[hits[0]]}` };
    return { keep: true };
  }

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
    // a marked intersection (when present) is verified by the generic point loop above;
    // an unmarked one is a visible integer lattice point by construction.
  }

  if (task === "inequality_region") {
    if (!spec.shaded) return { keep: false, reason: "inequality_region has no shaded region" };
    const { m, b } = spec.shaded;
    if (!ls.some((c) => c.m === m && c.b === b)) return { keep: false, reason: "boundary line does not match the shaded line" };
  }

  return { keep: true };
}

/* ADV-2 nonlinear single-figure self-consistency (parabola / exponential). The answer is
   known by construction; this guards drawer bugs: the asked feature is actually the
   figure's feature, and any marked point lies on a drawn curve. */
function checkNonlinear(task, num, spec) {
  const qs = quads(spec), es = exps(spec), ls = lines(spec);
  if (!qs.length && !es.length) return { keep: false, reason: "nonlinear graph has no parabola/exponential curve" };
  const okChoice = ["A", "B", "C", "D"].includes(num.correct_choice);

  if (task === "read_yint") {
    const curve = qs[0] || es[0];
    const yint = qs.length ? curve.c : curve.a + (curve.k || 0);   // parabola: c; exponential: a + k
    if (String(yint) !== String(num.answer)) return { keep: false, reason: `figure y-intercept ${yint} != answer ${num.answer}` };
    return { keep: true };
  }

  if (task === "read_feature") {
    for (const p of (spec.points || [])) {     // every marked point lies on a drawn curve
      const on = qs.some((c) => onQuad(c, p.at[0], p.at[1])) || es.some((c) => onExp(c, p.at[0], p.at[1])) || ls.some((c) => onLine(c, p.at[0], p.at[1]));
      if (!on) return { keep: false, reason: `marked point ${JSON.stringify(p.at)} off every curve` };
    }
    const ans = Number(num.answer), fp = num.fingerprint || [];
    if (fp.includes("vertex")) {
      const [h, k] = vtxOf(qs[0]);
      if (ans !== h && ans !== k) return { keep: false, reason: `vertex answer ${ans} is neither h=${h} nor k=${k}` };
    } else if (fp.includes("zero")) {
      if (!qs.length || Math.abs(qs[0].a * ans * ans + qs[0].b * ans + qs[0].c) > 1e-6) return { keep: false, reason: `x=${ans} is not a zero of the parabola` };
    } else if (fp.includes("intersection")) {
      const L = ls[0];
      if (!L || !qs.length) return { keep: false, reason: "intersection feature needs a line and a parabola" };
      const yL = L.m * ans + L.b, yQ = qs[0].a * ans * ans + qs[0].b * ans + qs[0].c;
      if (Math.abs(yL - yQ) > 1e-6) return { keep: false, reason: `x=${ans} is not an intersection (line ${yL} vs parabola ${yQ})` };
    }
    return { keep: true };
  }

  if (task === "interpret_feature_graph") {   // text-choice MCQ; correct_choice set by construction
    if (!okChoice) return { keep: false, reason: `bad correct_choice "${num.correct_choice}"` };
    return { keep: true };
  }

  if (task === "connect_translation_graph") {  // drawn parabola's vertex+leading must equal the keyed equation's
    const t = num.target || {};
    if (!qs.length) return { keep: false, reason: "connect item has no parabola" };
    const [h, k] = vtxOf(qs[0]);
    if (qs[0].a !== t.a || Math.abs(h - t.h) > EPS || Math.abs(k - t.k) > EPS) return { keep: false, reason: `drawn vertex (${h},${k},a=${qs[0].a}) != target (${t.h},${t.k},a=${t.a})` };
    if (!okChoice) return { keep: false, reason: `bad correct_choice "${num.correct_choice}"` };
    return { keep: true };
  }
  return { keep: true };
}

/* GEO-2 prism/cube self-consistency: the labeled edge lengths must yield the stated
   volume / surface area / solved dimension. Correct by construction; this guards drawer bugs. */
function checkPrism(num) {
  const d = num.figure?.spec?.dims;
  if (!d || ![d.l, d.w, d.h].every(Number.isFinite)) return { keep: false, reason: "prism missing numeric dims" };
  const { l, w, h } = d, ans = Number(num.answer), t = num.task;
  let ok = true;
  if (t === "prism_volume_fig") ok = l * w * h === ans;
  else if (t === "cube_fig") ok = l === w && w === h && (ans === l ** 3 || ans === 6 * l * l);
  else if (t === "prism_surface_fig") ok = 2 * (l * w + l * h + w * h) === ans;
  else if (t === "prism_solve_dim_fig") ok = h === ans;
  return ok ? { keep: true } : { keep: false, reason: `prism ${t}: dims ${l}×${w}×${h} don't yield answer ${ans}` };
}

export default { figureCheck };
