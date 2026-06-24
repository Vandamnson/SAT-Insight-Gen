# ADV Band-7 Figure Capstones — Blind QA + Grid Standardization

_2026-06-24 · 12 distinct gloves-off Advanced-Math figure capstones (`data/test-111.json`, G1–G5), plus a bank-wide grid standardization pass._

## Method
Each capstone rendered **question-only** (stem + figure + empty answer box; no answer, neutral ids). Four independent vision agents each solved their batch **from the figure + stem alone** — the full B7 chain: read features → reconstruct the equation (incl. leading coefficient) → apply the transformation/condition → compute — and adversarially audited the figure. Answers adjudicated against the private construction key (which `_advfigcheck.mjs` had already verified, 400 draws, 0 mismatches; G5 also SymPy-checked).

## Result: 9/12 first pass → 12/12 after fix
| chain | first pass | note |
|---|---|---|
| G2 (tangent shift) | 3/3 ✓ | needs only the labeled vertex |
| G4 (exponential) | ✓ | both points labeled |
| G5 (parabola+line) | 2/2 ✓ | marked point P present |
| **G1 (reconstruct+translate)** | 2/3 | **Q03 missed** |
| **G3 (reconstruct→standard form)** | 1/3 | **Q07, Q08 missed** |

## The defect (MAJOR, fixed)
The 3 misses were **not** construction errors — the keys are mathematically correct and the figures rendered the right parabolas. They were **figure ambiguity**: G1/G3 require recovering the leading coefficient `a`, which the solver gets by reading the **y-intercept off the curve** — but `a` must be ≠1 (that's the non-triviality), so the parabola is steep, the y-axis crossing is near-vertical, and it was **unlabeled**. Blind solvers misread it:
- **Q08**: read y-intercept ≈2 (actual **6**) → `a=2` instead of 3 → answer 10 instead of 18.
- **Q07**: read ≈−8 (actual **−7**) → `a=1` instead of 2 → −10 instead of −11.
- **Q03**: read ≈−5 (actual **−4**) → `a=2` instead of 3 → 11 instead of 20.

**Fix:** G1 and G3 now **label the y-intercept point explicitly** (coords), alongside the vertex — exactly how G4/G5 mark the points a solver needs. Re-verified blind: Q03→**20**, Q07→**−11**, Q08→**18**, all rated *clean*, each agent explicitly using the two labeled points to get `a`. (Construction unchanged; `_advfigcheck` still 400/0/0/0.)

## Grid standardization (the "standardize the adv-math graphs" sweep)
Audited **every** advanced-math figure in the bank: **40 of 41 were already square** (the ADV-2 square-grid work). One legacy stray (`test-81`, `y=x²−8x+12`, a `1×2` grid) normalized via `build/_advstd.mjs` (forces `xStep=yStep` by the generator's rule). **Result: 0 non-square advanced-math figures remain.** 4-way axis arrowheads are render-time (`coordPlane`), so they're universal. Viewer rebuilt.

## Verdict
The 12 capstones are **correct and now unambiguous** (12/12 blind-solve after the y-intercept-labeling fix), and **all advanced-math graphs in the bank are standardized to a square grid with 4-way arrowheads**. Bank at 778.
