/* Re-judge every bank item that is NOT yet judge-banded (Insight-Gen LLTM/curated)
   with the LLM band judge, so the whole bank has consistent, rigorous bands.
   Resumable (sidecar data/rejudge-bands.json keyed by _key) + pooled. Sidecar only;
   bank-rejudge-apply writes it back. node build/bank-rejudge.mjs */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { measure } from "../difficulty/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const SIDE = join(ROOT, "data", "rejudge-bands.json");
const N = Number(process.env.SIG_PANEL_N || 2);
const CAP = Number(process.env.SIG_POOL || 8);

const items = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const need = items.filter((o) => o.difficulty?.method !== "llm-judge");
const side = existsSync(SIDE) ? JSON.parse(readFileSync(SIDE, "utf8")) : {};
const todo = need.filter((o) => !side[o._key]);
console.log(`non-judge items: ${need.length} · already done: ${need.length - todo.length} · to do: ${todo.length} (n=${N}, cap=${CAP})`);

let i = 0, done = 0;
async function worker() {
  while (i < todo.length) {
    const it = todo[i++];
    try { const m = await measure(it, { n: N }); side[it._key] = { band: m.band, scalePoint: m.scalePoint, was: it.band, method: m.method }; }
    catch (e) { side[it._key] = { band: null, error: String(e.message).slice(0, 80) }; }
    if (++done % 10 === 0 || done === todo.length) { writeFileSync(SIDE, JSON.stringify(side)); console.log(`  ${done}/${todo.length}`); }
  }
}
await Promise.all(Array.from({ length: Math.min(CAP, todo.length) }, worker));
writeFileSync(SIDE, JSON.stringify(side));
// movement summary
const moved = need.filter((o) => side[o._key]?.band && side[o._key].band !== o.band).length;
console.log(`\nre-judged ${Object.keys(side).length} · band changed for ${moved}`);
