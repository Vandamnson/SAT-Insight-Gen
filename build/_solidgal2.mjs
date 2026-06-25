/* Render the three NEW GEO-2 solid renderers (cylinder/pyramid/triPrism) across
   normal + extreme proportions for image-inspection (extreme-geometry rule). */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cylinder, pyramid, triPrism, prism } from "../figures/figures.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const cards = [
  ["prism (baseline) 4×6×7", prism({ dims: { l: 4, w: 6, h: 7 }, labels: { l: "4", w: "6", h: "7" } })],
  ["cylinder normal r=3 h=5", cylinder({ dims: { r: 3, h: 5 }, labels: { r: "3", h: "5" } })],
  ["cylinder WIDE/FLAT r=8 h=2", cylinder({ dims: { r: 8, h: 2 }, labels: { r: "8", h: "2" } })],
  ["cylinder TALL/THIN r=2 h=9", cylinder({ dims: { r: 2, h: 9 }, labels: { r: "2", h: "9" } })],
  ["pyramid normal 6×4 h=8", pyramid({ dims: { l: 6, w: 4, h: 8 }, labels: { l: "6", w: "4", h: "8" } })],
  ["pyramid SQUAT 9×8 h=2", pyramid({ dims: { l: 9, w: 8, h: 2 }, labels: { l: "9", w: "8", h: "2" } })],
  ["pyramid TALL 3×3 h=10", pyramid({ dims: { l: 3, w: 3, h: 10 }, labels: { l: "3", w: "3", h: "10" } })],
  ["triPrism normal b=8 ht=6 L=10", triPrism({ dims: { b: 8, ht: 6, L: 10 }, labels: { b: "8", ht: "6", L: "10" } })],
  ["triPrism FLAT b=10 ht=2 L=8", triPrism({ dims: { b: 10, ht: 2, L: 8 }, labels: { b: "10", ht: "2", L: "8" } })],
  ["triPrism LONG b=4 ht=5 L=13", triPrism({ dims: { b: 4, ht: 5, L: 13 }, labels: { b: "4", ht: "5", L: "13" } })],
].map(([cap, svg]) => `<div class="cell"><div class="cap">${cap}</div>${svg}</div>`).join("");

mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
const out = join(ROOT, "tests", "figverify", "solid-gallery2.html");
writeFileSync(out,
  `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;padding:18px;background:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,300px));gap:16px}.cell{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px}.cap{font:600 12px monospace;color:#1f2937;margin-bottom:6px}svg.fig{max-width:270px;height:auto;border:1px dashed #eee}.fig-stroke{stroke:#1f2937;fill:none}.fig-label{fill:#334155}.fig-marker{fill:#1e293b}</style><body><h3 style="font-family:system-ui">GEO-2 new solids — normal + extreme proportions</h3><div class="grid">${cards}</div></body>`);
console.log(out);
