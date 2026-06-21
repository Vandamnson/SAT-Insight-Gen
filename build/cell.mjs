/* ============================================================================
   cell.mjs — the harness-side draw (BUILD_SPEC §1). NO LLM. Pins the RADICALS
   (incl. the rubric `task`) to the band, draws the INCIDENTALS (context — without
   replacement; format) in code, and emits a MODEL-FIRST structure directive: the
   harness fixes the difficulty-determining STRUCTURE, but the author invents a
   natural situation and chooses fitting numbers (an independent checker re-derives
   the answer; the LLTM gates the band off the radicals). This keeps items
   authentic — the equation arises from the story instead of a story being pasted
   onto a pre-pinned equation. Graph tasks (read_graph/connect_graph) stay
   harness-pinned: the harness draws the coordPlane figure and the answer.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { schemaFor, radicalsForBand, nearestRadicals, predictDifficulty } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXTS = (() => { const c = JSON.parse(readFileSync(join(ROOT, "taxonomy", "contexts.json"), "utf8")); return (c.contexts || c).map(String); })();

// WITHOUT-REPLACEMENT context rotation: hand out a shuffled context per contextual
// item so the same scenario never repeats within a run. Reshuffles only after the
// whole pool is consumed; the shuffle is randomized per run for cross-run variety.
let CTX_ORDER = null, ctxCursor = 0;
function shuffledContexts() { const a = CONTEXTS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function nextContext() { if (!CTX_ORDER || ctxCursor >= CTX_ORDER.length) { CTX_ORDER = shuffledContexts(); ctxCursor = 0; } return CTX_ORDER[ctxCursor++]; }

// coverage-aware TASK selection: among the band-valid radical combos, prefer the
// task used LEAST so far this run (tie-break random), so a subdomain's draws cycle
// through its distinct skills before repeating — fixes skill-element clustering.
const taskUsage = {};
function pickRadicals(matches, subdomain, r) {
  const byTask = {}; for (const m of matches) (byTask[m.task ?? "_"] ||= []).push(m);
  const tasks = Object.keys(byTask);
  const used = (tk) => taskUsage[`${subdomain}:${tk}`] || 0;
  const minU = Math.min(...tasks.map(used));
  const leastUsed = tasks.filter((tk) => used(tk) === minU);
  const chosen = leastUsed[Math.floor(r() * leastUsed.length)];
  taskUsage[`${subdomain}:${chosen}`] = used(chosen) + 1;
  const pool = byTask[chosen];
  return pool[Math.floor(r() * pool.length)];
}

/* ---- seeded PRNG + helpers ---- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/* ---- model-first directive helpers ---- */
const MF_HDR = "Build a NATURAL, self-consistent SAT-style item. Choose your OWN realistic numbers (avoid 0 and 1 as coefficients; favor varied, non-round values). Write all math as LaTeX in \\(...\\); money as plain $5; tables as markdown. An independent checker re-derives your answer from the statement, so it must be correct and unambiguous.";
const GRAPH_HDR = "A coordinate-plane graph is rendered separately for this item (you do NOT draw it; do NOT restate its data or equation in prose). Write math as LaTeX in \\(...\\).";
const ctxLineMF = (c) => (c === "none"
  ? "Pose it directly as an abstract problem (no real-world story)."
  : `Ground it in a believable, specific situation about: ${c}. The math must genuinely ARISE from the situation — never paste the context onto a bare equation.`);
const mf = (body, ctx, { mcq = false } = {}) => ({ answer: null, format: mcq ? "mcq" : null, directive: `${MF_HDR}\n- ${body}\n- ${ctx}${mcq ? "\n- Multiple choice: exactly 4 options, ONE correct, three plausible near-misses." : ""}` });
const ansType = (rad) => (rad.answer_type === "fraction" ? "a fraction in lowest terms" : "a clean integer");

