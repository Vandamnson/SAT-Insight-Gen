// graph-only test (Phase A) — draws every graph task via the construct-backward
// generator, runs the REAL Tier-C gate (figureCheck + legibility + band + dedup) and
// the render adapter, writes data/test-101.json. No LLM. `node build/_graphspot.mjs`.
import { writeFileSync } from "node:fs";
import { drawGraphItem, GRAPH_TASKS } from "./graph.mjs";
import { verifyAndGate } from "./selector.mjs";
import { toRenderItem } from "./pipeline.mjs";
import { predictBand } from "../difficulty/lltm.mjs";

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SUB = "linear_equations_two_variables";
function makeCell(task, idx) {
  const item = drawGraphItem(task, 5, rng(`g|${task}|${idx}`));
  const band = Number(predictBand({ task }, "algebra", SUB).slice(1));
  return { domain: "algebra", subdomain: SUB, band, statementId: `ALG.B${band}.s1`, radicals: { task }, tier: "C", incidentals: { context: "none", var_name: "x", format: item.format, numbers: item }, canonical_fingerprint: [], op_vocab: [], predicted_scale: 0 };
}

const kept = [], fails = []; let id = 0;
for (const task of GRAPH_TASKS) for (let i = 0; i < 3; i++) {
  const cell = makeCell(task, i), num = cell.incidentals.numbers;
  const cand = { statement: num.statement, choices: num.choices, correct_choice: num.correct_choice, answer: num.answer, solve_path: num.solve_path, fingerprint: num.fingerprint, radicals_used: {} };
  const gate = await verifyAndGate(cand, cell);
  if (!gate.keep) { fails.push(`${task}#${i} [B${cell.band}]: ${gate.stage} — ${gate.reason}`); continue; }
  kept.push(toRenderItem({ cand, cell, gate }, ++id));
}
writeFileSync("data/test-101.json", JSON.stringify({ number: 101, title: "graph pipeline — Phase A (construct-backward, Tier C)", questions: kept }, null, 2));
console.log(`kept ${kept.length}/${GRAPH_TASKS.length * 3}`);
fails.forEach((f) => console.log("  ✗", f));
const byTask = {}; kept.forEach((q) => (byTask[q.radicals.task] = (byTask[q.radicals.task] || 0) + 1));
console.log("by task:", JSON.stringify(byTask));
console.log("by band:", JSON.stringify(kept.reduce((a, q) => ((a[q.band] = (a[q.band] || 0) + 1), a), {})));
