/* Apply the re-judged bands (data/rejudge-bands.json) back into the bank so every
   item is judge-banded, and report band coverage before/after. Dry-run by default;
   pass --write. node build/bank-rejudge-apply.mjs [--write] */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const SIDE = join(ROOT, "data", "rejudge-bands.json");
const side = existsSync(SIDE) ? JSON.parse(readFileSync(SIDE, "utf8")) : {};
const items = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

const dist = (arr) => { const d = {}; for (const o of arr) d[o.band] = (d[o.band] || 0) + 1; return ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "M2"].filter((b) => d[b]).map((b) => `${b}:${d[b]}`).join("  "); };
console.log("BEFORE:", dist(items));

let changed = 0, moved = [];
for (const o of items) {
  const r = side[o._key];
  if (r && r.band) {
    if (r.band !== o.band) moved.push(`${o.source} ${o.skill}: ${o.band}→${r.band}`);
    if (r.band !== o.band || o.difficulty?.method !== "llm-judge") changed++;
    o.target_band = o.target_band || o.band;
    o.band = r.band;
    o.difficulty = { scalePoint: r.scalePoint, band: r.band, method: "llm-judge" };
  }
}
console.log("AFTER: ", dist(items));
console.log(`re-judged applied: ${Object.keys(side).length} · changed band/method: ${changed} · band moved: ${moved.length}`);
moved.slice(0, 25).forEach((m) => console.log("  " + m));
const judged = items.filter((o) => o.difficulty?.method === "llm-judge").length;
console.log(`bank now judge-banded: ${judged}/${items.length}`);
if (WRITE) { writeFileSync(BANK, items.map((o) => JSON.stringify(o)).join("\n") + "\n"); console.log("\n✓ wrote data/item-bank.jsonl"); }
else console.log("\n(dry-run — pass --write to apply)");
