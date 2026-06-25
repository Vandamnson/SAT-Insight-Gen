/* ============================================================================
   compositefig.mjs — GEO-2 SKILL-COMPOSITION figure items (Tier C, NO LLM). Variety
   comes from COMBINING primitives, not reskinning one formula: a parallelogram cut by
   a diagonal, a triangle inscribed in a semicircle, a rectangle's diagonal, a triangle
   with a line parallel to a side. Each composition is a distinct STRUCTURE.

   Construct-backward: the builder picks clean givens, computes the answer via the
   composed theorem, and emits a `scene` figure. Angle-chase items are SCHEMATIC
   ("figure not drawn to scale" — the marked values carry the data); length items are
   drawn metrically. figureCheck recomputes the answer from the stored givens.
   ============================================================================ */
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const sp = (...d) => d.map((s, i) => ({ step: i + 1, op: s.op, detail: s.detail }));
const D2R = Math.PI / 180;

/* B6 — parallelogram + diagonal: consecutive angles supplementary, then subtract.
   Given ∠ABC and the part ∠DAC the diagonal cuts from ∠A, find ∠CAB. SCHEMATIC. */
function gParallelogramDiagonal(r) {
  const b = randint(r, 50, 75), A = 180 - b, p = randint(r, 25, A - 25), ans = A - p;
  return {
    task: "parallelogram_diagonal_fig", format: "spr", answer: String(ans),
    composite: { kind: "parallelogram_diagonal", b, p },
    statement: `In parallelogram \\(ABCD\\) shown (not drawn to scale), diagonal \\(\\overline{AC}\\) is drawn. If \\(m\\angle ABC = ${b}^\\circ\\) and \\(m\\angle DAC = ${p}^\\circ\\), what is the measure, in degrees, of \\(\\angle CAB\\)?`,
    figure: { fn: "scene", spec: { w: 320, h: 220, pts: { A: [0, 0], B: [5, 0], C: [6.5, 2.4], D: [1.5, 2.4] }, segs: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"], ["A", "C"]], angles: [{ at: "B", from: "A", to: "C", label: `${b}°` }, { at: "A", from: "D", to: "C", label: `${p}°`, r: 16 }] } },
    solve_path: sp(
      { op: "consecutive_angles", detail: `Consecutive angles of a parallelogram are supplementary: \\(m\\angle DAB = 180 - ${b} = ${A}^\\circ\\).` },
      { op: "angle_subtract", detail: `\\(m\\angle CAB = m\\angle DAB - m\\angle DAC = ${A} - ${p} = ${ans}^\\circ\\).` }),
    fingerprint: ["composite_fig", "parallelogram_diagonal", `b${b}_p${p}`, "2d"],
  };
}

/* B7 — triangle inscribed in a semicircle (Thales): AB a diameter ⇒ ∠ACB = 90°.
   Given ∠BAC, find ∠ABC = 90 − ∠BAC. METRIC (C placed so ∠BAC is exact). */
function gTriangleSemicircle(r) {
  const a = randint(r, 25, 65), ans = 90 - a, C = [Math.cos(2 * a * D2R), Math.sin(2 * a * D2R)];
  return {
    task: "triangle_semicircle_fig", format: "spr", answer: String(ans),
    composite: { kind: "triangle_semicircle", a },
    statement: `In the circle with center \\(O\\) shown, \\(\\overline{AB}\\) is a diameter and \\(C\\) lies on the circle. If \\(m\\angle BAC = ${a}^\\circ\\), what is the measure, in degrees, of \\(\\angle ABC\\)?`,
    figure: { fn: "scene", spec: { w: 300, h: 210, showCenter: true, centerLabel: "O", circle: { through: ["A", "B", "C"] }, pts: { A: [-1, 0], B: [1, 0], C }, segs: [["A", "B"], ["A", "C"], ["B", "C"]], angles: [{ at: "A", from: "B", to: "C", label: `${a}°`, r: 18 }] } },
    solve_path: sp(
      { op: "angle_in_semicircle", detail: `An angle inscribed in a semicircle is right: \\(m\\angle ACB = 90^\\circ\\).` },
      { op: "triangle_angle_sum", detail: `\\(m\\angle ABC = 180 - 90 - ${a} = ${ans}^\\circ\\).` }),
    fingerprint: ["composite_fig", "triangle_semicircle", `a${a}`, "2d"],
  };
}

/* B4 — rectangle + diagonal (Pythagorean): diagonal = √(L²+W²). METRIC. */
const RECT = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [8, 6, 10], [12, 5, 13], [16, 12, 20]];
function gRectangleDiagonal(r) {
  const [L, W, d] = pick(r, RECT);
  return {
    task: "rectangle_diagonal_fig", format: "spr", answer: String(d),
    composite: { kind: "rectangle_diagonal", L, w: W },
    statement: `Rectangle \\(ABCD\\) shown has the side lengths marked, in inches. What is the length, in inches, of diagonal \\(\\overline{AC}\\)?`,
    figure: { fn: "scene", spec: { w: 300, h: 230, pts: { A: [0, 0], B: [L, 0], C: [L, W], D: [0, W] }, segs: [["A", "B", { label: String(L) }], ["B", "C", { label: String(W) }], ["C", "D"], ["D", "A"], ["A", "C"]] } },
    solve_path: sp({ op: "pythagorean", detail: `\\(AC = \\sqrt{${L}^2 + ${W}^2} = \\sqrt{${L * L + W * W}} = ${d}\\).` }),
    fingerprint: ["composite_fig", "rectangle_diagonal", `${L}x${W}`, "2d"],
  };
}

/* B6 — triangle with a line parallel to a side (similarity ⇒ proportion):
   DE ∥ BC ⇒ AD/DB = AE/EC ⇒ EC = AE·DB/AD. METRIC. */
const SIMIL = [[4, 6, 6, 9], [3, 6, 4, 8], [4, 8, 3, 6], [6, 4, 9, 6], [5, 10, 4, 8], [6, 9, 4, 6], [8, 4, 6, 3], [6, 3, 8, 4]];
function gSimilarParallel(r) {
  const [AD, DB, AE, EC] = pick(r, SIMIL);
  const A = [0, 7], B = [-5, 0], C = [6, 0];
  const Dp = [A[0] + (AD / (AD + DB)) * (B[0] - A[0]), A[1] + (AD / (AD + DB)) * (B[1] - A[1])];
  const Ep = [A[0] + (AE / (AE + EC)) * (C[0] - A[0]), A[1] + (AE / (AE + EC)) * (C[1] - A[1])];
  return {
    task: "similar_parallel_fig", format: "spr", answer: String(EC),
    composite: { kind: "similar_parallel", AD, DB, AE },
    statement: `In triangle \\(ABC\\) shown, \\(\\overline{DE}\\parallel\\overline{BC}\\) with \\(D\\) on \\(\\overline{AB}\\) and \\(E\\) on \\(\\overline{AC}\\). The marked lengths are in centimeters. What is the length, in centimeters, of \\(\\overline{EC}\\)?`,
    figure: { fn: "scene", spec: { w: 300, h: 230, pts: { A, B, C, D: Dp, E: Ep }, segs: [["A", "D", { label: String(AD) }], ["D", "B", { label: String(DB) }], ["A", "E", { label: String(AE) }], ["E", "C"], ["B", "C"], ["D", "E"]] } },
    solve_path: sp({ op: "similar_proportion", detail: `\\(\\dfrac{AD}{DB} = \\dfrac{AE}{EC}\\Rightarrow EC = \\dfrac{AE\\cdot DB}{AD} = \\dfrac{${AE}\\cdot ${DB}}{${AD}} = ${EC}\\).` }),
    fingerprint: ["composite_fig", "similar_parallel", `${AD}_${DB}_${AE}`, "2d"],
  };
}

const BUILDERS = { parallelogram_diagonal_fig: gParallelogramDiagonal, triangle_semicircle_fig: gTriangleSemicircle, rectangle_diagonal_fig: gRectangleDiagonal, similar_parallel_fig: gSimilarParallel };

/** drawCompositeFig(task, band, r) — a complete, correct-by-construction composite item. */
export function drawCompositeFig(task, band, r) {
  const b = BUILDERS[task];
  if (!b) throw new Error(`drawCompositeFig: no builder for composite task "${task}"`);
  return { ...b(r), harness: true };
}
export const COMPOSITE_TASKS = Object.keys(BUILDERS);
export default { drawCompositeFig, COMPOSITE_TASKS };
