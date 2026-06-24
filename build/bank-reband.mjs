/* Stage 2 — re-band the imported Mod2 items with the SAT-Insight-Gen judge.
   Resumable (sidecar data/mod2-bands.json keyed by item _key) + pooled. Does NOT
   mutate the bank; Stage 5 applies the bands. node build/bank-reband.mjs */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { measure } from "../difficulty/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const SIDE = join(ROOT, "data", "mod2-bands.json");
const N = Number(process.env.SIG_PANEL_N || 2);
const CAP = Number(process.env.SIG_POOL || 8);

const items = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const mod2 = items.filter((o) => String(o.source || "").startsWith("mod2/"));
const side = existsSync(SIDE) ? JSON.parse(readFileSync(SIDE, "utf8")) : {};
const todo = mod2.filter((o) => !side[o._key]);
console.log(`Mod2 items: ${mod2.length} · already banded: ${mod2.length - todo.length} · to do: ${todo.length} (n=${N}, cap=${CAP})`);

let i = 0, done = 0;
async function worker() {
  while (i < todo.length) {
    const it = todo[i++];
    try { const m = await measure(it, { n: N }); side[it._key] = { band: m.band, scalePoint: m.scalePoint, method: m.method, se: m.se_scale }; }
    catch (e) { side[it._key] = { band: null, error: String(e.message).slice(0, 80) }; }
    if (++done % 10 === 0 || done === todo.length) { writeFileSync(SIDE, JSON.stringify(side)); console.log(`  ${done}/${todo.length}`); }
  }
}
await Promise.all(Array.from({ length: Math.min(CAP, todo.length) }, worker));
writeFileSync(SIDE, JSON.stringify(side));
const hist = {}; for (const o of mod2) { const b = side[o._key]?.band || "?"; hist[b] = (hist[b] || 0) + 1; }
console.log(`\nMod2 measured bands: ${JSON.stringify(hist)}`);
console.log(`B1 (triviality-floor candidates): ${hist.B1 || 0}`);
