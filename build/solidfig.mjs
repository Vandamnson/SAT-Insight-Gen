/* ============================================================================
   solidfig.mjs — GEO-2 construct-backward 3D-SOLID figure items (Tier C). The figure
   (a labeled rectangular prism / cube, figures.js `prism`) is the source of truth: the
   harness pins the dimensions AND the answer, so each item is correct by construction —
   no LLM. The selector gates with figureCheck's prism arm (labels ↔ answer) + legibility.
   Closes the figure form of the volume/surface-area statements (GEO.B1.s1, B4.s1, B6.s1).
   ============================================================================ */
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const sp = (...d) => d.map((s, i) => ({ step: i + 1, op: s.op, detail: s.detail }));

/* B1 — read the labeled edges, compute the volume */
function gPrismVolume(r) {
  const l = randint(r, 2, 9), w = randint(r, 2, 9), h = randint(r, 2, 9), V = l * w * h;
  return {
    task: "prism_volume_fig", format: "spr", answer: String(V),
    statement: "The right rectangular prism shown has the edge lengths marked, in centimeters. What is the volume of the prism, in cubic centimeters?",
    figure: { fn: "prism", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: String(h) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = \\ell wh = ${l}\\cdot ${w}\\cdot ${h} = ${V}\\).` }),
    fingerprint: ["solid_fig", "prism_volume", `${l}x${w}x${h}`, "3d"],
  };
}

/* B4 — cube: volume s^3 or surface area 6s^2 */
function gCube(r) {
  const s = randint(r, 2, 9), vol = r() < 0.5, ans = vol ? s ** 3 : 6 * s * s;
  return {
    task: "cube_fig", format: "spr", answer: String(ans),
    statement: `The cube shown has its edge length marked, in inches. What is the ${vol ? "volume of the cube, in cubic inches" : "surface area of the cube, in square inches"}?`,
    figure: { fn: "prism", spec: { dims: { l: s, w: s, h: s }, labels: { l: String(s), w: String(s), h: String(s) } } },
    solve_path: sp({ op: vol ? "apply_volume_formula" : "apply_surface_area", detail: vol ? `\\(V = s^3 = ${s}^3 = ${ans}\\).` : `\\(SA = 6s^2 = 6\\cdot ${s}^2 = ${ans}\\).` }),
    fingerprint: ["solid_fig", "cube", vol ? "vol" : "sa", "3d"],
  };
}

/* B6 — prism surface area */
function gPrismSurface(r) {
  const l = randint(r, 2, 8), w = randint(r, 2, 8), h = randint(r, 2, 8), SA = 2 * (l * w + l * h + w * h);
  return {
    task: "prism_surface_fig", format: "spr", answer: String(SA),
    statement: "The right rectangular prism shown has the edge lengths marked, in meters. What is the surface area of the prism, in square meters?",
    figure: { fn: "prism", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: String(h) } } },
    solve_path: sp({ op: "apply_surface_area", detail: `\\(SA = 2(\\ell w + \\ell h + wh) = 2(${l * w} + ${l * h} + ${w * h}) = ${SA}\\).` }),
    fingerprint: ["solid_fig", "prism_surface", `${l}x${w}x${h}`, "3d"],
  };
}

/* B6 — given two edges + the volume (in the figure/stem), solve for the third (h) */
function gPrismSolveDim(r) {
  const l = randint(r, 2, 9), w = randint(r, 2, 9), h = randint(r, 2, 12), V = l * w * h;
  return {
    task: "prism_solve_dim_fig", format: "spr", answer: String(h),
    statement: `The right rectangular prism shown has a volume of ${V} cubic feet. Two of its edge lengths are marked, in feet. What is the value of \\(h\\)?`,
    figure: { fn: "prism", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: "h" } } },
    solve_path: sp({ op: "isolate_dimension", detail: `\\(h = \\dfrac{V}{\\ell w} = \\dfrac{${V}}{${l}\\cdot ${w}} = ${h}\\).` }),
    fingerprint: ["solid_fig", "prism_solve_dim", `${l}x${w}`, "3d"],
  };
}

const BUILDERS = { prism_volume_fig: gPrismVolume, cube_fig: gCube, prism_surface_fig: gPrismSurface, prism_solve_dim_fig: gPrismSolveDim };

/** drawSolidFig(task, band, r) — a complete, correct-by-construction 3D-solid figure item. */
export function drawSolidFig(task, band, r) {
  const b = BUILDERS[task];
  if (!b) throw new Error(`drawSolidFig: no builder for solid task "${task}"`);
  return { ...b(r), harness: true };
}
export const SOLID_TASKS = Object.keys(BUILDERS);
export default { drawSolidFig, SOLID_TASKS };
