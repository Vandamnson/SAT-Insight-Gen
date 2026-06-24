/* gloves-off ADV B7 figure capstones → data/test-NN.json + bank + a visual-check page.
   node build/_advfigspot.mjs [K-per-type] [testNum] */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawAdvFig, FIG_TYPES } from "./advfig.mjs";
import { appendToBank } from "./bank.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const K = Number(process.argv[2] || 3);
const testNum = Number(process.argv[3] || 111);
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const qs = [];
let id = 1;
for (const tpe of FIG_TYPES) for (let i = 0; i < K; i++) qs.push({ id: id++, ...drawAdvFig(tpe, rng(`advfig|${tpe}|show|${i}`)) });
writeFileSync(join(ROOT, "data", `test-${testNum}.json`), JSON.stringify({ number: testNum, title: "Band 7 — gloves-off Advanced Math figure capstones", questions: qs }, null, 2));
const added = appendToBank(qs, { source: `test-${testNum}` });

const CSS = `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 18px}.figref{font:600 12px monospace;color:#c2410c;margin-bottom:6px}</style>`;
const cards = qs.map((q) => `<div class="figitem"><div class="figref">#${q.id} · ${q.chain} · ${q.statementId} · scale ${q.difficulty.scalePoint} · ans=${q.answer.accept[0]}</div>${renderQuestion(q)}</div>`).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "advfig.html"), head("ADV B7 gloves-off figure capstones", 2) + FIG_OPT_CSS + CSS + `<main class="qs">${cards}</main>` + foot(2));
const byChain = {}; for (const q of qs) byChain[q.chain] = (byChain[q.chain] || 0) + 1;
console.log(`→ data/test-${testNum}.json · ${qs.length} items (${JSON.stringify(byChain)}) · banked ${added} new`);
console.log("→ tests/figverify/advfig.html");