/* ============================ one-variable ============================ */
function oneVarStruct(rad) {
  const s = [Number(rad.n_steps) === 1 ? "solvable in a single step" : Number(rad.n_steps) === 2 ? "needing two solve steps" : "needing several solve steps"];
  if (rad.has_variable_both_sides) s.push("with the variable on BOTH sides");
  if (rad.has_fractions) s.push("with a fractional coefficient");
  return s.join(", ");
}
function drawOneVar(rad, { context }) {
  const task = rad.task || "solve", ctx = ctxLineMF(context);
  if (task === "num_solutions") return mf("Write a one-variable linear equation, then ask HOW MANY solutions it has (no solution / exactly one / infinitely many). Make the count hinge on structure — e.g. the variable on both sides so the variable terms can cancel.", ctx, { mcq: true });
  if (task === "missing_coeff") return mf("Write a one-variable linear equation containing an UNKNOWN coefficient (a parameter such as k); ask for the value of that parameter that makes the equation have NO solution (or infinitely many).", ctx);
  const body = task === "create_solve"
    ? `Write a problem in which the student must MODEL the situation as a one-variable linear equation (${oneVarStruct(rad)}) and then solve it; the solution is ${ansType(rad)}. The equation must follow from the quantities in the story.`
    : `Write a one-variable linear equation to solve (${oneVarStruct(rad)}); the solution is ${ansType(rad)}.`;
  return mf(body, ctx);
}

