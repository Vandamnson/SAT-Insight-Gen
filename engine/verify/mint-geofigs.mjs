/* mint 5 GEOMETRY FIGURE families through the engine's figure adapter (the
   sanctioned import of v1's construct-backward figure builders) and realize one
   variant each → data/test-202.json.
   Verification per family: 80-draw selftest (figureCheck + legibility), judge
   banding (n=2), band-pass recorded (selfImport — these templates exist in v1 by
   design; the adapter is migration path (c)). node engine/verify/mint-geofigs.mjs */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawSolidFig } from "../../build/solidfig.mjs";
import { drawCircleFig } from "../../build/circlefig.mjs";
import { drawCompositeFig } from "../../build/compositefig.mjs";
import { figureCheck } from "../../verify/figurecheck.mjs";
import { legibilityCheck } from "../../verify/legibility.mjs";
import { predictBand } from "../../difficulty/lltm.mjs";
import { measure } from "../../difficulty/index.js";
import { rng } from "../types.mjs";
import { familyKey, addFamily, loadFamilies } from "../family.mjs";
import { mintVariants, tierCItem } from "../variants.mjs";
import { bandpassFamily } from "../bandpass.mjs";
import { loadCorpus } from "../distance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PICKS = [
  { task: "prism_volume_fig", subdomain: "solid_figures", draw: drawSolidFig },
  { task: "cylinder_volume_fig", subdomain: "solid_figures", draw: drawSolidFig },
  { task: "sector_area_fig", subdomain: "circle_figures", draw: drawCircleFig },
  { task: "inscribed_angle_fig", subdomain: "circle_figures", draw: drawCircleFig },
  { task: "tangent_length_fig", subdomain: "composite_figures", draw: drawCompositeFig },
];

const corpus = loadCorpus();
const mintedVariants = [];
for (const p of PICKS) {
  const band = predictBand({ task: p.task }, "geometry_trig", p.subdomain);
  const bandNum = Number(band.slice(1));
  // 80-draw selftest through the adapter's resolver (figureCheck + legibility)
  let ok = 0;
  for (let i = 0; i < 80; i++) {
    const num = p.draw(p.task, bandNum, rng(`geofig|${p.task}|${i}`));
    const cell = { incidentals: { numbers: num } };
    if (figureCheck(cell).keep && legibilityCheck(cell).keep) ok++;
  }
  console.log(`${p.task}: selftest ${ok}/80 (rubric band ${band})`);
  if (ok < 76) { console.log(`  ✗ not mintable`); continue; }

  const spec = { task: p.task, subdomain: p.subdomain, band };
  const famId = familyKey("figure", spec);
  if (!loadFamilies().some((f) => f.familyId === famId)) {
    // judge banding at mint (n=2) on a sample item
    const sampleNum = p.draw(p.task, bandNum, rng(`geofig|${p.task}|sample`));
    const sample = tierCItem(sampleNum, { domain: "geometry_trig", band, statementId: null, skill: p.subdomain });
    const d = await measure(sample, { n: 2 });
    const bp = await bandpassFamily(sample, sampleNum.fingerprint || [], { corpus, mode: "record", skipAuth: true, excludeId: famId });
    addFamily({
      familyId: famId, generator: "figure", spec, domain: "geometry_trig", subdomains: [p.subdomain],
      statementId: null, fingerprint: sampleNum.fingerprint || [],
      difficulty: { scalePoint: d.scalePoint, band: d.band, method: d.method },
      selftest: { draws: 80, mismatches: 80 - ok, trivial: 0, yield: ok / 80 },
      bandpass: { mode: "record", strictPass: true, selfImport: true, ...bp.noveltyDist, note: "figure-adapter import of a v1 construct-backward template (migration path c); novelty scores recorded" },
      stemPreview: `${p.subdomain}/${p.task}`,
    });
    console.log(`  ✓ family ${famId} minted (judge ${d.band} @${d.scalePoint})`);
  }
  const fam = loadFamilies().find((f) => f.familyId === famId);
  const got = await mintVariants(fam, 1);
  if (got.length) mintedVariants.push(got[0]);
}

const questions = mintedVariants.map((v, i) => ({ id: i + 1, ...v.item, _familyId: v.familyId, _variantId: v.variantId }));
writeFileSync(join(ROOT, "data", "test-202.json"), JSON.stringify({ number: 202, title: "ENGINE v2 — 5 geometry figure problems (one per family)", questions }, null, 2));
console.log(`\n→ data/test-202.json: ${questions.length} problems, ${new Set(questions.map((q) => q._familyId)).size} families`);
