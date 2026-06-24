/* Stage 5 — apply the cleanup to the bank in ONE rewrite.
   Removes: confirmed structural reskins (dedup-removals) ∪ trivial/non-SAT (triviality-drops)
   ∪ implausible (plausibility-drops). Updates Mod2 items with their judge-measured band
   (mod2-bands.json). Figures are NOT touched (audit is report-only). Dry-run by default;
   pass --write to overwrite data/item-bank.jsonl. node build/bank-apply.mjs [--write] */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const load = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);

const lines = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean);
const items = lines.map((l) => JSON.parse(l));
const keyToIdx = new Map(items.map((o, i) => [o._key, i]));
const origin = (o) => (String(o.source || "").startsWith("mod2/") ? "mod2" : "insight-gen");

const dedup = new Set(load(join(ROOT, "data", "dedup-removals.json"), { remove: [] }).remove);
const triv = new Set(load(join(ROOT, "data", "triviality-drops.json"), { drops: [] }).drops.map((d) => d.idx));
const plausRaw = load(join(ROOT, "data", "plausibility-drops.json"), []);
const plaus = new Set((Array.isArray(plausRaw) ? plausRaw : []).map((d) => keyToIdx.get(d.key)).filter((i) => i != null));
const bands = load(join(ROOT, "data", "mod2-bands.json"), {});

const remove = new Set([...dedup, ...triv, ...plaus]);
const survivors = items.filter((_, i) => !remove.has(i));

// update Mod2 survivors with measured band
let reband = 0;
for (const o of survivors) {
  if (origin(o) === "mod2" && bands[o._key]?.band) {
    o.band = bands[o._key].band; o.target_band = bands[o._key].band;
    o.difficulty = { scalePoint: bands[o._key].scalePoint, band: bands[o._key].band, method: "llm-judge" };
    reband++;
  }
}

const by = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`=== bank cleanup ${WRITE ? "(WRITE)" : "(dry-run)"} ===`);
console.log(`before: ${items.length}`);
console.log(`remove: ${remove.size}  = dedup ${dedup.size} ∪ trivial ${triv.size} ∪ implausible ${plaus.size} (overlaps merged)`);
console.log(`  removed by origin: ${JSON.stringify(by([...remove].map((i) => items[i]), origin))}`);
console.log(`after: ${survivors.length}  · Mod2 re-banded: ${reband}`);
console.log(`  survivors by origin: ${JSON.stringify(by(survivors, origin))}`);
console.log(`  survivors by band: ${JSON.stringify(by(survivors, (o) => o.band))}`);
if (WRITE) {
  writeFileSync(BANK, survivors.map((o) => JSON.stringify(o)).join("\n") + "\n");
  console.log(`\n✓ wrote ${survivors.length} items → data/item-bank.jsonl`);
} else {
  console.log(`\n(dry-run — pass --write to apply)`);
}
