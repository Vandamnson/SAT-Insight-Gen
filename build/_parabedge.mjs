/* diagnostic: render parabolas large so edge/arm behavior is visible. node build/_parabedge.mjs */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { coordPlane } from "../figures/figures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  { lab: "a=1 gentle ±6",     spec: { xRange: [-6, 6], yRange: [-6, 6], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"], plot: 460, curves: [{ type: "quadratic", a: 1, b: 0, c: -3 }] } },
  { lab: "a=2 steep",         spec: { xRange: [-5, 5], yRange: [-3, 9], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"], plot: 460, curves: [{ type: "quadratic", a: 2, b: -4, c: -2 }] } },
  { lab: "a=-2 steep down",   spec: { xRange: [-5, 5], yRange: [-6, 6], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"], plot: 460, curves: [{ type: "quadratic", a: -2, b: 0, c: 4 }] } },
  { lab: "a=1 default 80smp", spec: { xRange: [-6, 6], yRange: [-2, 10], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"], plot: 460, curves: [{ type: "quadratic", a: 1, b: -2, c: -3 }] } },
];
const cards = cases.map((c) => `<div style="border:1px solid #ccc;border-radius:8px;padding:10px;margin:10px"><div style="font:600 13px monospace;color:#c2410c">${c.lab}</div>${coordPlane(c.spec)}</div>`).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "parab-edge.html"),
  `<!doctype html><meta charset=utf8><style>svg.fig{max-width:520px;height:auto}.fig-stroke{stroke:#1f2937;fill:none}.fig-curve{stroke:#2563eb}.fig-dash{stroke-dasharray:4 3}.fig-grid{stroke:#e5e7eb}.fig-axis{stroke:#475569}.fig-label{fill:#334155}.fig-marker{fill:#1e293b}</style><body style="font-family:system-ui">${cards}</body>`);
console.log("→ tests/figverify/parab-edge.html");
