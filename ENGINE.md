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

- **SCALE TEST (n=50, SCALE-TEST-50.md)**: 5 mutually-blind clean-room agents × 10 GEO items. Correctness 50/50 (blind solve), surface novelty held (0 dup-level pairs) — but two failure modes appeared that the n=10 pilot hid: **skill-canon convergence** (5/5 agents wrote prism-volume; ~20/50 items in 6 repeated skill groups = undeclared family variants — v1's collapse one level up) and **authenticity dispersion** (sample mean 6.6 vs pilot 7.9; items as low as 3). Empirically grounds the inverted architecture: solo agents author; the engine's ledger, floors, independent verification, and parameterizer industrialize.
- **HARVEST (2026-07-01, `engine/harvest.mjs`)**: all 95 clean-room items folded into the two-tier bank under a new **`authored` gate branch** in family.mjs — verification is MEASURED, never faked (cross-model blind solve ×2, per-item absolute-judge authenticity, banding per the blind-calibration guide with a full blind band audit; no selftest is invented). Result: **61 authored families + 86 variants minted; 9 rejected as structural kin of banked parametric families** (all six convergent prism items, a4#8 tangent-length, a4#9/a5#9 altitude-geometric-mean) — the ledger catching exactly the duplicates it was built for (`data/engine/harvest-rejections.jsonl`). The scale test's convergence clusters are now DECLARED families with variants (6× transversal, 5× circle-equation, …) — free drill ladders. Cross-model correctness after format-normalization: **95/95** (every apparent disagreement was answer-format, the recurring lesson). 3 legacy items re-banded ≥2 bands by the audit (pre-guide author labels; audit matched the guide's table). Per-item floors recorded: 32/86 variants carry `strictPass:false` (mostly legacy-set voice scores; legacy full-measure auth mean 6.42 vs steered 7.06 — confirms the baseline dispersion at n=60). Authored variants are `cleanroom-text-v0` (no render schema) — **assemble.mjs skips them in modules/ladders until a render adapter exists**; they serve the ledger, dynamic avoid-lists, and future parameterization. Family `strictPass` = "structure CAN produce a passing item"; the per-variant flag is the per-realization truth.
- **STEERED-35 (n=35, STEERED-35.md)**: the controlled fix for failure mode #1 — same clean-room conditions, ONE Fable author, novelty put IN the objective (14 banned modal structures, name-the-modal-then-avoid procedure, disclosed scoring). Result: **canon hits 20/50 → 0/35; nearest-corpus sim 0.46 → 0.23** (0.17 vs the prior 50); authenticity ROSE (6.6 → 7.06 mean; tradeoff only in the tail, 2/35 pushed out-of-voice); correctness **35/35 cross-model** (2 blind Opus solvers); blind Opus band audit 35/35 within ±1 (B7 5/5 exact — the geo banding guide transfers across models). First live run of the **lighter harness: Fable authors ~3.5k tok/item, all gates Opus/deterministic** (scanner: `engine/verify/cleanroom-scan.mjs`). Untested: cross-session convergence under a STATIC packet — production needs dynamic avoid-lists from the ledger.

## The SUITE (end-to-end mastery loop, 2026-07-02 · v1.5 same day — "not good enough" upgrade)
v1.5 (the shipped shape): **full-domain modules + Bluebook-style player + the whole mastery loop inside one static page.**
- **Problem sources**: the engine two-tier bank AND the v1 item bank (`engine/bank-source.mjs` — 902 verified render-schema items, all four domains; pseudo-families from import-proposals, ungrouped items guarded by a pairwise surface floor). Modules are domain-aware (≈8 algebra / 8 advanced / 3 psda / 3 geometry per 22). Reserve minting tops $0-reseed families to ≥6 variants before assembly.
- **Player** (`assets/suite.js`, full rewrite): one question at a time, palette with answered/flagged states, flag-for-review, soft 35:00 module timer, review-before-submit, M1→routed-M2 interstitial; results = **estimated Math scale range** (RP67 frontier over band_cuts; labeled calibration-pending) + deficit map + review with solutions + progress across rounds.
- **In-page loop**: an embedded practice pool (~900 compact entries — stems as segs, client-rendered with vendored KaTeX; figures pre-rendered SVG; page ~3.4MB single file, file://-capable by construction) + a client-side prescriber (port of prescribe.mjs, kept in sync). Mastery model v2: MASTERED (≥3-of-last-4 ≥75% OR error-then-2-consecutive-correct recovery) · DEFICIENT · REVIEW (error to chase) · OK (passing, confirmed lightly, never blocks). Supply-dry cells are split out honestly as GENERATION DEMAND with the --fill-gaps pointer.
- **Verified**: scripted browser journey — diagnostic 33/44 (est 550–610) → routed hard M2 → 1 targeted round → "All practicable cells mastered" + 5 micro-cells correctly named as bank-dry (their true supply: 1–3 items each); 0 repeated variants; node suite-e2e green (CLI loop reaches MASTERY in 2 rounds); fixed en route: bank `id` field clobbering question ids (spread order), unrouted-M2 supply locked out of the pool, `[hidden]` vs author-display CSS.

## The SUITE (v0 record, superseded above)
Diagnose → target → train-to-mastery, offline-first (static pages, localStorage, no accounts):
- **`cli suite <id>`** — assembles M1 (22, mixed bands) + M2-easy + M2-hard (≤1 family per student-visible path, band mixes per `suite.mjs MIX`, seen-ledger aware) and renders ONE self-contained player page (`tests/suite-<id>/`) through the unchanged v1 chain — authored clean-room items flow via `render-adapter.mjs` (extracted SVGs → `figures.js raw` passthrough; 95/95 extracted, 86/86 converted), parametric/KaTeX items untouched. Player (`assets/suite.js`): M1 → threshold route (≥60% → hard M2) → deficit map (subdomain × band) → per-item review with solutions → results.json download + localStorage.
- **`cli prescribe <results.json> --student <id>`** — updates `data/students/<id>/` (history/seen/mastery; git-ignored), applies the mastery model (MASTERED ≥3-of-last-4 ≥75% · DEFICIENT <50% on ≥2 · else THIN → more measurement), and emits a targeted practice page: drills on the exact missed structures (parametric families mint fresh $0 reseeds on demand) + unseen-family transfer items. Loops until **MASTERY ACHIEVED**, or terminates **BLOCKED with the exact dry cells named** — `--fill-gaps` then emits a STEERING PACKET per dry cell (target cell + the live 88-structure avoid-list from `loadFamilies()` — the dynamic avoid-list) ready for a steered clean-room author run (STEERED-35 protocol).
- **Proof**: `engine/verify/suite-e2e.mjs` — simulated weak-in-circles/right-trig student: deficit map matched the injected profile with 0 false flags, 0 repeated variants across 75 served, all practice on-target, terminal state honest (BLOCKED cells verified supply-dry + packets emitted). Browser-verified via Playwright (routing, grading, deficit map, localStorage, download).
- Honest bounds: coverage = bank coverage (geometry_trig + algebra; no PSDA/Advanced-Math claims); bands still rubric/expert-calibrated, not student-data-calibrated — suite results.json is the future calibration feed; answer normalization is shared `engine/answers.mjs` (client copy in suite.js).

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
node engine/verify/cleanroom-scan.mjs <setDir> [--prior a1,..] [--emit <dir>]  # clean-room set scanner
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
