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

## GEO-2 (figures) — in progress: 3D solids ✅ (FIVE structures)
The biggest figure gap (volume & surface area, GEO.B1.s1 / B4.s1 / B5.s3 / B6.s1) is built as **five genuinely distinct solid structures**, not number-reskins of one box.
- **`figures.js`** — five cabinet-oblique renderers, each clamped so no edge/face becomes a sliver (extreme-geometry rule), auto-wired via `import * as FIG`, all image-verified across normal + extreme proportions:
  - `prism` — rectangular box / cube (depth receding up-right at half scale, dashed hidden edges, labels width-bottom/height-left/length-top).
  - `pyramid` — rectangular base + apex over the centroid, dashed back edges + dashed altitude.
  - `triPrism` — triangular cross-section extruded, only the back-bottom edge hidden, dashed front-face altitude.
  - `cylinder` — solid top rim, dashed back-arc + solid front-arc on the base, radius across the top, height on the left.
- **`build/solidfig.mjs`** — Tier-C construct-backward builders (the figure pins the dims AND the answer, no LLM): `prism_volume_fig` (B1), `cube_fig` volume-only (B4), `pyramid_volume_fig` V=⅓·lwh (B4), `triprism_volume_fig` V=½·b·hₜ·L (B5), `prism_surface_fig` (B6), `prism_solve_dim_fig` (B6), `cylinder_volume_fig` V=kπ→grid k=r²h (B6). All integer-clean / gridable by construction.
- **`verify/figurecheck.mjs`** — a `checkSolid` arm: per task, the labeled dimensions must recompute the stated answer (volume / surface area / solved dimension / cylinder coefficient).
- New tasks in the `solid_figures` schema (all Tier C); LLTM sanity **green** (B1/B4/B5/B6). **21 items banked** (test-115), **3 of each of the 7 structures**; bank → 857.

### The structural-duplicate fix (why this slice was rebuilt)
The first 3D-solid pass banked **6 box-volume + 5 cube** items — distinct numbers, but **one structure each** (a number-reskin, not variety). Root cause: the only dedup a Tier-C figure item traverses is the figure-signature gate, which keys on `(figure, answer)` and so treats *different numbers* as a *different item*; surface dedup is bypassed (the stem is a constant template) and structural dedup is off by default (and prism fingerprints bake the dims, so it wouldn't collapse them anyway). Fix, two levers:
1. **Per-structure quota** (`build/pipeline.mjs`, `SIG_FIG_QUOTA`, default 3): in the Tier-C dedup pass, cap kept items per `(structure, band)` where *structure* = the fingerprint with numeric/dimension tokens stripped. Logged as `figquota` drops — no silent capping. A band with only one structure is now bounded by the quota (earn more by adding **structures**, not numbers).
2. **More structures** — pyramid, triangular prism, cylinder (above), so the bank earns breadth honestly.
- **Blind QA (vision):** an independent agent solved the 9 new-structure items reading **only the rendered figures** (no answers, no dims in text) — **9/9 correct**, all figures legible, and it naturally produced `k=r²h` for the cylinders (the `kπ` SPR phrasing is well-posed). Confirms legibility + correctness + well-posedness from pixels alone.

## GEO-2 (figures) — circle arcs / sectors / inscribed angles ✅
The circle figure gap (GEO.B7.s3) is built as **three distinct structures**, construct-backward (Tier C, no LLM):
- **`figures.js circle`** — two new branches (image-verified across acute/obtuse/reflex angles and radii):
  - **sector** — two radii from O, the wedge shaded, the arc emphasized, the central angle arced+labelled at O, one radius labelled with its length; the radius label is pushed off the wedge bisector so it never crowds the angle label.
  - **inscribed** — central ∠AOB at O (radii, marked) plus the inscribed ∠ACB at a vertex C on the **major** arc (chords CA, CB), with a shared `angAt` angle-arc helper.
- **`build/circlefig.mjs`** — `arc_length_fig` (s = kπ → grid k = θr/180), `sector_area_fig` (A = kπ → grid k = θr²/360), `inscribed_angle_fig` (∠ACB = ½·∠AOB). Curated (θ, r) tables keep k a clean integer; the kπ form is the SAT "in terms of π" SPR.
- **`verify/figurecheck.mjs`** — a `checkCircleFig` arm: the marked angle label must equal the drawn span, the recomputed kπ coefficient (or ½·central) must equal the answer, and the inscribed vertex C must lie on the major arc.
- New `circle_figures` subdomain (Tier C, all GEO.B7.s3); LLTM sanity **green** (B7). **9 items banked** (test-116), 3 of each structure (the per-structure quota holds). Bank → 866.
- **Blind QA (vision):** an independent agent solved all 9 reading only the rendered figures — **9/9 correct**, and it verified every shaded wedge/bold arc matches its labelled central angle and every inscribed figure uses the standard ½ configuration. No issues flagged.

> The per-structure quota's grouping key was generalized in this slice: it now keys on the **task** (the skill = the structure) rather than parsing the fingerprint, since circle params (`90deg_r4`, `c80`) aren't pure-numeric tokens. This fixed the circle quota (the first run leaked 7 sector + 10 inscribed) and is exact for every figure family without per-pattern guessing.

### GEO-2 remaining (next)
- **Right-triangle trig & special-triangle labeling** (opp/adj/hyp, 30-60-90 / 45-45-90) — GEO.B6.s3 / B7.s2.
- **Congruence / similarity tick marks** + angle arcs on `triangle()` — GEO.B4.s2 polish.
- **Solids backlog:** cone (pairs with cylinder), sphere, composite solids (B7); cylinder/cone MCQ with π-form options.
- **Circles backlog:** tangent-line configurations, chord/secant lengths, sector-perimeter; sector_fraction as an SPR fraction.

## Deferred — GEO-2 (figures)
Reuse `figures.js` triangle/polygon/circle/parallelLines/parallelogram; build the real gaps — **3D solids** (prism/cube/pyramid/cylinder, none exist), **circle arcs/sectors + labels**, **right-triangle trig & special-triangle labeling**, **angle arcs on `triangle`**, **congruence ticks** — then construct-backward "read-from-figure" (Tier C) variants + geometry `figurecheck`/`legibility` arms. (`gen/diagramgen.mjs` is DISABLED and not SAT-aligned — supersede, don't revive.)
