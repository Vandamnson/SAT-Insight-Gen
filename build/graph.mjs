/* ============================================================================
   graph.mjs — construct-backward generator for ABSTRACT linear GRAPH items (Tier C).

   Graphs invert model-first: the FIGURE is the source of truth, so the harness pins
   the figure, the answer, AND (for MCQ) the distractors — every item is correct BY
   CONSTRUCTION. No LLM is involved (canonical phrasing, $0, instant). The selector
   guards drawer bugs (figureCheck = figure self-consistency) and readability
   (legibility gate); it never re-derives a "trusted" answer because there is no text
   to trust — the value lives in the pixels.

   drawGraphItem(task, band, r) -> a COMPLETE candidate the pipeline gates without
   authoring: { task, format, answer, statement, choices?, correct_choice?,
   solve_path, fingerprint, figure:{fn:"coordPlane", spec}, harness:true }.
   ============================================================================ */

export const GRAPH_TASKS = ["read_value", "slope_from_points", "connect_graph", "system_read", "system_count", "inequality_region", "parallel_perp_graph"];

/* ---- small helpers ---- */
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const sgn = (r) => (r() < 0.5 ? -1 : 1);
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }

/* exact rational slope {p,q}, q>0, reduced */
function frac(p, q) { if (q < 0) { p = -p; q = -q; } const g = gcd(p, q); return { p: p / g, q: q / g }; }
const isInt = (f) => f.q === 1;
const fval = (f) => f.p / f.q;
const fmtNum = (f) => (isInt(f) ? String(f.p) : (f.p < 0 ? "-" : "") + `\\frac{${Math.abs(f.p)}}{${f.q}}`);
/* griddable plain value for SPR ("p/q" or integer) */
const plainNum = (f) => (isInt(f) ? String(f.p) : `${f.p}/${f.q}`);

/* "<coef>x" for a slope */
function coefTex(f) {
  if (isInt(f)) return f.p === 1 ? "x" : f.p === -1 ? "-x" : `${f.p}x`;
  return `${f.p < 0 ? "-" : ""}\\frac{${Math.abs(f.p)}}{${f.q}}x`;
}
/* "y = <coef>x ± b" with rational slope + rational intercept */
function lineTexR(slope, bF) {
  let s = `y = ${coefTex(slope)}`;
  if (bF.p === 0) return s;
  const sign = bF.p < 0 ? "-" : "+";
  const mag = frac(Math.abs(bF.p), bF.q);
  return `${s} ${sign} ${fmtNum(mag)}`;
}
const lineTex = (m, b) => lineTexR(frac(m, 1), frac(b, 1));
const tex = (s) => `\\(${s}\\)`;
const slopeClass = (f) => `${fval(f) > 0 ? "pos" : "neg"}_${isInt(f) ? "int" : "frac"}`;

/* shuffle into 4 distinct choices. `correct` + `distractors` are FINAL strings
   (caller tex-wraps math, leaves text plain — mcq does NOT wrap). De-dups against
   the key + each other; throws if it can't field 4 distinct options (a builder bug). */
function mcq(correct, distractors, r) {
  const four = [{ t: correct, ok: true }];
  const seen = new Set([correct]);
  for (const d of distractors) { if (four.length >= 4) break; if (!seen.has(d)) { seen.add(d); four.push({ t: d, ok: false }); } }
  if (four.length < 4) throw new Error(`mcq: only ${four.length} distinct choices for "${correct}"`);
  for (let i = four.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [four[i], four[j]] = [four[j], four[i]]; }
  return { choices: four.map((c) => c.t), correct_choice: "ABCD"[four.findIndex((c) => c.ok)] };
}

const sp = (...steps) => steps.map((d, i) => ({ step: i + 1, op: d.op, detail: d.detail }));

/* ---- window: fit all lines + points; slope-sized; integer ticks ---- */
function frameFor(lines, points = [], extraX = []) {
  const X = Math.min(7, Math.max(3, ...points.map((p) => Math.abs(p[0]) + 1), ...extraX.map((x) => Math.abs(x) + 1)));
  const xmin = -X, xmax = X;
  const ys = [0, ...points.map((p) => p[1]), ...lines.map((L) => L.b)];
  for (const L of lines) ys.push(fval(L.f) * xmin + L.b, fval(L.f) * xmax + L.b);
  let ymin = Math.floor(Math.min(...ys)) - 1, ymax = Math.ceil(Math.max(...ys)) + 1;
  if (ymax - ymin > 16) { const c = Math.round((ymax + ymin) / 2); ymin = c - 8; ymax = c + 8; }
  const step = Math.max(xmax - xmin, ymax - ymin) > 12 ? 2 : 1;
  return { xRange: [xmin, xmax], yRange: [ymin, ymax], xStep: step, yStep: step, origin: true, axisLabels: ["x", "y"] };
}
const lineCurve = (m, b, opts = {}) => ({ type: "line", m, b, ...opts });

