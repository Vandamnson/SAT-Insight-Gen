/* ============================================================================
   regrade.mjs — re-measure a test file's items with the LLM-judge difficulty
   engine (difficulty/index.js measure) and rewrite their band + difficulty
   record. Resumable: items already method:"llm-judge" are skipped, and the file
   is written after each item. Run: SIG_LLM_TIMEOUT=300000 node build/regrade.mjs data/test-81.json
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { measure } from "../difficulty/index.js";

const file = process.argv[2] || "data/test-81.json";
const t = JSON.parse(readFileSync(file, "utf8"));
let done = 0;
for (const q of t.questions) {
  if (q.difficulty?.method === "llm-judge") { done++; continue; }
  const m = await measure(q);
  q.difficulty = { scalePoint: m.scalePoint, band: m.band, se_scale: m.se_scale, band_ambiguous: m.band_ambiguous, is_exemplar: m.is_exemplar, method: m.method, rp67_statement: m.rp67_statement, signals: m.signals };
  q.band = m.band;   // item IS its (judge-)measured band
  done++;
  writeFileSync(file, JSON.stringify(t, null, 2));   // incremental → resumable
  console.log(`  q${q.id} ${q.domain.padEnd(14)} target ${q.target_band} → ${m.band} @${m.scalePoint} (${m.method})`);
}
console.log(`\nre-graded ${done}/${t.questions.length} with the LLM judge → ${file}`);
