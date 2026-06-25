/* ============================================================================
   prompts.mjs — PER-DOMAIN PROMPT PACKS for Agents 1/2/3.

   Each domain gets its own focused instructions so a given agent call carries
   ONLY that domain's guidance (low, on-distribution context → better items).
   The shared engine (transport, JSON contract, retry, gates) is unchanged — only
   the CONTENT each agent sees is domain-selected here.

   A pack supplies three string fields:
     · rationaleExtra — appended to Agent 1's system prompt (method framing)
     · authorStyle    — the domain-specific STYLE bullets for Agent 2 (the generic
                        FORMATTING rules — LaTeX/currency/tables/length — stay in
                        author2.mjs and apply to every domain)
     · proveHints     — appended to Agent 3's verifier system prompt (verification
                        gotchas specific to the domain's answer shapes)

   `base` is the generic fallback (also used by domains without a pack yet, e.g.
   psda/geometry). `algebra` reproduces the shipped behavior verbatim.
   ============================================================================ */

const base = {
  rationaleExtra: "",
  authorStyle:
`- Be CONCISE. At MOST one short sentence of context, then the question. No backstory, no scene-setting, no flavor padding (e.g. NOT "A wildlife researcher monitors salmon migration by counting fish as they pass through a river ladder…"). Lower bands (B1–B3) especially terse; an abstract item is just the equation/expression and the ask.
- PHRASE LIKE THE REAL TEST: no redundant clauses (don't restate what is already implied — e.g. if a point off a line is given, do NOT add "which does not lie on the line"); no pile-ups of proper nouns or place-names.
- DEFINE THE VARIABLE CLEANLY — this is the #1 authenticity tell. Introduce it in its own clause ("…, where \\(w\\) is the number of liters filtered") OR keep it out of the question entirely ("How many tickets were sold?" — NEVER "How many tickets \\(h\\) were sold?"). Never drop an undefined letter into the ask, and never jam a variable into a noun phrase ("removes 14 grams per liter \\(w\\)"). For a free-response numeric item the cleanest form often names no variable at all.
- NUMBERS SHOULD FEEL REAL: when a fraction is required prefer common ones (1/2, 2/3, 3/4, 5/2) over arbitrary ratios like 12/5; avoid implausible real-world values (e.g. a 12.5-pound "bag" or "14 grams per liter").`,
  proveHints: "",
};

// Algebra — the shipped behavior, named explicitly so it never drifts.
const algebra = { ...base };

// Advanced Math — quadratics, exponential/quadratic models, polynomial rewriting,
// radical/rational/abs-value/nonlinear-system solving. Drops the linear-flavored
// rules above; adds nonlinear phrasing, exact-form, model, and distractor guidance.
const advanced_math = {
  rationaleExtra:
`\n\nFor ADVANCED MATH the radicals are NONLINEAR structure: the task names the METHOD — solve-by-factoring vs the quadratic formula vs the discriminant vs the vertex; expand / factor / combine-like-terms for a rewrite; isolate-and-square for a radical; clear-denominators for a rational; substitution for a linear–nonlinear system. The numbered solution path must follow THAT method, not generic linear "subtract/divide" steps. For an expression-rewriting item the "solution" is the algebraic manipulation that yields the equivalent form, not an equation solve.`,
  authorStyle:
`- Be CONCISE. An ABSTRACT solve-or-rewrite item is just the equation/expression and the ask — no story (e.g. "What is the sum of the solutions to \\(2x^2-7x+3=0\\)?", "Which expression is equivalent to \\((3x-4)(x+5)\\)?"). A model item gets at most one short clause of context, then the question.
- PHRASE LIKE THE REAL TEST: when using function notation, define it ("The function \\(f\\) is defined by \\(f(x)=\\dots\\)"); for a system, show both equations and ask for the specific value targeted. No redundant clauses, no proper-noun pile-ups.
- ROOTS & FORMS: give EXACT answers — irrational roots as \\(\\frac{-b\\pm\\sqrt{D}}{2a}\\) or \\(a\\pm\\sqrt{b}\\), never decimals; keep factored / standard / vertex forms exact. Prefer integer or simple-fraction roots UNLESS the task is specifically the quadratic formula (then irrational roots are expected).
- MODELS: name the quantity and its unit, and state growth/decay as a clear factor or percent ("increases by 8% each year", "doubles every 3 hours") with realistic initial values. A "quadratic context" must be a genuine quadratic relationship (area, projectile height, a product of related quantities) — never a disguised linear one.
- DISTRACTORS (MCQ): make the three wrong options the CANONICAL errors — a sign slip on a root, reciprocal or swapped roots, a dropped factor of 2, using \\(b\\) instead of \\(-b\\), or a value that fails the extraneous-root check.`,
  proveHints:
`\n\nNOTES FOR NONLINEAR ANSWERS — verify with care:
- A quadratic may have TWO real roots; if the item asks for "a/the solution" or lists roots, accept the claim iff it matches the correct root set (or the specific root named).
- Reject EXTRANEOUS roots: for a radical equation, substitute each candidate back into the ORIGINAL equation and keep only those that satisfy it.
- "No real solution" must correspond to a negative discriminant.
- For a rational equation, exclude any value that makes a denominator zero.
- For an MCQ asking which expression is EQUIVALENT, confirm with sympy (expand/factor/simplify, or equality over several random sample points) that the keyed option equals the stem AND the other three do not.`,
};

