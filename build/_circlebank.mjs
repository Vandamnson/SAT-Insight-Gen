/* GEO-2 circle figures — generate the arc-length / sector-area / inscribed-angle
   module through the live pipeline (per-structure quota active), bank it, render a
   gallery. Construct-backward (Tier C) → no LLM. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { generateCell, toRenderItem } from "./pipeline.mjs";
import { appendToBank, loadBankKeys } from "./bank.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");

// strip any existing circle_fig items (clean re-generate, no orphans)
const before = readFileSync(BANK, "utf8").trim().split("\n");
const isCircleFig = (l) => { try { const fp = JSON.parse(l).fingerprint || []; return Array.isArray(fp) && fp.includes("circle_fig"); } catch { return false; } };
const stripped = before.filter((l) => !isCircleFig(l));
writeFileSync(BANK, stripped.join("\n") + "\n");
console.log(`bank: ${before.length} → ${stripped.length} (removed ${before.length - stripped.length} old circle_fig items)`);

const N = Number(process.argv[2] || 20);
const kept = await generateCell("geometry_trig", "circle_figures", N, ["B7"], { i: 0 });
const qs = kept.map((s, i) => toRenderItem(s, i + 1));

writeFileSync(join(ROOT, "data", "test-116.json"),
  JSON.stringify({ number: 116, title: "GEO-2 — circle figures: arc length · sector area · inscribed angle", questions: qs }, null, 2));
const added = appendToBank(qs, { source: "test-116", savedAt: "2026-06-25" });

const cards = qs.map((q) => `<div class="figitem"><div class="figref">#${q.id} ${(q.fingerprint || [])[1]} ${q.band} ${q.statementId} ans=${q.answer?.accept ? q.answer.accept[0] : q.answer?.correct}</div>${renderQuestion(q)}</div>`).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "circles.html"),
  head("GEO-2 circle figures", 2) + FIG_OPT_CSS + `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 12px monospace;color:#c2410c}</style><main class="qs">${cards}</main>` + foot(2));

const by = {}; for (const q of qs) { const t = (q.fingerprint || [])[1]; by[`${q.band} ${t}`] = (by[`${q.band} ${t}`] || 0) + 1; }
console.log(`→ test-116.json · ${qs.length} items · banked ${added} new · bank now ${loadBankKeys().size}`);
console.log("structure × band:"); Object.keys(by).sort().forEach((k) => console.log(`   ${k.padEnd(30)} ${by[k]}`));
