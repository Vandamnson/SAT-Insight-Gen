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

export const GRAPH_TASKS = ["read_value", "slope_from_points", "connect_graph", "system_read", "system_count", "inequality_region", "parallel_perp_graph", "equation_to_graph", "inequality_to_graph", "system_to_graph", "point_in_region", "feasible_region", "interpret_graph_context"];

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

/* ---- STANDARD window — every graph reads as one family: a SYMMETRIC SQUARE
   window centred on the origin, unit grid. ±6 (step 1) is the canonical look;
   ±10 (step 2) is used ONLY when a feature that must be visible would fall outside
   ±6. Same canvas size either way (the renderer fixes the plot width and scales
   equally on both axes). Pass the feature points that MUST be on-screen — lines
   themselves clip to the window, as on the real test. ---- */
function standardFrame(featurePts = []) {
  const mx = Math.max(0, ...featurePts.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])]));
  const W = mx <= 6 ? 6 : 10, step = W <= 6 ? 1 : 2;
  return { xRange: [-W, W], yRange: [-W, W], xStep: step, yStep: step, origin: true, axisLabels: ["x", "y"] };
}
const lineCurve = (m, b, opts = {}) => ({ type: "line", m, b, ...opts });

/* ============================ the tasks ============================ */

function gReadValue(r) {
  const m = sgn(r) * randint(r, 1, 3), f = frac(m, 1);
  const feature = pick(r, ["yint", "xint", "point", "slope"]);
  let b, answer, ask, points = [], detail, sub = feature;
  let feat;
  if (feature === "xint") {
    const xi = sgn(r) * randint(r, 1, 4); b = -m * xi; answer = String(xi); feat = [[xi, 0]];
    ask = "What is the \\(x\\)-coordinate of the \\(x\\)-intercept of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) crosses the \\(x\\)-axis at \\((${xi}, 0)\\).`;
  } else if (feature === "point") {
    const px = sgn(r) * randint(r, 1, 3), py = sgn(r) * randint(r, 1, 6); b = py - m * px; answer = String(py);
    points = [[px, py]]; feat = [[px, py]];
    ask = "Point \\(P\\) is shown on line \\(\\ell\\). What is the \\(y\\)-coordinate of \\(P\\)?";
    detail = `Read \\(P = (${px}, ${py})\\) off the graph.`;
  } else if (feature === "slope") {
    b = sgn(r) * randint(r, 0, 5); answer = String(m); feat = [[0, b]];
    ask = "What is the slope of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) rises \\(${m}\\) for every \\(1\\) unit increase in \\(x\\).`;
  } else {
    b = sgn(r) * randint(r, 1, 6); answer = String(b); feat = [[0, b]];
    ask = "What is the \\(y\\)-coordinate of the \\(y\\)-intercept of line \\(\\ell\\)?";
    detail = `Line \\(\\ell\\) crosses the \\(y\\)-axis at \\((0, ${b})\\).`;
  }
  const spec = standardFrame(feat);
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
  const dx = pick(r, [2, 3]), dy = sgn(r) * randint(r, 1, 4);   // dy not a multiple of dx ⇒ fractional slopes too
  const x1 = sgn(r) * randint(r, 1, 2), y1 = sgn(r) * randint(r, 1, 2);
  const x2 = x1 + dx, y2 = y1 + dy, f = frac(dy, dx);
  const m = dy / dx, b = y1 - m * x1;
  const spec = standardFrame([[x1, y1], [x2, y2]]);
  spec.curves = [lineCurve(m, b)];
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
  const spec = standardFrame([[0, b]]); spec.curves = [lineCurve(m, b)];
  return {
    task: "connect_graph", format: "mcq", answer: correct, choices, correct_choice,
    statement: "Which equation represents the line shown in the \\(xy\\)-plane?",
    solve_path: sp({ op: "read_slope_intercept", detail: `Slope \\(${m}\\), \\(y\\)-intercept \\(${b}\\): \\(${correct}\\).` }),
    fingerprint: ["connect_graph", slopeClass(frac(m, 1)), "equation", "1line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gSystemRead(r) {
  const sx = sgn(r) * randint(r, 1, 4), sy = sgn(r) * randint(r, 1, 4);
  let m1 = sgn(r) * randint(r, 1, 3), m2; do { m2 = sgn(r) * randint(r, 1, 3); } while (m2 === m1);
  const b1 = sy - m1 * sx, b2 = sy - m2 * sx;
  const mark = r() < 0.5;                       // ~half mark the intersection P; ~half leave it to be READ off the graph (the more common SAT form)
  const spec = standardFrame([[sx, sy]]);
  spec.curves = [lineCurve(m1, b1), lineCurve(m2, b2)];
  if (mark) spec.points = [{ at: [sx, sy], label: "P" }];
  const where = mark ? "intersect at the point \\(P\\) shown" : "are shown";
  const fpMark = mark ? "marked" : "unmarked";
  const askPair = r() < 0.5;
  if (askPair) {
    const correct = tex(`(${sx}, ${sy})`);
    const { choices, correct_choice } = mcq(correct, [tex(`(${sy}, ${sx})`), tex(`(${-sx}, ${sy})`), tex(`(${sx}, ${-sy})`), tex(`(${-sx}, ${-sy})`)], r);
    return {
      task: "system_read", format: "mcq", answer: correct, choices, correct_choice,
      statement: `The graphs of the two equations in a system of linear equations ${where} in the \\(xy\\)-plane. What is the solution \\((x, y)\\) to the system?`,
      solve_path: sp({ op: "read_intersection", detail: `The lines meet at \\((${sx}, ${sy})\\).` }),
      fingerprint: ["system_read", fpMark, "pair", "2line"],
      figure: { fn: "coordPlane", spec },
    };
  }
  return {
    task: "system_read", format: "spr", answer: String(sx),
    statement: `The graphs of the two equations in a system of linear equations ${where} in the \\(xy\\)-plane. What is the \\(x\\)-coordinate of the solution to the system?`,
    solve_path: sp({ op: "read_intersection", detail: `The lines meet at \\((${sx}, ${sy})\\).` }),
    fingerprint: ["system_read", fpMark, "xcoord", "2line"],
    figure: { fn: "coordPlane", spec },
  };
}

function gSystemCount(r) {
  const none = r() < 0.5;
  let curves, feats;
  if (none) {                                   // parallel: equal slope, distinct intercept
    const m = sgn(r) * randint(r, 1, 3), b1 = sgn(r) * randint(r, 1, 5); let b2; do { b2 = sgn(r) * randint(r, 1, 5); } while (b2 === b1);
    curves = [lineCurve(m, b1), lineCurve(m, b2)]; feats = [[0, b1], [0, b2]];
  } else {                                      // intersecting
    const sx = sgn(r) * randint(r, 1, 3), sy = sgn(r) * randint(r, 1, 4);
    let m1 = sgn(r) * randint(r, 1, 3), m2; do { m2 = sgn(r) * randint(r, 1, 3); } while (m2 === m1);
    curves = [lineCurve(m1, sy - m1 * sx), lineCurve(m2, sy - m2 * sx)]; feats = [[sx, sy]];
  }
  const spec = standardFrame(feats); spec.curves = curves;
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
  const spec = standardFrame([[0, b]]);
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
  const spec = standardFrame([[0, bL]]); spec.curves = [lineCurve(m, bL)];
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

/* ===== "which graph" items — the ANSWER OPTIONS are figures (Phase B) ===== */
const lineSpec = (m, b) => { const s = standardFrame([[0, b]]); s.curves = [lineCurve(m, b)]; return s; };
const ineqSpec = (m, b, ineq, strict) => { const s = standardFrame([[0, b]]); s.curves = [lineCurve(m, b, { dash: strict })]; s.shaded = { m, b, ineq }; return s; };
const sysSpec = (lns) => { const s = standardFrame(lns.map((L) => [0, L.b])); s.curves = lns.map((L) => lineCurve(L.m, L.b)); return s; };
function mcqFigures(correctSpec, distractorSpecs, r) {
  const four = [{ spec: correctSpec, ok: true }, ...distractorSpecs.map((spec) => ({ spec, ok: false }))].slice(0, 4);
  for (let i = four.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [four[i], four[j]] = [four[j], four[i]]; }
  return { optionFigures: four.map((c) => c.spec), correct_choice: "ABCD"[four.findIndex((c) => c.ok)] };
}

function gEquationToGraph(r) {
  const m = sgn(r) * randint(r, 1, 3), b = sgn(r) * randint(r, 1, 4);
  const { optionFigures, correct_choice } = mcqFigures(lineSpec(m, b), [lineSpec(-m, b), lineSpec(m, -b), lineSpec(-m, -b)], r);
  return {
    task: "equation_to_graph", format: "mcq", correct_choice, answer: tex(lineTex(m, b)),
    statement: `Which of the following graphs in the \\(xy\\)-plane represents the equation \\(${lineTex(m, b)}\\)?`,
    optionFigures, target: { m, b }, figure: null,
    solve_path: sp({ op: "match_graph", detail: `The line has slope \\(${m}\\) and \\(y\\)-intercept \\(${b}\\).` }),
    fingerprint: ["equation_to_graph", slopeClass(frac(m, 1)), b > 0 ? "bpos" : "bneg", "4opt"],
  };
}

function gInequalityToGraph(r) {
  const m = sgn(r) * randint(r, 1, 3), b = sgn(r) * randint(r, 1, 4);
  const above = r() < 0.5, strict = r() < 0.5;
  const ineq = above ? (strict ? ">" : ">=") : (strict ? "<" : "<=");
  const opTex = above ? (strict ? ">" : "\\ge") : (strict ? "<" : "\\le");
  const flip = above ? (strict ? "<" : "<=") : (strict ? ">" : ">=");        // opposite-side distractor
  const tail = `${coefTex(frac(m, 1))}${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ""}`;
  const { optionFigures, correct_choice } = mcqFigures(
    ineqSpec(m, b, ineq, strict),
    [ineqSpec(m, b, flip, strict), ineqSpec(-m, b, ineq, strict), ineqSpec(m, -b, ineq, strict)], r);
  return {
    task: "inequality_to_graph", format: "mcq", correct_choice, answer: tex(`y ${opTex} ${tail}`),
    statement: `Which of the following graphs represents the inequality \\(y ${opTex} ${tail}\\) in the \\(xy\\)-plane?`,
    optionFigures, target: { m, b, ineq }, figure: null,
    solve_path: sp({ op: "match_region", detail: `Boundary \\(y = ${tail}\\) (${strict ? "dashed" : "solid"}); shade ${above ? "above" : "below"} it.` }),
    fingerprint: ["inequality_to_graph", slopeClass(frac(m, 1)), above ? "above" : "below", "4opt"],
  };
}

function gSystemToGraph(r) {
  let m1 = sgn(r) * randint(r, 1, 3), m2; do { m2 = sgn(r) * randint(r, 1, 3); } while (m2 === m1);
  const b1 = sgn(r) * randint(r, 1, 4), b2 = sgn(r) * randint(r, 1, 4);
  const L = [{ m: m1, b: b1 }, { m: m2, b: b2 }];
  const distractors = [                                  // each flips ONE feature of ONE line ⇒ a different line-set
    sysSpec([{ m: -m1, b: b1 }, { m: m2, b: b2 }]),
    sysSpec([{ m: m1, b: -b1 }, { m: m2, b: b2 }]),
    sysSpec([{ m: m1, b: b1 }, { m: -m2, b: b2 }]),
  ];
  const { optionFigures, correct_choice } = mcqFigures(sysSpec(L), distractors, r);
  return {
    task: "system_to_graph", format: "mcq", correct_choice, answer: tex(`${lineTex(m1, b1)}, \\ ${lineTex(m2, b2)}`),
    statement: `Which of the following graphs in the \\(xy\\)-plane represents the system of equations \\(${lineTex(m1, b1)}\\) and \\(${lineTex(m2, b2)}\\)?`,
    optionFigures, target: { lines: L }, figure: null,
    solve_path: sp({ op: "match_system", detail: `Two lines: slope \\(${m1}\\), intercept \\(${b1}\\); and slope \\(${m2}\\), intercept \\(${b2}\\).` }),
    fingerprint: ["system_to_graph", `${slopeClass(frac(m1, 1))}|${slopeClass(frac(m2, 1))}`, "graph", "2line4opt"],
  };
}

/* ===== "which point is a solution" — region figure, POINT options (gaps #4/#5) ===== */
const ptStr = (p) => `(${p[0]}, ${p[1]})`;
const inHalf = (p, rg) => { const v = p[1] - (rg.m * p[0] + rg.b); return (rg.ineq === ">" || rg.ineq === ">=") ? v > 0 : v < 0; };
const offBoundary = (p, regions) => regions.every((rg) => Math.abs(p[1] - (rg.m * p[0] + rg.b)) >= 1);   // ≥1 unit off each boundary (clean, unambiguous)
function regionFig(regions) {
  const s = standardFrame([[0, regions[0].b], [0, regions[regions.length - 1].b]]);
  s.curves = regions.map((rg) => lineCurve(rg.m, rg.b, { dash: rg.strict }));
  s.shaded = regions.map((rg) => ({ m: rg.m, b: rg.b, ineq: rg.ineq }));
  return s;
}
/* pick 1 lattice point inside ALL regions + 3 outside ≥1 of them, all off-boundary; null if it can't */
function pickPoints(r, regions) {
  const grid = [];
  for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) grid.push([x, y]);
  const off = grid.filter((p) => offBoundary(p, regions));
  const inside = off.filter((p) => regions.every((rg) => inHalf(p, rg)));
  const outside = off.filter((p) => !regions.every((rg) => inHalf(p, rg)));
  if (inside.length < 1 || outside.length < 3) return null;
  const correct = pick(r, inside), pool = outside.slice(), outs = [];
  while (outs.length < 3 && pool.length) outs.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return { correct, distractors: outs };
}
/* shuffle point options, keeping choices ↔ optionPoints aligned */
function shufflePoints(correct, distractors, r) {
  const cands = [{ pt: correct, ok: true }, ...distractors.map((pt) => ({ pt, ok: false }))];
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  return { choices: cands.map((c) => tex(ptStr(c.pt))), optionPoints: cands.map((c) => c.pt), correct_choice: "ABCD"[cands.findIndex((c) => c.ok)] };
}

function gPointInRegion(r) {
  let regions, pts, t = 0;
  do {
    const m = sgn(r) * randint(r, 1, 2), b = sgn(r) * randint(r, 1, 3), above = r() < 0.5, strict = r() < 0.5;
    regions = [{ m, b, ineq: above ? (strict ? ">" : ">=") : (strict ? "<" : "<="), strict }];
    pts = pickPoints(r, regions);
  } while (!pts && ++t < 30);
  const { choices, optionPoints, correct_choice } = shufflePoints(pts.correct, pts.distractors, r);
  return {
    task: "point_in_region", format: "mcq", choices, correct_choice, optionPoints, regions,
    answer: tex(ptStr(pts.correct)),
    statement: "The shaded region in the \\(xy\\)-plane is the graph of a linear inequality. Which of the following points is a solution to the inequality?",
    figure: { fn: "coordPlane", spec: regionFig(regions) },
    solve_path: sp({ op: "test_point", detail: `Only \\(${ptStr(pts.correct)}\\) lies in the shaded region.` }),
    fingerprint: ["point_in_region", slopeClass(frac(regions[0].m, 1)), regions[0].ineq.includes(">") ? "above" : "below", "1region"],
  };
}

function gFeasibleRegion(r) {
  let regions, pts, t = 0;
  do {
    const m1 = sgn(r) * randint(r, 1, 2); let m2; do { m2 = sgn(r) * randint(r, 1, 2); } while (m2 === m1);
    const s1 = r() < 0.5, s2 = r() < 0.5;
    regions = [
      { m: m1, b: sgn(r) * randint(r, 1, 3), ineq: s1 ? ">=" : "<=", strict: false },
      { m: m2, b: sgn(r) * randint(r, 1, 3), ineq: s2 ? ">=" : "<=", strict: false },
    ];
    pts = pickPoints(r, regions);
  } while (!pts && ++t < 40);
  if (!pts) { regions = [{ m: 1, b: -2, ineq: ">=", strict: false }, { m: -1, b: 2, ineq: "<=", strict: false }]; pts = pickPoints(r, regions); }   // guaranteed-feasible fallback
  const { choices, optionPoints, correct_choice } = shufflePoints(pts.correct, pts.distractors, r);
  return {
    task: "feasible_region", format: "mcq", choices, correct_choice, optionPoints, regions,
    answer: tex(ptStr(pts.correct)),
    statement: "The graph shows the solution region of a system of two linear inequalities in the \\(xy\\)-plane. Which of the following points is a solution to the system?",
    figure: { fn: "coordPlane", spec: regionFig(regions) },
    solve_path: sp({ op: "test_point", detail: `Only \\(${ptStr(pts.correct)}\\) satisfies BOTH inequalities (lies in the overlap).` }),
    fingerprint: ["feasible_region", `${regions[0].ineq}|${regions[1].ineq}`, "system", "2region"],
  };
}

/* ===== contextual interpret-a-graph (Phase C) — construct-backward templates ===== */
const CTX = [   // y-quantity has NO leading article (templates add it); all INCREASING ⇒ positive slope/intercept is plausible
  { y: "total cost", yu: "dollars", x: "hours", xu: "hour" },
  { y: "amount of water in a tank", yu: "liters", x: "minutes", xu: "minute" },
  { y: "distance from the starting line", yu: "meters", x: "seconds", xu: "second" },
  { y: "balance of an account", yu: "dollars", x: "weeks", xu: "week" },
  { y: "height of a seedling", yu: "centimeters", x: "days", xu: "day" },
  { y: "amount of data stored", yu: "gigabytes", x: "months", xu: "month" },
  { y: "number of subscribers", yu: "subscribers", x: "weeks", xu: "week" },
  { y: "total savings", yu: "dollars", x: "months", xu: "month" },
];
const uq = (n, u) => (n === 1 ? u.replace(/s$/, "") : u);   // singular unit for a value of 1
function gInterpretGraphContext(r) {
  const c = pick(r, CTX), m = randint(r, 2, 4); let b; do { b = randint(r, 1, 5); } while (b === m);   // positive ⇒ plausible increasing model; b≠m so distractors stay distinct
  const askSlope = r() < 0.5;
  const correct = askSlope
    ? `The ${c.y} increases by ${m} ${uq(m, c.yu)} for each additional ${c.xu}.`
    : `Before any ${c.x} have passed, the ${c.y} is ${b} ${uq(b, c.yu)}.`;
  const distractors = askSlope
    ? [`The ${c.y} increases by ${b} ${uq(b, c.yu)} for each additional ${c.xu}.`, `The initial ${c.y} is ${m} ${uq(m, c.yu)}.`, `After ${m} ${c.x}, the ${c.y} is ${b} ${uq(b, c.yu)}.`]
    : [`Before any ${c.x} have passed, the ${c.y} is ${m} ${uq(m, c.yu)}.`, `The ${c.y} increases by ${b} ${uq(b, c.yu)} for each additional ${c.xu}.`, `The ${c.y} increases by ${m} ${uq(m, c.yu)} for each additional ${c.xu}.`];
  const { choices, correct_choice } = mcq(correct, distractors, r);
  const spec = standardFrame([[0, b]]); spec.curves = [lineCurve(m, b)];
  return {
    task: "interpret_graph_context", format: "mcq", choices, correct_choice, answer: correct,
    statement: `The graph shown models the ${c.y}, \\(y\\), in ${c.yu}, after \\(x\\) ${c.x}. What does the ${askSlope ? "slope" : "\\(y\\)-intercept"} of the line represent?`,
    figure: { fn: "coordPlane", spec },
    solve_path: sp({ op: "interpret_part", detail: askSlope ? `Slope \\(${m}\\) = the change in ${c.y} per ${c.xu}.` : `\\(y\\)-intercept \\(${b}\\) = the ${c.y} at \\(x = 0\\).` }),
    fingerprint: ["interpret_graph_context", askSlope ? "slope" : "intercept", "context", "1line"],
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
  equation_to_graph: gEquationToGraph,
  inequality_to_graph: gInequalityToGraph,
  system_to_graph: gSystemToGraph,
  point_in_region: gPointInRegion,
  feasible_region: gFeasibleRegion,
  interpret_graph_context: gInterpretGraphContext,
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
