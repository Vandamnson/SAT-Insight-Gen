/* ============================================================================
   pick-anchors.mjs — select official CB Skills-Insight exemplars to use as the
   judge's few-shot anchors (one per band B2–B7), preferring self-contained,
   short stems. These are HELD OUT from validation (validate.mjs excludes them)
   so the judge is never tested on an item it was shown. Run once:
     node build/pick-anchors.mjs   →  taxonomy/anchors.json
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const items = JSON.parse(readFileSync(join(ROOT, "taxonomy", "exemplars.clean.json"), "utf8"));

const anchors = [];
for (const band of ["B2", "B3", "B4", "B5", "B6", "B7"]) {
  const cands = items.filter((i) => i.band === band && i.key);
  // prefer stems that don't depend on a figure (self-contained), then shortest
  const selfContained = cands.filter((i) => !/\bshown\b|graph|figure|scatterplot|\btable\b|diagram/i.test(i.stem));
  const pool = selfContained.length ? selfContained : cands;
  const pick = pool.slice().sort((a, b) => a.stem.length - b.stem.length)[0];
  if (pick) anchors.push({ band, domain: pick.domain, key: pick.key, stem: pick.stem.slice(0, 300) });
}
writeFileSync(join(ROOT, "taxonomy", "anchors.json"), JSON.stringify(anchors, null, 2));
console.log(`wrote taxonomy/anchors.json — ${anchors.length} official CB exemplars (held out from validation):`);
anchors.forEach((a) => console.log(`  [${a.band}] (${a.domain}) key=${a.key}  ${a.stem.slice(0, 70)}…`));
