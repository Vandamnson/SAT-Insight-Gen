/* ============================================================================
   engine/importer.mjs — E6 STUB: propose family groupings for the v1 bank (902).
   PROPOSAL-ONLY: writes data/engine/import-proposals.json, never touches
   families.jsonl (mod2/misc items need blind adjudication before any grouping
   is trusted). Run in a later session; kept here so the path is designed.
     node engine/importer.mjs
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");

function keyFor(o) {
  if (o.tier === "cross-skill" && o._p?.kind) return { key: `capstone:${o._p.kind}`, confidence: "high" };                     // fully parametric
  if (o.tier === "band-targeted" && o.params) return { key: `legacy:${o.skill}:${Object.keys(o.params).sort().join(",")}`, confidence: "medium" };
  if (o.radicals?.task) return { key: `cell:${o.skill}:${o.radicals.task}`, confidence: "medium" };                            // structure known, numbers not stored
  return { key: null, confidence: "none" };                                                                                   // mod2/misc → blind adjudication required
}

if (!existsSync(BANK)) { console.error("no v1 bank"); process.exit(1); }
const items = readFileSync(BANK, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const groups = {}, unresolved = [];
for (const o of items) {
  const { key, confidence } = keyFor(o);
  if (!key) { unresolved.push(o._key); continue; }
  (groups[key] ||= { confidence, members: [] }).members.push(o._key);
}
const proposals = Object.entries(groups).map(([key, g]) => ({ proposedFamilyKey: key, confidence: g.confidence, memberCount: g.members.length, members: g.members }));
writeFileSync(join(ROOT, "data", "engine", "import-proposals.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), note: "PROPOSALS ONLY — nothing imported; mod2/misc require blind adjudication", proposals, unresolvedCount: unresolved.length, unresolved }, null, 1));
console.log(`proposed ${proposals.length} family groupings over ${items.length - unresolved.length} items · ${unresolved.length} need blind adjudication (mod2/misc)`);
console.log(`→ data/engine/import-proposals.json (nothing written to families.jsonl)`);
