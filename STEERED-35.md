# STEERED-35 — novelty in the objective: solo Fable, 35 GEO items, 5 per band

_2026-07-01 · The controlled fix-test for SCALE-TEST-50's failure mode #1. Diagnosis under test: the
novelty push was weak because **novelty was never in the author's objective** — the baseline prompt
optimized "original items in authentic CB voice," and authenticity pulls toward the canon. Fix: same
clean-room conditions (context-free agent, rubric + banding guide, web research allowed), ONE solo
Fable author, 35 figure items at exactly 5 per band B1–B7, with the objective repaired: novelty
declared co-equal with authenticity, a name-the-modal-then-avoid-it procedure per item, 14 banned
modal structures (the scale-test canon ∪ banked engine families), a positive steer toward
under-written directions, and disclosed machine scoring. All gates ran on the cheap tier (Opus +
deterministic) — the first live exercise of the lighter harness: **Fable authors, Opus gates.**
Author prompt preserved at `tests/cleanroom/steered35/prompt.md`; scanner committed at
`engine/verify/cleanroom-scan.mjs` (validated by reproducing SCALE-TEST-50's numbers first)._

## Results — baseline vs steered

| measure | baseline (n=50, 5 blind agents) | steered (n=35, 1 agent, objective fixed) |
|---|---|---|
| **Canon-structure hits** | ~20/50 in 6 repeated skill groups (5/5 prism-volume, 4/5 transversal, 4/5 circle-equation, 3/5 Pythag-hyp) | **0/35 banned structures written.** 8/35 keyword-flagged, all adjudicated compliant — chain, inverse, or unstated-theorem realizations (i.e., exactly the steer). Closest call: set#33 inverse-sector. |
| In-set surface collisions | 0 ≥0.60 · 2 pairs at 0.46–0.53 | **0 pairs at any threshold, including the 0.45 floor** (595 pairs) |
| Structural clusters (≥0.55) | 0 | 0 |
| Skill-label repeats | 6 groups | 2 (2× triangle-area, 2× rectangle-area — both B1, where the rubric has only 2 usable statements after the prism ban; realizations structurally distinct, no surface collision) |
| Novelty vs 984-item corpus | max 0.46 · 1/50 at floor | **max 0.23 · 0/35** |
| Novelty vs prior clean-room 50 | — | **max 0.17** |
| **Authenticity** (all 35, absolute judge) | sampled n=10: mean 6.6, ~half < 7, min 3 | **mean 7.06** · 8/35 < 7 · min 3 · max 9 (officials 8.3, pilot 7.9) |
| **Correctness** | 50/50, same-model blind solve | **35/35 CROSS-model**: two independent blind Opus solvers, mutually identical and identical to the Fable author's key (22 apparent mismatches were all answer-format artifacts, again) |
| Band spread / accuracy | spread as mandated; no audit | exact 5/band · blind Opus re-band (shuffled, id-masked): **22/35 exact, 35/35 within ±1, 0 items ≥2 off; B7 5/5 exact** |
| Figures | not audited | blind visual audit (full-res, all 35): geometry 35/35 honest incl. right-angle-mark suppression on theorem-gated B7 items; **4 label defects** (1 major garble, 3 minor clips/collisions) — repaired in the repo copy, re-verified from rendered pixels |
| Cost | ~7–9k tokens/item, Fable everywhere | author (Fable) 122k ≈ **3.5k tokens/item**; gates all cheap tier: 2 Opus solvers 48k, Opus band audit 24k, Opus figure audit 112k, 35 Opus authenticity calls, deterministic scanner $0 |

## Interpretation (honest)

1. **The diagnosis was right.** With novelty specified — banned modals, name-then-avoid, disclosed
   scoring — skill-canon convergence went from ~20/50 to 0/35 and nearest-corpus similarity halved
   (0.46 → 0.23) in a single run with no architecture change. The weak push was an unspecified
   objective, not a capability ceiling.
2. **Voice did not pay for novelty — on average.** Mean authenticity ROSE vs the baseline sample
   (6.6 → 7.06) under the same scoring protocol. The tradeoff exists only in the tail: 2/35 items
   are genuinely out-of-distribution realizations (a count-the-grid-squares B1, scored 3; a
   tick-marked kite perimeter B2, scored 4) — the price of pushing, and exactly what the floor is
   for. Of the other 6 below-floor items, the judge's stated reason is mostly stem-narrates-the-figure
   redundancy, partly an artifact of this experiment's text contract (stems must describe figures in
   words); rendered items lean on the figure and read cleaner.
3. **The cheap-gate tier works.** Every gate ran on Opus or deterministic code and every gate did its
   job: the solvers agreed 35/35 cross-model (stronger evidence than the scale test's same-model
   agreement); the blind band audit landed within ±1 on all 35 with zero ≥2-band disagreements
   (corroborating the gate-hierarchy guide across models — all five B7 theorem-gated items exact);
   the figure audit caught 4 real label defects the author's own SVG check missed.
4. **What this does NOT show.** (a) Cross-SESSION convergence is untested: two steered authors given
   the SAME static packet could converge on the same "fresh" cells — the production fix is a dynamic
   avoid-list computed from the bank/ledger per run, which is the harness's job, and that experiment
   hasn't run. (b) Cross-model agreement is strong but not sympy-grade proof. (c) The band audit is
   model-vs-model corroboration, not student data. (d) B1 is structurally thin under the ban list
   (2 usable statements) — at production scale B1 needs either more statement coverage or relaxed
   bans with dedup doing the work.

## Division of labor, updated

The lighter harness is now empirically shaped: **Fable authors against a steering packet** (rubric +
banding guide + banned modals from the ledger + positive steer + disclosed scoring); **Opus and
deterministic code gate** (dedup/novelty scanner, cross-model blind solve, authenticity floor, band
audit, figure audit); failures route back as packet updates, not item patches. Next steps: dynamic
avoid-lists from the bank (occupancy steering), the harvester/parameterizer to fold accepted items
into families for $0 variants, and a second steered run to measure cross-session convergence.

Artifacts: `tests/cleanroom/steered35/{index.html, items.json, prompt.md}` (4 figure-label repairs
applied to index.html post-audit; items.json untouched), `tests/cleanroom/geo-rubric.md` (the exact
rubric given to baseline and steered authors), key entries `s35#1..35` in `tests/cleanroom/key.json`,
scanner `engine/verify/cleanroom-scan.mjs`.
