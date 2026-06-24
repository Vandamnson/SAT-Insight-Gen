/* ============================================================================
   _advgraphbank.mjs — generate a focused ADV-2 nonlinear-graph module through the
   REAL pipeline (generateCell over-generate+gate+dedup+balance → toRenderItem),
   write data/test-NN.json, and bank it (content-deduped, structural+cross-run dedup).
   Graph items are construct-backward (no LLM).  node build/_advgraphbank.mjs [N] [testNum]
   ============================================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateCell, toRenderItem } from "./pipeline.mjs";
import { appendToBank } from "./bank.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] || 24);
const testNum = Number(process.argv[3] || 109);

// graph items dedup on the FIGURE: within-run via generateCell's figure-signature, and
// cross-run via appendToBank's figure-aware content key — no surface/structural seeding needed.
const kept = await generateCell("advanced_math", "nonlinear_graphs", N, ["B1", "B2", "B5", "B6"], { i: 0 });
const questions = kept.map((s, i) => toRenderItem(s, i + 1));
writeFileSync(join(ROOT, "data", `test-${testNum}.json`), JSON.stringify({ number: testNum, title: "ADV-2 · advanced-math nonlinear graphs (B1, B2, B5, B6)", questions }, null, 2));
const added = appendToBank(questions, { source: `test-${testNum}` });

const byBand = {}, byTask = {};
for (const q of questions) { byBand[q.band] = (byBand[q.band] || 0) + 1; const t = (q.fingerprint || [])[0]; byTask[t] = (byTask[t] || 0) + 1; }
console.log(`\n→ data/test-${testNum}.json · ${questions.length} items · banked ${added} new`);
console.log("  bands:", JSON.stringify(byBand));
console.log("  tasks:", JSON.stringify(byTask));
