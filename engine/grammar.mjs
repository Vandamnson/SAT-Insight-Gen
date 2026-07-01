/* ============================================================================
   engine/grammar.mjs — corpus STRUCTURE-MINER → occupancy map (E4).

   Extracts deep-structure FEATURES (never expression) from the released material
   we hold (Skills-Insight exemplars + anchors) and from engine families, into
   cells:  domain × band × form × context × shape.
   The occupancy map data/engine/grammar.json shows, per cell, how many released
   items vs engine families exist → `targets()` lists in-distribution cells we
   have not yet written (the "novel yet likely" generation targets).

   HONEST BOUND: ~40 released items is a coarse map — the rubric matrix is the
   prior where the corpus is thin. `ingest <file>` extends the corpus later.
     node engine/grammar.mjs            # mine + write grammar.json
     node engine/grammar.mjs targets    # print under-occupied cells
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies } from "./family.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "engine", "grammar.json");

/* ---- feature extraction (structure only, no expression stored) ---- */
const SHAPES = [
  ["system", /\\begin\{cases\}|system of (two )?(linear )?equations/i],
  ["inequality", /inequalit|\\le|\\ge|[<>]=?/],
  ["quadratic", /\^\s*2|x\^2|quadratic|parabola|vertex/i],
  ["exponential", /\^\s*[xt]|exponential|growth|decay|doubl/i],
  ["radical", /\\sqrt|square root|radical/i],
  ["rational", /\\d?frac\{[^}]*[a-z][^}]*\}\{[^}]*[a-z][^}]*\}|rational/i],
  ["function", /f\s*\(|g\s*\(|function/i],
  ["geometry", /triangle|circle|rectangle|angle|perimeter|area|volume|degree/i],
  ["linear", /.*/],                                        // fallback
];
export function features(stemText, { domain = null, band = null, hasOptions = null } = {}) {
  const t = String(stemText || "");
  const shape = SHAPES.find(([, rx]) => rx.test(t))[0];
  const proseWords = t.replace(/\\[a-zA-Z]+|[{}^_=+\-*/()\d]/g, " ").split(/\s+/).filter((w) => w.length > 2).length;
  const context = proseWords >= 14 ? "context" : "abstract";
  return { domain, band, form: hasOptions == null ? "?" : hasOptions ? "mcq" : "spr", context, shape };
}
const cellKey = (f) => [f.domain || "?", f.band || "?", f.context, f.shape].join("|");

/* ---- corpora ---- */
function releasedItems() {
  const out = [];
  const ex = join(ROOT, "taxonomy", "exemplars.clean.json");
  if (existsSync(ex)) {
    const raw = JSON.parse(readFileSync(ex, "utf8"));
    const arr = Array.isArray(raw) ? raw : raw.items || Object.values(raw).find(Array.isArray) || [];
    for (const e of arr) if (e.stem && !/ax\+8|x\+613/.test(e.stem)) out.push(features(e.stem, { domain: e.domain, band: e.band, hasOptions: /A\)|\(A\)/.test(e.stem) || null }));
  }
  const extra = join(ROOT, "data", "engine", "released-ingest.jsonl");   // ingest path for future corpus growth
  if (existsSync(extra)) for (const l of readFileSync(extra, "utf8").trim().split("\n")) { const o = JSON.parse(l); out.push(features(o.stem, o)); }
  return out;
}
function engineFamilies() {
  return loadFamilies().map((f) => features(f.stemPreview || "", { domain: f.domain, band: f.difficulty?.band, hasOptions: false }));
}

/* ---- mine + occupancy ---- */
export function mine() {
  const rel = releasedItems(), eng = engineFamilies();
  const cells = {};
  for (const f of rel) { const k = cellKey(f); (cells[k] ||= { released: 0, engine: 0 }).released++; }
  for (const f of eng) { const k = cellKey(f); (cells[k] ||= { released: 0, engine: 0 }).engine++; }
  const map = { minedAt: new Date().toISOString(), releasedCount: rel.length, engineFamilies: eng.length, note: "coarse map (~40 released items); rubric matrix is the prior where thin", cells };
  mkdirSync(join(ROOT, "data", "engine"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(map, null, 1));
  return map;
}

/** targets() — in-distribution cells (released>0) with NO engine family yet: the
 *  "novel yet likely to appear" generation targets, most-occupied-released first. */
export function targets() {
  const map = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : mine();
  return Object.entries(map.cells)
    .filter(([, v]) => v.released > 0 && v.engine === 0)
    .sort((a, b) => b[1].released - a[1].released)
    .map(([k, v]) => ({ cell: k, released: v.released }));
}

import { fileURLToPath as f2 } from "node:url";
if (process.argv[1] && f2(import.meta.url) === process.argv[1]) {
  const map = mine();
  console.log(`mined ${map.releasedCount} released + ${map.engineFamilies} engine families → ${Object.keys(map.cells).length} cells → data/engine/grammar.json`);
  if (process.argv[2] === "targets" || true) {
    console.log("\nunder-occupied targets (released>0, engine=0):");
    for (const t of targets().slice(0, 15)) console.log(`  ${t.released}× ${t.cell}`);
  }
}
