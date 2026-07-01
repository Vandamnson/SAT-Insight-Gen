/* engine/weights-fit.mjs — bootstrap the chain-LLTM intercept from the CURATED
   capstone anchors whose step decompositions are known. Step weights are fixed
   (seeded from cell-LLTM marginals in each step's spec); wLen is fixed at 40;
   w0_chain is least-squares fit so predicted scale ≈ the curated scalePoints.
   Honesty: 3 anchors, all B7 — the model is calibrated ONLY at the top, which is
   why the composer clamps admission to B6–B7. node engine/weights-fit.mjs */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { step } from "./registry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W_LEN = 40, W_FIG = 25;

// curated anchors: portable chain ↔ the hand-calibrated capstone it reproduces
const ANCHORS = [
  { steps: ["sys_solve", "coeff_from_point"], scalePoint: 760, anchor: "C1" },
  { steps: ["sys_nosol_param", "linear_solve_with_param"], scalePoint: 790, anchor: "C2" },
  { steps: ["line_x_intercept", "vertical_shift_through_point"], scalePoint: 785, anchor: "C4" },
];

const rows = ANCHORS.map((a) => {
  const stepSum = a.steps.map((id) => step(id).spec.weight).reduce((x, y) => x + y, 0);
  const w0 = a.scalePoint - stepSum - W_LEN * (a.steps.length - 1);
  return { ...a, stepSum, w0 };
});
const w0_chain = Math.round(rows.reduce((s, r) => s + r.w0, 0) / rows.length);

console.log("anchor fit (wLen fixed at 40):");
for (const r of rows) {
  const pred = w0_chain + r.stepSum + W_LEN;
  console.log(`  ${r.anchor}: curated ${r.scalePoint} · predicted ${pred} · residual ${pred - r.scalePoint}`);
}
const rmse = Math.sqrt(rows.reduce((s, r) => s + (w0_chain + r.stepSum + W_LEN - r.scalePoint) ** 2, 0) / rows.length);
console.log(`  w0_chain = ${w0_chain} · RMSE ${rmse.toFixed(1)} scale pts (n=${rows.length}, all ≈B7 — hence the B6–B7 admission clamp)`);

writeFileSync(join(HERE, "weights.json"), JSON.stringify({ w0_chain, wLen: W_LEN, wFig: W_FIG, fitted: new Date().toISOString(), anchors: rows.map((r) => ({ anchor: r.anchor, scalePoint: r.scalePoint, residual: w0_chain + r.stepSum + W_LEN - r.scalePoint })) }, null, 1));
console.log("→ engine/weights.json");
