/* Stage 1 prep — merge threshold + sweep reskin candidate clusters (union-find on
   shared line-idx refs), emit BLINDED re-verify batches for fresh blind agents, and
   record the merged candidates for the apply step.
     node build/dedup-confirm.mjs <scratchDir>            # write batches
     node build/dedup-confirm.mjs <scratchDir> --apply    # build removals from verdicts in <scratchDir>/dc-verdicts.json
*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2];
const APPLY = process.argv.includes("--apply");
const segText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ");
const origin = (o) => (String(o.source || "").startsWith("mod2/") ? "mod2" : "insight-gen");
const bank = readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n").map((l, i) => { const o = JSON.parse(l); return { idx: i, stem: segText(o.stem), skill: o.skill, origin: origin(o), source: o.source }; });

// gather candidate ref-groups: threshold structural clusters + sweep clusters
const cand = JSON.parse(readFileSync(join(ROOT, "data", "dedup-candidates.json"), "utf8"));
const groups = [];
for (const c of cand.structClusters) groups.push(c.members.map((m) => m.idx));
const sweep = JSON.parse(readFileSync(join(ROOT, "data", "sweep-clusters.json"), "utf8"));
for (const k of Object.keys(sweep)) if (Array.isArray(sweep[k])) for (const g of sweep[k]) groups.push(g);

// union-find merge groups sharing any ref
const parent = new Map();
const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const union = (a, b) => { parent.set(find(a), find(b)); };
for (const g of groups) for (let i = 1; i < g.length; i++) union(g[0], g[i]);
const merged = new Map();
for (const g of groups) for (const r of g) { const root = find(r); if (!merged.has(root)) merged.set(root, new Set()); merged.get(root).add(r); }
const clusters = [...merged.values()].map((s) => [...s].sort((a, b) => a - b)).filter((g) => g.length > 1);
// dedupe identical merged clusters
const seen = new Set(); const uniq = [];
for (const g of clusters) { const k = g.join(","); if (!seen.has(k)) { seen.add(k); uniq.push(g); } }
uniq.forEach((g, i) => (g.cid = "R" + (i + 1)));

if (!APPLY) {
  const chunk = (arr, n) => { const out = Array.from({ length: n }, () => []); arr.forEach((x, i) => out[i % n].push(x)); return out; };
  const blind = uniq.map((g) => ({ cid: g.cid, members: g.map((ref) => ({ ref, stem: bank[ref].stem })) }));
  const nb = Math.min(6, Math.max(1, Math.ceil(blind.length / 10)));
  chunk(blind, nb).forEach((b, i) => writeFileSync(join(OUT, `dc-${i + 1}.json`), JSON.stringify({ clusters: b }, null, 1)));
  writeFileSync(join(OUT, "dc-key.json"), JSON.stringify(uniq.map((g) => ({ cid: g.cid, refs: g, origins: g.map((r) => bank[r].origin), skills: [...new Set(g.map((r) => bank[r].skill))] })), null, 1));
  console.log(`merged candidate reskin clusters: ${uniq.length} (covering ${uniq.reduce((a, g) => a + g.length, 0)} items) → ${nb} batches`);
  console.log(`spans: ${JSON.stringify(uniq.reduce((a, g) => { const o = new Set(g.map((r) => bank[r].origin)); const s = o.size > 1 ? "CROSS" : [...o][0]; a[s] = (a[s] || 0) + 1; return a; }, {}))}`);
} else {
  const verdicts = JSON.parse(readFileSync(join(OUT, "dc-verdicts.json"), "utf8")); // [{cid, reskin:bool, keep:<ref>}]
  const byCid = Object.fromEntries(uniq.map((g) => [g.cid, g]));
  const remove = [], confirmedClusters = [];
  for (const v of verdicts) {
    const g = byCid[v.cid]; if (!g || !v.reskin) continue;
    const keep = (typeof v.keep === "number" && g.includes(v.keep)) ? v.keep : g[0];
    const drop = g.filter((r) => r !== keep);
    remove.push(...drop); confirmedClusters.push({ cid: v.cid, keep, drop });
  }
  const removeSet = [...new Set(remove)].sort((a, b) => a - b);
  writeFileSync(join(ROOT, "data", "dedup-removals.json"), JSON.stringify({ count: removeSet.length, remove: removeSet, clusters: confirmedClusters }, null, 1));
  console.log(`confirmed reskin clusters: ${confirmedClusters.length} · items to remove: ${removeSet.length}`);
  console.log(`by origin: ${JSON.stringify(removeSet.reduce((a, r) => { a[bank[r].origin] = (a[bank[r].origin] || 0) + 1; return a; }, {}))}`);
}
