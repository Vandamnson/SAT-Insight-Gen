/* ============================================================================
   engine/distance.mjs — NEAREST-KNOWN-ITEM distances (the novelty floor's input).

   Surface: numeric/variable-blanked 4-gram shingles, max Jaccard SIMILARITY over
            the corpus (v1 bank + engine variants). High = too close to something.
   Structural: min normalized token-Levenshtein over op fingerprints. Low = the
            solve-path already exists.
   Self-contained implementations (selector.mjs/dedup-scan.mjs keep theirs private).
   ============================================================================ */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies, loadVariants } from "./family.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const blank = (s) => String(s).toLowerCase()
  .replace(/-?\d+\.?\d*/g, "#").replace(/[^a-z0-9#\s]/g, " ").replace(/\b[a-z]\b/g, "v")
  .split(/\s+/).filter(Boolean);
export function shingles(text) {
  const w = blank(text); const set = new Set();
  for (let i = 0; i + 4 <= w.length; i++) set.add(w.slice(i, i + 4).join(" "));
  if (!set.size) w.forEach((x) => set.add(x));
  return set;
}
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 0; };

function tokenLev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const structDist = (a, b) => tokenLev(a, b) / (Math.max(a.length, b.length) || 1);

export const stemText = (stem) => (Array.isArray(stem) ? stem : []).map((s) => (s.segs ? s.segs.map((g) => g.v).join("") : s.v || "")).join(" ");

/** loadCorpus() → { surface:[{id, sh}], structural:[{id, fp}] } over v1 bank +
 *  engine families/variants. Load ONCE per run. */
export function loadCorpus({ includeEngine = true } = {}) {
  const surface = [], structural = [];
  const bankFile = join(ROOT, "data", "item-bank.jsonl");
  if (existsSync(bankFile)) {
    for (const line of readFileSync(bankFile, "utf8").trim().split("\n")) {
      if (!line) continue;
      const o = JSON.parse(line);
      const txt = stemText(o.stem);
      if (txt) surface.push({ id: `v1:${o._key?.slice(0, 8)}`, sh: shingles(txt) });
      if (Array.isArray(o.fingerprint) && o.fingerprint.length) structural.push({ id: `v1:${o._key?.slice(0, 8)}`, fp: o.fingerprint });
    }
  }
  if (includeEngine) {
    for (const f of loadFamilies()) if (Array.isArray(f.fingerprint) && f.fingerprint.length) structural.push({ id: f.familyId, fp: f.fingerprint });
    for (const v of loadVariants()) { const txt = stemText(v.item?.stem); if (txt) surface.push({ id: v.variantId, sh: shingles(txt) }); }
  }
  return { surface, structural };
}

/** nearestSurface(text, corpus, {excludeId}) → { sim, id } (max Jaccard). */
export function nearestSurface(text, corpus, { excludeId = null } = {}) {
  const sh = shingles(text);
  let best = { sim: 0, id: null };
  for (const e of corpus.surface) {
    if (excludeId && e.id.includes(excludeId)) continue;
    const s = jaccard(sh, e.sh);
    if (s > best.sim) best = { sim: s, id: e.id };
  }
  return best;
}

/** nearestStructural(fp, corpus, {excludeId}) → { dist, id } (min normalized Levenshtein). */
export function nearestStructural(fp, corpus, { excludeId = null } = {}) {
  let best = { dist: 1, id: null };
  for (const e of corpus.structural) {
    if (excludeId && e.id.includes(excludeId)) continue;
    const d = structDist(fp, e.fp);
    if (d < best.dist) best = { dist: d, id: e.id };
  }
  return best;
}

export default { shingles, stemText, loadCorpus, nearestSurface, nearestStructural };
