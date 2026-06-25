import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { prism } from "../figures/figures.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  ["cube 5×5×5", prism({ dims: { l: 5, w: 5, h: 5 }, labels: { l: "5", w: "5", h: "5" } })],
  ["box 3×4×5 (l×w×h)", prism({ dims: { l: 3, w: 4, h: 5 }, labels: { l: "3", w: "4", h: "5" } })],
  ["flat slab 12×10×2", prism({ dims: { l: 12, w: 10, h: 2 }, labels: { l: "12", w: "10", h: "2" } })],
  ["tall column 2×2×9", prism({ dims: { l: 2, w: 2, h: 9 }, labels: { l: "2", w: "2", h: "9" } })],
];
const cards = cases.map(([c, s]) => `<div class="cell"><div class="cap">${c}</div>${s}</div>`).join("");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "prism.html"),
  `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;padding:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,340px));gap:16px}.cell{border:1px solid #d7dde6;border-radius:10px;padding:10px}.cap{font:600 12px monospace;color:#1f2937;margin-bottom:6px}svg.fig{max-width:300px;height:auto}.fig-stroke{stroke:#1f2937;fill:none}.fig-label{fill:#334155}</style><body><div class=grid>${cards}</div></body>`);
console.log("→ tests/figverify/prism.html");
