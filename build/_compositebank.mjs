/* GEO-2 skill-composition figures — generate through the live pipeline (quota active),
   bank, render a gallery. Construct-backward (Tier C) → no LLM. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { generateCell, toRenderItem } from "./pipeline.mjs";
import { appendToBank, loadBankKeys } from "./bank.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");

const before = readFileSync(BANK, "utf8").trim().split("\n");
const isComp = (l) => { try { const fp = JSON.parse(l).fingerprint || []; return Array.isArray(fp) && fp.includes("composite_fig"); } catch { return false; } };
const stripped = before.filter((l) => !isComp(l));
writeFileSync(BANK, stripped.join("\n") + "\n");
console.log(`bank: ${before.length} → ${stripped.length} (removed ${before.length - stripped.length} old composite_fig items)`);

const N = Number(process.argv[2] || 40);
const kept = await generateCell("geometry_trig", "composite_figures", N, ["B4", "B5", "B6", "B7"], { i: 0 });
const qs = kept.map((s, i) => toRenderItem(s, i + 1));

writeFileSync(join(ROOT, "data", "test-117.json"),
  JSON.stringify({ number: 117, title: "GEO-2 — skill-composition figures: parallelogram+diagonal · triangle-in-semicircle · rectangle diagonal · similar (parallel line)", questions: qs }, null, 2));
const added = appendToBank(qs, { source: "test-117", savedAt: "2026-06-25" });

const cards = qs.map((q) => `<div class="figitem"><div class="figref">#${q.id} ${(q.fingerprint || [])[1]} ${q.band} ${q.statementId} ans=${q.answer?.accept ? q.answer.accept[0] : q.answer?.correct}</div>${renderQuestion(q)}</div>`).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "composites.html"),
  head("GEO-2 composite figures", 2) + FIG_OPT_CSS + `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 12px monospace;color:#c2410c}</style><main class="qs">${cards}</main>` + foot(2));

const by = {}; for (const q of qs) { const t = (q.fingerprint || [])[1]; by[`${q.band} ${t}`] = (by[`${q.band} ${t}`] || 0) + 1; }
console.log(`→ test-117.json · ${qs.length} items · banked ${added} new · bank now ${loadBankKeys().size}`);
console.log("structure × band:"); Object.keys(by).sort().forEach((k) => console.log(`   ${k.padEnd(36)} ${by[k]}`));
