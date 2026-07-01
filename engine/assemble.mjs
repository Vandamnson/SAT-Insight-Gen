/* ============================================================================
   engine/assemble.mjs — product assembly over the two-tier bank.

   mockModule: a test-like set with the novelty guarantee BY CONSTRUCTION —
               at most ONE variant per family (no two items share a structure).
   drillLadder: the opposite on purpose — k variants of ONE family, for practice
               (same structure, fresh numbers/surface each time).
   Both emit v1 render-schema JSON so build/render.mjs + the viewer work unchanged.
   ============================================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies, loadVariants } from "./family.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BAND_ORDER = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"];
const bandIdx = (b) => BAND_ORDER.indexOf(b);

const toQuestion = (v, id) => ({ id, ...v.item, _familyId: v.familyId, _variantId: v.variantId });

/** mockModule({n, testNum, title, bands?}) → writes data/test-NN.json.
 *  ≤1 variant per family; spread across subdomains and bands. */
export function mockModule({ n = 22, testNum = 200, title, bands = null, includeRecordMode = false } = {}) {
  const fams = Object.fromEntries(loadFamilies().map((f) => [f.familyId, f]));
  let vars = loadVariants().filter((v) => fams[v.familyId] && v.item);
  if (bands) vars = vars.filter((v) => bands.includes(fams[v.familyId].difficulty?.band));
  // FLOORS RESPECTED: families that failed the strict band-pass ship in drills only,
  // never in a mock module (unless explicitly overridden).
  if (!includeRecordMode) vars = vars.filter((v) => fams[v.familyId].bandpass?.strictPass !== false);
  // one variant per family — prefer LLM-VOICED realizations (the distribution-floor fix)
  const perFam = new Map();
  for (const v of vars) {
    const cur = perFam.get(v.familyId);
    if (!cur || (v.realization?.mode === "llm-voice" && cur.realization?.mode !== "llm-voice")) perFam.set(v.familyId, v);
  }
  const pool = [...perFam.values()];
  const chosen = [], seenSub = {}, seenBand = {};
  pool.sort(() => 0);                                     // stable; diversity handled greedily below
  while (chosen.length < n && pool.length) {
    pool.sort((a, b) => {
      const fa = fams[a.familyId], fb = fams[b.familyId];
      const costA = (seenSub[fa.spec?.subdomain || fa.generator] || 0) + (seenBand[fa.difficulty?.band] || 0);
      const costB = (seenSub[fb.spec?.subdomain || fb.generator] || 0) + (seenBand[fb.difficulty?.band] || 0);
      return costA - costB;
    });
    const v = pool.shift(), f = fams[v.familyId];
    chosen.push(v);
    seenSub[f.spec?.subdomain || f.generator] = (seenSub[f.spec?.subdomain || f.generator] || 0) + 1;
    seenBand[f.difficulty?.band] = (seenBand[f.difficulty?.band] || 0) + 1;
  }
  chosen.sort((a, b) => bandIdx(fams[a.familyId].difficulty?.band) - bandIdx(fams[b.familyId].difficulty?.band));
  const questions = chosen.map((v, i) => toQuestion(v, i + 1));
  const nn = String(testNum).padStart(2, "0");
  const fp = join(ROOT, "data", `test-${nn}.json`);
  writeFileSync(fp, JSON.stringify({ number: testNum, title: title || `ENGINE v2 — mock module (≤1 per family)`, questions }, null, 2));
  return { fp, count: questions.length, families: new Set(chosen.map((c) => c.familyId)).size };
}

/** drillLadder(familyId, {k, testNum, title}) → writes data/test-NN.json with k
 *  variants of ONE family (practice ladder). */
export function drillLadder(familyId, { k = 5, testNum = 201, title } = {}) {
  const vars = loadVariants().filter((v) => v.familyId === familyId && v.item).slice(0, k);
  if (!vars.length) throw new Error(`no variants for family ${familyId}`);
  const questions = vars.map((v, i) => toQuestion(v, i + 1));
  const nn = String(testNum).padStart(2, "0");
  const fp = join(ROOT, "data", `test-${nn}.json`);
  writeFileSync(fp, JSON.stringify({ number: testNum, title: title || `ENGINE v2 — drill ladder (${familyId})`, questions }, null, 2));
  return { fp, count: questions.length };
}

export default { mockModule, drillLadder };
