# GEO-2 skill-compositions — rubric-fit audit

_2026-06-25 · Maps each of the 12 `composite_figures` tasks to the Geometry & Trigonometry Skills-Insight rubric (19 statements, B1–B7). Each composition combines **two** skills, so it can land in two rubric cells; the question is whether the **assigned** `statementByTask` + LLTM band is the right home, and where the composites sit on the rubric as a whole._

## Method
For each composite I name the two skills it composes, map each to its rubric statement, pick the **best-fit** statement (the dominant/highest skill), and compare to what the schema currently assigns. "Assigned" = `geometry_trig.json statementByTask` + the LLTM-predicted band. Rubric text is from `taxonomy/matrix.json`.

## The rubric cells the composites draw on
- **B3.s2** — angle measure via triangle-angle-sum + angle theorems
- **B3.s3** — Pythagorean: hypotenuse from two legs
- **B4.s1** — area of a plane figure; volume of a cube/pyramid
- **B4.s2** — scale factors, sum of triangle angles, congruence & similarity
- **B4.s3** — Pythagorean for a side; special-right-triangle side/angle
- **B5.s3** — multistep area & perimeter of plane figures
- **B6.s1** — surface area / volume / a dimension of a **prism**
- **B6.s2** — *complex* Pythagorean to find a side of a **rectangle**, or triangle angle sum
- **B6.s3** — *complex* congruence/similarity of **right triangles**, incl. trig ratios; scale-factor effects
- **B7.s1** — missing values in **2D & 3D shapes** via area/SA/volume formulas
- **B7.s2** — *complex* similar/congruent triangles, angle theorems, right-triangle trig
- **B7.s3** — circles: radii, diameters, tangents, angles, arcs, arc length, sectors

## Per-composition fit

| task | assigned (stmt · band) | skills composed | best-fit rubric | verdict |
|---|---|---|---|---|
| `triangle_semicircle` | B7.s3 · B7 | inscribed-angle/Thales (B7.s3) + angle sum (B3.s2) | **B7.s3** | ✅ correct — Thales is a circle-angle theorem |
| `tangent_length` | B7.s3 · B7 | tangent⟂radius (B7.s3) + Pythagorean (B3.s3) | **B7.s3** | ✅ correct — "tangents" named in B7.s3 |
| `intersecting_chords` | B7.s3 · B7 | intersecting-chords product (B7.s3) + solve eqn | **B7.s3** | ✅ ok by spirit — chords implied by B7.s3's "such as" (not named) |
| `right_triangle_altitude` | B7.s2 · B7 | right-triangle similarity (B6.s3/B7.s2) + geometric mean | **B7.s2** (or B6.s3) | ✅ correct — altitude-on-hypotenuse is right-triangle similarity |
| `rhombus_diagonal` | B6.s2 · B6 | rhombus ⟂-diagonals + Pythagorean (B3.s3) | **B6.s2** | ✅ ok — complex Pythagorean inside a quadrilateral |
| `rectangle_diagonal` | B4.s3 · B4 | rectangle + Pythagorean (B3.s3) | B4.s3 *(B6.s2 is verbatim)* | ⚠️ debatable — **B6.s2 literally says "Pythagorean to find a side of a rectangle"**; banded B4 only because the triples are clean |
| `parallelogram_diagonal` | B6.s2 · B6 | parallelogram consecutive-∠ + angle subtraction | B6.s2 *(or B4.s2)* | ⚠️ debatable — a 2-step angle chase ("complex") fits B6.s2; the bare skill is B3.s2/B4.s2 |
| `exterior_angle` | B4.s2 · B4 | exterior-angle theorem + angle sum (B3.s2) | **B3.s2** | ⚠️ over-banded — exterior-angle theorem is a B3 angle theorem; re-home to **B3.s2** (and it would be our only B3 composite) |
| `similar_parallel` | B6.s2 · B6 | parallel-line similarity (B4.s2) + proportion | **B4.s2** | ❌ **mis-mapped** — B6.s2 is Pythagorean/angle-sum, **not similarity**; basic DE∥BC proportion is B4.s2 |
| `square_in_circle` | B6.s1 · B6 | circle radius/diameter (B7.s3) + square area (B4.s1) | **B7.s1** (or B4.s1) | ❌ **mis-mapped** — B6.s1 is **prisms**; this is plane/2D area, → B7.s1 |
| `circle_in_square` | B6.s1 · B6 | square + circle area πr² (B4.s1/B7.s1) | **B7.s1** (or B4.s1) | ❌ **mis-mapped** — B6.s1 is **prisms**; circle area → B7.s1 |
| `trapezoid_midsegment` | B5.s3 · B5 | trapezoid + midsegment theorem | B5.s3 *(loose)* | ❌ **weak anchor** — the midsegment theorem isn't an explicit GEO statement; B5.s3 ("multistep area/perimeter") is a stretch (this is single-step, not area) |

**Scoreboard:** 5 clean ✅ · 3 debatable ⚠️ · 4 problematic ❌ (3 mis-mapped + 1 weak anchor).