// Geometry & Trigonometry (GEO-1, text/formula-first) — mensuration, angle/line
// theorems, similarity/congruence, Pythagorean & special right triangles, right-triangle
// trig, circles. Figures are OPTIONAL, so every configuration is described in self-
// contained prose; answers are EXACT (integer, simple fraction, radical surd, or pi-form).
const geometry_trig = {
  rationaleExtra:
`\n\nFor GEOMETRY & TRIGONOMETRY the task names the CONCEPT to apply — an area/perimeter/volume/surface-area FORMULA; the triangle angle-sum or angles formed by parallel/intersecting lines; SIMILARITY or CONGRUENCE (a proportion or corresponding parts); the PYTHAGOREAN theorem; a SPECIAL-right-triangle ratio (\\(1:\\sqrt3:2\\), \\(1:1:\\sqrt2\\)); a trigonometric RATIO (SOH-CAH-TOA) or the complementary identity \\(\\sin\\theta=\\cos(90^\\circ-\\theta)\\); a degree↔radian conversion; or a CIRCLE property (equation, arc length, sector area, central/inscribed angle, tangent). The numbered solution path must apply THAT theorem/formula step by step, ending in an exact value. Because no figure is drawn, the stem must describe the configuration COMPLETELY and unambiguously in words.`,
  authorStyle:
`- Be CONCISE. Most items are ABSTRACT (a described figure + numbers, no story; the SAT marks these "Figure not drawn to scale"). A mensuration item may get one short clause of real context (a garden, a box, a ramp); pure-theorem, coordinate-circle, and trig items take none.
- DESCRIBE THE FIGURE IN PROSE so the item is solvable WITHOUT a drawing: name the vertices/lines, state which lines are parallel, which angle is which, and every given length/measure. Never reference "the figure shown".
- EXACT ANSWERS ONLY — never decimals. Radicals as \\(a\\sqrt{b}\\) in lowest form (special triangles, Pythagorean with non-triple legs); areas/arcs/sectors and radian measures in terms of \\(\\pi\\) (e.g. \\(\\frac{\\pi}{3}\\), \\(6\\pi\\)); Pythagorean triples (3-4-5, 5-12-13, 8-15-17, 7-24-25) for clean integer sides; angles in whole degrees.
- TRIG: give ratios as exact fractions from the side lengths; for complementary-angle items keep it abstract (\\(\\sin 28^\\circ=\\cos 62^\\circ\\)). For circles in the \\(xy\\)-plane, the equation form is \\((x-h)^2+(y-k)^2=r^2\\).
- DISTRACTORS (MCQ): use the CANONICAL errors — perimeter for area (or vice versa), forgetting the \\(\\frac12\\) or \\(\\frac13\\) factor, radius/diameter confusion, using a leg as the hypotenuse, the supplement instead of the angle, scale factor applied to area/volume without squaring/cubing, or degrees left unconverted.`,
  proveHints:
`\n\nNOTES FOR GEOMETRY/TRIG ANSWERS — recompute exactly with sympy:
- AREA/PERIMETER/VOLUME/SA: rectangle \\(lw\\), triangle \\(\\tfrac12 bh\\), circle \\(\\pi r^2\\); box \\(lwh\\), cube \\(s^3\\), pyramid \\(\\tfrac13 Bh\\), prism SA \\(2(lw+lh+wh)\\). For a "solve for a dimension" item, isolate it from the formula.
- PYTHAGOREAN: \\(a^2+b^2=c^2\\); keep surds exact (sympy: \\(\\sqrt{8}=2\\sqrt2\\)). SPECIAL TRIANGLES: 30-60-90 \\(1:\\sqrt3:2\\), 45-45-90 \\(1:1:\\sqrt2\\).
- ANGLES: a triangle's three angles sum to \\(180^\\circ\\); vertical angles equal, a linear pair sums to \\(180^\\circ\\); for parallel lines cut by a transversal, corresponding/alternate angles are equal and co-interior sum to \\(180^\\circ\\).
- SIMILARITY: corresponding sides are proportional (set up the ratio); a scale factor \\(k\\) multiplies length by \\(k\\), area by \\(k^2\\), volume by \\(k^3\\).
- TRIG: \\(\\sin=\\dfrac{\\text{opp}}{\\text{hyp}}\\), \\(\\cos=\\dfrac{\\text{adj}}{\\text{hyp}}\\), \\(\\tan=\\dfrac{\\text{opp}}{\\text{adj}}\\); \\(\\sin\\theta=\\cos(90^\\circ-\\theta)\\); radians \\(=\\) degrees\\(\\times\\dfrac{\\pi}{180}\\).
- CIRCLE: \\((x-h)^2+(y-k)^2=r^2\\) with \\(r\\) the distance from the center to a point on it; arc length \\(=r\\theta\\) and sector area \\(=\\tfrac12 r^2\\theta\\) (\\(\\theta\\) in radians), or the degree-fraction \\(\\tfrac{\\text{deg}}{360}\\) of \\(2\\pi r\\) / \\(\\pi r^2\\); an inscribed angle is half its central angle.
- Treat equivalent EXACT forms as equal (\\(2\\sqrt3=\\sqrt{12}\\), \\(\\tfrac{\\pi}{2}=90^\\circ\\) in radians).`,
};

const PACKS = { algebra, advanced_math, geometry_trig };

/** promptPack(domain) -> { rationaleExtra, authorStyle, proveHints } (base-filled). */
export function promptPack(domain) {
  return { ...base, ...(PACKS[domain] || {}) };
}

export default { promptPack };
