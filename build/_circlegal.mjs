/* Image-inspect the new circle sector + inscribed-angle renderer branches. */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { circle } from "../figures/figures.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cards = [
  ["sector 60°, r=6 (from 20°)", circle({ R: 90, sector: { from: 20, to: 80, label: "60°", radiusLabel: "6" } })],
  ["sector 90°, r=4 (from 0°)", circle({ R: 90, sector: { from: 0, to: 90, label: "90°", radiusLabel: "4" } })],
  ["sector 120°, r=3 (from 30°)", circle({ R: 90, sector: { from: 30, to: 150, label: "120°", radiusLabel: "3" } })],
  ["sector 45°, r=8 (from 200°)", circle({ R: 90, sector: { from: 200, to: 245, label: "45°", radiusLabel: "8" } })],
  ["sector 270° REFLEX, r=2", circle({ R: 90, sector: { from: 0, to: 270, label: "270°", radiusLabel: "2" } })],
  ["sector 150°, r=6 (from 250°)", circle({ R: 90, sector: { from: 250, to: 40, label: "150°", radiusLabel: "6" } })],
  ["inscribed: central 80° → x?", circle({ R: 90, inscribed: { A: 200, B: 280, C: 70, centralLabel: "80°", inscribedLabel: "x°" } })],
  ["inscribed: central 120° → x?", circle({ R: 90, inscribed: { A: 170, B: 290, C: 60, centralLabel: "120°", inscribedLabel: "x°" } })],
  ["inscribed: central 100° → x?", circle({ R: 90, inscribed: { A: 210, B: 310, C: 90, centralLabel: "100°", inscribedLabel: "x°" } })],
].map(([cap, svg]) => `<div class="cell"><div class="cap">${cap}</div>${svg}</div>`).join("");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "circle-gallery.html"),
  `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;padding:18px;background:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,260px));gap:16px}.cell{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px}.cap{font:600 12px monospace;color:#1f2937;margin-bottom:6px}svg.fig{max-width:240px;height:auto;border:1px dashed #eee}.fig-stroke{stroke:#1f2937;fill:none}.fig-label{fill:#111;font-weight:600}.fig-marker{fill:#111}.fig-fill{fill:#bfdbfe}</style><body><h3 style="font-family:system-ui">GEO-2 circles — sector + inscribed angle</h3><div class="grid">${cards}</div>`);
console.log("→ tests/figverify/circle-gallery.html");
