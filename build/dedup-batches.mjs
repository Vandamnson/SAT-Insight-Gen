/* prep BLINDED batch files for the blind-agent de-dup adjudication.
   - candidate clusters (structural + context) split into batches, members stripped
     to {ref, stem} (no origin/skill/source) so agents judge purely on item text;
   - a "missed-reskin sweep" set: the highest-volume single-generator skills, full
     blinded stem lists, so agents can find reskins BELOW the deterministic threshold.
   Writes to the scratchpad dir given as argv[2]. node build/dedup-batches.mjs <dir> */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2];
const cand = JSON.parse(readFileSync(join(ROOT, "data", "dedup-candidates.json"), "utf8"));
const segText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ");
const originOf = (it) => (String(it.source || "").startsWith("mod2/") ? "mod2" : "insight-gen");

// give each candidate cluster a stable id; keep a (non-blind) key for later merge
let sid = 0, cid = 0;
const key = {};
const blindStruct = cand.structClusters.map((c) => { const id = "S" + (++sid); key[id] = c; return { cid: id, kind: "structural", members: c.members.map((m) => ({ ref: m.idx, stem: m.stem })) }; });
const blindCtx = cand.ctxClusters.map((c) => { const id = "C" + (++cid); key[id] = c; return { cid: id, kind: "context", members: c.members.map((m) => ({ ref: m.idx, stem: m.stem })) }; });

const chunk = (arr, n) => { const out = Array.from({ length: n }, () => []); arr.forEach((x, i) => out[i % n].push(x)); return out; };
const write = (name, payload) => { writeFileSync(join(OUT, name), JSON.stringify(payload, null, 1)); return name; };

const files = [];
chunk(blindStruct, 2).forEach((b, i) => files.push(write(`dd-struct-${i + 1}.json`, { kind: "structural", clusters: b })));
chunk(blindCtx, 4).forEach((b, i) => files.push(write(`dd-ctx-${i + 1}.json`, { kind: "context", clusters: b })));

// missed-reskin sweep: top single-generator skills by item count (≥12 items)
const bank = readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n").map((l, i) => { const o = JSON.parse(l); return { idx: i, origin: originOf(o), skill: o.skill, domain: o.domain, stem: segText(o.stem) }; });
const bySkill = {}; for (const it of bank) (bySkill[it.skill] ||= []).push(it);
const topSkills = Object.entries(bySkill).filter(([, v]) => v.length >= 12).sort((a, b) => b[1].length - a[1].length).slice(0, 4);
topSkills.forEach(([skill, its], i) => { write(`dd-sweep-${i + 1}.json`, { skill, count: its.length, items: its.map((it) => ({ ref: it.idx, stem: it.stem })) }); files.push(`dd-sweep-${i + 1}.json`); });

writeFileSync(join(OUT, "dedup-key.json"), JSON.stringify(key, null, 1));
console.log(`structural clusters: ${blindStruct.length} → 2 batches`);
console.log(`context clusters: ${blindCtx.length} → 4 batches`);
console.log(`sweep skills (≥12): ${topSkills.map(([s, v]) => s + "(" + v.length + ")").join(", ")}`);
console.log("files: " + files.join(", "));
