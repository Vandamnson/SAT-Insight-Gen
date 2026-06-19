/* ============================================================================
   cell.mjs — the harness-side draw (BUILD_SPEC §1). NO LLM. For one slot it pins
   the RADICALS to the requested band (via the LLTM) and draws the INCIDENTALS —
   including CONCRETE numbers, construct-backward — in code. Varying incidentals =
   surface variety (a reskin, same band); varying radicals = real novelty / a
   different band. We never let the model pick either (BUILD_SPEC §8) — that
   re-collapses to the canonical instance. Variety comes from code, here.

   Per-subdomain number drawers pin the answer + the structural givens; the author
   only disguises + contextualizes; PROVE (or consistency) re-verifies the answer.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { schemaFor, radicalsForBand, nearestRadicals, predictDifficulty } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXTS = (() => { const c = JSON.parse(readFileSync(join(ROOT, "taxonomy", "contexts.json"), "utf8")); return (c.contexts || c).map(String); })();

/* ---- seeded PRNG (reproducible draws) + helpers ---- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function frac(p, q) { const g = gcd(p, q) || 1; p /= g; q /= g; if (q < 0) { p = -p; q = -q; } return q === 1 ? String(p) : `${p}/${q}`; }
/* tiny exact-rational arithmetic (for fractional slopes / solutions) */
const R = (p, q = 1) => { const g = gcd(p, q) || 1; let np = p / g, nq = q / g; if (nq < 0) { np = -np; nq = -nq; } return { p: np, q: nq }; };
const radd = (a, b) => R(a.p * b.q + b.p * a.q, a.q * b.q);
const rmul = (a, b) => R(a.p * b.p, a.q * b.q);
const rstr = (x) => (x.q === 1 ? String(x.p) : `${x.p}/${x.q}`);
const DIR_HDR = "USE THESE EXACT NUMBERS (drawn by the harness — do NOT pick your own, do NOT round/“nicen” them):";

/* ============================ number drawers ============================ */

// linear_equations_one_variable — pins a·x + b = c and its solution.
function drawOneVar(rad, { r, range, band, varName }) {
  const [, chi] = range || [2, 12];
  const messy = band >= 3;
  const sgn = () => (messy && r() < 0.35 ? -1 : 1);
  const solMax = band <= 1 ? 9 : 12;
  let a = randint(r, 2, band <= 1 ? 9 : chi), b, c, solution;
  if (rad.answer_type === "fraction") {
    b = sgn() * randint(r, 1, messy ? 15 : 9);
    do { c = sgn() * randint(r, 4, messy ? 40 : 25); } while (((((c - b) % a) + a) % a) === 0);
    solution = frac(c - b, a);
  } else if (Number(rad.n_steps) === 1) {
    solution = sgn() * randint(r, 2, solMax);
    if (r() < 0.5) { b = 0; c = a * solution; } else { a = 1; b = sgn() * randint(r, 1, band <= 1 ? 9 : 15); c = solution + b; }
  } else {
    b = sgn() * randint(r, 1, messy ? 15 : 9);
    solution = sgn() * randint(r, 2, solMax);
    c = a * solution + b;
  }
  const eq = b === 0 ? `${a}·${varName} = ${c}` : a === 1 ? `${varName} + (${b}) = ${c}` : `${a}·${varName} + (${b}) = ${c}`;
  const directive = `${DIR_HDR}
- The problem's core equation must be equivalent to:  ${eq}
- The single correct answer is:  ${varName} = ${solution}
- Realize the radicals as the DISGUISE of this equation (has_variable_both_sides → put a ${varName}-term on both sides that simplifies back to this; has_distribution → wrap a factor like k(${varName}+p); has_fractions → introduce a fractional coefficient) and wrap it in the context. The simplified equation and the answer must stay exactly as above.`;
  return { a, b, c, solution, variable: varName, core_equation: eq, answer: String(solution), directive, format: null };
}

