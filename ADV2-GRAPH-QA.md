# ADV-2 Nonlinear-Graph Items — Blind Vision QA

_2026-06-24 · 24 banked Advanced-Math graph items (`data/test-109.json`, B1/B2/B5/B6 × the 5 graph tasks)._

## Method (truly blind, adversarial)
Each item was rendered **question-only** — stem + coordinate figure + (for MCQ) the four options, with an empty answer box, a neutral id (`Q01…Q24`), and **no answer, task name, or construction parameters** anywhere on the page. Six independent vision agents (4 items each) were each told to do two jobs from the **image alone**:
1. **Solve it** like an expert test-taker — read the value off the graph / match the equation to the graph / interpret the feature → a number or A–D.
2. **Adversarially audit** the figure for any defect that could mislead a student — feature off-gridline / clipped / unmarked, label–curve–axis collisions, indistinct MCQ options, scale problems — with severity BLOCKER / MAJOR / MINOR / NIT.

Their answers were then adjudicated against a **private construction key** (the figureCheck-verified answers), which the agents never saw. A blind answer ≠ the constructed answer means the figure is wrong, ambiguous, or misleading — exactly what we want to surface.

## Headline result
| | First pass | After fix |
|---|---|---|
| **Blind-solve agreement** vs construction | **23 / 24** | **24 / 24** |
| Items the figure renders **ambiguously** | 1 (Q17) + 4 minor-doubt | 0 |
| **Math / figure-answer correctness** | **24 / 24 confirmed** | 24 / 24 |

Crucially, **every constructed answer was independently confirmed correct** — no figure showed a different answer than the construction claimed. The one disagreement was a *legibility* defect, not a math error.

## The one real defect — Q17 (MAJOR, fixed)
- **Item:** "Which graph could be `y = (x−1)² + 1`?" Correct option **B** = vertex (1, 1), opens up. figureCheck had verified exactly one option matches — the construction was right.
- **What the blind agent did:** picked **C** (vertex (1, −1)) and rated it *minor-doubt*. Cause: the correct option (1, 1) and the vertical-shift distractor (1, −1) differ only by 2 units, and on the **step-2 grid there was no gridline at y = ±1**, so the single discriminating feature (vertex *above* vs *below* the x-axis) fell **between gridlines** — unreadable.
- **Fix:** unit grids so feature values land **on** gridlines —
  - parabola which-graph options → fixed `[-5,5]×[-6,6]` **step-1** window;
  - `frameForCurve` step threshold raised 12 → 14 so read-task windows stay step-1.
- **Re-verified blind:** a fresh agent now reads Q17 → **B, clean**; the two read items previously rated *minor-doubt* (Q02 y-int 3, Q03 y-int −4) now read **clean**. After the fix, **34 of 42** rendered figures use a unit grid; the only step-2 figures left are the two **exponential** which-graph items (Q13/Q15), where options are discriminated by *shape* (growth vs decay vs reflection) — both were solved correctly.

## Defect tally
| Severity | Count | Disposition |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 1 | **Fixed** (Q17 grid ambiguity) |
| MINOR | ~5 | Q02/Q03 off-gridline reads **fixed by step-1**; Q06 top-clip, Q08/Q09 axis-tick-number overlapped by curve, Q14 A/B near-twin distractors — see below |
| NIT | ~7 | vertex/coord label sitting close to a dashed guide (Q07/Q20/Q23); Q24 projectile launch-height reads ≈0 |

## Residual minors (accepted, low priority)
- **Axis tick-number vs curve overlap** (Q08, Q09, Q12): when a parabola crosses the x-axis near a labeled tick, the blue curve passes over the number. Intrinsic to dense graphs (real SAT figures show this too); never blocked a correct read (all solved clean). Could be mitigated later by nudging tick labels off the curve.
- **Near-twin distractors** (Q14: options A/B share vertex-x, differ only in height): a *hurried* reader could misclick, but the agent solved it correctly and exactly one matches. This is legitimate SAT distractor design, not a defect.
- **Exponential which-graph step-2 grid** (Q13/Q15): shape-discriminated, both solved correctly — left as-is.
- **Projectile realism** (Q24): launch height at t=0 is small (≈1); the asked feature (vertex) is labeled and unambiguous. Cosmetic.

## Verdict
The ADV-2 graph pipeline is **correct and ship-ready**: blind expert solvers independently reproduced **100%** of the constructed answers, and the single rendering ambiguity they exposed has been fixed and re-verified. Bank re-banked clean to **732** with the corrected figures.

_Reproduce: `node build/_advgraphqa.mjs 109` (question-only page + private key) → screenshot each `#Qxx` → blind vision agents → adjudicate vs `scratchpad/adv-qa-key.json`._
