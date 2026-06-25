# GEO-1 — Geometry & Trigonometry pipeline (text/formula-first)

_2026-06-24 · the fourth and final content domain. Built on the same engine as Algebra and Advanced Math — no special-casing._

## Why text-first
The Geometry & Trigonometry Skills-Insight rubric has **19 statements across B1–B7, and every one is figure-OPTIONAL** (only `GEO.B5.s1`, sine/cosine + radians, is figure-`none`). Nothing forces a figure. So GEO-1 builds the domain as a **text/formula-first** pipeline — model-first authoring, configurations described in self-contained prose, **exact answers** (integer, simple fraction, radical surd, or π-form), verified by program or self-consistency. This gives **full rubric coverage with zero new figure renderers**. Figures (a large, separate effort — 3D solids, circle arcs/sectors, trig labeling all missing today) are deferred to **GEO-2**.

## Reuses the algebra pipeline verbatim (structure)
Geometry plugs into the existing engine with **no mechanism changes**:
- `taxonomy/cells/geometry_trig.json` — same shape as `advanced_math.json`; `@contexts` for incidentals (the model-first author invents the scenario; the context hint isn't load-bearing).
- `build/cell.mjs` — 4 model-first drawers via the shared `mf(...)`; registered in `DRAWERS`; theorem/trig/coordinate tasks added to `ABSTRACT_TASKS`.
- `build/prompts.mjs` — a `geometry_trig` prompt pack (exact-answer discipline, prose-described figures, a `proveHints` formula sheet).
- **Auto-wired, no edits**: `difficulty/lltm.mjs` (loads any `cells/*.json`), `difficulty/judge.mjs` (reads GEO statements already in `matrix.json`), `build/pipeline.mjs` (`DOMAIN_CODE.geometry_trig="GEO"` already set), `verify/*` (routed by `cell.tier`).

## The 4 subdomains (19 statements)
| subdomain | tasks | tier | bands |
|---|---|---|---|
| **area_volume** | rect_area, prism_volume, perimeter, triangle_area, circle_area, pyramid_volume, cube_volume, multistep_area_perimeter, surface_area, solve_dimension, composite_2d3d | **A** (PROVE) | B1→B7 |
| **lines_angles_triangles** | parallel_transversal, triangle_angle_sum, intersecting_angles, scale_factor, similarity, congruence, angle_complex, similarity_right, similarity_complex | **B** (consistency) + A (angle-sum) | B2→B7 |
| **right_triangles_trig** | pythagorean_hyp/leg, special_30_60_90, special_45_45_90, sin_cos_complementary, radian_convert, trig_ratio, trig_complex | **A** (Pythagorean/special/radian) + B | B3→B7 |
| **circles** | circle_equation, arc_length, sector_area, circle_angle, tangent | **A** (eqn/arc/sector) + B (theorems) | B5, B7 |

**LLTM sanity: all 33 tasks predict their rubric band** (`band_anchors` B1:340…B7:740, edges [370,420,470,550,610,680]). Verification tier mix ≈ **65% Tier-A PROVE / 35% Tier-B consistency**.

## Verification
- **Tier A (PROVE / sympy)** for everything mechanizable — Agent-3 writes a `verify()` that recomputes the exact (incl. symbolic √/π) answer: all of area_volume, Pythagorean/special-triangle/radian/complementary, circle equation/arc/sector.
- **Tier B (consistency)** for theorem/relational tasks — LLM solves N× and must agree ≥80%: parallel-line angle relationships, similarity/congruence, scale-factor, trig-ratio reasoning, circle theorems. Consistency doubles as a **well-posedness gate** — a text item that's ambiguous without a figure can't reach agreement and is dropped, so survivors are genuinely figure-independent.
- **Plausibility** stays on for contextual mensuration; abstract figure items skip it.

## Pilot validation (B1–B3, end-to-end)
`--domain geometry_trig B1,B2,B3` → **6/6 cells passed the gate** (3/3 over-generated each, all unique). Every item correct and well-posed without a figure:
- prism volume 17·11·8 = **1496** (PROVE) · triangle perimeter 12+19+27 = **58** · co-interior angles 180−47 = **133** (Tier-B consistency) · triangle area ½·16·9 = 72 · linear pair 180−47 = **133** (PROVE) · Pythagorean hypotenuse √(15²+8²) = **17** (8-15-17 triple).

## Honest caveats
- **No figures in GEO-1** — every item is self-contained text. Rubric-faithful (figure-optional); the consistency gate is what guarantees the theorem items are unambiguous.
- **Tier-B is weaker than PROVE** — theorem tasks rest on LLM self-agreement, not a program proof. Acceptable (no mechanical geometric verifier exists) and gated at ≥80%.
- **B1 is structurally thin** — only one subdomain (area_volume) reaches Band 1, so low-band volume is bounded by that subdomain's task variety. Generation is weighted toward B1–B4 to correct the Mod2 import's B6/B7 skew, but B1 stays the hardest to fill.
- **Authoring nits** — the model-first author occasionally over-contextualizes (a triangle area set "over a swimming pool") or names a gratuitous variable (`height h = 8`); cosmetic, consistent with the other domains.

## Blind QA pass (40-item module, 2026-06-25)
Four blind agents independently solved all 40 banked items **from the question text alone** (no answer, no figure — the GEO-1 premise under test), adjudicated against the construction key.
- **Correctness: 40/40.** Three apparent mismatches were all equivalences: unicode `√` vs `\sqrt` (Q17 `4√11`, Q32 `3√13/13`) and an exact-vs-gridded-decimal SPR (Q39: √325 = `5√13` ≈ `18.03`, where the stem correctly says "round to the nearest hundredth" — an irrational student-produced response must be gridded as a decimal).
- **Well-posedness: clean.** 37 clean + 3 "minor-doubt" (dense angle-position / intersecting-segment phrasing in Q05/Q30/Q37) — **all three still solved correctly**, confirming no item secretly depends on a figure. The Tier-B consistency gate's well-posedness filter held.
- **Nits (no fix):** occasional verbose `@contexts` framing and a "diameter h" naming; cosmetic, consistent with the other domains.
- **Refinement noted:** the prompt pack's "never decimals" rule is right for MCQ (exact radical options) but, for SPR with an irrational value, gridding as a rounded decimal with a "round to…" instruction is the correct SAT form — the author already does this; the rule could say so explicitly.

## GEO-2 (figures) — in progress: 3D solids ✅
The biggest figure gap (4 statements: volume & surface area) is now built.
- **`figures.js prism`** — rectangular box / cube in cabinet oblique projection (front face true-size, depth receding up-right at half scale), dashed hidden edges, edge labels (width-bottom, height-left, length-top), proportions clamped so no edge becomes a sliver (extreme-geometry rule). Auto-wired via `import * as FIG`. Visually verified across cube / 3-4-5 box / flat slab / tall column.
- **`build/solidfig.mjs`** — Tier-C construct-backward builders (the figure pins the dims AND the answer, no LLM): `prism_volume_fig` (B1), `cube_fig` volume/SA (B4), `prism_surface_fig` (B6), `prism_solve_dim_fig` (B6, two edges + volume → find h).
- **`verify/figurecheck.mjs`** — a `prism` arm: the labeled edges must yield the stated volume / surface area / solved dimension.
- New `solid_figures` subdomain in the schema (Tier C); LLTM sanity green (B1/B4/B6). **16 items banked** (test-115), all 4 tasks; rendered + spot-verified correct (volume 84, surface 136, cube SA 96, solve-dim h=5). Bank → 852.

### GEO-2 remaining (next)
- **Circle arcs / sectors** (+ arc-length & sector labels, inscribed/central angle arcs) — the rest of GEO.B7.s3.
- **Right-triangle trig & special-triangle labeling** (opp/adj/hyp, 30-60-90 / 45-45-90) — GEO.B6.s3 / B7.s2.
- **Congruence / similarity tick marks** + angle arcs on `triangle()` — GEO.B4.s2 polish.

## Deferred — GEO-2 (figures)
Reuse `figures.js` triangle/polygon/circle/parallelLines/parallelogram; build the real gaps — **3D solids** (prism/cube/pyramid/cylinder, none exist), **circle arcs/sectors + labels**, **right-triangle trig & special-triangle labeling**, **angle arcs on `triangle`**, **congruence ticks** — then construct-backward "read-from-figure" (Tier C) variants + geometry `figurecheck`/`legibility` arms. (`gen/diagramgen.mjs` is DISABLED and not SAT-aligned — supersede, don't revive.)
