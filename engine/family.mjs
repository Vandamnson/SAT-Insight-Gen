/* ============================================================================
   engine/family.mjs — the TWO-TIER BANK's sole persistence layer (ENGINE v2).

   FAMILY  = one verified structure (the expensive tier: independently resolved,
             judge-banded, band-passed). VARIANT = one realized item inheriting
             the family's verification (the near-free tier).

   THE GATE IS STRUCTURAL, NOT A FLAG: this module is the only writer of
   data/engine/*.jsonl, and addFamily/addVariant THROW unless the record carries
   its verification verdicts. There is no bypass parameter.

   Keys are BAND-FREE (v1's keyOf embedded the mutable band — REPO-REVIEW A4):
   a family's identity is its structural spec; a variant's identity is its
   family + realized content.
   ============================================================================ */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "engine");
const FAMILIES = join(DIR, "families.jsonl");
const VARIANTS = join(DIR, "variants.jsonl");

const sha1 = (v) => createHash("sha1").update(JSON.stringify(v)).digest("hex");

/** familyKey(generator, spec) — content identity of a STRUCTURE. No band, no
 *  difficulty, no surface: two mints of the same structural spec are the same family. */
export function familyKey(generator, spec) {
  return "fam_" + sha1({ g: generator, s: spec }).slice(0, 10);
}

/** variantKey(familyId, item) — content identity of a realized item (stem/options/
 *  answer/figure — again band-free). */
export function variantKey(familyId, item) {
  return familyId + "#" + sha1({ stem: item.stem, options: item.options ?? null, answer: item.answer, fig: item.figure ?? null }).slice(0, 8);
}

const loadJsonl = (p) => (existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
export const loadFamilies = () => loadJsonl(FAMILIES);
export const loadVariants = () => loadJsonl(VARIANTS);

/* ---- verification requirements (the structural gate) ---- */
const ACCEPTED_METHODS = ["llm-judge", "curated", "lltm_chain_v1", "rubric_prior", "expert_blind_calibration"];
function assertFamilyVerified(f) {
  const errs = [];
  if (!f.generator || !f.spec) errs.push("missing generator/spec");
  if (f.generator === "authored") {
    // AUTHORED tier (clean-room harvest, STEERED-35.md): there is no draw loop, so
    // verification is MEASURED, never faked — cross-model blind solve + per-item
    // absolute-judge authenticity + banding per the operative instrument.
    const v = f.verification;
    if (!v?.blindSolve || v.blindSolve.agreement !== true || !(v.blindSolve.solvers >= 2)) errs.push("authored: needs blindSolve {agreement:true, solvers>=2}");
    if (!v?.provenance?.set) errs.push("authored: missing provenance.set");
  } else {
    const st = f.selftest;
    if (!st || !(st.draws >= 20)) errs.push("selftest.draws < 20");
    if (!st || st.mismatches !== 0) errs.push("selftest.mismatches !== 0");
    if (!st || st.trivial !== 0) errs.push("selftest.trivial !== 0");
  }
  const d = f.difficulty;
  if (!d || !d.band || !Number.isFinite(d.scalePoint)) errs.push("missing judge/curated difficulty");
  if (d && !ACCEPTED_METHODS.includes(d.method)) errs.push(`difficulty.method '${d?.method}' not accepted`);
  // rubric_prior is sanctioned ONLY where the judge is uncalibrated (currently GEO — 0 anchors; see ENGINE.md)
  if (["rubric_prior","expert_blind_calibration"].includes(d?.method) && f.domain !== "geometry_trig") errs.push(d.method+" only sanctioned for geometry_trig (judge uncalibrated there)");
  if (!f.bandpass || typeof f.bandpass !== "object") errs.push("missing bandpass record (scores or {mode:'record'})");
  if (errs.length) throw new Error(`family REFUSED (unverified): ${errs.join("; ")}`);
}
function assertVariantVerified(v) {
  const errs = [];
  if (!v.familyId) errs.push("missing familyId");
  const vd = v.verdicts;
  if (!vd) errs.push("missing verdicts");
  else {
    if (vd.resolver && vd.resolver.ok !== true) errs.push("resolver verdict not ok");
    const blindOk = vd.blindSolve && vd.blindSolve.agreement === true && vd.blindSolve.solvers >= 2;
    if (!vd.resolver && !(vd.prove && vd.prove.keep === true) && !blindOk) errs.push("needs resolver.ok, prove.keep, or blindSolve {agreement:true, solvers>=2}");
    if (vd.answerPin === false) errs.push("answer-pin failed");
  }
  if (!v.answer) errs.push("missing answer");
  if (errs.length) throw new Error(`variant REFUSED (unverified): ${errs.join("; ")}`);
}

/** addFamily(family) → {added, familyId}. Dedup by familyKey; throws if unverified. */
export function addFamily(family) {
  assertFamilyVerified(family);
  mkdirSync(DIR, { recursive: true });
  const familyId = family.familyId || familyKey(family.generator, family.spec);
  const have = new Set(loadFamilies().map((f) => f.familyId));
  if (have.has(familyId)) return { added: false, familyId };
  const rec = { familyId, createdAt: new Date().toISOString(), engineVersion: "v2.0", ...family };
  appendFileSync(FAMILIES, JSON.stringify(rec) + "\n");
  return { added: true, familyId };
}

/** addVariant(variant) → {added, variantId}. Dedup by content; throws if unverified
 *  or if the family does not exist (variants cannot precede their family). */
export function addVariant(variant) {
  assertVariantVerified(variant);
  const fams = new Set(loadFamilies().map((f) => f.familyId));
  if (!fams.has(variant.familyId)) throw new Error(`variant REFUSED: family ${variant.familyId} not minted`);
  mkdirSync(DIR, { recursive: true });
  const variantId = variant.variantId || variantKey(variant.familyId, variant);
  const have = new Set(loadVariants().map((v) => v.variantId));
  if (have.has(variantId)) return { added: false, variantId };
  const rec = { variantId, createdAt: new Date().toISOString(), ...variant };
  appendFileSync(VARIANTS, JSON.stringify(rec) + "\n");
  return { added: true, variantId };
}

/** summary() — counts for CLI/status output. */
export function summary() {
  const fams = loadFamilies(), vars = loadVariants();
  const perFam = {}; for (const v of vars) perFam[v.familyId] = (perFam[v.familyId] || 0) + 1;
  const byBand = {}; for (const f of fams) byBand[f.difficulty?.band || "?"] = (byBand[f.difficulty?.band || "?"] || 0) + 1;
  return { families: fams.length, variants: vars.length, byBand, perFam };
}

export default { familyKey, variantKey, loadFamilies, loadVariants, addFamily, addVariant, summary };
