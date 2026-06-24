# Figure audit — blind vision pass (report only)

_2026-06-23 · 88 figure-bearing items rendered + screenshotted; each judged against its stem + answer by a blind vision agent. No edits applied — fixing is a follow-up._

**79 of 88 figures clean.** Defects: 4 blocker · 1 major · 1 minor · 3 nit

| ref | severity | origin · figure · skill | issue | suggested fix |
|---|---|---|---|---|
| #30 | **blocker** | insight-gen · coordPlane · system_graph_solution | Grid is empty — the two system lines are not drawn, so x cannot be read | Draw both lines intersecting at x=2 |
| #156 | **blocker** | insight-gen · rectangle · geo_rect_area | Rectangle is blank; stem says the width is shown but no '6' is labeled | Label the 6 m width (and 9 m length) |
| #159 | **blocker** | insight-gen · parallelLines · geo_parallel_transversal | Lines labeled p/q not m/n, transversal r not t, no angle x marked, no given value | Relabel m/n/t, mark angle x, add the given angle |
| #681 | **blocker** | mod2 · dotPlot · center_spread | Dot plots show 14 & 16 points (stem says 18 each); B is not a +4 shift of A's shape | Redraw both with 18 points; B = A shifted +4 identically |
| #22 | **major** | insight-gen · coordPlane · read_graph_point | Stem says a line is shown with P on it, but no line is drawn — only point P(3,5) | Render the line through P |
| #554 | **minor** | mod2 · parallelLines · angles_parallel | 74° drawn lower-left at n while (a+b) is lower-right at m — alternate, not corresponding as stated | Move the 74° arc to the lower-right position at line n |
| #163 | **nit** | insight-gen · coordPlane · geo_intersecting_angles | Points A,B,C,D correctly placed on two lines through O; the lines themselves are unlabeled | Optionally label lines ℓ and m |
| #455 | **nit** | mod2 · parallelLines · angles_parallel | Three labeled angles positioned plausibly; math yields x=35 consistent with the answer | — |
| #726 | **nit** | mod2 · parallelLines · angles_parallel | Alternate-interior config correct; caption has a stray '·' separator | Remove the trailing '·' in the caption |

> Blockers/major are items whose figure fails to depict the problem (missing line/grid/label) — they should be fixed or dropped in the follow-up pass. Nits are cosmetic. All other 79 figures correctly match their stem + answer.

## Resolution (2026-06-24) — all real defects fixed; 2 "blockers" were screenshot artifacts

Re-rendered each flagged item **isolated at full resolution** before editing. Root cause of the real defects: early-Insight-Gen items carried **old figure-spec formats** the current `figures.js` renderers don't read.

| ref | verdict | fix |
|---|---|---|
| #22, #30 (+ a 3rd: test-70) | **real** — coordPlane curves were bare `{m,b}` with no `type`, so `renderCurve` skipped them | **Renderer fix**: `renderCurve` now treats a typeless `{m,b}` as a line (`figures/figures.js`). Lines/systems now draw. |
| #156 | **real** — rectangle spec used `lengthLabel/widthLabel` (renderer wants `labels.{bottom,left}`) | **Spec patch**: now labels "9 m" / "6 m"; 9×6=54 ✓ (`build/fig-patch.mjs`). |
| #159 | **real** — parallelLines spec used old `{lines,transversal,given,unknown}` (renderer wants `{upperLabel,lowerLabel,angles[]}`) | **Spec patch**: now lines m/n, transversal t, 118° + x° as corresponding angles ⇒ x=118 ✓. |
| #681 | **FALSE POSITIVE** — spec is correct (A & B both 18 dots, B = A shifted +4); agent miscounted from the downscaled full-page screenshot | none (verified at full res). |
| #554 | **FALSE POSITIVE** — spec places both angles bottom-right (corresponding); the agent misread the wedge at low res | none. |
| #163, #455, #726 | cosmetic nits (unlabeled lines / caption "·") | left as-is. |

Verified: `figures/verify-all.mjs` gate passes (no regression); fixed items re-rendered + visually confirmed. **Lesson:** run figure-vs-problem vision checks on **isolated, full-resolution** renders — downscaled multi-item page screenshots cause dot-miscounts and wedge misreads.
