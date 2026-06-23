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

const PACKS = { algebra, advanced_math };

/** promptPack(domain) -> { rationaleExtra, authorStyle, proveHints } (base-filled). */
export function promptPack(domain) {
  return { ...base, ...(PACKS[domain] || {}) };
}

export default { promptPack };
