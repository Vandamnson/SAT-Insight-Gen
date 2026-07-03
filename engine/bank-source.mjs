/* bank-source — the v1 item bank (data/item-bank.jsonl, 902 verified render-schema
   items across all four domains) as a SUITE problem source.

   Family identity is best-effort by design (REPO-REVIEW A-era debt): items covered
   by data/engine/import-proposals.json get their proposed group as a pseudo-family;
   the 432 unresolved mod2/misc items are singletons and must be guarded at
   assembly time by the pairwise surface floor instead (suite.mjs does this).
   Known caveat carried on every item: advanced_math judge bands drift ~+1
   (HANDOFF-era finding) — recorded, not corrected. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let _cache = null;
export function loadBankQuestions() {
  if (_cache) return _cache;
  const groups = {};
  const pp = join(ROOT, "data", "engine", "import-proposals.json");
  if (existsSync(pp)) {
    const { proposals } = JSON.parse(readFileSync(pp, "utf8"));
    for (const pr of proposals) for (const m of pr.members) groups[m] = pr.proposedFamilyKey;
  }
  const out = [];
  let excluded = 0;
  for (const line of readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n")) {
    if (!line) continue;
    const it = JSON.parse(line);
    if (!it.answer || !it.type || !it.stem) { excluded++; continue; }
    const band = it.band || it.target_band;
    if (!band) { excluded++; continue; }
    out.push({
      q: it,                                   // render-schema passthrough
      id: `v1:${it._key.slice(0, 8)}`,         // matches distance.mjs corpus ids
      key: it._key,
      domain: it.domain, skill: it.skill, band,
      group: groups[it._key] ?? null,          // pseudo-family or singleton
    });
  }
  if (excluded) console.log(`bank-source: ${excluded} items excluded (missing answer/type/band)`);
  _cache = out;
  return out;
}

export default { loadBankQuestions };
