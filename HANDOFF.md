# HANDOFF — SAT-Insight-Gen

_Last updated: 2026-06-22 · Repo is GIT (`main` = old hybrid baseline; BUILD_SPEC on `build-spec-pipeline`; latest work on `opus-double-gate`). NEW ARCHITECTURE per `BUILD_SPEC.md` — see below._

## ⮕ CURRENT: ALGEBRA GRAPH PIPELINE — complete (2026-06-22, branch `opus-double-gate`, commits 93e1b96→3c89436)
A construct-backward graph-item pipeline for Algebra. **Graphs invert model-first**: the FIGURE is the source of truth, so the harness pins the figure + answer + distractors → correct BY CONSTRUCTION, and abstract graph tasks need **NO LLM** (`build/graph.mjs`; routed from `cell.mjs drawTwoVar` when the task is in `GRAPH_TASKS`; pipeline harness-complete branch skips rationale+author, re-draws on a gate miss). Tier C.
- **12 graph tasks**, all rubric-grounded: `read_value`, `slope_from_points`, `connect_graph` (graph→eq), `system_read`, `system_count`, `inequality_region`, `parallel_perp_graph`, `equation_to_graph` + `inequality_to_graph` (**4 figure OPTIONS** — "which graph"), `point_in_region`, `feasible_region` (system of 2 inequalities, overlapping shaded), `interpret_graph_context` (graphed model, interpret slope/intercept). All in `linear_equations_two_variables` (algebra.json), tier C, LLTM-banded B2–B6.
- **Verification (no LLM):** `verify/figurecheck.mjs` (per-type: points-on-line(s), system intersection on both / parallel, inequality boundary↔shaded, **distractor-validity** for which-graph = exactly-one-option-matches, **point-membership** for region tasks); `verify/legibility.mjs` (graph analog of plausibility — wired into `verifyAndGate`, plausibility skipped for tier C). `figures/verify-all.mjs` adversarial gate passes all live figures.
- **Standardized presentation:** every coordPlane is a symmetric square ±6 unit-grid window (`standardFrame` in graph.mjs); ±10 fallback only if a feature exceeds ±6.
- **Renderer:** `figures.js coordPlane` shaded region uses Sutherland–Hodgman half-plane clip (correct for steep boundaries; `spec.shaded` may be an ARRAY for systems). `render.mjs` renders per-option figures in a 2×2 grid (FIG_OPT_CSS). Dashed boundary = strict `<`/`>`, solid = `≤`/`≥`.
- **Eval drivers:** `build/_graphtest.mjs` (offline correctness-by-construction, 600 draws/0 err), `build/_graphspot.mjs` (graph-only test → `data/test-101.json`, 36/36 through the real gate), `build/_shadedcheck.mjs` (72 half-planes correct — shaded-region regression guard).
- Rubric coverage vs `matrix.json` algebra is now COMPLETE for graphs/figures (the one figureLoad:req statement ALG.B2.s2 is covered line+system). Tables are still LLM-authored (text pipeline), not construct-backward — a possible future rigor upgrade.
- **NOT yet done:** a full mixed `--domain` LLM run confirming graph items flow alongside text items at scale (the harness-complete branch is wired + unit-tested via `_graphspot`, but not exercised in a full pipeline run).

## model-first authoring + authenticity finding (2026-06-21, branch `opus-double-gate`, commit d99c522)
A refinement on the BUILD_SPEC pipeline (described below). The harness now pins item **STRUCTURE, not exact numbers**: it draws the band-fixing radicals + a structure directive; the **author invents a natural situation and picks fitting numbers**; PROVE re-derives; the LLTM gates the band off the radicals. This removes the "context pasted onto a pre-set equation" tell. Graph tasks (`read_graph`/`connect_graph`) stay harness-pinned (figure + answer).

