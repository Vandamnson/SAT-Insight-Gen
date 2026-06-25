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

/* B4 — exterior angle = sum of the two remote interior angles. SCHEMATIC. */
function gExteriorAngle(r) {
  const a = randint(r, 30, 75), b = randint(r, 30, Math.min(75, 150 - a)), ans = a + b;   // ext = a+b < 180; ∠C = 180−a−b > 0
  return {
    task: "exterior_angle_fig", format: "spr", answer: String(ans),
    composite: { kind: "exterior_angle", a, b },
    statement: `In triangle \\(ABC\\) shown (not drawn to scale), side \\(\\overline{BC}\\) is extended to \\(D\\). If \\(m\\angle A = ${a}^\\circ\\) and \\(m\\angle B = ${b}^\\circ\\), what is the measure, in degrees, of exterior angle \\(\\angle ACD\\)?`,
    figure: { fn: "scene", spec: { w: 330, h: 210, pts: { A: [1.4, 2.6], B: [0, 0], C: [3, 0], D: [4.7, 0] }, segs: [["B", "C"], ["C", "D"], ["A", "B"], ["A", "C"]], angles: [{ at: "A", from: "B", to: "C", label: `${a}°`, r: 16 }, { at: "B", from: "A", to: "C", label: `${b}°` }] } },
    solve_path: sp({ op: "exterior_angle_theorem", detail: `The exterior angle equals the sum of the two remote interior angles: \\(${a} + ${b} = ${ans}^\\circ\\).` }),
    fingerprint: ["composite_fig", "exterior_angle", `a${a}_b${b}`, "2d"],
  };
}

/* B5 — trapezoid midsegment = average of the two parallel sides. */
function gTrapezoidMidsegment(r) {
  let b1 = randint(r, 8, 18), b2 = randint(r, 4, 14); if ((b1 + b2) % 2) b2 += 1; if (b1 === b2) b2 += 2;
  const ans = (b1 + b2) / 2, h = 4.2, A = [0, 0], B = [b1, 0], D = [(b1 - b2) / 2, h], C = [(b1 + b2) / 2, h];
  return {
    task: "trapezoid_midsegment_fig", format: "spr", answer: String(ans),
    composite: { kind: "trapezoid_midsegment", b1, b2 },
    statement: `In trapezoid \\(ABCD\\) shown, \\(\\overline{AB}\\parallel\\overline{DC}\\) with \\(AB = ${b1}\\) and \\(DC = ${b2}\\) (in centimeters). The midsegment \\(\\overline{MN}\\) joins the midpoints of the two legs. What is the length, in centimeters, of \\(\\overline{MN}\\)?`,
    figure: { fn: "scene", spec: { w: 330, h: 190, pts: { A, B, C, D, M: [(A[0] + D[0]) / 2, (A[1] + D[1]) / 2], N: [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2] }, segs: [["A", "B", { label: String(b1) }], ["B", "C"], ["C", "D", { label: String(b2) }], ["D", "A"], ["M", "N", { dashed: true }]] } },
    solve_path: sp({ op: "midsegment", detail: `\\(MN = \\dfrac{AB + DC}{2} = \\dfrac{${b1} + ${b2}}{2} = ${ans}\\).` }),
    fingerprint: ["composite_fig", "trapezoid_midsegment", `${b1}_${b2}`, "2d"],
  };
}

/* B6 — square inscribed in a circle: diagonal = 2r ⇒ area = ½·(2r)² = 2r². */
function gSquareInCircle(r) {
  const rad = randint(r, 3, 9), ans = 2 * rad * rad, k = rad / Math.SQRT2;
  return {
    task: "square_in_circle_fig", format: "spr", answer: String(ans),
    composite: { kind: "square_in_circle", r: rad },
    statement: `A square is inscribed in a circle of radius \\(${rad}\\) (shown), with all four vertices on the circle. What is the area of the square?`,
    figure: { fn: "scene", spec: { w: 250, h: 250, circle: { c: [0, 0], r: rad }, pts: { O: [0, 0], P: [k, k], Q: [-k, k], R: [-k, -k], S: [k, -k] }, segs: [["P", "Q"], ["Q", "R"], ["R", "S"], ["S", "P"], ["O", "P", { label: String(rad) }]], ptLabels: { O: "O", P: "", Q: "", R: "", S: "" } } },
    solve_path: sp({ op: "diagonal_area", detail: `The diagonal equals the diameter \\(= 2(${rad}) = ${2 * rad}\\); area \\(= \\tfrac12 d^2 = \\tfrac12(${2 * rad})^2 = ${ans}\\).` }),
    fingerprint: ["composite_fig", "square_in_circle", `r${rad}`, "2d"],
  };
}

