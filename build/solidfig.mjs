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
  const e = [randint(r, 2, 9), randint(r, 2, 9), randint(r, 2, 9)].sort((a, b) => a - b);   // canonical (sorted) ⇒ permuted/relabeled boxes never bank twice
  const l = e[0], w = e[1], h = e[2], V = l * w * h;
  return {
    task: "prism_volume_fig", format: "spr", answer: String(V),
    statement: "The right rectangular prism shown has the edge lengths marked, in centimeters. What is the volume of the prism, in cubic centimeters?",
    figure: { fn: "prism", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: String(h) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = \\ell wh = ${l}\\cdot ${w}\\cdot ${h} = ${V}\\).` }),
    fingerprint: ["solid_fig", "prism_volume", `${l}x${w}x${h}`, "3d"],
  };
}

/* B4 — cube VOLUME (GEO.B4.s1 is "the volume of a cube or pyramid"; surface area is a
   B6 prism skill, covered by prism_surface — so the cube task is volume-only). */
function gCube(r) {
  const s = randint(r, 2, 9), V = s ** 3;
  return {
    task: "cube_fig", format: "spr", answer: String(V),
    statement: "The cube shown has its edge length marked, in inches. What is the volume of the cube, in cubic inches?",
    figure: { fn: "prism", spec: { dims: { l: s, w: s, h: s }, labels: { l: String(s), w: String(s), h: String(s) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = s^3 = ${s}^3 = ${V}\\).` }),
    fingerprint: ["solid_fig", "cube", "vol", "3d"],
  };
}

/* B6 — prism surface area */
function gPrismSurface(r) {
  const e = [randint(r, 2, 8), randint(r, 2, 8), randint(r, 2, 8)].sort((a, b) => a - b);   // canonical (sorted)
  const l = e[0], w = e[1], h = e[2], SA = 2 * (l * w + l * h + w * h);
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
  const [l, w] = [randint(r, 2, 9), randint(r, 2, 9)].sort((a, b) => a - b);   // canonical labeled pair; h is the unknown
  const h = randint(r, 2, 12), V = l * w * h;
  return {
    task: "prism_solve_dim_fig", format: "spr", answer: String(h),
    statement: `The right rectangular prism shown has a volume of ${V} cubic feet. Two of its edge lengths are marked, in feet. What is the value of \\(h\\)?`,
    figure: { fn: "prism", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: "h" } } },
    solve_path: sp({ op: "isolate_dimension", detail: `\\(h = \\dfrac{V}{\\ell w} = \\dfrac{${V}}{${l}\\cdot ${w}} = ${h}\\).` }),
    fingerprint: ["solid_fig", "prism_solve_dim", `${l}x${w}`, "3d"],
  };
}

/* B4 — pyramid VOLUME (GEO.B4.s1 "volume of a cube or pyramid"). Rectangular base
   l×w, height h; V = ⅓·l·w·h. Dims chosen so the product is divisible by 3 ⇒ V is a
   clean integer (gridable SPR). A genuinely different STRUCTURE from the box (the ⅓). */
function gPyramidVolume(r) {
  const [l, w] = [randint(r, 2, 9), randint(r, 2, 9)].sort((a, b) => a - b);   // canonical base
  const h = (l * w) % 3 === 0 ? randint(r, 2, 9) : 3 * randint(r, 1, 3);       // force l·w·h divisible by 3
  const V = (l * w * h) / 3;
  return {
    task: "pyramid_volume_fig", format: "spr", answer: String(V),
    statement: "The right rectangular pyramid shown has the base edge lengths and height marked, in centimeters. What is the volume of the pyramid, in cubic centimeters?",
    figure: { fn: "pyramid", spec: { dims: { l, w, h }, labels: { l: String(l), w: String(w), h: String(h) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = \\tfrac13\\ell wh = \\tfrac13\\cdot ${l}\\cdot ${w}\\cdot ${h} = ${V}\\).` }),
    fingerprint: ["solid_fig", "pyramid_volume", `${l}x${w}x${h}`, "3d"],
  };
}

/* B5 — triangular-prism VOLUME (GEO.B5.s3). Triangular cross-section (base b, height
   ht) extruded a length L; V = ½·b·ht·L. b is even ⇒ ½·b·ht is an integer ⇒ clean V. */
function gTriPrismVolume(r) {
  const b = 2 * randint(r, 1, 4), ht = randint(r, 2, 9), L = randint(r, 3, 12);   // b even ⇒ integer V
  const V = (b * ht / 2) * L;
  return {
    task: "triprism_volume_fig", format: "spr", answer: String(V),
    statement: "The right triangular prism shown has a triangular cross-section with the base and height marked, and a length marked, in feet. What is the volume of the prism, in cubic feet?",
    figure: { fn: "triPrism", spec: { dims: { b, ht, L }, labels: { b: String(b), ht: String(ht), L: String(L) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = \\tfrac12 b\\,h_t\\cdot L = \\tfrac12\\cdot ${b}\\cdot ${ht}\\cdot ${L} = ${V}\\).` }),
    fingerprint: ["solid_fig", "triprism_volume", `${b}x${ht}x${L}`, "3d"],
  };
}

/* B6 — cylinder VOLUME (GEO.B6.s1, includes cylinders). V = πr²h, reported in terms
   of π: the volume is kπ, grid k = r²h (the SAT "in terms of π" SPR form). The π makes
   this a structurally distinct answer from the integer-multiply solids. */
function gCylinderVolume(r) {
  const rad = randint(r, 2, 7), h = randint(r, 2, 9), k = rad * rad * h;
  return {
    task: "cylinder_volume_fig", format: "spr", answer: String(k),
    statement: "The cylinder shown has the radius and height marked, in centimeters. The volume of the cylinder is \\(k\\pi\\) cubic centimeters. What is the value of \\(k\\)?",
    figure: { fn: "cylinder", spec: { dims: { r: rad, h }, labels: { r: String(rad), h: String(h) } } },
    solve_path: sp({ op: "apply_volume_formula", detail: `\\(V = \\pi r^2 h = \\pi\\cdot ${rad}^2\\cdot ${h} = ${k}\\pi\\), so \\(k = ${rad}^2\\cdot ${h} = ${k}\\).` }),
    fingerprint: ["solid_fig", "cylinder_volume", `${rad}x${h}`, "3d"],
  };
}

const BUILDERS = { prism_volume_fig: gPrismVolume, cube_fig: gCube, pyramid_volume_fig: gPyramidVolume, triprism_volume_fig: gTriPrismVolume, prism_surface_fig: gPrismSurface, prism_solve_dim_fig: gPrismSolveDim, cylinder_volume_fig: gCylinderVolume };

/** drawSolidFig(task, band, r) — a complete, correct-by-construction 3D-solid figure item. */
export function drawSolidFig(task, band, r) {
  const b = BUILDERS[task];
  if (!b) throw new Error(`drawSolidFig: no builder for solid task "${task}"`);
  return { ...b(r), harness: true };
}
export const SOLID_TASKS = Object.keys(BUILDERS);
export default { drawSolidFig, SOLID_TASKS };
