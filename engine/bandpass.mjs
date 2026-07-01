/* ============================================================================
   engine/bandpass.mjs — the GENERATION-TIME BAND-PASS.

   A family is mintable only if it is:
     · NOT TOO CLOSE to anything known (novelty floor):
         nearest surface similarity  <  FLOORS.surfaceMax   (default 0.45)
         nearest structural distance >  FLOORS.structMin    (default 0.25)
     · NOT TOO FAR from the SAT distribution (distribution floor):
         authenticityScore ≥ FLOORS.authMin                 (default 7; official ≈ 8.0)

   Modes: "record" (score + log only — the calibration default) and "enforce".
   All scores are recorded on the family either way, so floor tuning has data.
   ============================================================================ */
import { loadCorpus, nearestSurface, nearestStructural, stemText } from "./distance.mjs";
import { authenticityScore } from "./authenticity.mjs";

export const FLOORS = {
  surfaceMax: Number(process.env.ENGINE_SURFACE_MAX ?? 0.45),
  structMin: Number(process.env.ENGINE_STRUCT_MIN ?? 0.25),
  authMin: Number(process.env.ENGINE_AUTH_MIN ?? 7),
};

/** bandpassFamily(sampleItem, fingerprint, {corpus, mode, skipAuth}) →
 *  { pass, mode, noveltyDist: {surfaceSim, nearestSurfaceId, structDist, nearestStructId},
 *    authenticityScore, why, reasons[] }
 *  `sampleItem` = one drawn item of the candidate family (its stem represents the
 *  family's surface); `fingerprint` = the family's op-token fingerprint. */
export async function bandpassFamily(sampleItem, fingerprint, { corpus = null, mode = "record", skipAuth = false, excludeId = null } = {}) {
  const C = corpus || loadCorpus();
  const reasons = [];
  const text = stemText(sampleItem.stem);
  const ns = nearestSurface(text, C, { excludeId });      // excludeId = the candidate's OWN familyId (a family is not a duplicate of itself)
  const st = Array.isArray(fingerprint) && fingerprint.length ? nearestStructural(fingerprint, C, { excludeId }) : { dist: 1, id: null };

  if (ns.sim >= FLOORS.surfaceMax) reasons.push(`surface too close: ${ns.sim.toFixed(2)} ≥ ${FLOORS.surfaceMax} (nearest ${ns.id})`);
  if (st.dist <= FLOORS.structMin) reasons.push(`structure too close: ${st.dist.toFixed(2)} ≤ ${FLOORS.structMin} (nearest ${st.id})`);

  let auth = null, why = null;
  if (!skipAuth) {
    try { const a = await authenticityScore(sampleItem); auth = a.score; why = a.why; }
    catch (e) { reasons.push(`authenticity judge unavailable (${String(e.message).slice(0, 60)}) — recorded null`); }
    if (auth !== null && auth < FLOORS.authMin) reasons.push(`authenticity ${auth} < ${FLOORS.authMin}: ${why}`);
  }

  const pass = reasons.length === 0;
  return {
    pass: mode === "enforce" ? pass : true,               // record mode never blocks — but scores are kept
    strictPass: pass, mode, reasons,
    noveltyDist: { surfaceSim: +ns.sim.toFixed(3), nearestSurfaceId: ns.id, structDist: +st.dist.toFixed(3), nearestStructId: st.id },
    authenticityScore: auth, authenticityWhy: why,
  };
}

export default { bandpassFamily, FLOORS };
