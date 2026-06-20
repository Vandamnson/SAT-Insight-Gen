/* ============================================================================
   cell.mjs — the harness-side draw (BUILD_SPEC §1). NO LLM. Pins the RADICALS
   (incl. the rubric `task`) to the band and draws the INCIDENTALS — including
   CONCRETE numbers, construct-backward — in code. Covers the FULL Skills-Insight
   algebra attribute set (taxonomy/algebra-attributes.md): solve / create / model
   / interpret / rate-of-change / number-of-solutions / parallel-perp / create-
   from-pairs|table|translation / connect / identify-coeff, plus systems and
   inequalities. Math is emitted as \(...\) LaTeX; currency stays plain text;
   tables as markdown (the adapter renders them).
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { schemaFor, radicalsForBand, nearestRadicals, predictDifficulty } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXTS = (() => { const c = JSON.parse(readFileSync(join(ROOT, "taxonomy", "contexts.json"), "utf8")); return (c.contexts || c).map(String); })();

/* ---- seeded PRNG + helpers ---- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (p, q) => { const g = gcd(p, q) || 1; p /= g; q /= g; if (q < 0) { p = -p; q = -q; } return q === 1 ? String(p) : `${p}/${q}`; };
const R = (p, q = 1) => { const g = gcd(p, q) || 1; let np = p / g, nq = q / g; if (nq < 0) { np = -np; nq = -nq; } return { p: np, q: nq }; };
const radd = (a, b) => R(a.p * b.q + b.p * a.q, a.q * b.q);
const rmul = (a, b) => R(a.p * b.p, a.q * b.q);
const rstr = (x) => (x.q === 1 ? String(x.p) : `${x.p}/${x.q}`);
const term = (b) => (b < 0 ? `- ${-b}` : `+ ${b}`);                      // signed constant: "+ 5" / "- 3"
const DIR_HDR = "USE THESE EXACT NUMBERS (drawn by the harness — do NOT pick your own, do NOT round). Write math in \\(...\\); money as plain $5; tables as markdown.";
const ctxLine = (c) => (c === "none" ? "Keep it abstract (no real-world context)." : `Set it in this context: ${c}.`);
const makeDir = (body, ctx, answer) => `${DIR_HDR}\n- Build the item around:  ${body}\n- ${ctx}\n` +
  (answer != null ? "- Keep the math and the answer EXACTLY as given." : "- Interpretation/modeling item: write exactly 4 options, ONE correct, the others plausible near-misses.");

/* ============================ one-variable ============================ */
function solveNums(rad, v, r, range, band) {
  const [, chi] = range || [2, 12];
  const messy = band >= 3, sg = () => (messy && r() < 0.35 ? -1 : 1), solMax = band <= 1 ? 9 : 12;
  let a = randint(r, 2, band <= 1 ? 9 : chi), b, c, solution;
  if (rad.answer_type === "fraction") {
    b = sg() * randint(r, 1, messy ? 15 : 9);
    do { c = sg() * randint(r, 4, messy ? 40 : 25); } while (((((c - b) % a) + a) % a) === 0);
    solution = frac(c - b, a);
  } else if (Number(rad.n_steps) === 1) {
    solution = sg() * randint(r, 2, solMax);
    if (r() < 0.5) { b = 0; c = a * solution; } else { a = 1; b = sg() * randint(r, 1, band <= 1 ? 9 : 15); c = solution + b; }
  } else { b = sg() * randint(r, 1, 9); solution = sg() * randint(r, 2, solMax); c = a * solution + b; }
  const eq = b === 0 ? `${a}${v} = ${c}` : a === 1 ? `${v} ${term(b)} = ${c}` : `${a}${v} ${term(b)} = ${c}`;
  return { a, b, c, solution: String(solution), eq };
}
function drawOneVar(rad, { r, range, band, varName, context }) {
  const task = rad.task || "solve", v = varName, ctx = ctxLine(context);
  if (task === "num_solutions") {
    const a = randint(r, 2, 9), b = randint(r, 1, 15), outcome = pick(r, ["no solution", "infinitely many solutions", "exactly one solution"]);
    let rhs;
    if (outcome === "no solution") rhs = `${a}${v} ${term(b + randint(r, 1, 9))}`;
    else if (outcome === "infinitely many solutions") rhs = `${a}${v} ${term(b)}`;
    else { let d; do { d = randint(r, 2, 9); } while (d === a); rhs = `${d}${v} ${term(randint(r, 1, 15))}`; }
    const body = `the equation  \\(${a}${v} ${term(b)} = ${rhs}\\); ask HOW MANY solutions it has (answer: ${outcome}).`;
    return { task, answer: outcome, format: "mcq", directive: makeDir(body, ctx, outcome) };
  }
  if (task === "missing_coeff") {
    const a = randint(r, 2, 9), b = randint(r, 1, 12), c = b + randint(r, 1, 9);
    const body = `the equation  \\(${a}${v} ${term(b)} = k${v} ${term(c)}\\); ask for the value of \\(k\\) for which it has NO solution (answer \\(k = ${a}\\)).`;
    return { task, answer: String(a), format: null, directive: makeDir(body, ctx, String(a)) };
  }
  const n = solveNums(rad, v, r, range, band);
  const body = task === "create_solve"
    ? `a context the student must MODEL as an equation equivalent to  \\(${n.eq}\\), then SOLVE (answer \\(${v} = ${n.solution}\\)). The student must set up the equation from the situation.`
    : `the equation  \\(${n.eq}\\); solve for \\(${v}\\) (answer \\(${v} = ${n.solution}\\)).${rad.has_variable_both_sides ? ` Disguise it with a ${v}-term on BOTH sides that simplifies back to this.` : ""}`;
  return { task, ...n, answer: n.solution, format: null, directive: makeDir(body, ctx, n.solution) };
}

