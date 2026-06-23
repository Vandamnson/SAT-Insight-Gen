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
import { drawGraphItem, GRAPH_TASKS } from "./graph.mjs";

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
  // GRAPH tasks (tier C) — construct-backward in graph.mjs: the harness pins the
  // figure, answer, AND distractors; NO LLM (the figure is the source of truth, so
  // there is no text to author or PROVE). The result is marked harness:true.
  if (GRAPH_TASKS.includes(task)) return drawGraphItem(task, band, r);
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

/* ===================== advanced math: quadratics ===================== */
function drawQuadratic(rad, { r, context }) {
  const task = rad.task, ctx = ctxLineMF(context), irr = rad.has_fraction_or_irrational;
  if (task === "solve_factored") return mf(`Write a quadratic equation already in FACTORED form (a product of two linear factors equal to 0); ask for its solution(s). ${irr ? "Use fractional roots (factors like \\((2x-3)\\))." : "Use integer roots."}`, ctx);
  if (task === "solve_by_factoring") return mf(`Write a quadratic equation in standard form \\(ax^2+bx+c=0\\) that factors over the integers; ask for its solutions (the values of the variable).${irr ? " The roots may be fractions." : ""}`, ctx);
  if (task === "solve_formula") return mf(`Write a quadratic equation that does NOT factor over the integers, so the quadratic formula is needed; ask for a solution. ${irr ? "The roots are irrational — give one in exact \\(\\frac{a\\pm\\sqrt{b}}{c}\\) form." : "Choose coefficients giving clean values."}`, ctx);
  if (task === "discriminant") return mf("Write a quadratic equation (optionally with a parameter) and ask HOW MANY real solutions it has, or for the parameter value at which the number of real solutions changes. The answer hinges on the discriminant.", ctx, { mcq: true });
  if (task === "vertex") return mf("Write a quadratic function; ask for a feature determined by its vertex — the maximum or minimum value, or the x-coordinate of the vertex (axis of symmetry).", ctx);
  return mf("Write a situation the student must MODEL as a quadratic equation, then solve for an unknown quantity (a length, a time, a count). The quadratic must arise from the story (area, projectile height, or a product of related quantities) — never pasted on.", ctx);
}

/* ============== advanced math: nonlinear functions & models ============== */
function drawNonlinearModel(rad, { context }) {
  const task = rad.task, ctx = ctxLineMF(context), exp = rad.uses_exponential;
  if (task === "quad_model_use") return mf("Give a QUADRATIC model relating two quantities in context (e.g. height vs. time); ask the student to USE it to find an output for a given input, or an input giving a stated output.", ctx);
  if (task === "exp_model_use") return mf("Give an EXPONENTIAL model in context (a quantity changing by a constant factor/percent per period, \\(y=a\\cdot b^{t}\\)); ask the student to use it to find a value.", ctx);
  if (task === "identify_feature") return mf(`Give ${exp ? "an exponential" : "a quadratic"} FUNCTION as an equation; ask which statement correctly identifies a key feature of its graph (the vertex/maximum, the y-intercept, or the ${exp ? "end behavior / horizontal asymptote" : "zeros"}). Pose it abstractly.`, ctx, { mcq: true });
  if (task === "create_model") return mf(`Describe a situation with ${exp ? "constant-percent growth or decay" : "a quadratic relationship"} between two quantities; ask WHICH equation models it.`, ctx, { mcq: true });
  return mf("Give a quadratic or exponential model in context; ask the student to INTERPRET the meaning of one specific feature (the initial value, the growth/decay factor, or the vertex) in terms of the situation.", ctx, { mcq: true });
}

