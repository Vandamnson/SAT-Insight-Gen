# Scale test — 5 clean-room Fable agents × 10 GEO figure items (n=50)

_2026-07-01 · Question: does the solo-agent authoring quality observed at n=10 hold at n=50 across
independent, mutually-blind sessions — the exact condition under which v1's LLM authoring collapsed
(73% reskins)? Five agents, identical rubric-only prompts, no knowledge of each other or the project._

## Results

| measure | result | verdict |
|---|---|---|
| **Correctness** (independent blind solve, no key) | **50/50 agreement · 0 ill-posed** | held (caveat: solver = same model family; not sympy-grade proof) |
| **Surface novelty, within the 50** (1,225 pairs) | 0 pairs ≥0.82 · 0 ≥0.60 · 2 cross-agent at 0.46–0.53 · 0 structural clusters | held |
| **Novelty vs the 984-item bank** | max sim 0.46; 1/50 touches the floor | held |
| **Band spread** | B1–B4: 20 · B5–B6: 15 · B7: 15 — exactly as mandated | held |
| **Skill-canon convergence** | **5/5 agents wrote prism-volume · 4/5 parallel-transversal · 4/5 circle-equation-xy · 3/5 Pythag-hyp — ~20/50 items in 6 repeated skill groups** | **failure mode #1** |
| **Authenticity** (sample n=10, 2/agent) | **mean 6.6** (pilot was 7.9; officials 8.3); range 3–8; ~half below the 7 floor | **failure mode #2** |
| Cost | ~60–90k tokens/agent ≈ 7–9k/item, one-off, no variants | structural |

## Interpretation (honest)

1. **The n=10 result substantially survives**: correctness and surface-level novelty did not collapse
   at n=50. The v1-era claim "LLM authoring re-collapses to canonical" is wrong *at the surface level*
   for fresh high-effort agents.
2. **But the canonical pull is real — it just lives one level up.** Independent agents don't repeat
   *items*; they repeat *skills*: five agents independently chose prism-volume, four chose the
   circle-equation (that one not even mandated by the breadth requirement). Different numbers, same
   structure — i.e. **undeclared family variants**. Extrapolated to n=200 without a ledger, a
   mock-module product would silently violate ≤1-per-structure. This is v1's collapse, deferred and
   diluted, not abolished.
3. **Quality disperses across sessions.** The single pilot (7.9 auth) was a good draw; across five
   agents the sample mean fell to 6.6 with individual items as low as 3. Voice floors must be
   *enforced*, not assumed, on solo output too.
4. **Same-model blind agreement is strong evidence, not proof.** Author and solver share a model
   family; correlated blind spots are possible in principle. For shipping, the independent-resolver /
   sympy tier remains the standard.

## Conclusion — the measured division of labor

Neither side wins alone. The inverted architecture is now empirically grounded end-to-end:

- **Solo clean-room agents AUTHOR** — best-in-class item writing, real novelty at the item level,
  correct at the measured rate of 50/50.
- **The engine INDUSTRIALIZES** — precisely the four things the scale test showed solo agents cannot
  provide: (a) the **dedup/family ledger** that catches skill-level convergence across sessions;
  (b) the **authenticity floor** that catches the 3s and 5s; (c) **independent verification** beyond
  same-model agreement; (d) **parameterization** that turns each accepted item into a family with
  $0 variants, ladders, and diagnostics — amortizing the ~8k-token authoring cost across unlimited
  practice volume.

Artifacts: `scratchpad/scale/a1..a5/` (5 HTML sets + items.json), `solve-1/2.json` + key,
analysis in `scale-analyze.mjs`. Pilot set: `scratchpad/freshgeo/`.
