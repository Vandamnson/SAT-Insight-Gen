/* ============================================================================
   _advgraphrender.mjs — render a diverse, gate-passed spread of ADV-2 nonlinear
   graph items (all 5 tasks × both curve families × extreme params) to an HTML page
   for VISUAL image-inspection. Uses the REAL gate + REAL toRenderItem + renderer, so
   the page shows exactly what would ship.  node build/_advgraphrender.mjs
   ============================================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawCell } from "./cell.mjs";
import { verifyAndGate } from "./selector.mjs";
import { toRenderItem } from "./pipeline.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANDS = [1, 2, 5, 6];

const shapeOf = (item) => {
  const fig = item.figure;
  const curves = fig ? fig.spec.curves : (item.options?.[0]?.fig?.spec?.curves || []);
  const q = curves.find((c) => c.type === "quadratic"), e = curves.find((c) => c.type === "exponential");
  if (e) return `exp b=${e.b}${e.k ? ` k=${e.k}` : ""}`;
  if (q) return `parab a=${q.a}${curves.some((c) => c.type === "line") ? " +line" : ""}`;
  return "?";
};

// generate gate-passed items, tag with task + shape
const recs = [];
let id = 1;
for (const band of BANDS) {
  for (let idx = 0; idx < 70; idx++) {
    const cell = drawCell("advanced_math", "nonlinear_graphs", band, idx);
    const num = cell.incidentals.numbers;
    const cand = { statement: num.statement, choices: num.choices, correct_choice: num.correct_choice, answer: num.answer, solve_path: num.solve_path, fingerprint: num.fingerprint, radicals_used: {} };
    const gate = await verifyAndGate(cand, cell);
    if (!gate.keep) continue;
    const item = toRenderItem({ cand, cell, gate }, id++);
    recs.push({ item, task: cell.radicals.task, band, shape: shapeOf(item) });
  }
}

// pick a diverse subset: up to 2 per (task|shape) bucket so every variant + extreme shows
const buckets = {};
const picked = [];
for (const r of recs) {
  const key = `${r.task}|${r.shape}`;
  buckets[key] = (buckets[key] || 0) + 1;
  if (buckets[key] <= 2) picked.push(r);
}
picked.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band) || a.task.localeCompare(b.task));

const ansText = (it) => (it.type === "mcq" ? `correct = ${it.answer.correct}` : `answer = ${it.answer.accept[0]}`);
const CSS = `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 18px;break-inside:avoid}.figref{font:600 12px monospace;color:#c2410c;margin-bottom:6px}</style>`;
const cards = picked.map((r) =>
  `<div class="figitem"><div class="figref">#${r.item.id} · ${r.task} · B${r.band} · ${r.item.statementId} · ${r.shape} · ${ansText(r.item)}</div>${renderQuestion(r.item)}</div>`).join("\n");

mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "adv-graphs.html"), head("ADV-2 nonlinear graph items — visual check", 2) + FIG_OPT_CSS + CSS + `<main class="qs">${cards}</main>` + foot(2));

const byTask = {};
for (const r of picked) byTask[r.task] = (byTask[r.task] || 0) + 1;
const shapes = [...new Set(recs.map((r) => r.shape))].sort();
console.log(`→ tests/figverify/adv-graphs.html · ${picked.length} cards (of ${recs.length} gate-passed)`);
console.log("  per task:", JSON.stringify(byTask));
console.log("  shapes present:", shapes.join(" · "));
