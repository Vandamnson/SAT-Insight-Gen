/* ============================================================================
   ledger.mjs — anti-repeat (port of SAT-AI's Ledger, JSON-backed for leanness).
   Two tiers:
     • structural novelty: a cell hash sha1(program|domain|band|statementId|
       template|context|type) — no two items share a cell in a build.
     • surface novelty: numeric-blanked 4-gram stem fingerprint + Jaccard ≥ 0.6
       (port of SAT-Mod2 dedup) — catches reworded clones that share a cell.
   ============================================================================ */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const cellId = ({ program, domain, band, statementId, skill, context = "", type }) =>
  createHash("sha1").update([program, domain, band, statementId, skill, context, type].join("|")).digest("hex").slice(0, 16);

export function stemText(item) {
  const flat = (arr) => (Array.isArray(arr) ? arr : [arr]).map((s) => (typeof s === "string" ? s : s?.segs ? flat(s.segs) : s?.v || "")).join(" ");
  return flat(item.stem || "");
}
function shingles(text) {
  // numbers → '#', strip punctuation, AND collapse standalone single-letter identifiers
  // (variable/function names f,g,P,Q,x,…) → 'v' so structural clones that only differ in
  // their letters (e.g. "f+g find h(2)" vs "P+Q find h(2)") still register as duplicates.
  const norm = text.toLowerCase().replace(/-?\d+\.?\d*/g, "#").replace(/[^a-z0-9#\s]/g, " ").replace(/\b[a-z]\b/g, "v").split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 4 <= norm.length; i++) set.add(norm.slice(i, i + 4).join(" "));
  if (!set.size) norm.forEach((w) => set.add(w)); // very short stems
  return set;
}
function jaccard(a, b) {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

export class Ledger {
  constructor(path) { this.path = path; this.cells = new Set(); this.fps = [];
    if (path && existsSync(path)) { const d = JSON.parse(readFileSync(path, "utf8")); this.cells = new Set(d.cells || []); this.fps = (d.fps || []).map((s) => new Set(s)); } }
  seenCell(id) { return this.cells.has(id); }
  seenSimilar(item, threshold = 0.45) { const sh = shingles(stemText(item)); return this.fps.some((f) => jaccard(sh, f) >= threshold); }   // 0.45: catches structural clones (~0.49) while real items sit ≤0.15
  /** returns false if a duplicate (by cell or surface), else records and returns true */
  record(item) {
    const id = item.cellId || cellId(item);
    if (this.cells.has(id)) return false;
    if (this.seenSimilar(item)) return false;
    this.cells.add(id); this.fps.push(shingles(stemText(item)));
    return true;
  }
  save() { if (this.path) writeFileSync(this.path, JSON.stringify({ cells: [...this.cells], fps: this.fps.map((s) => [...s]) })); }
  get size() { return this.cells.size; }
}

export default { Ledger, cellId, stemText };