/* ============== advanced math: polynomial / expression rewriting ============== */
const POLY_DIRECTIVE = {
  combine_like_terms: "Give a polynomial expression with several like terms; ask which expression is equivalent after combining like terms.",
  distribute: "Give a product of a monomial and a polynomial; ask which expression is equivalent after applying the distributive property.",
  factor_gcf: "Give a polynomial whose terms share a common factor; ask which expression results from factoring out the greatest common factor.",
  sum_polynomials: "Give two polynomials; ask which expression is equivalent to their sum or difference.",
  solve_for_variable: "Give a literal equation (a formula relating several variables); ask which expression equals a specified variable when the equation is solved for it.",
  product_mono_bin: "Give the product of a monomial and a binomial; ask which expression is its expanded equivalent.",
  product_bin_bin: "Give the product of two binomials; ask which expression is its expanded equivalent.",
  factor: "Give a quadratic trinomial; ask which factored form is equivalent.",
  choose_form: "Give a quadratic or exponential expression; ask which EQUIVALENT form most clearly displays a stated feature (the zeros, the vertex/extreme value, the y-intercept, or the growth factor).",
};
function drawPolyExpr(rad, { context }) {
  return mf(POLY_DIRECTIVE[rad.task] || POLY_DIRECTIVE.combine_like_terms, ctxLineMF(context), { mcq: true });
}

/* ============== advanced math: radical / rational / nonlinear-system ============== */
function drawRadicalRational(rad, { context }) {
  const task = rad.task, ctx = ctxLineMF(context);
  if (task === "solve_abs_value") return mf("Write an absolute-value equation \\(|ax+b|=c\\) with \\(c>0\\); ask for its solution set (both values).", ctx);
  if (task === "solve_radical") return mf(`Write a radical equation (a square root of a linear expression equal to a value or another expression); ask for the solution.${rad.extraneous_check ? " Choose numbers so that squaring introduces an EXTRANEOUS root the student must reject." : ""}`, ctx);
  if (task === "solve_rational") return mf("Write a rational equation (the variable in a denominator, or two equal fractions) that reduces to a linear or quadratic equation; ask for the solution.", ctx);
  if (task === "nonlinear_system") return mf("Write a system of one LINEAR and one NONLINEAR equation (a line and a parabola, or a line and \\(xy=k\\)); ask for a coordinate value at an intersection.", ctx);
  if (task === "unknown_constant") return mf("Write a problem with one or more nonlinear equations containing an unknown CONSTANT, where a stated condition (a given solution, a repeated/double root, or no real solution) pins the constant; ask for that constant's value.", ctx);
  return mf("Give a complex equation or formula relating several variables (with a square, a root, or a fraction); ask which expression equals a specified variable of interest when solved for it.", ctx, { mcq: true });
}

const DRAWERS = {
  linear_equations_one_variable: drawOneVar,
  linear_equations_two_variables: drawTwoVar,
  systems_of_linear_equations: drawSystem,
  linear_inequalities: drawInequality,
  quadratic_equations: drawQuadratic,
  nonlinear_functions_models: drawNonlinearModel,
  polynomial_expressions: drawPolyExpr,
  radical_rational_equations: drawRadicalRational,
};

// tasks the real SAT poses ABSTRACTLY (bare equation/lines, no scenario) — they ask
// the student to ANALYZE structure, so a real-world story reads as generator output.
// (parallel_perp included: perpendicularity has no meaning on a real-world rate model
// — the blind judge flagged the contextualized version as "conceptually incoherent".)
const ABSTRACT_TASKS = new Set([
  "num_solutions", "missing_coeff", "number_of_solutions", "missing_coefficient", "variable_constants", "parallel_perp",
  // advanced math — solving/rewriting/analysis the real SAT poses with a bare expression (no story)
  "solve_factored", "solve_by_factoring", "solve_formula", "discriminant", "vertex", "identify_feature",
  "combine_like_terms", "distribute", "factor_gcf", "sum_polynomials", "solve_for_variable",
  "product_mono_bin", "product_bin_bin", "factor", "choose_form",
  "solve_abs_value", "solve_radical", "solve_rational", "nonlinear_system", "unknown_constant", "solve_formula",
]);

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