/* ============================ two-variable ============================ */
const lineTex = (m, b0) => { const ms = rstr(m), mc = ms === "1" ? "x" : ms === "-1" ? "-x" : `${ms}x`; return `y = ${mc} ${b0 < 0 ? "- " + -b0 : "+ " + b0}`; };
function drawLine(rad, r, band) {
  const sg = () => (band >= 3 && r() < 0.4 ? -1 : 1);
  const m = rad.has_fraction
    ? (() => { const q = pick(r, [2, 3, 4]); let p; do { p = sg() * randint(r, 1, 3 * q); } while (p % q === 0); return R(p, q); })()
    : R(sg() * randint(r, 2, band <= 2 ? 5 : 7));
  return { m, b0: sg() * randint(r, 1, 12) };
}
function drawTwoVar(rad, { r, band, context }) {
  const task = rad.task, ctx = ctxLine(context);
  const { m, b0 } = drawLine(rad, r, band), ms = rstr(m), line = lineTex(m, b0);
  const B = (body) => ({ task, answer: null, format: "mcq", directive: makeDir(body, ctx, null) });
  const A = (body, answer, fmt = null) => ({ task, answer: String(answer), format: fmt, directive: makeDir(body, ctx, answer) });

  // Tier B — interpret / model / connect (MCQ, no pinned numeric answer)
  if (task === "create_equation") return B(`a context with a starting amount and a constant per-unit rate; ask WHICH linear equation models it (the correct one is equivalent to \\(${line}\\)); distractors swap the rate and the starting value or a sign.`);
  if (task === "interpret_io") return B(`a linear model \\(${line}\\) in context; ask the student to INTERPRET the meaning of one input-output pair (a point on the line) in the situation.`);
  if (task === "rate_of_change") return B(`a linear model \\(${line}\\) in context; ask the student to INTERPRET the rate of change (the slope \\(${ms}\\)) in terms of the situation.`);
  if (task === "interpret_part") return B(`a linear model \\(${line}\\) in context; ask what the ${r() < 0.5 ? `slope \\(${ms}\\)` : `y-intercept \\(${b0}\\)`} represents in the situation.`);
  if (task === "connect") { const rows = [0, 1, 2].map((x) => `| ${x} | ${rstr(radd(rmul(m, R(x)), R(b0)))} |`).join("\\n"); return B(`a small markdown table of \\(x,y\\) values on \\(${line}\\):\\n| x | y |\\n| --- | --- |\\n${rows}\\nask which EQUATION matches the table.`); }
  if (task === "identify_coeff") return B(`a context modeled by \\(${line}\\); ask which value in the equation is the coefficient/constant that represents a stated quantity in the situation.`);

  // Tier A — value answers
  if (task === "evaluate") { const x1 = m.q * randint(r, 1, 4); return A(`the line \\(${line}\\); ask for \\(y\\) when \\(x = ${x1}\\) (answer \\(y = ${rstr(radd(rmul(m, R(x1)), R(b0)))}\\)).`, rstr(radd(rmul(m, R(x1)), R(b0)))); }
  if (task === "find_slope") { const q = m.q, x1 = q * randint(r, -1, 1), x2 = x1 + q * randint(r, 1, 4); return A(`a line through \\((${x1}, ${rstr(radd(rmul(m, R(x1)), R(b0)))})\\) and \\((${x2}, ${rstr(radd(rmul(m, R(x2)), R(b0)))})\\); ask for the slope (answer \\(${ms}\\)).`, ms); }
  if (task === "find_intercept") { if (r() < 0.5) return A(`the line \\(${line}\\); ask for its \\(y\\)-intercept (answer \\(${b0}\\)).`, String(b0)); const xi = rstr(rmul(R(-b0), R(m.q, m.p))); return A(`the line \\(${line}\\); ask for its \\(x\\)-intercept (answer \\(x = ${xi}\\)).`, xi); }
  if (task === "solve_given") { const x1 = m.q * randint(r, 1, 3), x2 = x1 + m.q * randint(r, 1, 3); return A(`a line with slope \\(${ms}\\) through \\((${x1}, ${rstr(radd(rmul(m, R(x1)), R(b0)))})\\); ask for \\(y\\) when \\(x = ${x2}\\) (answer \\(y = ${rstr(radd(rmul(m, R(x2)), R(b0)))}\\)).`, rstr(radd(rmul(m, R(x2)), R(b0)))); }

  // Tier A — line-equation answers (MCQ; PROVE re-derives)
  const lineMCQ = (body, answer) => ({ task, answer, format: "mcq", directive: makeDir(body, ctx, answer) });
  if (task === "parallel_perp") {
    const par = r() < 0.5, px = randint(r, -5, 5), py = randint(r, -6, 8), mp = par ? m : R(-m.q, m.p);
    const bp = radd(R(py), rmul(R(-1), rmul(mp, R(px)))), mpS = rstr(mp);
    const ansTex = `y = ${mpS === "1" ? "x" : mpS === "-1" ? "-x" : mpS + "x"} ${bp.p < 0 ? "- " + rstr(R(-bp.p, bp.q)) : "+ " + rstr(bp)}`;
    return lineMCQ(`find the line through \\((${px}, ${py})\\) that is ${par ? "PARALLEL" : "PERPENDICULAR"} to \\(${line}\\) (answer \\(${ansTex}\\)).`, ansTex);
  }
  if (task === "create_from_pairs" || task === "create_from_table" || task === "create_from_translation") {
    const sg = () => (band >= 4 && r() < 0.4 ? -1 : 1), mi = sg() * randint(r, 2, 6), bi = sg() * randint(r, 1, 12);
    const ansTex = `y = ${mi === 1 ? "x" : mi === -1 ? "-x" : mi + "x"} ${bi < 0 ? "- " + -bi : "+ " + bi}`;
    if (task === "create_from_pairs") { const x1 = randint(r, 1, 3), x2 = x1 + randint(r, 1, 3); return lineMCQ(`a line passes through \\((${x1}, ${mi * x1 + bi})\\) and \\((${x2}, ${mi * x2 + bi})\\); ask WHICH equation represents it (answer \\(${ansTex}\\)).`, ansTex); }
    if (task === "create_from_table") { const rows = [0, 1, 2, 3].map((x) => `| ${x} | ${mi * x + bi} |`).join("\\n"); return lineMCQ(`a table of values (include it as markdown in the stem):\\n| x | y |\\n| --- | --- |\\n${rows}\\nask WHICH equation represents the line (answer \\(${ansTex}\\)).`, ansTex); }
    const k = randint(r, 1, 6), up = r() < 0.5, baseB = bi - (up ? k : -k);
    return lineMCQ(`the function \\(f(x) = ${mi === 1 ? "x" : mi + "x"} ${baseB < 0 ? "- " + -baseB : "+ " + baseB}\\) is translated ${up ? "UP" : "DOWN"} ${k} units to form \\(g\\); ask for the equation of \\(g\\) (answer \\(${ansTex}\\)).`, ansTex);
  }
  // fallback (should not hit): treat as evaluate
  const x1 = m.q; return A(`the line \\(${line}\\); ask for \\(y\\) when \\(x = ${x1}\\).`, rstr(radd(rmul(m, R(x1)), R(b0))));
}

