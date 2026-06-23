/* ============================================================================
   bank-html.mjs — browsable HTML view of the persistent item bank.
   Reads data/item-bank.jsonl and emits tests/bank/{index.html,solutions.html}
   reusing render.mjs's exact KaTeX + figure + question renderers. A sticky filter
   bar (domain / band / type / text search) makes the whole bank navigable.
     node build/bank-html.mjs
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderQuestion, renderSolution, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const OUT = join(ROOT, "tests", "bank");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stemText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ").toLowerCase();

const DOMAIN_LABEL = { algebra: "Algebra", advanced_math: "Advanced Math", psda: "Problem-Solving & Data", geometry_trig: "Geometry & Trig" };

function main() {
  const lines = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean);
  let items = lines.map((l) => JSON.parse(l));
  // organize: domain → band → skill, then give each a UNIQUE id (bank ids collide across tests)
  const dorder = ["algebra", "advanced_math", "psda", "geometry_trig"];
  items.sort((a, b) =>
    (dorder.indexOf(a.domain) - dorder.indexOf(b.domain)) ||
    String(a.band).localeCompare(String(b.band)) ||
    String(a.skill).localeCompare(String(b.skill)));
  items.forEach((it, i) => { it.id = i + 1; });

  const counts = { domain: {}, band: {} };
  for (const it of items) { counts.domain[it.domain] = (counts.domain[it.domain] || 0) + 1; counts.band[it.band] = (counts.band[it.band] || 0) + 1; }

  const cards = items.map((it) => {
    const dataQ = esc(stemText(it.stem) + " " + (it.skill || ""));
    return `<div class="bankitem" data-domain="${esc(it.domain)}" data-band="${esc(it.band)}" data-type="${esc(it.type)}" data-skill="${esc(it.skill)}" data-q="${dataQ}">
  <div class="bk-meta"><span class="bk-dom">${esc(DOMAIN_LABEL[it.domain] || it.domain)}</span><span class="bk-band">${esc(it.band)}</span><span class="bk-skill">${esc(it.skill || "")}</span><span class="bk-src">${esc(it.source || "")}</span></div>
  ${renderQuestion(it)}
</div>`;
  }).join("\n");

  const domOpts = ["all", ...dorder.filter((d) => counts.domain[d])].map((d) =>
    `<option value="${d}">${d === "all" ? "All domains" : DOMAIN_LABEL[d]}${d === "all" ? "" : ` (${counts.domain[d]})`}</option>`).join("");
  const bandOpts = ["all", "B1", "B2", "B3", "B4", "B5", "B6", "B7"].map((b) =>
    `<option value="${b}">${b === "all" ? "All bands" : b}${b === "all" || !counts.band[b] ? "" : ` (${counts.band[b]})`}</option>`).join("");

  const FILTER_CSS = `<style>
  .bankbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #d7dde6;padding:12px 0;margin:0 0 18px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .bankbar select,.bankbar input{font:14px inherit;padding:6px 9px;border:1px solid #c3ccd8;border-radius:8px;background:#fff}
  .bankbar input{min-width:220px;flex:1}
  .bankbar .count{margin-left:auto;color:#647084;font-size:13px;white-space:nowrap}
  .bankitem{margin:0 0 14px}
  .bk-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:#647084;margin:0 0 -6px}
  .bk-meta span{background:#eef2f7;border-radius:5px;padding:1px 7px}
  .bk-meta .bk-band{background:#e8f0fe;color:#2563eb;font-weight:600}
  .bk-meta .bk-dom{background:#e6f4f1;color:#0f766e;font-weight:600}
  .bankitem.hide{display:none}
  </style>`;

  const filterJS = `<script>
  (function(){
    const items=[].slice.call(document.querySelectorAll('.bankitem'));
    const d=document.getElementById('f-domain'),b=document.getElementById('f-band'),t=document.getElementById('f-type'),q=document.getElementById('f-search'),c=document.getElementById('f-count');
    function apply(){
      const dv=d.value,bv=b.value,tv=t.value,qv=q.value.toLowerCase().trim();
      let n=0;
      for(const el of items){
        const ok=(dv==='all'||el.dataset.domain===dv)&&(bv==='all'||el.dataset.band===bv)&&(tv==='all'||el.dataset.type===tv)&&(!qv||el.dataset.q.indexOf(qv)>=0);
        el.classList.toggle('hide',!ok); if(ok)n++;
      }
      c.textContent='showing '+n+' of '+items.length;
    }
    [d,b,t].forEach(e=>e.addEventListener('change',apply)); q.addEventListener('input',apply); apply();
  })();
  </script>`;

  const indexHtml = head(`Item Bank (${items.length}) — SAT-Insight-Gen`, 2) + FIG_OPT_CSS + FILTER_CSS + `
<header class="masthead"><h1>Item Bank</h1><p class="sub">${items.length} verified items · ${Object.keys(counts.domain).length} domains · bands B1–B7 · click an MCQ choice to check it</p></header>
<div class="bankbar">
  <select id="f-domain">${domOpts}</select>
  <select id="f-band">${bandOpts}</select>
  <select id="f-type"><option value="all">All types</option><option value="mcq">Multiple choice</option><option value="spr">Student-response</option></select>
  <input id="f-search" type="search" placeholder="search stems / skills…" autocomplete="off">
  <span class="count" id="f-count"></span>
</div>
<main class="qs">
${cards}
</main>
` + filterJS + foot(2);

  const sols = items.map(renderSolution).join("\n");
  const solHtml = head(`Item Bank — solutions`, 2) + `
<header class="masthead"><h1>Item Bank — worked solutions</h1></header>
<main class="sols">${sols}</main>` + foot(2);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "index.html"), indexHtml);
  writeFileSync(join(OUT, "solutions.html"), solHtml);
  console.log(`✓ bank → tests/bank/index.html (${items.length} items)`);
  console.log(`  by domain: ${JSON.stringify(counts.domain)}`);
}

main();
