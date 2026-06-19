# Plan — SAT-aligned figure/diagram question generation

## The problem (honest state)
The procedural generators are a good *mechanism* (construct-backward → exact, self-verifying, $0) but **narrow and not yet SAT-aligned**:
- `graphgen` only does polynomial f vs g intersections with a "sum/product/count of x-coords" ask. Real SAT coordinate-graph items are far broader (read features off a graph, exponential/quadratic models in context, circles, transformations, systems) and the *phrasing* is contextual, not "sum of intersection x-coords."
- `diagramgen` only does polygon interior-angle-sum with x-expressions. Real SAT geometry is triangles (right/similar/congruent, trig), circles (arcs/sectors/tangents/inscribed angles), parallel lines/transversals, **3D solids**, plus area/perimeter/volume — almost none of which we generate.

We must stop inventing question shapes and instead **mirror what the test actually does**. Two inputs: the official **rubric** (Skills-Insight, which we already have) and a corpus of **official reference questions** (which we must source).

> **Status (2026-06-17): both `gen/graphgen.mjs` and `gen/diagramgen.mjs` are DISABLED.** They were stopgaps. This plan replaces them with ONE truly SAT-aligned, extensively-validated, effectively-infinite figure-question generator (rubric-grounded archetypes → parametric construct→compute→hide generators → validated against official references). Re-enable nothing piecemeal; build the real thing.

## Step 1 — Re-ground in the rubric (what figures appear, per band)
We already have the Skills-Insight statements in `taxonomy/matrix.json`. Extract the **figure-bearing** ones and the implied figure type, per band, e.g.:
- Geometry/Trig: B1 area/volume of rect & prism; B2 perimeter, **parallel lines + transversal**; B3 area/sides, **triangle-angle-sum / intersecting lines**, Pythagorean; B4 area & volume of cube/pyramid, **similar/congruent triangles**, special right triangles; B5 **circle equation**, sine/cosine of complementary angles; B6 prism surface area/volume, right-triangle trig; B7 **circle theorems** (radii/diameters/tangents/arcs/arc-length/sectors), 2D & 3D missing-value.
- Advanced/Algebra (coordinate plane): read y-intercept / key feature of a **nonlinear** graph (B1–B2), nonlinear graph features & translations (B5–B6), linear graphs & systems (B2–B6).
- PSDA (data displays): bar graph / frequency table (B2), two-way table (B3), **scatterplot + line of best fit** (B4), frequency-table mean/median + graph rate-of-change (B6).
Deliverable: `taxonomy/figure-skills.json` — a table of (band, domain, statement, figureType, typical-ask) — the spec the generators must cover.

## Step 2 — Source official reference questions (the missing input)
Build a corpus of *real* figure questions to mirror form + difficulty (the user's call). In priority order:
1. **Skills-Insight exemplars (geometry/data ones we skipped).** Earlier harvest got Algebra/Advanced/PSDA text; the **Geometry exemplars rendered as figure images** so yielded no text. → Re-scrape `?domain=S&score_band=MSS1–7` (and the figure-bearing Advanced/PSDA cells) with Playwright and **vision-OCR the question images** into structured text + a figure description. These are *band-labeled and authoritative*.
2. **College Board Question Bank / Bluebook released practice tests** — official, with difficulty tags; pull figure items per skill.
3. **Khan Academy Official SAT Practice** — difficulty-tagged, often cleaner HTML.
Deliverable: `corpus/figure-refs.json` — per item: stem, figure type + spec, answer, band, source. Used both to (a) derive archetypes (Step 3) and (b) validate generators (Step 5). Note: this is partly manual/vision-assisted; flag what needs the user (Bluebook export, etc.).

## Step 3 — Catalog the real archetypes (figure × question × band)
From Steps 1–2, write the **archetype catalog** `gen/archetypes.md`: for each figure type, the question patterns the SAT actually uses and their band range. First-pass inventory of what to build:
- **Coordinate plane:** read a feature (intercept/vertex/solution) off a curve; quadratic/exponential model in context + interpret a feature; system (linear×nonlinear) solution; transformation of a graph; circle in the plane.
- **Geometry diagrams:** right-triangle (Pythagorean / special / trig ratios); similar & congruent triangles; **circle** (central/inscribed angle, chord, tangent, arc length, sector area); parallel-lines/transversal angle algebra; polygon angles (have); area/perimeter of composite plane figures.
- **3D solids:** prism / cylinder / cone / sphere / pyramid — volume/surface-area, missing dimension, similar-solid scaling.
- **Data displays:** scatter + line of best fit (rate/predict/residual); bar & histogram (compare/derive a statistic); dot/box plot (center/spread); two-way & frequency tables (probability, conditional, expected count).

## Step 4 — Build SAT-aligned procedural generators (construct→compute→hide)
Keep the self-verifying principle; widen coverage. Each generator: forward-construct known quantities → realize a figure → hide some → ask in **SAT phrasing** (mirroring the archetypes), with the answer exact + numerically self-checked. Build order by coverage value:
1. **Geometry diagram pack** (the biggest gap, the user's lead): right-triangle (trig/Pythagorean/special), circle (central/inscribed/chord/tangent/arc/sector), area/perimeter of composite figures. Renderers: extend `triangle`/`circle`; add a `compositeFigure`/labeled-segment renderer.
2. **3D solids pack**: a `solid` renderer (cylinder/cone/sphere/prism/pyramid line-icons with labeled dimensions) + volume/SA/missing-dimension/similar-solid generators.
3. **Coordinate-plane v2** (fix graphgen): contextual phrasing (read a feature; model + interpret), add **exponential/quadratic** curves to the figures.js fn-renderer (serializable params), circle-in-plane, transformations — phrased like the official items, not "sum of intersection x-coords."
4. **Data-display pack**: scatter+LOBF, bar/histogram/dot/box, two-way table generators (construct the data → compute the asked statistic → hide).
Each ships with its figures.js renderer + a `verify-all.mjs` arm + extreme-geometry matrix entries + a self-test (same discipline as the existing figure gate).

## Step 5 — Validate generated vs official
For each archetype, compare generated items to the `corpus/figure-refs.json` references on: figure type match, question-phrasing similarity, and **measured band** (run the LLM judge). Acceptance: the generator's items are indistinguishable-in-form from official ones at the target band, and pixel-QA clean. Track which archetypes are covered vs the Step-1 rubric table (a coverage matrix, like the 4×7 one).

## Sequencing & priorities
1. Steps 1–2 first (rubric extraction + reference corpus, incl. vision-OCR of the geometry exemplars) — *cheap, unblocks everything*.
2. Then Step 4.1 (geometry diagram pack) — the lead gap.
3. Then 4.2/4.3/4.4 in parallel as renderers land.
- Reuse: the figure gate (`figures/verify-all.mjs`), the judge (band validation), the item schema, the construct→compute→hide pattern from `gen/graphgen.mjs`/`gen/diagramgen.mjs`.
- Open question for the user: how much official-corpus sourcing is OK (Bluebook export / manual), vs vision-OCR of the public Skills-Insight exemplars (which I can do).
