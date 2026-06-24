/* ============================================================================
   dedup-scan.mjs — deterministic candidate generator for the de-dup sequence.
   Over the combined bank it computes, per item:
     · structSig  — number/variable-blanked template (captures problem STRUCTURE)
     · ctxText    — prose-only, number-blanked (captures real-world CONTEXT)
   then clusters near-identical structures and near-identical contexts (greedy
   union-find on shingle Jaccard). Clusters are tagged within-insight / within-mod2
   / CROSS-generator. Output → data/dedup-candidates.json (fed to the blind agents).
     node build/dedup-scan.mjs
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const STRUCT_T = Number(process.env.DEDUP_STRUCT || 0.82);   // structural near-dup Jaccard floor
const CTX_T = Number(process.env.DEDUP_CTX || 0.55);          // context near-dup Jaccard floor
const CTX_MIN_WORDS = 8;                                      // below this = abstract, no real context

const segText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ");
const proseText = (segs) => (Array.isArray(segs) ? segs : []).filter((s) => s.t === "text").map((s) => s.v).join(" ");
const originOf = (it) => (String(it.source || "").startsWith("mod2/") ? "mod2" : "insight-gen");

function structBlank(s) {
  return (" " + String(s).toLowerCase()
    .replace(/\\([a-z]+)/g, " $1 ")            // \frac → frac (keep as a structural token)
    .replace(/-?\d+(\.\d+)?/g, "#")            // numbers → #
    .replace(/\b[a-z]\b/g, "@")                // single-letter variables → @
    .replace(/[^a-z@#\s]/g, " ")
    .replace(/\s+/g, " ").trim() + " ");
}
function ctxBlank(s) {
  return String(s).toLowerCase().replace(/-?\d+(\.\d+)?/g, "#").replace(/[^a-z#\s]/g, " ").replace(/\s+/g, " ").trim();
}
function shingles(str, k = 3) {
  const w = str.split(/\s+/).filter(Boolean);
  if (w.length < k) return new Set(w.length ? [w.join(" ")] : []);
  const s = new Set(); for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(" "));
  return s;
}
function jac(a, b) { if (!a.size || !b.size) return 0; let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter); }

// greedy union-find clustering on pairs whose Jaccard ≥ t
function cluster(idxs, sh, t) {
  const parent = new Map(idxs.map((i) => [i, i]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  const pairs = [];
  for (let i = 0; i < idxs.length; i++) for (let j = i + 1; j < idxs.length; j++) {
    const a = idxs[i], b = idxs[j]; const s = jac(sh[a], sh[b]);
    if (s >= t) { union(a, b); pairs.push([a, b, +s.toFixed(2)]); }
  }
  const groups = new Map();
  for (const i of idxs) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return { groups: [...groups.values()].filter((g) => g.length > 1), pairs };
}

const items = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l, i) => {
  const o = JSON.parse(l);
  const stem = segText(o.stem), prose = proseText(o.stem);
  return { idx: i, origin: originOf(o), domain: o.domain, skill: o.skill, band: o.band, source: o.source,
           stem, prose, structSh: shingles(structBlank(stem + " " + (o.options || []).map((x) => segText(x.seg || x.segs || [])).join(" "))),
           ctxWords: ctxBlank(prose).split(/\s+/).filter(Boolean).length, ctxSh: shingles(ctxBlank(prose)) };
});

const all = items.map((it) => it.idx);
const structSh = Object.fromEntries(items.map((it) => [it.idx, it.structSh]));
const ctxIdx = items.filter((it) => it.ctxWords >= CTX_MIN_WORDS).map((it) => it.idx);
const ctxSh = Object.fromEntries(items.map((it) => [it.idx, it.ctxSh]));

const S = cluster(all, structSh, STRUCT_T);
const C = cluster(ctxIdx, ctxSh, CTX_T);

const tagOrigin = (members) => { const o = new Set(members.map((m) => items[m].origin)); return o.size > 1 ? "CROSS" : [...o][0]; };
const pack = (groups, kind) => groups.map((g) => ({
  kind, size: g.length, span: tagOrigin(g),
  members: g.map((m) => ({ idx: m, origin: items[m].origin, domain: items[m].domain, skill: items[m].skill, source: items[m].source, stem: items[m].stem })),
})).sort((a, b) => (a.span === "CROSS" ? -1 : 1) - (b.span === "CROSS" ? -1 : 1) || b.size - a.size);

const structClusters = pack(S.groups, "structural");
const ctxClusters = pack(C.groups, "context");

const stat = (clusters) => {
  const inClusters = clusters.reduce((a, c) => a + c.size, 0);
  const byspan = {}; for (const c of clusters) byspan[c.span] = (byspan[c.span] || 0) + 1;
  return { clusters: clusters.length, itemsInClusters: inClusters, byspan };
};
const report = {
  bankSize: items.length,
  thresholds: { structural: STRUCT_T, context: CTX_T, ctxMinWords: CTX_MIN_WORDS },
  structural: stat(structClusters),
  context: stat(ctxClusters),
  structClusters, ctxClusters,
};
writeFileSync(join(ROOT, "data", "dedup-candidates.json"), JSON.stringify(report, null, 1));

console.log(`bank ${items.length} items · structural≥${STRUCT_T} · context≥${CTX_T}`);
console.log(`STRUCTURAL near-dup clusters: ${report.structural.clusters} (covering ${report.structural.itemsInClusters} items) · by span ${JSON.stringify(report.structural.byspan)}`);
console.log(`CONTEXT near-dup clusters:    ${report.context.clusters} (covering ${report.context.itemsInClusters} items) · by span ${JSON.stringify(report.context.byspan)}`);
console.log(`\nCROSS-generator structural clusters (top):`);
for (const c of structClusters.filter((c) => c.span === "CROSS").slice(0, 6)) console.log(`  [${c.size}] ${c.members.map((m) => m.origin + ":" + (m.skill || m.domain)).join(" | ")}`);
console.log(`\n→ data/dedup-candidates.json`);