/* ============================ systems ============================ */
const lin2 = (a, b, c) => `${a}x ${b < 0 ? "− " + -b : "+ " + b}y = ${c}`;
function drawSystem(rad, { r, band, context }) {
  const sg = () => (r() < 0.45 ? -1 : 1);
  const nz = (lo, hi) => { let v; do { v = sg() * randint(r, lo, hi); } while (v === 0); return v; };
  let a1, b1, a2, b2; do { a1 = nz(1, 6); b1 = nz(1, 6); a2 = nz(1, 6); b2 = nz(1, 6); } while (a1 * b2 - a2 * b1 === 0);
  const det = a1 * b2 - a2 * b1, task = rad.task, ctx = ctxLine(context);
  let answer = null, body = "", format = null;
  if (task === "solve" || task === "create_solve") {
    let x0s, y0s, c1, c2;
    if (rad.has_fraction_solution) { c1 = nz(2, 30); c2 = nz(2, 30); x0s = rstr(R(c1 * b2 - c2 * b1, det)); y0s = rstr(R(a1 * c2 - a2 * c1, det)); }
    else { const x0 = nz(1, 9), y0 = nz(1, 9); c1 = a1 * x0 + b1 * y0; c2 = a2 * x0 + b2 * y0; x0s = String(x0); y0s = String(y0); }
    const which = r() < 0.5 ? "x" : "y"; answer = which === "x" ? x0s : y0s;
    body = `the system  \\(\\{ ${lin2(a1, b1, c1)} ;\\ ${lin2(a2, b2, c2)} \\}\\)${task === "create_solve" ? ", which the student must first SET UP from the context," : ""}; ask for \\(${which}\\) (answer \\(${which} = ${answer}\\)).`;
  } else if (task === "number_of_solutions") {
    const outcome = pick(r, ["one", "none", "infinitely many"]), k = nz(2, 4), c1 = nz(2, 20); let c2;
    if (outcome === "one") { do { a2 = nz(1, 6); b2 = nz(1, 6); } while (a1 * b2 - a2 * b1 === 0); c2 = nz(2, 20); }
    else { a2 = k * a1; b2 = k * b1; c2 = outcome === "infinitely many" ? k * c1 : k * c1 + nz(1, 6); }
    answer = outcome; format = "mcq"; body = `the system  \\(\\{ ${lin2(a1, b1, c1)} ;\\ ${lin2(a2, b2, c2)} \\}\\); ask HOW MANY solutions it has (answer: ${outcome}).`;
  } else { // missing_coefficient
    const c1 = nz(2, 20), bb2 = nz(1, 6), need = (a1 * bb2) / b1;
    if (!Number.isInteger(need)) return drawSystem({ ...rad, task: "solve" }, { r, band, context });
    answer = String(need); body = `the system  \\(\\{ ${lin2(a1, b1, c1)} ;\\ kx ${bb2 < 0 ? "− " + -bb2 : "+ " + bb2}y = ${nz(2, 20)} \\}\\); ask for \\(k\\) so the system has NO solution (answer \\(k = ${need}\\)).`;
  }
  return { task, answer, format, directive: makeDir(body, ctx, answer) };
}