/* ============================ the tasks ============================ */

function gReadValue(r) {
  const m = sgn(r) * randint(r, 1, 3), f = frac(m, 1);
  const feature = pick(r, ["yint", "xint", "point", "slope"]);
  let b, answer, ask, points = [], detail, sub = feature;
  if (feature === "xint") {
    const xi = sgn(r) * randint(r, 1, 4); b = -m * xi; answer = String(xi);
    ask = "What is the \\(x\\)-coordinate of the \\(x\\)-intercept of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) crosses the \\(x\\)-axis at \\((${xi}, 0)\\).`;
  } else if (feature === "point") {
    b = sgn(r) * randint(r, 0, 5); const px = sgn(r) * randint(r, 1, 4), py = m * px + b; answer = String(py);
    points = [[px, py]];
    ask = "Point \\(P\\) is shown on line \\(\\ell\\). What is the \\(y\\)-coordinate of \\(P\\)?";
    detail = `Read \\(P = (${px}, ${py})\\) off the graph.`;
  } else if (feature === "slope") {
    b = sgn(r) * randint(r, 0, 5); answer = String(m);
    ask = "What is the slope of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) rises \\(${m}\\) for every \\(1\\) unit increase in \\(x\\).`;
  } else {
    b = sgn(r) * randint(r, 1, 6); answer = String(b);
    ask = "What is the \\(y\\)-coordinate of the \\(y\\)-intercept of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) crosses the \\(y\\)-axis at \\((0, ${b})\\).`;
  }
  const spec = frameFor([{ f, b }], points);
  spec.curves = [lineCurve(m, b)];
  if (points.length) spec.points = points.map(([x, y]) => ({ at: [x, y], label: "P" }));
  return {
    task: "read_value", format: "spr", answer,
    statement: `The graph of line \\(\\ell\\) in the \\(xy\\)-plane is shown. ${ask}`,
    solve_path: sp({ op: "read_graph", detail }),
    fingerprint: ["read_value", slopeClass(f), sub, "1line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gSlopeFromPoints(r) {
  const m = sgn(r) * randint(r, 1, 3), dx = pick(r, [1, 2, 3]);
  const x1 = sgn(r) * randint(r, 1, 3), y1 = sgn(r) * randint(r, 1, 4);
  const x2 = x1 + dx, y2 = y1 + m * dx, f = frac(y2 - y1, x2 - x1);
  const spec = frameFor([{ f: frac(m, 1), b: y1 - m * x1 }], [[x1, y1], [x2, y2]]);
  spec.curves = [lineCurve(m, y1 - m * x1)];
  spec.points = [{ at: [x1, y1], label: "P" }, { at: [x2, y2], label: "Q" }];
  return {
    task: "slope_from_points", format: "spr", answer: plainNum(f),
    statement: "The line shown in the \\(xy\\)-plane passes through points \\(P\\) and \\(Q\\). What is the slope of the line?",
    solve_path: sp({ op: "slope_from_two_points", detail: `Slope \\(= \\frac{${y2} - (${y1})}{${x2} - (${x1})} = ${plainNum(f)}\\).` }),
    fingerprint: ["slope_from_points", slopeClass(f), "slope", "1line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gConnectGraph(r) {
  const m = sgn(r) * randint(r, 1, 3), b = sgn(r) * randint(r, 1, 6);
  const correct = tex(lineTex(m, b));
  const distractors = [tex(lineTex(-m, b)), tex(lineTex(m, -b)), tex(lineTex(-m, -b))];
  const { choices, correct_choice } = mcq(correct, distractors, r);
  const spec = frameFor([{ f: frac(m, 1), b }]); spec.curves = [lineCurve(m, b)];
  return {
    task: "connect_graph", format: "mcq", answer: correct, choices, correct_choice,
    statement: "Which equation represents the line shown in the \\(xy\\)-plane?",
    solve_path: sp({ op: "read_slope_intercept", detail: `Slope \\(${m}\\), \\(y\\)-intercept \\(${b}\\): \\(${correct}\\).` }),
    fingerprint: ["connect_graph", slopeClass(frac(m, 1)), "equation", "1line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gSystemRead(r) {
  const sx = sgn(r) * randint(r, 1, 4), sy = sgn(r) * randint(r, 1, 5);
  let m1 = sgn(r) * randint(r, 1, 3), m2; do { m2 = sgn(r) * randint(r, 1, 3); } while (m2 === m1);
  const b1 = sy - m1 * sx, b2 = sy - m2 * sx;
  const spec = frameFor([{ f: frac(m1, 1), b: b1 }, { f: frac(m2, 1), b: b2 }], [[sx, sy]]);
  spec.curves = [lineCurve(m1, b1), lineCurve(m2, b2)];
  spec.points = [{ at: [sx, sy], label: "P" }];
  const askPair = r() < 0.5;
  if (askPair) {
    const correct = tex(`(${sx}, ${sy})`);
    const { choices, correct_choice } = mcq(correct, [tex(`(${sy}, ${sx})`), tex(`(${-sx}, ${sy})`), tex(`(${sx}, ${-sy})`), tex(`(${-sx}, ${-sy})`)], r);
    return {
      task: "system_read", format: "mcq", answer: correct, choices, correct_choice,
      statement: "The graphs of two lines in the \\(xy\\)-plane intersect at the point \\(P\\) shown. What is the solution \\((x, y)\\) of the system?",
      solve_path: sp({ op: "read_intersection", detail: `The lines meet at \\(P = (${sx}, ${sy})\\).` }),
      fingerprint: ["system_read", "mixed", "pair", "2line"],
      figure: { fn: "coordPlane", spec },
    };
  }
  return {
    task: "system_read", format: "spr", answer: String(sx),
    statement: "The graphs of two lines in the \\(xy\\)-plane intersect at the point \\(P\\) shown. What is the \\(x\\)-coordinate of the solution to the system?",
    solve_path: sp({ op: "read_intersection", detail: `The lines meet at \\(P = (${sx}, ${sy})\\).` }),
    fingerprint: ["system_read", "mixed", "xcoord", "2line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gSystemCount(r) {
  const none = r() < 0.5;
  let curves, lines;
  if (none) {                                   // parallel: equal slope, distinct intercept
    const m = sgn(r) * randint(r, 1, 3), b1 = sgn(r) * randint(r, 1, 5); let b2; do { b2 = sgn(r) * randint(r, 1, 5); } while (b2 === b1);
    lines = [{ f: frac(m, 1), b: b1 }, { f: frac(m, 1), b: b2 }]; curves = [lineCurve(m, b1), lineCurve(m, b2)];
  } else {                                      // intersecting
    const sx = sgn(r) * randint(r, 1, 3), sy = sgn(r) * randint(r, 1, 4);
    let m1 = sgn(r) * randint(r, 1, 3), m2; do { m2 = sgn(r) * randint(r, 1, 3); } while (m2 === m1);
    lines = [{ f: frac(m1, 1), b: sy - m1 * sx }, { f: frac(m2, 1), b: sy - m2 * sx }]; curves = [lineCurve(m1, lines[0].b), lineCurve(m2, lines[1].b)];
  }
  const spec = frameFor(lines); spec.curves = curves;
  const correct = none ? "No solution" : "Exactly one solution";
  const { choices, correct_choice } = mcq(correct, ["Exactly one solution", "No solution", "Infinitely many solutions", "Exactly two solutions"].filter((x) => x !== correct).slice(0, 3), r);
  return {
    task: "system_count", format: "mcq", answer: correct, choices, correct_choice,
    statement: "The graphs of the two lines of a system of linear equations are shown in the \\(xy\\)-plane. How many solutions \\((x, y)\\) does the system have?",
    solve_path: sp({ op: "compare_lines", detail: none ? "The lines are parallel (equal slope, different intercepts), so they never meet." : "The lines have different slopes, so they meet at exactly one point." }),
    fingerprint: ["system_count", none ? "parallel" : "intersect", "count", "2line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gInequalityRegion(r) {
  const m = sgn(r) * randint(r, 1, 3), b = sgn(r) * randint(r, 1, 5), f = frac(m, 1);
  const above = r() < 0.5, strict = r() < 0.5;
  const ineq = above ? (strict ? ">" : ">=") : (strict ? "<" : "<=");
  const opTex = above ? (strict ? ">" : "\\ge") : (strict ? "<" : "\\le");
  const correct = `y ${opTex} ${coefTex(f)}${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ""}`;
  const flipOp = above ? (strict ? "<" : "\\le") : (strict ? ">" : "\\ge");
  const tail = `${coefTex(f)}${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ""}`;
  const distractors = [
    `y ${flipOp} ${tail}`,                                            // wrong direction
    `y ${opTex} ${coefTex(frac(-m, 1))}${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ""}`,   // flipped slope sign
    `y ${opTex} ${coefTex(f)}${-b > 0 ? ` + ${-b}` : -b < 0 ? ` - ${b}` : ""}`,           // flipped intercept
  ];
  const { choices, correct_choice } = mcq(tex(correct), distractors.map(tex), r);
  const spec = frameFor([{ f, b }]);
  spec.curves = [lineCurve(m, b, { dash: strict })];
  spec.shaded = { m, b, ineq };
  return {
    task: "inequality_region", format: "mcq", answer: tex(correct), choices, correct_choice,
    statement: "The shaded region in the \\(xy\\)-plane is the graph of which inequality?",
    solve_path: sp({ op: "read_region", detail: `Boundary \\(y = ${tail}\\) (${strict ? "dashed → strict" : "solid → inclusive"}); the shaded side is ${above ? "above" : "below"} it.` }),
    fingerprint: ["inequality_region", slopeClass(f), above ? "above" : "below", strict ? "strict" : "incl"],
    figure: { fn: "coordPlane", spec },
  };
}

function gParallelPerp(r) {
  const kind = pick(r, ["parallel", "perpendicular"]);
  // exclude slope ±1 (its negative reciprocal is also ±1, which collapses distractors)
  const m = pick(r, [2, -2, 3, -3]), bL = sgn(r) * randint(r, 1, 5);
  const qx = sgn(r) * randint(r, 1, 4); let qy; do { qy = sgn(r) * randint(r, 1, 6); } while (qy === m * qx + bL);
  const through = (slope) => frac(qy * slope.q - slope.p * qx, slope.q);   // intercept of a line of `slope` through (qx,qy)
  const par = frac(m, 1), perp = frac(-1, m);
  const slope = kind === "parallel" ? par : perp;
  const bF = through(slope);
  const correct = lineTexR(slope, bF);
  const bump = frac(bF.p + bF.q, bF.q);   // bF + 1, a guaranteed-distinct intercept fallback
  const distractors = kind === "parallel"
    ? [lineTexR(perp, through(perp)), lineTexR(frac(-m, 1), through(frac(-m, 1))), lineTexR(par, frac(bL, 1)), lineTexR(par, bump)]
    : [lineTexR(par, through(par)), lineTexR(frac(1, m), through(frac(1, m))), lineTexR(perp, frac(bL, 1)), lineTexR(perp, bump)];
  const { choices, correct_choice } = mcq(tex(correct), distractors.map(tex), r);
  const spec = frameFor([{ f: frac(m, 1), b: bL }]); spec.curves = [lineCurve(m, bL)];
  return {
    task: "parallel_perp_graph", format: "mcq", answer: tex(correct), choices, correct_choice,
    statement: `Line \\(\\ell\\) is shown in the \\(xy\\)-plane. Which equation represents the line that passes through the point \\((${qx}, ${qy})\\) and is ${kind} to line \\(\\ell\\)?`,
    solve_path: sp(
      { op: kind === "parallel" ? "apply_parallel" : "apply_perpendicular", detail: `Line \\(\\ell\\) has slope \\(${m}\\); the ${kind} slope is \\(${fmtNum(slope)}\\).` },
      { op: "point_slope", detail: `Through \\((${qx}, ${qy})\\): \\(${correct}\\).` },
    ),
    fingerprint: ["parallel_perp_graph", kind, slopeClass(slope), "1line"],
    figure: { fn: "coordPlane", spec },
  };
}

const BUILDERS = {
  read_value: gReadValue,
  slope_from_points: gSlopeFromPoints,
  connect_graph: gConnectGraph,
  system_read: gSystemRead,
  system_count: gSystemCount,
  inequality_region: gInequalityRegion,
  parallel_perp_graph: gParallelPerp,
};

/** drawGraphItem(task, band, r) — a complete, correct-by-construction graph candidate.
 *  `band` is accepted for signature symmetry (difficulty is set by the cell's LLTM task
 *  weight, not here). Marks the result `harness:true` so the pipeline skips the LLM. */
export function drawGraphItem(task, band, r) {
  const build = BUILDERS[task] || gReadValue;
  const item = build(r);
  return { ...item, harness: true };
}

export default { drawGraphItem, GRAPH_TASKS };