/* B6 — circle inscribed in a square (side s, even): r = s/2 ⇒ area = (s/2)²·π = kπ. */
function gCircleInSquare(r) {
  const s = 2 * randint(r, 2, 7), k = (s / 2) * (s / 2);
  return {
    task: "circle_in_square_fig", format: "spr", answer: String(k),
    composite: { kind: "circle_in_square", s },
    statement: `A circle is inscribed in a square with side length \\(${s}\\) (shown), touching all four sides. The area of the circle is \\(k\\pi\\). What is the value of \\(k\\)?`,
    figure: { fn: "scene", spec: { w: 240, h: 240, circle: { c: [s / 2, s / 2], r: s / 2 }, pts: { A: [0, 0], B: [s, 0], C: [s, s], D: [0, s] }, segs: [["A", "B", { label: String(s) }], ["B", "C"], ["C", "D"], ["D", "A"]] } },
    solve_path: sp({ op: "inscribed_circle", detail: `\\(r = \\tfrac{${s}}{2} = ${s / 2}\\); area \\(= \\pi r^2 = ${k}\\pi\\), so \\(k = ${k}\\).` }),
    fingerprint: ["composite_fig", "circle_in_square", `s${s}`, "2d"],
  };
}

/* B6 — rhombus with perpendicular diagonals: half-diagonals a, b satisfy a²+b²=s².
   Given one diagonal (2a) and the side s, find the other diagonal (2b). */
const RHOMB = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [4, 3, 5], [8, 6, 10], [12, 5, 13]];
function gRhombusDiagonal(r) {
  const [a, b, s] = pick(r, RHOMB), d1 = 2 * a, ans = 2 * b;
  return {
    task: "rhombus_diagonal_fig", format: "spr", answer: String(ans),
    composite: { kind: "rhombus_diagonal", a, b, s },
    statement: `The rhombus shown has perpendicular diagonals. One diagonal has length \\(${d1}\\) and each side has length \\(${s}\\) (in inches). What is the length, in inches, of the other diagonal?`,
    figure: { fn: "scene", spec: { w: 240, h: 240, pts: { R: [a, 0], T: [0, b], L: [-a, 0], B: [0, -b], O: [0, 0] }, segs: [["R", "T", { label: String(s) }], ["T", "L"], ["L", "B"], ["B", "R"], ["R", "L", { label: String(d1) }], ["T", "B"]], angles: [{ at: "O", from: "R", to: "T", right: true }], ptLabels: { R: "", T: "", L: "", B: "", O: "" } } },
    solve_path: sp({ op: "rhombus_pythagorean", detail: `Half-diagonals: \\((${d1}/2)^2 + x^2 = ${s}^2 \\Rightarrow x = ${b}\\); the other diagonal \\(= 2(${b}) = ${ans}\\).` }),
    fingerprint: ["composite_fig", "rhombus_diagonal", `${a}_${b}_${s}`, "2d"],
  };
}

/* B7 — right triangle, altitude to the hypotenuse: CH = √(AH·HB) (geometric mean). */
const ALT = [[2, 8, 4], [4, 9, 6], [3, 12, 6], [2, 18, 6], [4, 16, 8], [5, 20, 10], [9, 16, 12], [4, 25, 10], [8, 18, 12], [3, 27, 9]];
function gRightTriangleAltitude(r) {
  const [p, q, h] = pick(r, ALT), A = [0, 0], B = [p + q, 0], H = [p, 0], C = [p, h];
  return {
    task: "right_triangle_altitude_fig", format: "spr", answer: String(h),
    composite: { kind: "right_triangle_altitude", p, q },
    statement: `In right triangle \\(ABC\\) shown, the altitude from the right angle at \\(C\\) meets the hypotenuse \\(\\overline{AB}\\) at \\(H\\). If \\(AH = ${p}\\) and \\(HB = ${q}\\), what is the length of \\(\\overline{CH}\\)?`,
    figure: { fn: "scene", spec: { w: 330, h: 210, pts: { A, B, C, H }, segs: [["A", "H", { label: String(p) }], ["H", "B", { label: String(q) }], ["A", "C"], ["C", "B"], ["C", "H"]], angles: [{ at: "C", from: "A", to: "B", right: true }, { at: "H", from: "C", to: "B", right: true }] } },
    solve_path: sp({ op: "geometric_mean", detail: `\\(CH = \\sqrt{AH\\cdot HB} = \\sqrt{${p}\\cdot ${q}} = \\sqrt{${p * q}} = ${h}\\).` }),
    fingerprint: ["composite_fig", "right_triangle_altitude", `${p}_${q}`, "2d"],
  };
}