/* ============================ inequalities ============================ */
function drawInequality(rad, { r, band, context, varName }) {
  const task = rad.task, neg = rad.negative_coefficient, ctx = ctxLine(context), v = varName;
  const a = (neg ? -1 : 1) * randint(r, 2, 9), opPos = pick(r, ["<", "\\le", ">", "\\ge"]);
  const B = (body) => ({ task, answer: null, format: "mcq", directive: makeDir(body, ctx, null) });
  if (task === "create_onevar") return B(`a one-quantity constraint context; ask WHICH one-variable linear inequality models it (e.g. \\(${a}${v} ${term(randint(r, 1, 12))} ${opPos} ${randint(r, 10, 40)}\\)); distractors flip the inequality or swap numbers.`);
  if (task === "create_twovar") { const u1 = randint(r, 2, 9), u2 = randint(r, 2, 9), cap = randint(r, 30, 120); return B(`a constraint with two quantities at ${u1} and ${u2} per unit and a limit of ${cap}; ask WHICH two-variable inequality models it (e.g. \\(${u1}x + ${u2}y ${opPos} ${cap}\\)); distractors flip direction or swap coefficients.`); }
  if (task === "variable_constants") return B(`a linear inequality with a PARAMETER (e.g. \\(${a}${v} + k ${opPos} ${randint(r, 5, 30)}\\)); ask for which values of the parameter a stated condition on the solution set holds.`);
  const A = (body, answer) => ({ task, answer: String(answer), format: null, directive: makeDir(body, ctx, answer) });
  if (task === "solve_boundary") {
    const x = randint(r, 2, 12), b = (band >= 3 && r() < 0.4 ? -1 : 1) * randint(r, 1, 20), c = a * x + b;
    const flip = { "<": ">", "\\le": "\\ge", ">": "<", "\\ge": "\\le" };
    const dir = a < 0 ? flip[opPos] : opPos;
    return A(`the inequality \\(${a}${v} ${term(b)} ${opPos} ${c}\\); ask for the BOUNDARY value of \\(${v}\\). Solving gives \\(${v} ${dir} ${x}\\), so the boundary is \\(${v} = ${x}\\).`, x);
  }
  // max_int / min_int — boundary is non-integer; floor/ceil is the answer
  const M = randint(r, 3, 15), rem = randint(r, 1, Math.abs(a) - 1), b = randint(r, 1, 12), c = a * M + (a > 0 ? rem : -rem) + b;
  const want = task === "max_int" ? "GREATEST" : "LEAST", op = task === "max_int" ? (a > 0 ? "<" : ">") : (a > 0 ? ">" : "<");
  return A(`a context giving \\(${a}${v} ${term(b)} ${op} ${c}\\); ask for the ${want} integer value of \\(${v}\\) satisfying it (answer \\(${v} = ${M}\\)).`, M);
}