## Where they sit on the rubric (coverage map)
Composites as **currently assigned** populate only 6 distinct statements, heavily on the right edge:

```
        s1            s2                  s3
B3       –             –                   –
B4   square*,circle*  exterior         rectangle
B5       –             –               trapezoid
B6   (–, prism)   parallelogram,                –
                  similar,rhombus
B7       –        rt-altitude     semicircle,tangent,chords
        (* square/circle are MIS-filed under B6.s1=prism)
```
After the recommended re-mappings (below), coverage spreads B3→B7:
```
B3  exterior(s2)
B4  square/circle(s1)   similar(s2)   rectangle(s3)
B6                      parallelogram,rhombus(s2)
B7  square/circle(s1)?  rt-altitude(s2)   semicircle,tangent,chords(s3)
```

## What composites do NOT touch (gaps)
Rubric statements with **zero** composite coverage:
- **B1.s1, B1.s2, B2.s1, B3.s1** — low-band area/perimeter/volume. *Expected:* composing two skills raises difficulty, so B1–B2 isn't a natural composite home (covered by GEO-1 text + solids instead). Honest structural floor.
- **B2.s2 — parallel lines cut by a transversal.** A natural composite gap (transversal + triangle angle chase). **Buildable next.**
- **B3.s3** — bare Pythagorean (covered as a *component* of rectangle/rhombus/tangent, never standalone — fine).
- **B5.s1 — sin/cos complementary, radians (TRIG).** No composite touches trig at all.
- **B5.s2 — equation of a circle** (covered by GEO-1 text).
- **B6.s1 — prism SA/volume** (covered by GEO-2 **solids**, not composites — correct division of labor).
- **B6.s3 / B7.s2 trig ratios** — `right_triangle_altitude` touches right-triangle *similarity* but **no composite uses a trigonometric ratio or a special right triangle** (30-60-90 / 45-45-90).

**Two real thematic holes:** (1) **trigonometry** (B5.s1, B6.s3, B7.s2-trig) and (2) **parallel-lines/transversal** angle chases (B2.s2).

## The core tension (honest)
The composites were banded by a *composition-adds-difficulty* heuristic (`w0 = 470` + a task weight chosen to spread B4–B7), **not** by the rubric's named home for the skill. That produced three kinds of drift:
1. **Statement drift** — `square_in_circle`/`circle_in_square` filed under a *prism* statement (B6.s1) purely because B6 was the target band; the statement text doesn't match.
2. **Skill drift** — `similar_parallel` filed under B6.s2 (Pythagorean/angle), but it's a *similarity* item (B4.s2).
3. **Band drift** — `exterior_angle` sits at B4 though the exterior-angle theorem is a B3 skill; `rectangle_diagonal` sits at B4 though "Pythagorean → rectangle side" is literally B6.s2 (the clean triples keep it easy, so B4 is defensible difficulty-wise but not skill-wise).

None of this affects **correctness** (every item is construct-backward-verified and blind-solved 12/12) — it's a **labeling/calibration** issue: the rubric tag and band should reflect the skill, so the bank reports honest coverage.

## Recommendations
**Re-map (statement + band) to match the skill:**
| task | from | to | band |
|---|---|---|---|
| `similar_parallel` | B6.s2 | **B4.s2** (similarity) | B6 → **B4** |
| `square_in_circle` | B6.s1 | **B7.s1** (2D/3D area formulas) | B6 → **B7** |
| `circle_in_square` | B6.s1 | **B7.s1** | B6 → **B7** |
| `exterior_angle` | B4.s2 | **B3.s2** (angle theorems) | B4 → **B3** |
| `trapezoid_midsegment` | B5.s3 | keep, but flag — closest legitimate home; midsegment is not an explicit statement | B5 |
| `rectangle_diagonal` | B4.s3 | keep at B4.s3 for clean triples; note B6.s2 is the verbatim home for harder versions | B4 |

**Build next to close the thematic holes** (cheap on `scene()`):
- **Trig compositions** — right triangle with a given trig ratio + Pythagorean (find the third side); special-right-triangle (30-60-90 / 45-45-90) side chase → **B6.s3 / B7.s2 / B4.s3**. Closes the trig hole.
- **Parallel-lines + triangle** — a transversal cutting two parallel lines with a triangle, alternate/co-interior + angle sum → **B2.s2** (and gives a lower-band composite).
- **Special-right-triangle in a composite** (e.g., a 45-45-90 inside a square, a 30-60-90 inside an equilateral split) → **B4.s3**.

## Bottom line
The 12 compositions are mathematically sound and visually verified, and **5 are cleanly on-rubric** (the three circle items + altitude + rhombus). But **4 carry mis-labeled rubric tags** (two circle-area items filed under *prisms*, one similarity item filed under *Pythagorean*, one with no true rubric home) and **3 are banded by difficulty rather than skill**. Fixing the six tags above makes the bank's coverage map honest and spreads composites B3→B7. The biggest *content* gaps the engine should fill next are **trigonometry** and **parallel-line/transversal** compositions.