/* B7 — tangent from an external point: PT ⊥ OT ⇒ PT = √(OP² − r²). */
const TAN = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20]];
function gTangentLength(r) {
  const [rad, pt, d] = pick(r, TAN), O = [0, 0], P = [d, 0], T = [rad * rad / d, rad * pt / d];
  return {
    task: "tangent_length_fig", format: "spr", answer: String(pt),
    composite: { kind: "tangent_length", r: rad, d },
    statement: `From external point \\(P\\), segment \\(\\overline{PT}\\) is tangent to the circle with center \\(O\\) at \\(T\\) (so \\(\\overline{PT}\\perp\\overline{OT}\\)). If the radius is \\(${rad}\\) and \\(OP = ${d}\\) (shown), what is the length of \\(\\overline{PT}\\)?`,
    figure: { fn: "scene", spec: { w: 300, h: 230, circle: { c: [0, 0], r: rad }, pts: { O, P, T }, segs: [["O", "T", { label: String(rad) }], ["O", "P", { label: String(d) }], ["P", "T"]], angles: [{ at: "T", from: "O", to: "P", right: true }] } },
    solve_path: sp({ op: "tangent_pythagorean", detail: `\\(PT = \\sqrt{OP^2 - r^2} = \\sqrt{${d}^2 - ${rad}^2} = \\sqrt{${d * d - rad * rad}} = ${pt}\\).` }),
    fingerprint: ["composite_fig", "tangent_length", `r${rad}_d${d}`, "2d"],
  };
}

/* B7 — two chords intersecting inside a circle: AP·PB = CP·PD ⇒ PD = AP·PB/CP.
   SCHEMATIC: the four points lie on one circle exactly because AP·PB = CP·PD. */
const CHORD = [[6, 4, 8, 3], [6, 4, 3, 8], [8, 3, 6, 4], [6, 2, 4, 3], [9, 2, 6, 3], [8, 6, 12, 4], [10, 3, 6, 5], [8, 3, 4, 6]];
function gIntersectingChords(r) {
  const [AP, PB, CP, PD] = pick(r, CHORD);
  const u = [Math.cos(0.35), Math.sin(0.35)], v = [Math.cos(1.95), Math.sin(1.95)];
  const A = [AP * u[0], AP * u[1]], B = [-PB * u[0], -PB * u[1]], C = [CP * v[0], CP * v[1]], Dp = [-PD * v[0], -PD * v[1]];
  return {
    task: "intersecting_chords_fig", format: "spr", answer: String(PD),
    composite: { kind: "intersecting_chords", AP, PB, CP, PD },
    statement: `Chords \\(\\overline{AB}\\) and \\(\\overline{CD}\\) intersect at point \\(P\\) inside the circle (shown). Using the marked segment lengths, what is the length of \\(\\overline{PD}\\)?`,
    figure: { fn: "scene", spec: { w: 280, h: 280, circle: { through: ["A", "B", "C"] }, pts: { A, B, C, D: Dp, P: [0, 0] }, segs: [["A", "P", { label: String(AP) }], ["P", "B", { label: String(PB) }], ["C", "P", { label: String(CP) }], ["P", "D"]] } },
    solve_path: sp({ op: "intersecting_chords", detail: `\\(AP\\cdot PB = CP\\cdot PD \\Rightarrow PD = \\dfrac{${AP}\\cdot ${PB}}{${CP}} = ${PD}\\).` }),
    fingerprint: ["composite_fig", "intersecting_chords", `${AP}_${PB}_${CP}`, "2d"],
  };
}

const BUILDERS = {
  parallelogram_diagonal_fig: gParallelogramDiagonal, triangle_semicircle_fig: gTriangleSemicircle,
  rectangle_diagonal_fig: gRectangleDiagonal, similar_parallel_fig: gSimilarParallel,
  exterior_angle_fig: gExteriorAngle, trapezoid_midsegment_fig: gTrapezoidMidsegment,
  square_in_circle_fig: gSquareInCircle, circle_in_square_fig: gCircleInSquare, rhombus_diagonal_fig: gRhombusDiagonal,
  right_triangle_altitude_fig: gRightTriangleAltitude, tangent_length_fig: gTangentLength, intersecting_chords_fig: gIntersectingChords,
};

/** drawCompositeFig(task, band, r) — a complete, correct-by-construction composite item. */
export function drawCompositeFig(task, band, r) {
  const b = BUILDERS[task];
  if (!b) throw new Error(`drawCompositeFig: no builder for composite task "${task}"`);
  return { ...b(r), harness: true };
}
export const COMPOSITE_TASKS = Object.keys(BUILDERS);
export default { drawCompositeFig, COMPOSITE_TASKS };
