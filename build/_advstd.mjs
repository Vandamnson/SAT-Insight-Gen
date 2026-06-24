/* ============================================================================
   _advstd.mjs — STANDARDIZE every advanced_math figure in the bank to a SQUARE grid
   (xStep === yStep), matching the generator's rule (one step on both axes; step 2
   only for genuinely tall windows). Catches legacy items the generators never
   re-emitted. Render-time 4-way arrowheads are already universal (coordPlane).
   Rewrites only the changed lines; preserves each line's archival _key.
     node build/_advstd.mjs
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BANK = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "item-bank.jsonl");
const lines = readFileSync(BANK, "utf8").trim().split("\n");
let changed = 0; const detail = [];
const out = lines.map((line) => {
  if (!line.trim()) return line;
  const q = JSON.parse(line);
  if (q.domain !== "advanced_math") return line;
  const specs = [];
  if (q.figure?.spec) specs.push(q.figure.spec);
  for (const o of (q.options || [])) if (o.fig?.spec) specs.push(o.fig.spec);
  let touched = false;
  for (const s of specs) {
    if (!Array.isArray(s.xRange) || !Array.isArray(s.yRange)) continue;
    const xs = s.xRange[1] - s.xRange[0], ys = s.yRange[1] - s.yRange[0];
    const step = Math.max(xs, ys) > 14 ? 2 : 1;        // generator's standard: one step on both axes
    if (s.xStep !== step || s.yStep !== step) { s.xStep = step; s.yStep = step; touched = true; }
  }
  if (touched) { changed++; if (detail.length < 12) detail.push(`${q.source}/${q.skill}`); return JSON.stringify(q); }
  return line;
});
writeFileSync(BANK, out.join("\n") + "\n");
console.log(`standardized ${changed} advanced_math figure(s) to a square grid`);
if (detail.length) console.log("  " + detail.join(", "));
