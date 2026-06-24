# Advanced Math — strict rubric conformance audit (`test-106`)

_2026-06-24 · `data/test-106.json` (20 items, the latest Advanced-Math module) vs. the Skills-Insight Advanced Math rubric (ADV.B1–B7, 15 statements). "Strict" = each item must (a) actually test the skill its assigned statement names and (b) sit at that statement's rubric band._

## Verdict
**13 / 20 fully conformant.** 1 item is filed under the wrong statement; 5 are banded **one level above** the rubric band for the skill they test; there are real **coverage gaps** (no exponential items; B6.s3 and part of B7.s2 missing). No program-gating violations (module is SAT-program, which permits every gated variant).

## Per-item conformance
| q | claimed statement | what it actually tests | strict verdict |
|---|---|---|---|
| q1 | ADV.B1.s2 (combine like terms *by addition*) | combine 6 terms with **subtraction** | ⚠ marginal — has subtraction; B1.s2 says "addition"; really B1/B2 boundary |
| q2 | ADV.B2.s2 (GCF) | factor out GCF | ✅ |
| q3 | ADV.B3.s2 (solve for a variable) | solve `P=9n+5q` for n | ✅ |
| q4 | ADV.B3.s1 (factored quadratic) | `(2h−14)(3h+9)=0` | ✅ |
| q5 | ADV.B3.s1 (simple radical) | `√(4k+13)−4=5` | ✅ |
| q6 | ADV.B4.s1 (use a quadratic relating two vars) | total acres `(2n+9)(4n+7)` at n=5 | ✅ |
| q7 | ADV.B3.s2 (solve for a variable) | solve `7an−4b=2cn+9d` for n | ⚠ **band B4** but statement is **B3** — no B4 "solve-for-variable" exists in the rubric |
| q8 | ADV.B4.s2 (quadratic by factoring) | `6t²+7t−20=0` | ✅ |
| q9 | ADV.B4.s2 (rational equation) | `5/(3n+11)=2/(2n+3)` | ✅ |
| q10 | ADV.B5.s1 (quad function, graph feature) | features of `f(x)=−3(x−5)²+14` | ✅ |
| q11 | ADV.B5.s2 (product of two binomials) | expand `(4y−7)(2y+5)` | ✅ |
| q12 | ADV.B5.s1 (quad function key feature) | minimum of `3h²−24h+5` | ✅ |
| q13 | ADV.B4.s2 (rational equation) | rational eq w/ extraneous root | ⚠ **band B5** but statement is **B4** (skill ceiling) |
| q14 | ADV.B6.s1 (*create & solve* in context) | **interpret** the vertex of a profit model | ✗ **wrong statement** — this is **B6.s2** (interpret), not B6.s1 |
| q15 | ADV.B5.s2 (monomial × binomial) | `¾n²(8n³−12n)` | ⚠ **band B6** but statement is **B5** (skill ceiling) |
| q16 | ADV.B6.s1 (create & solve quadratic in context) | rectangular plot area → quadratic | ✅ |
| q17 | ADV.B4.s2 (linear–nonlinear system) | line × parabola, find t | ⚠ **band B6** but statement is **B4** (skill ceiling) |
| q18 | ADV.B7.s2 (most suitable form for a feature) | which form shows the minimum | ✅ |
| q19 | ADV.B6.s1 (create & solve quadratic in context) | solar-array area → quadratic | ⚠ **band B7** but statement is **B6**; also near-duplicate structure of q16 |
| q20 | ADV.B7.s1 (unknown constant in a nonlinear eq) | find k in `√(7x+k)−x=4` | ✅ |

## Findings

**1. One mis-assigned statement (q14).** It interprets the vertex of a contextual quadratic — that is **ADV.B6.s2** ("interpret a key feature"), but it's filed as **ADV.B6.s1** ("create … and solve"). Band (B6) is right; the statement is wrong. Root cause: `statementByBand` in `advanced_math.json` maps *all* B6 nonlinear-model items to one statement (s1), so it can't separate the `create_model` and `interpret_feature` tasks.

**2. Five items banded above the rubric ceiling for their skill** (q7, q13, q15, q17, q19). The rubric pegs *raw solving* at B3–B4 and *rewriting/products* at B5; the LLTM/judge bands by **cognitive load**, so a harder instance of a B4 skill (rational eq with an extraneous root; a linear–nonlinear system; a 3-fraction-coefficient product; a contextual create-and-solve) measures B5–B7. Honest tension: **difficulty-band ≠ rubric-skill-band.** Per the rubric these skills top out lower; per the judge they're harder. Neither is "wrong," but strictly, the *statement* they're attached to is a lower band than the item.

**3. Coverage gaps (the most actionable):**
- **No exponential items at all.** Every nonlinear-function/model item (q6, q10, q12, q14, q16, q19) is **quadratic**. ADV.B4.s1, B5.s1, B6.s1, B6.s2 explicitly include **exponential** functions (growth/decay, growth factor). This is the biggest rubric gap.
- **ADV.B6.s3 not covered** — connecting a graph (or points) to its algebra and how a **translation** affects graph/equation. No translation item.
- **ADV.B7.s2 only half-covered** — "choose the form that displays a feature" (q18) is present, but "use properties of **exponents / rational / radical** expressions to rewrite complex expressions" is not.
- **ADV.B1.s1 and ADV.B2.s1 not covered** — read the y-intercept / a key feature off a **nonlinear graph** (figure-required). These are the deferred ADV-2 figure statements — expected, not a defect of this text module.

**4. Near-duplicate (q16 ↔ q19).** Both are "rectangle-area → quadratic → solve for a dimension" in context — the same structure, one banded B6 and one B7. Same reskin pattern the dedup pass flagged elsewhere; q19 is also the over-banded one in finding #2.

**5. q1 marginal.** Combine-like-terms is genuinely a B1/B2 boundary skill; B1.s2's "through addition" is narrower than the subtraction-bearing expression q1 uses. Minor.

## Recommendations
1. **Add a per-task statement map** (not one statement per band) so interpret-vs-create (q14) and rewrite-vs-solve route to the right ADV.s-id. Quick `advanced_math.json` change.
2. **Add exponential coverage** — `exp_model_use` / `create_model(exp)` / `interpret_feature(exp)` are already tasks in the schema; they just didn't get drawn this run. Force at least 2–3 exponential items (growth factor, decay, doubling time).
3. **Add ADV.B6.s3** (translation of a quad/exp; graph↔algebra connection) and the **exponent/radical-rewriting** half of B7.s2 — both are missing skills, not just unlucky draws.
4. **Decide the band-vs-rubric policy:** either (a) cap solving/rewriting items at the rubric's band for that skill, or (b) accept judge-measured difficulty and relabel the statement to the nearest higher-band skill. Document which — it's the same difficulty≠skill-band tension noted in the novelty discussion.
5. The B1.s1/B2.s1 nonlinear-graph statements close when **ADV-2** (nonlinear figures) ships.

## Scorecard
- Statement-correct: **19/20** (q14 mislabeled).
- Band-matches-rubric-for-skill: **14/20** (5 above ceiling + q1 marginal).
- Rubric statements represented: **11 of 15** (missing B1.s1, B2.s1 — deferred figures; B6.s3; exponent/radical half of B7.s2). **Exponential thread absent across the 6 statements that name it.**
