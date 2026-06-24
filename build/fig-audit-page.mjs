/* Stage 4 prep — render every figure-bearing bank item as a card (stem + figure +
   answer), paginated, so each page can be screenshotted and handed to a blind vision
   agent for a figure-vs-problem audit. Reuses render.mjs renderQuestion.
     node build/fig-audit-page.mjs   → tests/figaudit/pNN.html + data/figure-audit-manifest.json */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tests", "figaudit");
const PER = Number(process.env.FIG_PER_PAGE || 15);
const segText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ");

import { existsSync } from "node:fs";
const removed = existsSync(join(ROOT, "data", "dedup-removals.json"))
  ? new Set(JSON.parse(readFileSync(join(ROOT, "data", "dedup-removals.json"), "utf8")).remove) : new Set();
const items = readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n").filter(Boolean)
  .map((l, i) => ({ idx: i, ...JSON.parse(l) })).filter((o) => o.figure && !removed.has(o.idx));

const CSS = `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 13px monospace;color:#c2410c;margin-bottom:4px}</style>`;
mkdirSync(OUT, { recursive: true });
const pages = [];
for (let p = 0; p * PER < items.length; p++) {
  const slice = items.slice(p * PER, p * PER + PER);
  const cards = slice.map((it) => `<div class="figitem"><div class="figref">#${it.idx} · ${it.figure.fn}</div>${renderQuestion({ ...it, id: it.idx })}</div>`).join("\n");
  const name = `p${String(p + 1).padStart(2, "0")}.html`;
  writeFileSync(join(OUT, name), head(`Figure audit ${name}`, 2) + FIG_OPT_CSS + CSS + `<main class="qs">${cards}</main>` + foot(2));
  pages.push({ page: name, refs: slice.map((it) => ({ ref: it.idx, fn: it.figure.fn, type: it.type, answer: it.type === "mcq" ? it.answer?.correct : (it.answer?.accept || [])[0], stem: segText(it.stem) })) });
}
writeFileSync(join(ROOT, "data", "figure-audit-manifest.json"), JSON.stringify(pages, null, 1));
console.log(`figure items: ${items.length} → ${pages.length} pages of ${PER} (tests/figaudit/pNN.html)`);
console.log(`by fn: ${JSON.stringify(items.reduce((a, o) => { a[o.figure.fn] = (a[o.figure.fn] || 0) + 1; return a; }, {}))}`);
