/* ============================================================================
   cell.mjs — the harness-side draw (BUILD_SPEC §1). NO LLM. For one slot it pins
   the RADICALS to the requested band (via the LLTM in difficulty/lltm.mjs) and
   draws the INCIDENTALS randomly. This split is the whole point: varying
   incidentals = cheap surface variety (a reskin, same band); varying radicals =
   real novelty / a different band. We do NOT let the model pick either — if the
   model "chooses an interesting context" it re-collapses to the canonical
   instance and you get reskins. Variety comes from code, here.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { schemaFor, radicalsForBand, nearestRadicals, predictDifficulty } from "../difficulty/lltm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXTS = (() => { const c = JSON.parse(readFileSync(join(ROOT, "taxonomy", "contexts.json"), "utf8")); return (c.contexts || c).map(String); })();

// mulberry32 — a tiny seeded PRNG so a given draw index is reproducible (stable
// reruns, debuggable, resumable). Variety still comes from the index advancing.
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/** drawCell(domain, subdomain, band, idx) -> a cell object (the spec JSON of §1).
 *  Radicals pinned to the band; incidentals drawn from the index-seeded RNG. */
export function drawCell(domain, subdomain, band, idx = 0) {
  const { sub } = schemaFor(domain, subdomain);
  const bandStr = typeof band === "number" ? `B${band}` : band;
  const r = rng(`${domain}|${subdomain}|${bandStr}|${idx}`);

  // RADICALS — all vectors whose predicted band == target; pick one (rotate by
  // idx + jitter). Empty (rare) => nearest band's closest vector.
  const matches = radicalsForBand(domain, subdomain, bandStr);
  const radicals = matches.length ? matches[Math.floor(r() * matches.length)] : nearestRadicals(domain, subdomain, bandStr);

  // INCIDENTALS — surface variety, drawn in code.
  const ia = sub.incidental_axes;
  const ctxList = ia.context === "@contexts" ? CONTEXTS : (ia.context || []);
  const useNone = r() < (ia.context_none_weight ?? 0);
  const incidentals = {
    context: useNone ? "none" : pick(r, ctxList),
    var_name: pick(r, ia.var_name),
    coefficient_range: ia.coefficient_range,
    constant_range: ia.constant_range,
    answer_type: radicals.answer_type,        // echoed for the author's number choices
    format: r() < 0.6 ? "spr" : "mcq",        // question format is SURFACE (incidental), not difficulty-determining
    seed: randint(r, 1000, 9999),             // a surface nonce so identical radicals still vary numerically
  };

  return {
    domain, subdomain,
    target: sub.target,
    band: Number(bandStr.slice(1)),
    statementId: (sub.statementByBand || {})[bandStr] || null,
    radicals,
    incidentals,
    predicted_scale: predictDifficulty(radicals, domain, subdomain),
    canonical_fingerprint: sub.canonical_fingerprint || [],
    op_vocab: sub.op_vocab || [],
    tier: schemaFor(domain, subdomain).dom.tier || "A",
  };
}

export default { drawCell };
