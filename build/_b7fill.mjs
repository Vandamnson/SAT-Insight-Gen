/* ============================================================================
   _b7fill.mjs — populate Band 7 for ALGEBRA. The cross-skill generator (compose.mjs,
   verified by _composecheck) is sound for any seed, so draw N distinct items per
   chain C1–C7, content-dedup via appendToBank, and bank them (band:"B7" → they show
   in the viewer's B7 facet).  node build/_b7fill.mjs [N-per-chain] [testNum]
   ============================================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawCross, CROSS_TYPES } from "./compose.mjs";
import { appendToBank } from "./bank.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] || 5);
const testNum = Number(process.argv[3] || 110);
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const qs = [];
let id = 1;
for (const tpe of CROSS_TYPES) for (let i = 0; i < N; i++) qs.push({ id: id++, ...drawCross(tpe, rng(`b7fill|${tpe}|${i}`)) });
writeFileSync(join(ROOT, "data", `test-${testNum}.json`), JSON.stringify({ number: testNum, title: "Band 7 — cross-skill algebra (fill)", questions: qs }, null, 2));
const added = appendToBank(qs, { source: `test-${testNum}` });
const byChain = {}; for (const q of qs) byChain[q.chain] = (byChain[q.chain] || 0) + 1;
console.log(`drew ${qs.length} (${JSON.stringify(byChain)}), banked ${added} new B7 algebra → test-${testNum}.json`);
