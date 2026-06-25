import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { generateCell, toRenderItem } from "./pipeline.mjs";
import { appendToBank } from "./bank.mjs";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kept = await generateCell("geometry_trig", "solid_figures", Number(process.argv[2]||5), ["B1","B4","B6"], { i: 0 });
const qs = kept.map((s, i) => toRenderItem(s, i + 1));
writeFileSync(join(ROOT,"data","test-115.json"), JSON.stringify({ number:115, title:"GEO-2 — 3D solids (figure)", questions:qs }, null, 2));
const added = appendToBank(qs, { source:"test-115" });
const cards = qs.map(q=>`<div class="figitem"><div class="figref">#${q.id} ${(q.fingerprint||[])[1]} ${q.band} ${q.statementId} ans=${q.answer.accept?q.answer.accept[0]:q.answer.correct}</div>${renderQuestion(q)}</div>`).join("\n");
mkdirSync(join(ROOT,"tests","figverify"),{recursive:true});
writeFileSync(join(ROOT,"tests","figverify","solids.html"), head("GEO-2 3D solids",2)+FIG_OPT_CSS+`<style>.figitem{border:1px solid #d7dde6;border-radius:10px;padding:10px 14px;margin:0 0 16px}.figref{font:600 12px monospace;color:#c2410c}</style><main class="qs">${cards}</main>`+foot(2));
const by={}; for(const q of qs){const t=(q.fingerprint||[])[1];by[t]=(by[t]||0)+1;}
console.log(`→ test-115.json · ${qs.length} items ${JSON.stringify(by)} · banked ${added} · tests/figverify/solids.html`);
