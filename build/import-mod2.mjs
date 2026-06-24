/* ============================================================================
   import-mod2.mjs — merge the SAT-Mod2-Novel-Tests item set into this bank so the
   combined corpus can be browsed (bank-html) and de-duped across both generators.
   Mod2 items are tagged band:"M2" (Module-2-hard, unbanded) + source mod2/test-NN
   so they stay identifiable and removable. Content-deduped by appendToBank.
     node build/import-mod2.mjs
   ============================================================================ */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { appendToBank } from "./bank.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOD2 = join(ROOT, "..", "SAT-Mod2-Novel-Tests", "data");
if (!existsSync(MOD2)) { console.error("SAT-Mod2 data dir not found:", MOD2); process.exit(1); }

let total = 0, added = 0;
for (const f of readdirSync(MOD2).filter((f) => /^test-\d+\.json$/.test(f)).sort()) {
  const t = JSON.parse(readFileSync(join(MOD2, f), "utf8"));
  const num = String(t.number || (f.match(/\d+/) || [0])[0]).padStart(2, "0");
  // band:"M2" / target_band placed BEFORE ...q so any field on q wins, but Mod2 items carry no band.
  const items = (t.questions || []).map((q) => ({ program: "SAT", band: "M2", target_band: "M2", ...q }));
  total += items.length;
  const n = appendToBank(items, { source: `mod2/test-${num}` });
  added += n;
  console.log(`  mod2/test-${num}: +${n}/${items.length}`);
}
console.log(`\nMod2 import: ${added} new of ${total} items (dedup skipped ${total - added}) → data/item-bank.jsonl`);
