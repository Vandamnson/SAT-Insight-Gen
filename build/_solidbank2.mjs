/* GEO-2 solids v2 — regenerate the 3D-solid module with the per-structure quota
   active and ALL SEVEN structures (box · cube · pyramid · triangular prism · cylinder
   volume + prism surface + solve-dim). Strips the old solid_fig items from the bank
   (the over-stuffed prism/cube set), regenerates fresh, re-banks, renders a gallery.
   Construct-backward (Tier C) → no LLM. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { generateCell, toRenderItem } from "./pipeline.mjs";
import { appendToBank, loadBankKeys } from "./bank.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");

// 1) strip every existing solid_fig item from the bank (clean replace, no orphans)
const before = readFileSync(BANK, "utf8").trim().split("\n");
const isSolid = (l) => { try { const fp = JSON.parse(l).fingerprint || []; return Array.isArray(fp) && fp.includes("solid_fig"); } catch { return false; } };
const stripped = before.filter((l) => !isSolid(l));
writeFileSync(BANK, stripped.join("\n") + "\n");
console.log(`bank: ${before.length} → ${stripped.length} (removed ${before.length - stripped.length} old solid_fig items)`);

// 2) generate the full structure set; quota caps each (structure,band) at SIG_FIG_QUOTA
const N = Number(process.argv[2] || 40);
const kept = await generateCell("geometry_trig", "solid_figures", N, ["B1", "B4", "B5", "B6"], { i: 0 });
const qs = kept.map((s, i) => toRenderItem(s, i + 1));

// 3) write the module + re-bank
writeFileSync(join(ROOT, "data", "test-115.json"),
  JSON.stringify({ number: 115, title: "GEO-2 — 3D solids (figure): box · cube · pyramid · triangular prism · cylinder", questions: qs }, null, 2));
const added = appendToBank(qs, { source: "test-115", savedAt: "2026-06-25" });

// 4) gallery for image-inspection
const cards = qs.map((q) => `<div class="figitem"><div class="figref">#${q.id} ${(q.fingerprint || [])[1]} ${q.band} ${q.statementId} ans=${q.answer?.accept ? q.answer.accept[0] : q.answer?.correct}</div>${renderQuestion(q)}</div>`).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "solids.html"),
  head("GEO-2 3D solids v2", 2) + FIG_OPT_CSS + `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 12px monospace;color:#c2410c}</style><main class="qs">${cards}</main>` + foot(2));

// 5) report the structure×band distribution
const by = {}; for (const q of qs) { const t = (q.fingerprint || [])[1]; by[`${q.band} ${t}`] = (by[`${q.band} ${t}`] || 0) + 1; }
console.log(`→ test-115.json · ${qs.length} items · banked ${added} new · bank now ${loadBankKeys().size}`);
console.log("structure × band:"); Object.keys(by).sort().forEach((k) => console.log(`   ${k.padEnd(34)} ${by[k]}`));