// linear_equations_two_variables — a line y = m·x + b0; task picks what's asked.
function drawTwoVar(rad, { r, band, context }) {
  const sgnB = () => (band >= 3 && r() < 0.4 ? -1 : 1);
  const m = rad.has_fraction_slope ? (() => { const q = pick(r, [2, 3, 4]); let p; do { p = sgnB() * randint(r, 1, 3 * q); } while (p % q === 0); return R(p, q); })() : R(sgnB() * randint(r, 2, band <= 2 ? 5 : 7));
  const b0 = sgnB() * randint(r, 1, 12);
  const mStr = rstr(m), task = rad.task;
  const line = `y = ${mStr === "1" ? "" : mStr === "-1" ? "-" : mStr + "·"}x ${b0 >= 0 ? "+ " + b0 : "- " + -b0}`;
  const ctxNote = context === "none" ? "Keep it abstract (pure coordinate-geometry, no real-world context)." : `Set it in this context: ${context}.`;
  let answer = null, body = "";
  if (task === "evaluate") {
    const x1 = (m.q) * randint(r, 1, 4) * (sgnB());                       // multiple of denom ⇒ clean y
    const y1 = radd(rmul(m, R(x1)), R(b0));
    answer = rstr(y1); body = `the line  ${line}; ask for the value of y when x = ${x1}  (answer y = ${answer}).`;
  } else if (task === "find_slope") {
    const q = m.q, x1 = q * randint(r, -2, 1), x2 = x1 + q * randint(r, 1, 4);
    const y1 = radd(rmul(m, R(x1)), R(b0)), y2 = radd(rmul(m, R(x2)), R(b0));
    answer = mStr; body = `a line passes through the points (${x1}, ${rstr(y1)}) and (${x2}, ${rstr(y2)}); ask for the slope  (answer = ${answer}).`;
  } else if (task === "find_intercept") {
    const which = r() < 0.5 ? "y" : "x";
    if (which === "y") { answer = String(b0); body = `the line  ${line}; ask for its y-intercept  (answer = ${answer}).`; }
    else { const xi = rmul(R(-b0), R(m.q, m.p)); answer = rstr(xi); body = `the line  ${line}; ask for its x-intercept  (answer x = ${answer}).`; }
  } else if (task === "parallel_perp") {
    const par = r() < 0.5, px = sgnB() * randint(r, 1, 6), py = sgnB() * randint(r, 1, 8);
    const mp = par ? m : R(-m.q, m.p);                                     // perpendicular slope = negative reciprocal
    const bp = radd(R(py), rmul(R(-1), rmul(mp, R(px))));                  // b' = py - m'·px
    const mpS = rstr(mp), npLine = `y = ${mpS === "1" ? "" : mpS === "-1" ? "-" : mpS + "·"}x ${bp.p >= 0 ? "+ " + rstr(bp) : "- " + rstr(R(-bp.p, bp.q))}`;
    answer = npLine; body = `find the equation of the line through (${px}, ${py}) that is ${par ? "PARALLEL" : "PERPENDICULAR"} to  ${line}  (answer: ${npLine}).`;
  } else if (task === "interpret") {
    const which = r() < 0.5 ? `the slope (${mStr})` : `the y-intercept (${b0})`;
    body = `a linear MODEL  ${line}  where x and y are real quantities in the context; ask the student to INTERPRET the meaning of ${which} in context. Write 4 plausible interpretation options, exactly ONE correct (others swap slope↔intercept, units, or direction).`;
  } else { // connect
    body = `a linear function given as ONE representation (a small table of (x,y) values OR a verbal slope+point description consistent with ${line}); ask which EQUATION (or which graph feature) matches it. Write 4 options, exactly ONE correct.`;
  }
  const directive = `${DIR_HDR}
- Build the item around:  ${body}
- ${ctxNote}
${answer != null ? "- The simplified line and the answer above must stay EXACTLY as given." : "- This is an interpretation/matching item: no recomputation, but exactly one option is correct."}`;
  // line-equation answers (parallel/perp) and the interpretive tasks are MCQ; numeric answers may be SPR.
  return { task, m: mStr, b0, line, answer, directive, format: answer == null || task === "parallel_perp" ? "mcq" : null };
}

