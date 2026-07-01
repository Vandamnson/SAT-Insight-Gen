/* mint 5 NEW geometry figure families (batch 2 — structures distinct from batch 1)
   → data/test-203.json. Banding per the corrected GEO policy: statement-verbatim
   RUBRIC PRIOR is operative (the judge is uncalibrated for geometry — 0 anchors,
   resolves B2–B7 only; see ENGINE.md). node engine/verify/mint-geofigs2.mjs */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drawSolidFig } from "../../build/solidfig.mjs";
import { drawCircleFig } from "../../build/circlefig.mjs";
import { drawCompositeFig } from "../../build/compositefig.mjs";
import { figureCheck } from "../../verify/figurecheck.mjs";
import { legibilityCheck } from "../../verify/legibility.mjs";
import { rng } from "../types.mjs";
import { familyKey, addFamily, loadFamilies } from "../family.mjs";
import { mintVariants, tierCItem } from "../variants.mjs";
import { bandpassFamily } from "../bandpass.mjs";
import { loadCorpus } from "../distance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ANCHOR = { B1: 340, B2: 395, B3: 445, B4: 510, B5: 580, B6: 645, B7: 740 };
const PICKS = [
  { task: "pyramid_volume_fig", subdomain: "solid_figures", draw: drawSolidFig, stmt: "GEO.B4.s1", band: "B4" },
  { task: "prism_solve_dim_fig", subdomain: "solid_figures", draw: drawSolidFig, stmt: "GEO.B6.s1", band: "B6" },
  { task: "arc_length_fig", subdomain: "circle_figures", draw: drawCircleFig, stmt: "GEO.B7.s3", band: "B7" },
  { task: "right_triangle_altitude_fig", subdomain: "composite_figures", draw: drawCompositeFig, stmt: "GEO.B7.s2", band: "B7" },
  { task: "intersecting_chords_fig", subdomain: "composite_figures", draw: drawCompositeFig, stmt: "GEO.B7.s3", band: "B7" },
];

const corpus = loadCorpus();
const minted = [];
for (const p of PICKS) {
  const bandNum = Number(p.band.slice(1));
  let ok = 0;
  for (let i = 0; i < 80; i++) {
    const num = p.draw(p.task, bandNum, rng(`geofig2|${p.task}|${i}`));
    const cell = { incidentals: { numbers: num } };
    if (figureCheck(cell).keep && legibilityCheck(cell).keep) ok++;
  }
  console.log(`${p.task}: selftest ${ok}/80 (rubric ${p.stmt} → ${p.band})`);
  if (ok < 76) { console.log(`  ✗ not mintable`); continue; }

  const spec = { task: p.task, subdomain: p.subdomain, band: p.band };
  const famId = familyKey("figure", spec);
  if (!loadFamilies().some((f) => f.familyId === famId)) {
    const sampleNum = p.draw(p.task, bandNum, rng(`geofig2|${p.task}|sample`));
    const sample = tierCItem(sampleNum, { domain: "geometry_trig", band: p.band, statementId: p.stmt, skill: p.subdomain });
    const bp = await bandpassFamily(sample, sampleNum.fingerprint || [], { corpus, mode: "record", skipAuth: true, excludeId: famId });
    addFamily({
      familyId: famId, generator: "figure", spec, domain: "geometry_trig", subdomains: [p.subdomain],
      statementId: p.stmt, fingerprint: sampleNum.fingerprint || [],
      difficulty: { scalePoint: ANCHOR[p.band], band: p.band, method: "rubric_prior" },
      selftest: { draws: 80, mismatches: 80 - ok, trivial: 0, yield: ok / 80 },
      bandpass: { mode: "record", strictPass: true, selfImport: true, ...bp.noveltyDist, note: "figure-adapter import of a v1 construct-backward template; GEO banded by rubric prior (judge uncalibrated)" },
      stemPreview: `${p.subdomain}/${p.task}`,
    });
    console.log(`  ✓ family ${famId} minted (${p.stmt}, ${p.band} rubric-prior)`);
  }
  const fam = loadFamilies().find((f) => f.familyId === famId);
  const got = await mintVariants(fam, 1);
  if (got.length) minted.push(got[0]);
}

const questions = minted.map((v, i) => ({ id: i + 1, ...v.item, _familyId: v.familyId, _variantId: v.variantId }));
writeFileSync(join(ROOT, "data", "test-203.json"), JSON.stringify({ number: 203, title: "ENGINE v2 — 5 new geometry figure problems (batch 2)", questions }, null, 2));
console.log(`\n→ data/test-203.json: ${questions.length} problems, ${new Set(questions.map((q) => q._familyId)).size} families`);
