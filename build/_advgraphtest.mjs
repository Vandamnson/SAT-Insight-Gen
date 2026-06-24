/* ============================================================================
   _advgraphtest.mjs — offline MATH gate for the ADV-2 nonlinear graph builders.
   Draws N of each task, runs the real selector gate (figureCheck → legibility →
   LLTM band) + a render-smoke (coordPlane must not throw) + answer-by-construction,
   and prints pass rates with failure reasons. NO LLM. Run:  node build/_advgraphtest.mjs
   ============================================================================ */
import { drawCell } from "./cell.mjs";
import { verifyAndGate } from "./selector.mjs";
import { figureCheck } from "../verify/figurecheck.mjs";
import { legibilityCheck } from "../verify/legibility.mjs";
import { predictBand } from "../difficulty/lltm.mjs";
import { coordPlane } from "../figures/figures.js";

const TASKS = [
  ["read_yint", 1, "ADV.B1.s1"],
  ["read_feature", 2, "ADV.B2.s1"],
  ["graph_from_eq", 5, "ADV.B5.s1"],
  ["interpret_feature_graph", 6, "ADV.B6.s2"],
  ["connect_translation_graph", 6, "ADV.B6.s3"],
];
const N = 60;
const candOf = (cell) => { const n = cell.incidentals.numbers; return { statement: n.statement, choices: n.choices, correct_choice: n.correct_choice, answer: n.answer, solve_path: n.solve_path, fingerprint: n.fingerprint, radicals_used: {} }; };
const bump = (o, k) => (o[k] = (o[k] || 0) + 1);

let allOk = true;
for (const [task, band, sid] of TASKS) {
  let drawn = 0, fc = 0, lc = 0, gate = 0, rok = 0, sidOk = 0, bandOk = 0;
  const reasons = {};
  let idx = 0;
  while (drawn < N && idx < N * 30) {
    const cell = drawCell("advanced_math", "nonlinear_graphs", band, idx++);
    if (cell.radicals.task !== task) continue;          // B6 yields two tasks — keep only this one
    drawn++;
    const num = cell.incidentals.numbers;
    const f = figureCheck(cell); if (f.keep) fc++; else bump(reasons, `FIG: ${f.reason}`);
    const l = legibilityCheck(cell); if (l.keep) lc++; else bump(reasons, `LEG: ${l.reason}`);
    if (predictBand(cell.radicals, "advanced_math", "nonlinear_graphs") === `B${band}`) bandOk++;
    if (cell.statementId === sid) sidOk++; else bump(reasons, `SID: ${cell.statementId}`);
    try { if (num.figure) coordPlane(num.figure.spec); (num.optionFigures || []).forEach((s) => coordPlane(s)); rok++; }
    catch (e) { bump(reasons, `RENDER: ${e.message}`); }
    const g = await verifyAndGate(candOf(cell), cell);
    if (g.keep) gate++; else bump(reasons, `GATE(${g.stage}): ${g.reason}`);
  }
  const pct = (x) => `${x}/${drawn}`;
  const ok = fc === drawn && lc === drawn && gate === drawn && rok === drawn && sidOk === drawn && bandOk === drawn;
  if (!ok) allOk = false;
  console.log(`\n${ok ? "✓" : "✗"} ${task}  (B${band}, ${sid})`);
  console.log(`   figureCheck ${pct(fc)} · legibility ${pct(lc)} · band ${pct(bandOk)} · statementId ${pct(sidOk)} · render ${pct(rok)} · FULL GATE ${pct(gate)}`);
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`     ✗ ${n}× ${r}`);
}
console.log(allOk ? "\n=== ALL TASKS PASS ALL GATES ===" : "\n=== FAILURES ABOVE — FIX BUILDERS/ARMS ===");
process.exit(allOk ? 0 : 1);
