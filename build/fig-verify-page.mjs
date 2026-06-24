/* focused re-render of the just-fixed figures + the false-positive suspects, for
   visual verification. node build/fig-verify-page.mjs */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFS = [19, 27, 82, 99, 102, 106, 324, 422, 544, 588];
const bank = readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n").map((l, i) => ({ idx: i, ...JSON.parse(l) }));
const CSS = `<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 13px monospace;color:#c2410c;margin-bottom:4px}</style>`;
const cards = REFS.map((r) => { const it = bank[r]; return `<div class="figitem"><div class="figref">#${r} · ${it.figure.fn} · ${it.source}</div>${renderQuestion({ ...it, id: r })}</div>`; }).join("\n");
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "index.html"), head("Figure fix verification", 2) + FIG_OPT_CSS + CSS + `<main class="qs">${cards}</main>` + foot(2));
console.log("→ tests/figverify/index.html ·", REFS.length, "items");