// systems_of_linear_equations — a 2x2 system; task picks solve / #solutions / etc.
const lin2 = (a, b, c) => `${a}x ${b < 0 ? "− " + -b : "+ " + b}y = ${c}`;   // clean "2x − 2y = 10"
function drawSystem(rad, { r, band, context }) {
  const sgn = () => (r() < 0.45 ? -1 : 1);
  const nz = (lo, hi) => { let v; do { v = sgn() * randint(r, lo, hi); } while (v === 0); return v; };
  let a1, b1, a2, b2; do { a1 = nz(1, 6); b1 = nz(1, 6); a2 = nz(1, 6); b2 = nz(1, 6); } while (a1 * b2 - a2 * b1 === 0);   // det ≠ 0
  const det = a1 * b2 - a2 * b1, task = rad.task;
  const ctxNote = context === "none" ? "Keep it abstract (a pure system in x and y)." : `Set it in this two-quantity context: ${context}.`;
  let answer = null, body = "";
  if (task === "solve" || task === "create_solve") {
    let x0s, y0s, c1, c2;
    if (rad.has_fraction_solution) { c1 = nz(2, 30); c2 = nz(2, 30); x0s = rstr(R(c1 * b2 - c2 * b1, det)); y0s = rstr(R(a1 * c2 - a2 * c1, det)); }
    else { const x0 = nz(1, 9), y0 = nz(1, 9); c1 = a1 * x0 + b1 * y0; c2 = a2 * x0 + b2 * y0; x0s = String(x0); y0s = String(y0); }
    const which = r() < 0.5 ? "x" : "y"; answer = which === "x" ? x0s : y0s;
    body = `the system  { ${lin2(a1, b1, c1)} ;  ${lin2(a2, b2, c2)} }${task === "create_solve" ? ", which the student must first SET UP from the context," : ""}; ask for the value of ${which}  (answer ${which} = ${answer}).`;
  } else if (task === "number_of_solutions") {
    const outcome = pick(r, ["one", "none", "infinitely many"]); const k = nz(2, 4), c1 = nz(2, 20);
    if (outcome === "one") { do { a2 = nz(1, 6); b2 = nz(1, 6); } while (a1 * b2 - a2 * b1 === 0); c2 = nz(2, 20); }
    else { a2 = k * a1; b2 = k * b1; c2 = outcome === "infinitely many" ? k * c1 : k * c1 + nz(1, 6); }
    answer = outcome; body = `the system  { ${lin2(a1, b1, c1)} ;  ${lin2(a2, b2, c2)} }; ask HOW MANY solutions it has  (answer: ${outcome}).`;
  } else { // missing_coefficient
    const c1 = nz(2, 20), bb2 = nz(1, 6); const need = (a1 * bb2) / b1;                               // a2 making slopes equal ⇒ parallel
    if (!Number.isInteger(need)) return drawSystem({ ...rad, task: "solve" }, { r, band, context });   // retry as solve if non-integer
    answer = String(need); body = `the system  { ${a1}x + ${b1}y = ${c1} ;  k·x + ${bb2}y = ${nz(2, 20)} }; ask for the value of k for which the system has NO solution  (answer k = ${need}).`;
  }
  const directive = `${DIR_HDR}
- Build the item around:  ${body}
- ${ctxNote}
- Keep the coefficients and the answer EXACTLY as given.`;
  return { task, a1, b1, a2, b2, answer, directive, format: task === "number_of_solutions" ? "mcq" : null };
}

