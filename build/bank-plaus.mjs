/* Stage 3 — plausibility gate on the Mod2 items (Insight-Gen items already passed
   plausibility at generation). Adapter: build a `cand` (statement+answer) and a
   minimal `cell` (incidentals.context: abstract→"none" so the gate skips bare-math
   items) from each bank item, then reuse verify/plausibility.mjs. Resumable + pooled.
   Does NOT mutate the bank. node build/bank-plaus.mjs */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { plausibilityCheck } from "../verify/plausibility.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const SIDE = join(ROOT, "data", "mod2-plaus.json");
const CAP = Number(process.env.SIG_POOL || 8);

const stmt = (segs) => (segs || []).map((s) => (s.t === "math" ? `\\(${s.v}\\)` : s.t === "mathblock" ? `\\[${s.v}\\]` : s.v)).join("");
const proseWords = (segs) => (segs || []).filter((s) => s.t === "text").map((s) => s.v).join(" ").replace(/[^a-z ]/gi, " ").split(/\s+/).filter(Boolean).length;
// abstract (skip) iff little prose or a bare-math lead-in; else treat as real-world context
const ABSTRACT = /^\s*(in the (given )?(equation|system|function|expression|inequality)|the (equation|system|function|graph|expression|inequality|polynomial)|which|what (is|are)|solve|for what|if\s)/i;
function cellFor(item) {
  const prose = stmt(item.stem.filter((s) => s.t === "text"));
  const abstract = proseWords(item.stem) < 10 || (ABSTRACT.test(prose) && proseWords(item.stem) < 16);
  return { incidentals: { context: abstract ? "none" : "real-world" } };
}
function candFor(item) {
  const answer = item.type === "mcq" ? `choice ${item.answer?.correct}` : (item.answer?.accept || [])[0];
  return { statement: stmt(item.stem), answer, correct_choice: item.answer?.correct };
}

const items = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const mod2 = items.filter((o) => String(o.source || "").startsWith("mod2/"));
const side = existsSync(SIDE) ? JSON.parse(readFileSync(SIDE, "utf8")) : {};
const todo = mod2.filter((o) => !side[o._key]);
console.log(`Mod2 items: ${mod2.length} · already checked: ${mod2.length - todo.length} · to do: ${todo.length}`);

let i = 0, done = 0;
async function worker() {
  while (i < todo.length) {
    const it = todo[i++];
    try { const v = await plausibilityCheck(candFor(it), cellFor(it)); side[it._key] = { keep: v.keep !== false, skipped: v.skipped || null, issues: v.issues || [] }; }
    catch (e) { side[it._key] = { keep: true, error: String(e.message).slice(0, 80) }; }
    if (++done % 15 === 0 || done === todo.length) { writeFileSync(SIDE, JSON.stringify(side)); console.log(`  ${done}/${todo.length}`); }
  }
}
await Promise.all(Array.from({ length: Math.min(CAP, todo.length) }, worker));
writeFileSync(SIDE, JSON.stringify(side));
const drop = mod2.filter((o) => side[o._key] && side[o._key].keep === false);
console.log(`\nimplausible (drop): ${drop.length}`);
for (const o of drop.slice(0, 20)) console.log(`  ${o.source}: ${(side[o._key].issues || []).join("; ").slice(0, 90)}`);
writeFileSync(join(ROOT, "data", "plausibility-drops.json"), JSON.stringify(drop.map((o) => ({ key: o._key, source: o.source, issues: side[o._key].issues })), null, 1));
