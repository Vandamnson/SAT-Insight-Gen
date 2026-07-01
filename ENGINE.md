# ENGINE v2 — the novelty engine

_Branch `engine` · 2026-06-24 · Mission: a **cheap, excellent SAT resource for students of all backgrounds** — items that are **genuinely novel yet in-distribution** ("questions the College Board could have written but hasn't")._

## Doctrine (what v1 taught us, engineered in)
1. **The LLM never chooses what makes an item novel or true.** The harness owns structure; independent resolvers own truth; calibrated judges own difficulty; the LLM is confined to surface realization.
2. **Novelty is a property of the enumerable structure space**, not model temperature (v1's blind sweep: 73% reskins where the space was thin). The engine grows novelty by adding **steps** and **edges**, never by prompting harder.
3. **Defects fix the generator, not the item** — every gate failure routes to a step/edge/prompt fix so the next thousand items inherit it.
4. **A quality invariant you can bypass isn't an invariant** — the only writer of engine data (`family.mjs`) *throws* without verification records. No flags.

## Architecture (two tiers + three gates)
- **FAMILY** (expensive, once): one verified structure — 80-draw selftest through an INDEPENDENT resolver + essentialChain (no-shortcut proof) + band-pass scores + judged/curated difficulty. `data/engine/families.jsonl`.
- **VARIANT** (near-free): a re-realization inheriting the family's verification — reseed for parametric generators ($0, re-resolved every time), LLM surface for cell families (~4 calls, PROVE-gated). `data/engine/variants.jsonl`.
- **Products**: `assemble.mjs` — mock modules take **≤1 variant per family** (novelty by construction); drill ladders take k variants of one family (practice by design). Both emit v1 render schema.

### Generators
| generator | structure source | variant cost | verification |
|---|---|---|---|
| `chain` | **path composition**: typed steps × curated edge allowlist | $0 reseed | chain resolver (composed independent per-step resolvers) + essentialChain |
| `capstone`/`figcapstone` | v1's 12 curated C/G capstones | $0 reseed | `resolveCapstone`/`resolveAdvFig` (the v1 checkers, exported) |
| `figure` | tier-C construct-backward builders | $0 reseed | figureCheck + legibility |
| `cell` | v1 four-agent text pipeline | ~4 LLM calls | PROVE + plausibility + band gate |

### The band-pass (generation-time, calibrated before enforced)
- **Novelty floor**: nearest-surface similarity < 0.45 AND nearest-structural distance > 0.25, over v1 bank + engine tiers. Calibration: **42/42 known reskins flagged; 32/32 officials pass**.
- **Distribution floor**: `authenticityScore ≥ 7` (absolute judge; officials mean 8.3). A floor, never a target — the anti-recognition discipline.

## Honest current state (findings, not marketing)
- **Port-proof PASSED**: C1/C2/C4 reproduced through the new resolver at 80/80 (scales within ±20 of curated anchors, RMSE 14.7).
- **Composition produces real novelty**: 2 chains that never existed in v1 admitted at 80/80 (`line_x_intercept>coeff_from_point`, `sys_solve>vertical_shift_through_point`).
- **The distribution floor initially rejected all template chains (auth 3–6).** Two fixes, both measured by A/B (`engine/verify/realize-ab.mjs`): (a) stem-template polish (the "(x, y) lies on the graph" fix lifted two chains to 8–9), and (b) **LLM realization** (`realize/llm.mjs`: numbers pinned, answer-pin + PROVE gates — all passed on attempt 1) lifted the rest → **4/5 chains now pass the floor (7–9)**. The realized stems read released-CB (e.g. "In the xy-plane, the x-intercept of the graph of y=−2x+8 lies on the graph of ax+3y=12, where a is a constant. What is the value of a?").
- **One chain SHAPE is inherently out-of-voice**: `sys_nosol_param>linear_solve_with_param` (the C2 shape — reuse k in an *unrelated* second equation) scores 4–5 template AND realized; the judge consistently reads it as "two items bolted together" because the dependency is narrative, not mathematical. Disposition per doctrine: the floor stays at 7; this shape stays **record-mode** (usable in drills, excluded from strict-pass mock modules). Composition lesson: prefer edges whose dependency is *structural* (a point/function feeding the next construction) over *parameter-reuse* edges.
- **Chain banding is calibrated only at B7** (3 anchors) → chains admit B6–B7 only; lower bands come from cell/figure adapter families.
- **The judge is UNCALIBRATED for geometry** (0 geometry anchors — the CB geometry exemplars are figure-images and were never harvested; the judge also only resolves B2–B7). Measured on our figure items it compressed toward the middle (rubric B1/B6/B7/B7/B7 → judge B4/B4/B5/B6/B5; a B1 prism item re-measured n=5 at B3±25). **Policy: geometry bands come from `taxonomy/geo-banding-guide.md`** — a blind, context-free expert calibration (method `expert_blind_calibration`), which superseded the raw rubric-prior after it caught two of our own labeling errors: cylinder forward volume is B3/B4 (the cells file bundles it under the B6 prism statement), and a tangent item whose stem STATES the perpendicularity is B4, not B7 (stating the off-sheet theorem collapses the difficulty — generator lesson: for B7 circle items, never state the theorem). Judge scores stay advisory until geometry anchors exist.
- **Grammar map is coarse** (32 released items) → `grammar.mjs targets` lists under-occupied in-distribution cells; `data/engine/released-ingest.jsonl` is the ingestion path for corpus growth.
- **Misconception tags**: author contract now emits per-wrong-choice tags (optional field); chains are SPR (no distractors). Full deterministic tagging for harness MCQs is future work.

## Run it
```bash
node engine/verify/selftest.mjs            # the hard gate: steps + chains (exit code)
node engine/verify/bandpass-calibrate.mjs  # the confusion table (novelty + distribution floors)
node engine/cli.mjs mint-capstones         # 12 curated v1 families ($0)
node engine/cli.mjs mint-chains            # composed chains → band-pass → mint (record mode)
node engine/cli.mjs variants 3             # 3 variants per family
node engine/cli.mjs module 200 22          # mock module, ≤1 per family
node engine/cli.mjs ladder <famId> 201 5   # drill ladder
node engine/grammar.mjs                    # occupancy map + generation targets
node engine/importer.mjs                   # v1 import PROPOSALS (writes nothing)
node build/render.mjs data/test-200.json   # render through the unchanged v1 viewer
```

## Growth path (each is one reviewed change)
1. **New step** → one file in `engine/steps/` (make + independent resolve + named methods) — selftest enforces the discipline mechanically.
2. **New edge** → one reviewed line in `engine/edges.mjs`.
3. **LLM realization** (`realize/llm.mjs`, next): pinned-numbers directive → authorItem → answer-pin → PROVE; target = lift chain authenticity past the floor.
4. **Corpus growth** → append released items to `released-ingest.jsonl`, re-mine, re-target.
5. **Geometry judge anchors** → OCR the figure-image CB geometry exemplars (flagged optional in HANDOFF P2c) into `taxonomy/anchors.json` so GEO items can be judge-banded; until then GEO uses rubric priors.
6. **v1 import** → adjudicate `import-proposals.json` (432 mod2/misc items need blind grouping).
