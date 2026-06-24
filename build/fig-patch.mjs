/* Fix audited figure defects that are old-format specs the current figures.js
   renderers don't read: rectangle (lengthLabel/widthLabel → labels.{bottom,left})
   and parallelLines ({lines,transversal,given,unknown} → {upperLabel,lowerLabel,
   transversalLabel,angles[]}). coordPlane bare-{m,b} is handled by the renderCurve
   shim. Patches data/item-bank.jsonl AND any data/test-*.json with the old format.
     node build/fig-patch.mjs */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POS = { "upper-right": "top-right", "upper-left": "top-left", "lower-right": "bottom-right", "lower-left": "bottom-left" };

function fixRect(sp) {
  if (sp.fn) return null;
  if (sp.labels && (sp.labels.bottom || sp.labels.left)) return null;
  if (!(sp.lengthLabel || sp.widthLabel || sp.length || sp.width)) return null;
  return { labels: { bottom: sp.lengthLabel || (sp.length != null ? sp.length + " m" : ""), left: sp.widthLabel || (sp.width != null ? sp.width + " m" : "") }, title: sp.title || "rectangle (not to scale)" };
}
function fixParallel(sp) {
  if (Array.isArray(sp.angles)) return null;       // already new format
  if (!Array.isArray(sp.lines)) return null;
  const upper = sp.lines[0], lower = sp.lines[1];
  const atOf = (ln) => (ln === upper ? "upper" : "lower");
  const ang = (a) => a ? { at: atOf(a.at), pos: POS[a.position] || "top-right", text: (a.value != null ? a.value + "°" : (a.label || "x") + "°") } : null;
  return { transversalAngleDeg: 58, upperLabel: upper, lowerLabel: lower, transversalLabel: sp.transversal || "t", angles: [ang(sp.given), ang(sp.unknown)].filter(Boolean) };
}
const patchSpec = (fn, sp) => (fn === "rectangle" ? fixRect(sp) : fn === "parallelLines" ? fixParallel(sp) : null);

let n = 0;
// bank (JSONL)
const BANK = join(ROOT, "data", "item-bank.jsonl");
const lines = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
for (const o of lines) { if (o.figure) { const ns = patchSpec(o.figure.fn, o.figure.spec || {}); if (ns) { o.figure.spec = ns; n++; console.log(`  bank ${o.source} ${o.figure.fn} → new format`); } } }
if (n) writeFileSync(BANK, lines.map((o) => JSON.stringify(o)).join("\n") + "\n");

// source test files
for (const f of readdirSync(join(ROOT, "data")).filter((f) => /^test-\d+\.json$/.test(f))) {
  const p = join(ROOT, "data", f); const t = JSON.parse(readFileSync(p, "utf8")); let touched = 0;
  for (const q of t.questions || []) { if (q.figure) { const ns = patchSpec(q.figure.fn, q.figure.spec || {}); if (ns) { q.figure.spec = ns; touched++; n++; } } }
  if (touched) { writeFileSync(p, JSON.stringify(t, null, 2)); console.log(`  ${f}: patched ${touched}`); }
}
console.log(`\npatched ${n} figure spec(s) to current format`);
