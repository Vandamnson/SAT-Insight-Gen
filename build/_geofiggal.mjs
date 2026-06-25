import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { triangle, rectangle, polygon, parallelLines, parallelogram, circle } from "../figures/figures.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cards = [
  ["rectangle — area / perimeter (B1.s2, B2.s1, B3.s1, B5.s3)", rectangle({ w: 300, h: 180, labels: { bottom: "12", left: "8" } })],
  ["triangle, right + Pythagorean (B3.s3, B4.s3, B6.s2)", triangle({ vertices: [[0,0],[8,0],[0,6]], labels: ["B","C","A"], right: "B", sideLabels: { BC: "8", BA: "6", CA: "10" } })],
  ["triangle, sides for similarity (B4.s2, B7.s2) — NO congruence ticks", triangle({ vertices: [[0,0],[9,0],[6,7]], labels: ["P","Q","R"], sideLabels: { PQ: "9", QR: "x", PR: "12" } })],
  ["polygon — interior angles / perimeter (B2.s1, B3.s2)", polygon({ vertices: [[0,0],[10,0],[12,8],[5,12],[-2,8]], labels: ["A","B","C","D","E"], angleLabels: { C: "120°" } })],
  ["parallel lines cut by transversal (B2.s2)", parallelLines({ transversalAngleDeg: 58, upperLabel: "m", lowerLabel: "n", transversalLabel: "t", angles: [{ at: "upper", pos: "top-right", text: "124°" }] })],
  ["parallelogram — angles (B3.s2)", parallelogram({ angleA: 110, vertexLabels: ["A","B","C","D"], angles: { A: "110°", B: "70°" } })],
  ["circle — center + point (B5.s2 equation; B7.s3 radii/tangents)", circle({ R: 80, centerLabel: "O", showCenter: true, pointsOnCircle: [{ label: "P", angleDeg: 35 }], radii: [35] })],
].map(([cap, svg]) => `<div class="cell"><div class="cap">${cap}</div>${svg}</div>`).join("");
const gaps = `<div class="cell gap"><div class="cap">NO RENDERER (GEO-2 gaps)</div><ul>
<li>3D solids — rectangular prism / cube / pyramid / cylinder (B1.s1, B4.s1, B6.s1, B7.s1)</li>
<li>circle arcs / sectors + arc-length & sector labels, inscribed/central angle arcs (B7.s3)</li>
<li>right-triangle TRIG labeling (opp/adj/hyp, SOH-CAH-TOA) & special-triangle ratio marks (B6.s3, B7.s2)</li>
<li>congruence / similarity TICK marks on equal sides & angles (B4.s2, B6.s3, B7.s2)</li>
<li>angle ARCS on triangle() (only parallelLines/parallelogram have them)</li>
</ul></div>`;
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "geo-gallery.html"),
  `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;padding:18px;background:#fff}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,420px));gap:18px}.cell{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px}.cap{font:600 12px monospace;color:#1f2937;margin-bottom:6px}.gap{background:#fff7ed;border-color:#fdba74}.gap li{font:13px system-ui;margin:3px 0;color:#9a3412}svg.fig{max-width:380px;height:auto}.fig-stroke{stroke:#1f2937;fill:none}.fig-grid{stroke:#e5e7eb}.fig-axis{stroke:#475569}.fig-label{fill:#334155}.fig-marker{fill:#1e293b}.fig-fill{fill:#bfdbfe}</style><body><h3 style="font-family:system-ui">Geometry/Trig rubric — figures we can render vs gaps</h3><div class="grid">${cards}${gaps}</div></body>`);
console.log("→ tests/figverify/geo-gallery.html");