const DRAWERS = {
  linear_equations_one_variable: drawOneVar,
  linear_equations_two_variables: drawTwoVar,
  systems_of_linear_equations: drawSystem,
  linear_inequalities: drawInequality,
};

/* ============================ the draw ============================ */
export function drawCell(domain, subdomain, band, idx = 0) {
  const { dom, sub } = schemaFor(domain, subdomain);
  const bandStr = typeof band === "number" ? `B${band}` : band, bandNum = Number(bandStr.slice(1));
  const r = rng(`${domain}|${subdomain}|${bandStr}|${idx}`);
  const matches = radicalsForBand(domain, subdomain, bandStr);
  const radicals = matches.length ? matches[Math.floor(r() * matches.length)] : nearestRadicals(domain, subdomain, bandStr);
  const ia = sub.incidental_axes;
  const ctxList = ia.context === "@contexts" ? CONTEXTS : (ia.context || []);
  const useContext = "from_context" in radicals ? radicals.from_context === true : r() >= (ia.context_none_weight ?? 0);
  const context = useContext && ctxList.length ? pick(r, ctxList) : "none";
  const varName = pick(r, ia.var_name);
  const numbers = (DRAWERS[subdomain] || drawOneVar)(radicals, { r, range: ia.coefficient_range, band: bandNum, varName, context });
  const format = numbers.format || (r() < 0.6 ? "spr" : "mcq");
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
