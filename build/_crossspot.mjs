// cross-skill B7/800 showcase → data/test-104.json (one of each chain) + bank. No LLM.
import { writeFileSync } from "node:fs";
import { drawCross, CROSS_TYPES } from "./compose.mjs";
import { appendToBank } from "./bank.mjs";

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const qs = CROSS_TYPES.map((t, i) => ({ id: i + 1, ...drawCross(t, rng(`xshow7|${t}`)) }));
writeFileSync("data/test-104.json", JSON.stringify({ number: 104, title: "Band 7 — cross-skill (≈800 algebra)", questions: qs }, null, 2));
const added = appendToBank(qs, { source: "test-104" });
console.log(`test-104: ${qs.length} items, banked ${added} new`);
qs.forEach((q) => console.log(`  q${q.id} ${q.chain} (scale ${q.difficulty.scalePoint})  answer=${q.answer.accept[0]}`));
