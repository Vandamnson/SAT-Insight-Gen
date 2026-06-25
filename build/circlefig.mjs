/* ============================================================================
   circlefig.mjs — GEO-2 construct-backward CIRCLE figure items (Tier C, NO LLM).
   The figures.js `circle` figure (sector with central angle + radius, or an
   inscribed-angle configuration) pins the geometry AND the answer, so each item is
   correct by construction; the selector gates with figureCheck's circle arm +
   legibility. The FIGURE form of GEO.B7.s3 (arcs, sectors, circle angles).

   Arc length / sector area are reported "in terms of π" as kπ (the SAT SPR form):
   the grid answer is the integer k. Curated (θ, r) tables keep k a clean integer.
   ============================================================================ */
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const sp = (...d) => d.map((s, i) => ({ step: i + 1, op: s.op, detail: s.detail }));
const baseAngle = (r) => 10 * randint(r, 0, 35);   // a varied starting ray, multiple of 10°

// (θ°, r, k) with k = θr/180 a clean integer ⇒ arc length = kπ
const ARC = [[90, 2, 1], [90, 4, 2], [90, 6, 3], [90, 8, 4], [60, 3, 1], [60, 6, 2], [60, 9, 3], [120, 3, 2], [120, 6, 4], [45, 4, 1], [45, 8, 2], [30, 6, 1], [30, 12, 2], [135, 4, 3], [150, 6, 5], [270, 2, 3], [270, 4, 6], [180, 3, 3], [180, 5, 5], [72, 5, 2], [72, 10, 4]];
// (θ°, r, k) with k = θr²/360 a clean integer ⇒ sector area = kπ
const SEC = [[90, 2, 1], [90, 4, 4], [90, 6, 9], [90, 8, 16], [120, 3, 3], [120, 6, 12], [45, 4, 2], [45, 8, 8], [180, 2, 2], [180, 4, 8], [60, 6, 6], [72, 5, 5], [36, 10, 10], [120, 9, 27], [180, 6, 18], [270, 2, 3], [270, 4, 12]];

/* B7 — arc length of a shaded sector: s = (θ/360)·2πr = kπ; grid k. */
function gArcLength(r) {
  const [theta, rad, k] = pick(r, ARC), from = baseAngle(r);
  return {
    task: "arc_length_fig", format: "spr", answer: String(k),
    statement: "In the circle shown with center \\(O\\), the marked central angle subtends the bold arc, and the radius is marked. The length of the bold arc is \\(k\\pi\\). What is the value of \\(k\\)?",
    figure: { fn: "circle", spec: { R: 92, sector: { from, to: from + theta, label: `${theta}°`, radiusLabel: String(rad) } } },
    solve_path: sp({ op: "apply_arc_length", detail: `\\(\\text{arc} = \\dfrac{${theta}}{360}\\cdot 2\\pi(${rad}) = ${k}\\pi\\), so \\(k = ${k}\\).` }),
    fingerprint: ["circle_fig", "arc_length", `${theta}deg_r${rad}`, "2d"],
  };
}

/* B7 — area of a shaded sector: A = (θ/360)·πr² = kπ; grid k. */
function gSectorArea(r) {
  const [theta, rad, k] = pick(r, SEC), from = baseAngle(r);
  return {
    task: "sector_area_fig", format: "spr", answer: String(k),
    statement: "In the circle shown with center \\(O\\), the shaded sector has the marked central angle and radius. The area of the shaded sector is \\(k\\pi\\). What is the value of \\(k\\)?",
    figure: { fn: "circle", spec: { R: 92, sector: { from, to: from + theta, label: `${theta}°`, radiusLabel: String(rad), shade: true } } },
    solve_path: sp({ op: "apply_sector_area", detail: `\\(\\text{area} = \\dfrac{${theta}}{360}\\cdot \\pi(${rad})^2 = ${k}\\pi\\), so \\(k = ${k}\\).` }),
    fingerprint: ["circle_fig", "sector_area", `${theta}deg_r${rad}`, "2d"],
  };
}

/* B7 — inscribed angle: ∠ACB (vertex C on the major arc) = ½·(central ∠AOB). */
function gInscribedAngle(r) {
  const central = 2 * randint(r, 20, 80);            // even ⇒ ½ is integer; 40..160 (< 180)
  const A = baseAngle(r), B = A + central;            // central ∠AOB = minor arc A→B
  const C = A + central + Math.round((360 - central) * (0.32 + 0.36 * r()));   // C on the major arc
  return {
    task: "inscribed_angle_fig", format: "spr", answer: String(central / 2),
    statement: "In circle \\(O\\) shown, \\(\\overline{CA}\\) and \\(\\overline{CB}\\) are chords and the central angle \\(\\angle AOB\\) is marked. What is the measure, in degrees, of the inscribed angle \\(\\angle ACB\\) (marked \\(x^\\circ\\))?",
    figure: { fn: "circle", spec: { R: 92, inscribed: { A: A % 360, B: B % 360, C: C % 360, centralLabel: `${central}°`, inscribedLabel: "x°" } } },
    solve_path: sp({ op: "apply_inscribed_angle", detail: `An inscribed angle is half the central angle on the same arc: \\(x = \\tfrac12\\cdot ${central} = ${central / 2}\\).` }),
    fingerprint: ["circle_fig", "inscribed_angle", `c${central}`, "2d"],
  };
}

const BUILDERS = { arc_length_fig: gArcLength, sector_area_fig: gSectorArea, inscribed_angle_fig: gInscribedAngle };

/** drawCircleFig(task, band, r) — a complete, correct-by-construction circle figure item. */
export function drawCircleFig(task, band, r) {
  const b = BUILDERS[task];
  if (!b) throw new Error(`drawCircleFig: no builder for circle task "${task}"`);
  return { ...b(r), harness: true };
}
export const CIRCLE_TASKS = Object.keys(BUILDERS);
export default { drawCircleFig, CIRCLE_TASKS };
