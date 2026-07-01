/* ============================================================================
   engine/verify/bandpass-calibrate.mjs — the CONFUSION TABLE that justifies
   flipping the band-pass from record → enforce.

   1. KNOWN RESKINS (dedup-candidates structClusters, blind-verified in v1):
      intra-cluster pair similarity must land ABOVE the surface floor → "rejected".
   2. OFFICIAL exemplars: must PASS the novelty floor vs our corpus, and (sample)
      PASS the distribution floor (official mean ≈ 8.0).
   3. THE 5 CURRENT CHAINS: the three C1/C2/C4 PORTS should be novelty-REJECTED
      (their ancestors are banked in v1 — correct behavior!), the two NEW chains
      should pass. node engine/verify/bandpass-calibrate.mjs [--auth-n=8]
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, nearestSurface, shingles, stemText } from "../distance.mjs";
import { bandpassFamily, FLOORS } from "../bandpass.mjs";
import { enumerateChains, chainSignature, drawChain } from "../composer.mjs";
import { rng } from "../types.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AUTH_N = Number((process.argv.find((a) => a.startsWith("--auth-n=")) || "").split("=")[1] || 8);
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 0; };

console.log(`floors: surface<${FLOORS.surfaceMax}  struct>${FLOORS.structMin}  auth≥${FLOORS.authMin}\n`);
const corpus = loadCorpus();
console.log(`corpus: ${corpus.surface.length} surface entries, ${corpus.structural.length} structural fingerprints\n`);

/* 1. known reskins must be flagged */
const cand = JSON.parse(readFileSync(join(ROOT, "data", "dedup-candidates.json"), "utf8"));
let pairs = 0, flagged = 0;
for (const cl of cand.structClusters) {
  for (let i = 0; i + 1 < cl.members.length; i += 2) {
    const a = shingles(cl.members[i].stem), b = shingles(cl.members[i + 1].stem);
    pairs++; if (jaccard(a, b) >= FLOORS.surfaceMax) flagged++;
  }
}
console.log(`1. KNOWN RESKINS: ${flagged}/${pairs} intra-cluster pairs flagged by the surface floor (want ~all)`);

/* 2. officials must pass */
const raw = JSON.parse(readFileSync(join(ROOT, "taxonomy", "exemplars.clean.json"), "utf8"));
const officials = (Array.isArray(raw) ? raw : raw.items || Object.values(raw).find(Array.isArray))
  .filter((e) => e.stem && !/ax\+8|x\+613/.test(e.stem));
let offPass = 0;
for (const o of officials) { if (nearestSurface(o.stem, corpus).sim < FLOORS.surfaceMax) offPass++; }
console.log(`2. OFFICIALS (novelty floor): ${offPass}/${officials.length} pass vs our corpus (want ~all — they are not our items)`);

const { authenticityScore } = await import("../authenticity.mjs");
const sample = officials.slice(0, AUTH_N);
const scores = [];
for (const o of sample) { try { scores.push((await authenticityScore(o.stem)).score); } catch { /* transport */ } }
if (scores.length) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const passing = scores.filter((s) => s >= FLOORS.authMin).length;
  console.log(`   OFFICIALS (distribution floor, n=${scores.length}): mean ${mean.toFixed(1)}, ${passing}/${scores.length} ≥ ${FLOORS.authMin} (want ~all)`);
}

/* 3. the 5 current chains through the full band-pass (record mode) */
console.log(`\n3. CURRENT CHAINS through the band-pass (ports SHOULD fail novelty — ancestors are banked):`);
for (const spec of enumerateChains({})) {
  const sig = chainSignature(spec);
  const it = drawChain(spec, rng(`cal|${sig}`));
  const bp = await bandpassFamily(it, it.fingerprint, { corpus, mode: "record" });
  console.log(`  ${bp.strictPass ? "PASS " : "REJECT"} ${sig}`);
  console.log(`     surface ${bp.noveltyDist.surfaceSim} (near ${bp.noveltyDist.nearestSurfaceId}) · struct ${bp.noveltyDist.structDist} · auth ${bp.authenticityScore ?? "—"}${bp.reasons.length ? "\n     ⤷ " + bp.reasons.join("; ") : ""}`);
}