/* ============================ two-variable ============================ */
// coordPlane spec for a graph item: a tight integer window sized to the slope so
// the whole line, the y-intercept, and any marked point are on-screen and readable.
function coordSpec(m, b0, pt) {
  const am = Math.abs(m) || 1;
  let X = Math.max(3, Math.min(6, Math.round((8 - Math.abs(b0)) / am)));
  if (pt) X = Math.max(X, Math.abs(pt[0]) + 1);
  const xmin = -X, xmax = X;
  const yv = [m * xmin + b0, m * xmax + b0, b0, 0, ...(pt ? [pt[1]] : [])];
  let ymin = Math.floor(Math.min(...yv)) - 1, ymax = Math.ceil(Math.max(...yv)) + 1;
  if (ymax - ymin > 18) { const c = Math.round((ymax + ymin) / 2); ymin = c - 9; ymax = c + 9; }
  const step = Math.max(xmax - xmin, ymax - ymin) > 14 ? 2 : 1;
  const spec = { xRange: [xmin, xmax], yRange: [ymin, ymax], xStep: step, yStep: step, origin: true, axisLabels: ["x", "y"], curves: [{ type: "line", m, b: b0 }] };
  if (pt) spec.points = [{ at: pt, label: "P" }];
  return spec;
}
const TWOVAR_MCQ = new Set(["create_equation", "interpret_io", "rate_of_change", "interpret_part", "parallel_perp", "create_from_pairs", "create_from_table", "create_from_translation", "connect", "identify_coeff"]);
function drawTwoVar(rad, { r, band, context }) {
  const task = rad.task, ctx = ctxLineMF(context), fr = rad.has_fraction ? " Use a fractional slope/rate." : "";
  // GRAPH tasks (tier C) — harness draws the figure AND pins the answer.
  if (task === "read_graph") {
    const mi = (band >= 4 && r() < 0.4 ? -1 : 1) * randint(r, 1, 3), bi = (r() < 0.4 ? -1 : 1) * randint(r, 1, 6);
    const readY = r() < 0.5; let answer, pt = null, ask;
    if (readY) { answer = String(bi); ask = "ask for the y-coordinate where line ℓ crosses the y-axis (its y-intercept)"; }
    else { const px = randint(r, 1, 3) * (r() < 0.5 ? -1 : 1), py = mi * px + bi; pt = [px, py]; answer = String(py); ask = `point P is marked at (${px}, ${py}) on the line — ask for the y-coordinate of P`; }
    return { task, answer, format: null, directive: `${GRAPH_HDR}\n- A graph of line ℓ is shown; the value must be READ off the graph.\n- ${ask}; the answer is ${answer}.`, figure: { fn: "coordPlane", spec: coordSpec(mi, bi, pt) } };
  }
  if (task === "connect_graph") {
    const mi = (band >= 4 && r() < 0.4 ? -1 : 1) * randint(r, 1, 3), bi = (r() < 0.4 ? -1 : 1) * randint(r, 1, 6);
    const ansTex = `y = ${mi === 1 ? "x" : mi === -1 ? "-x" : mi + "x"} ${bi < 0 ? "- " + -bi : "+ " + bi}`;
    return { task, answer: ansTex, format: "mcq", directive: `${GRAPH_HDR}\n- A graph of a line is shown. Ask WHICH equation represents it (answer \\(${ansTex}\\)); 4 options varying the slope sign and the intercept.`, figure: { fn: "coordPlane", spec: coordSpec(mi, bi, null) } };
  }
  // model-first for the computational + interpretive tasks
  const T = {
    evaluate: `a linear relationship in context defined by a starting value and a constant rate; ask for the output at a specific input.${fr}`,
    find_slope: `a linear relationship in context given by two input-output data points; ask for the rate of change (slope).${fr}`,
    find_intercept: `a linear relationship in context; ask for its ${r() < 0.5 ? "starting value (y-intercept)" : "x-intercept (the input where the output is 0)"}.${fr}`,
    solve_given: `a linear relationship where a rate and one data point are given; ask for the output at a different input.${fr}`,
    create_equation: "a situation with a starting amount and a constant per-unit rate; ask WHICH equation models it.",
    interpret_io: "a linear model in context; ask the student to INTERPRET the meaning of one specific input-output pair in the situation.",
    rate_of_change: "a linear model in context; ask the student to INTERPRET the rate of change (the slope) in terms of the situation.",
    interpret_part: "a linear model in context; ask what a named part (the slope or the y-intercept) represents in the situation.",
    parallel_perp: `give a line and a point not on it; ask for the equation of the line through that point ${r() < 0.5 ? "PARALLEL" : "PERPENDICULAR"} to the given line.`,
    create_from_pairs: "give two input-output pairs; ask which equation represents the line through them.",
    create_from_table: "give a small markdown table of (x, y) values lying on a line; ask which equation represents it (include the table in the stem).",
    create_from_translation: "give a linear function and a vertical translation (up or down by k units); ask for the equation of the translated function.",
    connect: "give a linear function as a small markdown table of (x, y) values; ask which equation matches it (include the table).",
    identify_coeff: "a contextual linear model; ask which value in the equation represents a stated quantity in the situation.",
  };
  return mf(T[task] || T.evaluate, ctx, { mcq: TWOVAR_MCQ.has(task) });
}

/* ============================ systems ============================ */
function drawSystem(rad, { context }) {
  const task = rad.task, ctx = ctxLineMF(context), fr = rad.has_fraction_solution ? " The solution may be a fraction." : "";
  if (task === "number_of_solutions") return mf("Write a system of two linear equations in two variables and ask HOW MANY solutions it has (one / none / infinitely many). The answer should require comparing the two equations, not guessing.", ctx, { mcq: true });
  if (task === "missing_coefficient") return mf("Write a 2x2 linear system in which one coefficient is an UNKNOWN parameter; ask for the value of that parameter that makes the system have NO solution (or infinitely many).", ctx);
  const body = task === "create_solve"
    ? `Write a TWO-quantity situation the student must model as a system of two linear equations, then solve for one of the quantities.${fr}`
    : `Write a system of two linear equations in two variables and ask for the value of one variable.${fr}`;
  return mf(body, ctx);
}