// linear_inequalities — a·x + b (op) c; negative coefficient flips the sign.
function drawInequality(rad, { r, band, context, varName }) {
  const task = rad.task, neg = rad.negative_coefficient;
  const a = (neg ? -1 : 1) * randint(r, 2, 9), opPos = pick(r, ["<", "≤", ">", "≥"]);
  const ctxNote = context === "none" ? "Keep it abstract (a pure one-variable inequality)." : `Set it in this constraint context: ${context}.`;
  let answer = null, body = "";
  if (task === "solve_boundary") {
    const x = randint(r, 2, 12), b = (band >= 3 && r() < 0.4 ? -1 : 1) * randint(r, 1, 20), c = a * x + b;
    const flipped = a < 0 ? { "<": ">", "≤": "≥", ">": "<", "≥": "≤" }[opPos] : opPos;
    answer = String(x); body = `the inequality  ${a}${varName} ${b >= 0 ? "+ " + b : "- " + -b} ${opPos} ${c}; ask for the BOUNDARY value of ${varName} (the value where the two sides are equal). Solving gives ${varName} ${flipped} ${x}, so the boundary is ${varName} = ${x}.`;
  } else if (task === "max_int" || task === "min_int") {
    const M = randint(r, 3, 15), rem = randint(r, 1, Math.abs(a) - 1), b = randint(r, 1, 12);
    const c = a * M + (a > 0 ? rem : -rem) + b;                                                        // boundary = M + rem/|a| (non-integer)
    answer = String(M); body = `a context giving the inequality  ${a}${varName} ${b >= 0 ? "+ " + b : "- " + -b} ${a > 0 ? opPos.replace(">", "<").replace("≥", "≤") : opPos.replace("<", ">").replace("≤", "≥")} ${c}; ask for the ${task === "max_int" ? "GREATEST" : "LEAST"} integer value of ${varName} satisfying it (answer ${varName} = ${M}).`;
  } else if (task === "two_var_model") {
    const u1 = randint(r, 2, 9), u2 = randint(r, 2, 9), cap = randint(r, 30, 120);
    body = `a constraint context with two quantities at ${u1} and ${u2} per unit and a limit of ${cap}; ask WHICH two-variable inequality models the constraint (e.g. ${u1}x + ${u2}y ${opPos} ${cap}). Write 4 options; exactly ONE correct (others swap the inequality direction or the coefficients).`;
  } else { // variable_constants
    body = `a linear inequality whose coefficient/constant is a PARAMETER (e.g. ${a}${varName} + k ${opPos} ${randint(r, 5, 30)}); ask for which values of the parameter a stated condition on the solution set holds. Write 4 options; exactly ONE correct.`;
  }
  const directive = `${DIR_HDR}
- Build the item around:  ${body}
- ${ctxNote}
${answer != null ? "- Keep the inequality and the answer EXACTLY as given (mind the sign flip if the coefficient is negative)." : "- This is a modeling/parametric item: exactly one option is correct."}`;
  return { task, a, answer, directive, format: answer == null ? "mcq" : null };
}

const DRAWERS = {
  linear_equations_one_variable: drawOneVar,
  linear_equations_two_variables: drawTwoVar,
  systems_of_linear_equations: drawSystem,
  linear_inequalities: drawInequality,
};

/* ============================ the draw ============================ */

/** drawCell(domain, subdomain, band, idx) -> a cell object (the spec JSON of §1).
 *  Radicals pinned to the band; incidentals (incl. concrete numbers) drawn from
 *  the index-seeded RNG. */
export function drawCell(domain, subdomain, band, idx = 0) {
  const { dom, sub } = schemaFor(domain, subdomain);
  const bandStr = typeof band === "number" ? `B${band}` : band;
  const bandNum = Number(bandStr.slice(1));
  const r = rng(`${domain}|${subdomain}|${bandStr}|${idx}`);

  const matches = radicalsForBand(domain, subdomain, bandStr);
  const radicals = matches.length ? matches[Math.floor(r() * matches.length)] : nearestRadicals(domain, subdomain, bandStr);

  const ia = sub.incidental_axes;
  const ctxList = ia.context === "@contexts" ? CONTEXTS : (ia.context || []);
  const useContext = "from_context" in radicals ? radicals.from_context === true : r() >= (ia.context_none_weight ?? 0);
  const context = useContext && ctxList.length ? pick(r, ctxList) : "none";
  const varName = pick(r, ia.var_name);

  const drawer = DRAWERS[subdomain] || drawOneVar;
  const numbers = drawer(radicals, { r, range: ia.coefficient_range, band: bandNum, varName, context });
  const format = numbers.format || (r() < 0.6 ? "spr" : "mcq");
  const tier = (sub.task_tier || {})[radicals.task] || dom.tier || "A";

  return {
    domain, subdomain,
    target: sub.target,
    band: bandNum,
    statementId: (sub.statementByBand || {})[bandStr] || null,
    radicals,
    incidentals: { context, var_name: varName, format, numbers },
    tier,
    predicted_scale: predictDifficulty(radicals, domain, subdomain),
    canonical_fingerprint: sub.canonical_fingerprint || [],
    op_vocab: sub.op_vocab || [],
  };
}

export default { drawCell };