- `build/cell.mjs` — drawers emit MODEL-FIRST structure directives (`answer:null`). Structure-analysis tasks (`num_solutions`, `missing_coeff`, `number_of_solutions`, `variable_constants`) forced **ABSTRACT** (no scenario) to match the real SAT. MCQ/SPR ratio fixed (~50/50 → **~70/30**). Keeps context (without-replacement) + task (least-used) rotation.
- `build/author2.mjs` — **few-shot VOICE anchors** from real CB exemplars (`taxonomy/exemplars.clean.json`, held out by band so the same-band judge pair isn't leaked); **variable-definition** + phrasing discipline; model-first contract (author owns the numbers).
- `build/selector.mjs` — tier-C `figureCheck` (graph items) + run-level structural-clone dedup (`SIG_STRUCT_DEDUP`).

**Authenticity spot-check** (blind judge vs CB exemplars — `build/_authjudge.mjs` matched-pairs, `build/_absjudge.mjs` absolute):
- **The matched-pairs metric is CONFOUNDED by recognition** (the judge has memorized released items → "I recognize the Kelvin item"); it scored ours 4.1 vs 8.1. **Use the ABSOLUTE single-item judge** (`_absjudge.mjs`) instead.
- ABSOLUTE authenticity: **5.8** (model-first only) / **5.9** (+ abstract-task/few-shot/phrasing) vs **8.0 official** (clean ceiling ~9). Real gap ≈ **2 pts, not 4**. Abstract-task fix moved the how-many-solutions item **3→9**. The 4 fixes net flat on aggregate because the judge always finds a fresh nit.
- **DOMINANT remaining tell = variable definition** (CB defines the variable in its own clause or omits it from the ask; we embedded it awkwardly). Fix applied in `author2.mjs` STYLE but **UNVERIFIED** (chose to bank, not spend another cycle).
- 2 official exemplars are **scrape-corrupted** (`2x+16=ax+8`, `x+63=x+613`) — excluded from few-shot + baseline.
- Re-run: `SIG_OVER=2 node build/_spot.mjs 99` (gen 8) → `node build/_absjudge.mjs official data/test-98.json data/test-99.json`. **NOTE:** the judges' `texToPlain` MUST keep `$` (currency) and map `\ell`→ℓ — a bug stripped both and unfairly tanked currency/ℓ items.

## BUILD_SPEC four-agent linear pipeline (2026-06-19) — base architecture
The architecture was rebuilt to `BUILD_SPEC.md` — a **linear four-agent producer + deterministic two-tier selector** (PromptCoT rationale→author + PROVE program-verifier). This REPLACES the hybrid grid+open-lane + LLM-judge approach. Diagram #5 in `ARCHITECTURE.md`.

**Modules (all new, on branch `build-spec-pipeline`):**
- `taxonomy/cells/algebra.json` — per-subdomain RADICAL axes (difficulty-determining) vs INCIDENTAL axes (surface) + hand-set LLTM weights + official band cut scores. Only `linear_equations_one_variable` so far (build order step 1).
- `difficulty/lltm.mjs` — additive LLTM over radicals → 200-800 scale → band; `radicalsForBand`, asymmetric `bandGate` (reject if harder), `fitWeights` (step-5 refit hook). **Replaces the drifting LLM-judge.**
- `build/cell.mjs` — `drawCell()`: radicals PINNED to band, incidentals (context, var, **concrete numbers**) DRAWN in code (BUILD_SPEC §8 — never let the model pick them). `drawNumbers()` constructs the core equation backward, band-appropriate.
- `build/rationale.mjs` (Agent 1, sonnet) + `build/author2.mjs` (Agent 2, sonnet/opus): system prompts verbatim from spec; author emits flat JSON + typed `solve_path`; harness pins the numbers/answer, author only disguises + contextualizes.
- `verify/prove.mjs` — Tier A: Agent 3 writes a sympy `verify()`, run in an isolated subprocess, 10s hard timeout (sandbox tested). `verify/consistency.mjs` — Tier B: N-solve self-consistency for free domains (also the §5.2 difficulty-measurement signal).
- `build/selector.mjs` (`verifyAndGate` + `surfaceDup`) + `build/fingerprint.mjs` (op-sequence + structural distance; reskin gate LOG-ONLY until histogram seen).
- `build/pipeline.mjs` — `generateTest(blueprint)`: draw→rationale→author→selector (parallel) → dedup (sequential) → `pickBalanced` → render-schema adapter.

**Run it:**
```bash
SIG_OVER=2 SIG_LLM_CONCURRENCY=4 SIG_POOL=5 node build/pipeline.mjs linear_equations_one_variable 6 B1,B2,B3,B4 91
node build/render.mjs data/test-91.json
```
**Proven (test-91):** 12/12 passed the gate, B1 items distinct (`w+1=4` vs `3h=15`), strong context/structure/answer-type variety, all 6 PROVE-verified, clean B1–B4. `claude` CLI has NO --temperature (variety is harness-drawn; Tier-B varies the prompt per solve). python3 + sympy 1.14 system-wide (no venv).

**Next on this branch:** (1) add cell schemas for the other algebra subdomains, then advanced/psda/geometry (geometry = Tier B consistency); (2) tighten author realization of `has_fractions`/`has_distribution` disguises; (3) BUILD_SPEC step 3 — log the structural-distance histogram, then set per-cell ε reskin floor; (4) step 5 — refit LLTM weights from Tier-B measured difficulty + log the structure-vs-model correlation `anc(d)`; (5) typeset math in the adapter (currently plain-text segments). Old hybrid batch (the held 20×22) lives on `main` if ever wanted.

## What this is
A Skills-Insight–indexed SAT Math generator with perfect figures and RP67-quantified difficulty. New repo reusing SAT-Mod2 (figures/site/verify) + SAT-AI (recompute leash/ledger/profiles). Full design plan: `~/.claude/plans/cuddly-dazzling-reef.md`. Source doc: `~/Downloads/skills-insight-digital-sat-suite.pdf`. Architecture history + diagrams: `ARCHITECTURE.md`.

## Phase 0 — DONE ✓
- **Repo scaffolded** at `~/Downloads/SAT-Insight-Gen`; ported verbatim from SAT-Mod2: `figures/figures.js`, `assets/{base,print,theme}.css`, `app.js`, `katex/`, `fonts/`, `build/render.mjs` (only edit: figures import → `../figures/figures.js`). npm `katex` resolves from `build/node_modules`.
- **`taxonomy/matrix.json`** — the full 4×7 Skills-Insight matrix: 28 cells, 66 statements, 10 program-gated, with scale ranges + band midpoints + RP67/RP50 note. The direct answer to "isolate the skills."
- **`taxonomy/skills.json` + `crosswalk.json`** — GENERATED by `build/_build_taxonomy.mjs` (do not hand-edit; edit the builder or matrix). 91 generatable templates (39 from SAT-Mod2 backbone, 52 new low-/mid-band), each with: recompute branch (one of the 21 SAT-AI branches, or `needs-deep-verify` for 2 qualitative ones), params contract (from SAT-AI PARAMS_HINTS), the bands it serves, and per-band `bandLevers`.
- **`taxonomy/item.schema.json`** — per-item record (SAT-Mod2 segment model + band spine + difficulty + verify records).
- **Module interfaces:** `difficulty/index.js` (Subsystem A — `measure`/`accept`/`bandOf`; Phase-0 anchor-only stub) and `figures/index.js` (Subsystem B — `render`/`verify`; Phase-0 structural stub).
- **`build/validate-taxonomy.mjs`** — the spine/interface gate. PASSES. Caught and we fixed one real bug (exp_model spanned advanced_math↔psda).
- **Fixture** `data/test-99.json` renders to `tests/test-99/` — 2 SVG figures, 16 KaTeX spans, 0 math errors.

### Verify the build is healthy
```bash
cd ~/Downloads/SAT-Insight-Gen
node build/_build_taxonomy.mjs && node build/validate-taxonomy.mjs && node build/render.mjs data/test-99.json
```

## Phase 1 — DONE ✓ (Algebra MVP, end-to-end)
Full band-targeted pipeline built and proven on a 3-item Algebra pilot (B2/B4/B5), all doubly-verified, band-measured, rendered + pixel-checked.
- **`verify/recompute.js`** — JS port of SAT-AI's leash for the 5 Algebra branches (`alg_linear_eq_1var/eq_2var/func/systems/inequalities`) + `toFloat`/`close` + emits the LLTM `feature_trace`. Tests: `node verify/recompute.test.mjs` (22 pass).
- **`build/llm.mjs`** — transport via the local **`claude` CLI** (subscription, no API credits). Model `claude-opus-4-8`, `--permission-mode plan`, JSON envelope. Env: `SIG_MODEL`, `SIG_LLM_TIMEOUT` (use 300000 for figure items — they're slow).
- **`build/author.mjs`** — band-lever-injected author prompt (levers from `skills.json` bands[b]); emits stem + params + figure spec + claimed answer + solution. **`verify/deep-verify.mjs`** — the BLINDED second solve (separate call, never sees the claimed answer).
- **`build/ledger.mjs`** — anti-repeat (cell hash + numeric-blanked 4-gram Jaccard@0.6), JSON-backed at `data/ledger.json`.
- **Subsystem A:** `difficulty/features.js` (LLTM feature vector + hand-set priors) + `difficulty/index.js` `measure()` = band-anchor ⊕ intrinsic feature estimate; `accept()` = band gate. Verified the gate BITES (a trivial item claiming B7 measures B5 → rejected). Tests: `node difficulty/difficulty.test.mjs` (8 pass).
- **Subsystem B gate-1:** `figures/consistency.js` `measureFigure` — coordPlane checks (points lie on drawn lines; params slope/intercept matches a drawn line). Tests in `build/phase1-deterministic.test.mjs` (10 pass, incl. ledger).
- **`build/generate.mjs`** — the orchestrator: author → recompute → figure-consistency → difficulty(accept iff band within ±1 of target) → blinded deep-verify → ledger → assemble. **Run:** `SIG_LLM_TIMEOUT=300000 node build/generate.mjs pilot` → writes `data/test-80.json`.
- **`build/render.mjs`** — band-aware masthead + band/scale badge on each question; segment renderer now inserts spaces at inline-math↔text boundaries (fixes "ofyin"; keeps "xy-plane" attached).
- **Result:** `data/test-80.json` (3 items) → `tests/test-80/` renders clean (figures + KaTeX, 0 math errors), pixel-verified.

### Phase-1 decisions / honest caveats
- **Band tol = ±1 in Phase 1** (env `SIG_BAND_TOL`): the difficulty estimator uses uncalibrated hand-set priors, so exact-band (tol 0) would over-reject and waste LLM calls. The exact scalePoint is always recorded. **Phase-2 calibration + judge panel tightens to tol 0** — this is the big accuracy step.
- **`item.band` = MEASURED band** (not target); `target_band` keeps provenance. So Q3 (system_solve, aimed B6) is filed honestly as B5@607.
- **`bandOf` partitions by lower cut scores** (370/420/470/550/610/680); published scaleMax values leave display gaps (601–609) — do not treat them as hard maxima.
- **Only a 3-band pilot was generated** to bound LLM spend. Scaling to a full multi-item-per-band Algebra set = expand `PILOT` in `generate.mjs` (or add a coverage-driven planner) — bounded only by budget. The taxonomy, estimator, and gate are already band-general.
- **deep-verify is reasoning-only** so far (no code exec); recompute.js does the rigorous numeric check. Phase 2 can add a SymPy venv for symbolic cases.

### Run the full gate
```bash
node build/validate-taxonomy.mjs && node verify/recompute.test.mjs && node difficulty/difficulty.test.mjs && node build/phase1-deterministic.test.mjs
```

## Phase 2 — IN PROGRESS (accuracy: judge panel + figure verification + calibration)
- **P2d figure verification DONE:** `figures/verify-all.mjs` — adversarial re-render→parse→measure arms for coordPlane/scatter/triangle/circle, with SVG-mutation self-tests that must bite, a HARD GATE (self-tests + all live generated figures) and an extreme-geometry DIAGNOSTIC. Run: `node figures/verify-all.mjs`. (parallelLines family stays in `figures/verify.mjs`.) Found 3 figures.js hardening TODOs at extreme params (aspect caps, label margins) — tracked, not gating.
- **P2b judge panel DONE:** `difficulty/judge.mjs` — N independent panelists estimate P(correct) per band → interpolate RP67 (and RP50 for exemplars); band definitions are GROUNDED in the PDF's actual Skills-Insight statements per domain (matrix.json); hand-curated few-shot anchors. `difficulty/index.js measureFull()` reconciles anchor+feature+judge by inverse-variance pooling + RP50 exemplar tag. Opt-in in generation via `SIG_USE_JUDGE=1` (+3 calls/item).
- **P2a sourcing RESOLVED:** harvested College Board's own Skills-Insight **exemplars** via Playwright — the tool's pages are server-rendered per `?domain=&score_band=MSSn` URL (domain codes H/P/Q/S, bands MSS1–7), so one pass of same-origin `fetch` pulled all 28 cells. `taxonomy/exemplars.json` (40 band-labeled examples, Algebra/Advanced/PSDA) + `exemplars.clean.json` (34 clean items, all 7 bands). Gaps: Geometry exemplars are figure-IMAGES (no text); some math lost structure (MathML had no TeX annotations). This is the authoritative band-aligned set.
- **P2c calibration + validation DONE:** `difficulty/validate.mjs` (held-out spot check) + `difficulty/calibrate.mjs` (collect→fit, resumable). Ran the judge on all **34 official exemplars** (n=2). **RAW judge: ±1-band=88%, Spearman ρ=0.90, exact=47%, RMSE=57** vs College Board's OWN band labels — already well-calibrated. A linear de-compression map (b≈0.97) does **NOT** beat raw on leave-one-out CV, so it is **NOT deployed** (`calibration.json` `deployed:false`; `judge.mjs` falls back to raw). The earlier 7-item "compression" was sampling noise. Generate gate stays **tol=±1** (`SIG_BAND_TOL`) — evidence: ±1 is reliable (88%), exact is ~half (47%), so ±1 is the right operational tolerance, not 0.
  - Re-fit anytime ($0, reuses data): `node difficulty/calibrate.mjs fit`. Re-collect: `SIG_LLM_TIMEOUT=300000 SIG_PANEL_N=2 node difficulty/calibrate.mjs collect`. Artifacts: `difficulty/judge-raw.json` (34 labeled judge outputs), `calibration.json`.
  - **Optional refinements (not blocking):** OCR the Geometry figure-exemplars (vision) to add the 4th domain; try n=3 / isotonic if a future larger labeled set warrants it.

## Difficulty engine is now LLM-JUDGE ONLY (2026-06-17)
- **The deterministic anchor+structural-feature estimator was REMOVED** (`difficulty/features.js` deleted; `difficulty.test.mjs`/`judge.test.mjs` deleted). It was a brittle proxy: it over-rated items with figures and a crude `is_parametric` heuristic flagged any lettered param string (e.g. `shape:"triangle"`, `measure:"perimeter"`) as parametric (+65), pushing a trivial perimeter item to B3.
- `difficulty/index.js` `measure(item)` is now **async and judge-based**: scalePoint = the panel's RP67 crossing, band = `bandOf(scalePoint)`, RP50→exemplar. Falls back to the target-band midpoint only if the judge transport fails. `generate.mjs` always uses it (no more `SIG_USE_JUDGE` flag). Panel size via `SIG_PANEL_N` (default 2).
- Why: the judge reads the actual cognitive task. Validated ρ=0.90/±1=88% vs CB labels; e.g. q8 (sum 3 triangle sides) — deterministic said B3, judge correctly says **B1**.
- `build/regrade.mjs` re-measures a test file's items with the judge (resumable). The showcase `data/test-81.json` was re-graded so its bands are judge-accurate.

### Judge fidelity upgrade + critique→revise loop (2026-06-17)
- **Judge grounded in CB's real rubric, verbatim:** band descriptors are the FULL, un-truncated Skills-Insight statements per domain (removed a 380-char cap in `judge.mjs bandDescFor`), and the few-shot anchors are now **official CB exemplars** (`taxonomy/anchors.json`, 1/band B2–B7, from `build/pick-anchors.mjs`) instead of hand-written ones. Held out from validation. **Validated: within-±1 88%→93%, ρ 0.90→0.91, exact 47%→50%.**
- **Critique→revise loop:** `difficulty/judge.mjs retargetHint()` turns a band MISS into one concrete revision instruction (e.g. "make a coefficient parametric / remove the method cue"); `build/generate.mjs` feeds it to `author(target, feedback)` (prompt injects a REVISION block) on the next attempt — no more blind re-rolls. `SIG_MAX_REPAIRS` (default 2) sets the feedback-guided retries. `generate.mjs` is now importable (`generateOne`/`resolveTarget` exported; `main()` guarded). Demo: `node build/demo-loop.mjs` (drove a B4 item → B6 → B7 in 2 guided revisions).
- **Loop-driven showcase result:** regenerated `data/test-81.json` (28/28) with the loop → **100% within ±1 band of target, 46% exact**, all deep-verify PASS, 8 cells needed judge-guided revisions (vs the old pipeline which scattered up to 3 bands off). Renders to `tests/test-81/`.
- **Two more figure fixes (pixel-caught):** (1) x-axis name moved onto the axis line past the arrow (was above the axis, colliding with point labels near the right end). (2) `verify-all.mjs` label-overlap gate now flags real INTERPENETRATION (>1.5px both axes), not a box-model "touch" — `textW` over-estimates glyph width. Figure gate is clean with 0 extreme-geometry TODOs remaining.

## Full-matrix showcase + figure fixes (2026-06-17)
- **`data/test-81.json` = the 4×7 showcase: 28/28 cells** (every band × every domain), 7/7/7/7 domain balance, 16 mcq / 12 spr, 7 figures (coordPlane/triangle/table), 0 KaTeX errors, all deep-verified PASS. Renders to `tests/test-81/`. Generate/resume: `SIG_LLM_TIMEOUT=300000 node build/generate.mjs matrix` (resumable — fills only missing cells; ledger `data/ledger-matrix.json`).
- **`recompute.js` now DEFERS on a non-numeric answer** (interpretation / "which is true" / identify-coefficients / parametric items) → the blinded verifier gates them, instead of the numeric leash falsely rejecting. This filled the last 3 (Algebra B4/B6/B7) holes. Non-Algebra branches also defer (Phase-3 ports them).
- **`author.mjs` figure guide expanded** to scatter/barChart/dotPlot/triangle/circle (was coordPlane/table only) so non-Algebra figure cells render.
- **figures.js arrowhead fixes (both pixel-QA catches):** (1) vertical-axis markers `arrowU`/`arrowD` were `orient="auto"`, which double-rotated the pre-vertical chevron so the y-axis arrow pointed sideways → set `orient="0"`. (2) their refpoint was the base (refY), leaving a gap between the open caret and the axis tip → moved refpoint to the TIP (`arrowU` refY 0, `arrowD` refY 6), matching the x-axis arrow. `figures/verify-all.mjs` has a regression self-test for `arrowU orient="0"`.
- **figures.js point-label clamp** (coordPlane) so an edge point can't clip the frame. **verify-all.mjs**: dropped the label-vs-curve box-distance check from the hard gate (it over-flagged a point label near its own on-curve point; crowding/legibility is a pixel/vision-QA judgment, not box distance). Live gate now = frame-clip + label-overlap + per-type geometric arms.
- Reminder: the deterministic figure gate can't see arrowhead orientation or legibility — those are **pixel/vision QA** (Playwright screenshot + look). Both arrow bugs were caught that way; keep that loop in the publish path.

## Novel procedural figure generators — variety beyond parabolas/triangles (2026-06-17)
Self-verifying, $0 (no LLM): CONSTRUCT-BACKWARD (build the answer structure → realize it as a figure → hide the data → ask), so the answer is known by construction and double-checked numerically.
- **`gen/graphgen.mjs` — DISABLED 2026-06-17** (too narrow / not SAT-aligned; `export const DISABLED=true`, `buildGraphItem()` throws, dropped from `module2.mjs`, its test skips). Rework per FIGURE-PLAN.md Step 4.3 after the B1–B4 batch ships. Original capability below: Graph-intersection questions: choose nice roots → build f, g with f−g = leading·∏(x−rᵢ) → graphs intersect exactly there → ask sum/product/count of intersection x-coords (obfuscated: solver must set f=g and solve f−g=0, then apply Vieta). Variety: line/quadratic/**cubic**, 1–3 intersections. Aspect-capped windowing so cubics render cleanly. `node gen/graphgen.test.mjs` → 16/16 self-checked + rendered; `data/test-graph.json` renders to `tests/test-90/`. (TODO: exponential/log curves need a figures.js fn-renderer that takes serializable params.)
- **`gen/diagramgen.mjs` — DISABLED 2026-06-17** (stopgap; `DISABLED=true`, throws, test skips, removed from `module2.mjs`). Both procedural gens are now off → to be replaced by ONE SAT-aligned figure generator per FIGURE-PLAN.md (after the B1–B4 batch ships). Original capability below: Polygon vertex-angle questions (quadrilateral/**pentagon** — variety beyond triangles): pick true x + integer angles summing to (N−2)·180 → present each as an x-expression aᵢx+bᵢ → solver uses the angle-sum to solve for x then evaluates the target. Self-verifying (Σ expr = total at x). New `polygon(spec)` renderer added to figures.js (generalizes triangle). `node gen/diagramgen.test.mjs` → 16/16; `data/test-diagram.json` → `tests/test-91/`. NOTE: figure labels are SVG text → use Unicode "°", NOT LaTeX (the bug that showed `^{\circ}` literally).
- **Parallel B7 fleet — TODO (#1):** run the full verified pipeline concurrently over ~22 Band-7 Module-2 targets, drawing on graphgen/diagramgen for novel figures (xhigh). Decide node-parallel (reuses leash+judge+loop) vs Workflow-tool (true parallel xhigh agents).

## Later
- **Phase 2** (first paid phase): calibrated multi-LLM-judge panel + inverse-variance reconciliation + RP50 exemplars; **source the labeled corpus** (Skills-Insight exemplars at satsuite.collegeboard.org/skills-insight FIRST — already band-labeled; then Question Bank/Khan/Bluebook; seed M1/M2 as coarse anchor); validate to ρ≥0.70 / RMSE≤60 / ±1-band≥0.90. Generalize figure verify to all types + extremes matrix + Playwright pixel-QA.
- **Phase 3–5:** other 3 domains + low-band templates; coverage-driven planning; PSAT program gates; output profiles (per-band drills, band sets, adaptive modules); empirical 2PL/3PL IRT when response data exists.

## Gotchas / decisions
- **Serve from repo root** (like SAT-Mod2), not a `site/` dir — keeps asset depths in `render.mjs` correct. `tests/` holds rendered pages.
- **skills.json / crosswalk.json are generated.** Always edit `matrix.json` or `_build_taxonomy.mjs`, then re-run the builder + validator.
- **Domain coherence is enforced** — a template may not span content domains (validator errors). Keep PSDA growth-factor (`growth_factor`, psda) separate from Advanced Math exponential modeling (`exp_model`, advanced_math).
- **Math scale ranges are identical across SAT/PSAT programs** (only R&W middle bands differ) — so the band axis is program-independent; programs only gate *which statements* apply.
