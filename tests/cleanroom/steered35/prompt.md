You are starting completely fresh with NO other context. You are a veteran Digital SAT Math item writer. Your only inputs are: (1) the two files below, (2) your own knowledge of the SAT, and (3) online research if you want it (you may study the style/difficulty of released Digital SAT geometry items — but every problem you write must be ORIGINAL, never copied or paraphrased).

Read first:
- /private/tmp/claude-501/-Users-vandanpokal/0a57f6ba-b5bc-48db-a35d-e584fecd4afb/scratchpad/steered/geo-rubric.md — the College Board Skills-Insight performance-band rubric for Digital SAT Geometry & Trigonometry (bands B1–B7, scale ranges, RP67 placement rule).
- /private/tmp/claude-501/-Users-vandanpokal/0a57f6ba-b5bc-48db-a35d-e584fecd4afb/scratchpad/steered/geo-banding-guide.md — a difficulty calibration guide: an item's band is set by its HARDEST GATE (reference-sheet formula < famous off-sheet fact < recalled/recognized off-sheet theorem); inverse ≈ +1 band over forward; chain ≈ +1 over hardest link. Follow it when assigning bands. In particular: for high-band circle/theorem items, NEVER state the theorem in the stem — stating it collapses the difficulty.

YOUR TASK: author 35 Digital SAT-style Geometry & Trigonometry FIGURE problems — EXACTLY 5 problems at each band B1, B2, B3, B4, B5, B6, B7. Every problem must include a figure the student genuinely needs.

=== NOVELTY IS A PRIMARY OBJECTIVE (co-equal with authenticity) ===
Your set will be machine-scored on BOTH of these, and both floors are binding:
(a) STRUCTURAL DISTANCE against a corpus of 1,000+ existing SAT-style items — problems that repeat well-worn structures fail, even with new numbers and a new context;
(b) AUTHENTICITY against released College Board items, judged blind by an expert — problems that drift out of Digital SAT voice, scope, or plausibility fail.
Novelty that breaks SAT voice fails; voice that repeats the canon fails. The target is the gap between them: problems that are in-distribution but unwritten — items the College Board could have written but hasn't.

Procedure for EVERY problem: first write ONE line naming the MODAL item for the skill you chose — the exact problem every prep book prints for that skill. Then author something structurally different from it. Record that line in the item's "modal" field (see items.json contract).

BANNED MODAL STRUCTURES (hard bans — do not write these with any numbers or any context):
1. Right rectangular prism or cylinder volume: direct plug-in (dimensions given, find V) or one-unknown inverse (V and other dimensions given, find the missing one).
2. Pyramid or cone volume: direct plug-in or one-unknown inverse.
3. Parallel lines cut by a transversal: single-step angle chase (corresponding / alternate / co-interior).
4. Equation of a circle in the xy-plane from center + radius or center + a point, or reading center/radius off standard form.
5. Pythagorean theorem: hypotenuse or leg from the other two sides as the item's main event.
6. Special right triangles (30-60-90 / 45-45-90): side lookup as the main event.
7. Right-triangle altitude-to-hypotenuse: geometric mean / similarity-to-trig-ratio in the standard configuration.
8. Triangle similarity via a segment drawn parallel to one side (the standard proportionality picture).
9. Tangent length from radius + external distance (tangent–radius perpendicularity as inverse Pythagorean).
10. Composite solid volume = cylinder + cone or cylinder + hemisphere stacked.
11. Sector area or arc length: direct proportionality plug-in from a central angle.
12. Inscribed angle = half the central angle, single step.
13. Intersecting chords product, standard configuration.
14. Triangle angle sum / vertical angles / exterior angle: single-configuration angle chase.
These are the structures every prep book and generator already over-produces. The underlying SKILLS all remain fair game — the ban is on these standard REALIZATIONS of them.

UNDER-WRITTEN DIRECTIONS (a compass, not a checklist):
- Perturbation problems: change one quantity, ask what happens to another (scale factor on a dimension → effect on perimeter, area, or volume).
- Composite and embedded configurations that require constructing or recognizing an auxiliary segment.
- Cross-skill links: trigonometry inside circle configurations, similarity inside solids, coordinate geometry meeting plane/solid geometry.
- Radian↔degree reasoning used structurally; complementary sine–cosine identities used structurally (not as a bare conversion drill).
- Real-world modeling with partial fills, cross-sections, nets/unfolding, shadows and sightlines, non-box solids.
- Comparisons and ratios between TWO figures rather than computation on one.

Requirements:
- EXACTLY 5 problems per band, B1 through B7 (35 total). Band each item with the banding guide's gate hierarchy and give a one-line justification (which gate places it: sheet formula vs famous fact vs off-sheet theorem recall; forward vs inverse; chain length). B1–B2 items must still be genuinely EASY — novelty there means a fresh configuration, never hidden difficulty.
- Authentic Digital SAT voice: terse stems, "Figure not drawn to scale" where appropriate, ~21 multiple-choice (4 options, canonical-error distractors) and ~14 student-produced-response.
- FIGURES: draw them yourself as clean inline SVG — labeled, readable at ~320px, honest proportions unless marked not-to-scale. No degenerate placements (no collinear/coincident/antipodal points that misrepresent the configuration).
- Answers exactly correct — verify each by independent computation before finalizing.

DELIVERABLES (write ONLY these two files, plus reading the two inputs — touch nothing else on this machine). Write both files PROGRESSIVELY as you go (extend them after each band) so partial work is never lost:
1. /private/tmp/claude-501/-Users-vandanpokal/0a57f6ba-b5bc-48db-a35d-e584fecd4afb/scratchpad/steered/s1/index.html — one self-contained HTML page (inline CSS+SVG, answer+solution collapsible per problem, band label shown).
2. /private/tmp/claude-501/-Users-vandanpokal/0a57f6ba-b5bc-48db-a35d-e584fecd4afb/scratchpad/steered/s1/items.json — machine-readable: [{"n":1,"band":"B1","type":"mcq|spr","skill":"<short skill label>","modal":"<the one-line modal item you avoided>","stem":"<the full stem as plain text, describing the figure's given values in words; for MCQ include the four choices inline>","figure":"<one-line figure description>","answer":"<final answer>"}] for all 35.

End with a one-line confirmation that both files are written.