/* ============================ inequalities ============================ */
function drawInequality(rad, { context }) {
  const task = rad.task, ctx = ctxLineMF(context), neg = rad.negative_coefficient ? " Use a negative coefficient on the variable (so the inequality direction flips when dividing)." : "";
  if (task === "create_onevar") return mf("Write a one-quantity constraint situation and ask WHICH one-variable linear inequality models it.", ctx, { mcq: true });
  if (task === "create_twovar") return mf("Write a constraint with TWO quantities (each with a per-unit value, against a combined limit); ask WHICH two-variable linear inequality models it.", ctx, { mcq: true });
  if (task === "variable_constants") return mf("Write a linear inequality containing a PARAMETER (an unknown constant); ask for which parameter values a stated condition on the solution set holds.", ctx, { mcq: true });
  if (task === "solve_boundary") return mf(`Write a one-variable linear inequality; ask for the BOUNDARY value of the variable (where the two sides are equal).${neg}`, ctx);
  const want = task === "max_int" ? "GREATEST" : "LEAST";
  return mf(`Write a constraint giving a one-variable linear inequality whose solution is a range; ask for the ${want} INTEGER value of the variable satisfying it. Choose numbers so the boundary is NOT an integer (so the floor/ceiling is unambiguous).${neg}`, ctx);
}

const DRAWERS = {
  linear_equations_one_variable: drawOneVar,
  linear_equations_two_variables: drawTwoVar,
  systems_of_linear_equations: drawSystem,
  linear_inequalities: drawInequality,
};

// tasks the real SAT poses ABSTRACTLY (bare equation, no scenario) — they ask the
// student to ANALYZE equation structure, so dressing them in a real-world story
// reads as generator output. Force context off for these.
const ABSTRACT_TASKS = new Set(["num_solutions", "missing_coeff", "number_of_solutions", "missing_coefficient", "variable_constants"]);

/* ============================ the draw ============================ */
export function drawCell(domain, subdomain, band, idx = 0) {
  const { dom, sub } = schemaFor(domain, subdomain);
  const bandStr = typeof band === "number" ? `B${band}` : band, bandNum = Number(bandStr.slice(1));
  const r = rng(`${domain}|${subdomain}|${bandStr}|${idx}`);
  const matches = radicalsForBand(domain, subdomain, bandStr);
  let radicals = matches.length ? pickRadicals(matches, subdomain, r) : nearestRadicals(domain, subdomain, bandStr);
  const ia = sub.incidental_axes;
  const ctxList = ia.context === "@contexts" ? CONTEXTS : (ia.context || []);
  const forceAbstract = ABSTRACT_TASKS.has(radicals.task);   // structure-analysis tasks → no scenario (match the real SAT)
  if (forceAbstract && radicals.from_context) radicals = { ...radicals, from_context: false };   // keep the LLTM consistent
  const useContext = forceAbstract ? false : ("from_context" in radicals ? radicals.from_context === true : r() >= (ia.context_none_weight ?? 0));
  const context = useContext && ctxList.length ? (ctxList === CONTEXTS ? nextContext() : pick(r, ctxList)) : "none";
  const varName = pick(r, ia.var_name);
  const numbers = (DRAWERS[subdomain] || drawOneVar)(radicals, { r, range: ia.coefficient_range, band: bandNum, varName, context });
  // value-answer tasks roll SPR vs MCQ; the many forced-MCQ tasks (interpretive,
  // which-equation, how-many-solutions) already skew the pool toward MCQ, so the
  // value tasks lean ~45% SPR to land the whole set near the SAT's ~75/25 mix.
  const format = numbers.format || (r() < 0.45 ? "spr" : "mcq");
  const tier = (sub.task_tier || {})[radicals.task] || dom.tier || "A";
  return {
    domain, subdomain, target: sub.target, band: bandNum,
    statementId: (sub.statementByBand || {})[bandStr] || null,
    radicals, incidentals: { context, var_name: varName, format, numbers }, tier,
    predicted_scale: predictDifficulty(radicals, domain, subdomain),
    canonical_fingerprint: sub.canonical_fingerprint || [], op_vocab: sub.op_vocab || [],
  };
}

export default { drawCell };
