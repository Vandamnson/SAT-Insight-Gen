import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { coordPlane } from "../figures/figures.js";
import { legibilityCheck } from "../verify/legibility.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = {
  xRange: [-3, 5], yRange: [-13, 1], xStep: 1, yStep: 1, origin: true, axisLabels: ["x", "y"],
  curves: [{ type: "quadratic", a: 2, b: -4, c: -10 }],     // 2(x-1)^2 - 12
  points: [{ at: [1, -12], coords: true }],                 // vertex labeled with coords; y-intercept (0,-10) read off the grid
};
const leg = legibilityCheck({ incidentals: { numbers: { figure: { fn: "coordPlane", spec } } } });
console.log("legibility:", JSON.stringify(leg));
const svg = coordPlane(spec);
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "glovesoff.html"),
  `<!doctype html><meta charset=utf8><style>svg.fig{max-width:540px;height:auto}.fig-stroke{stroke:#1f2937;fill:none}.fig-curve{stroke:#2563eb}.fig-dash{stroke-dasharray:4 3}.fig-grid{stroke:#e5e7eb}.fig-axis{stroke:#475569}.fig-label{fill:#334155}.fig-marker{fill:#1e293b}</style><body style="font-family:system-ui;padding:16px"><div style="max-width:560px">${svg}</div></body>`);
console.log("→ tests/figverify/glovesoff.html");
