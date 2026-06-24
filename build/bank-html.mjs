/* ============================================================================
   bank-html.mjs — browsable HTML view of the persistent item bank.
   Reads data/item-bank.jsonl → tests/bank/{index.html,solutions.html}, reusing
   render.mjs's KaTeX + figure + question/solution renderers. Sticky filter bar
   (origin / domain / band / type / search). Each item shows its WORKED SOLUTION
   inline (collapsible) and, where the math is graphable, an embedded DESMOS graph
   (lazy-loaded on expand): solve-items graph y=LHS & y=RHS (intersection = answer),
   functions graph y=f(x), systems graph each equation.
     node build/bank-html.mjs
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderQuestion, renderSolution, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");
const OUT = join(ROOT, "tests", "bank");
// Desmos public demo API key (swap for an org key in production).
const DESMOS_KEY = "dcb31709b452b1cf9dc26972add0fda6";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stemText = (segs) => (Array.isArray(segs) ? segs : []).map((s) => s.v || "").join(" ").toLowerCase();
const DOMAIN_LABEL = { algebra: "Algebra", advanced_math: "Advanced Math", psda: "Problem-Solving & Data", geometry_trig: "Geometry & Trig" };
const ORIGIN_LABEL = { "insight-gen": "SAT-Insight-Gen", mod2: "SAT-Mod2" };
const originOf = (it) => (String(it.source || "").startsWith("mod2/") ? "mod2" : "insight-gen");

/* ---- Desmos seed expressions derived from the item's own stem math ---- */
const cleanLatex = (l) => l.replace(/\\dfrac/g, "\\frac").replace(/\\,|\\!|\\;|\\ /g, "").replace(/\\left|\\right/g, "").trim();
const renameVar = (l, v) => (!v || v === "x" ? l : l.replace(new RegExp("(?<![A-Za-z\\\\])" + v + "(?![A-Za-z])", "g"), "x"));
const stripCmd = (s) => String(s).replace(/\\[A-Za-z]+/g, "");   // drop LaTeX commands so coefficients like "ax" still count as x (but \frac/\sqrt don't)
const hasY = (s) => /y/.test(stripCmd(s));
const hasX = (s) => /x/.test(stripCmd(s));
const nonXYvars = (s) => [...new Set((stripCmd(s).match(/[A-Za-z]/g) || []).filter((c) => c !== "x" && c !== "y"))];
// a "substantive" equation: exactly one '=', no inequality, and at least one side is
// more than a lone symbol (so answer-definitions like "x = a" / "x = b" are dropped).
function substantiveEq(e) {
  if ((e.match(/=/g) || []).length !== 1 || /[<>≤≥]/.test(e)) return false;
  const [l, r] = e.split("=");
  const meaty = (s) => { const t = s.replace(/\s/g, ""); return t.length >= 3 || /\d/.test(t) || /[+\-*/^(){}\\]/.test(t); };
  return meaty(l) || meaty(r);
}
export function desmosExprs(item) {
  const segs = item.stem || [];
  const maths = segs.filter((s) => s.t === "math").map((s) => s.v.trim());
  const blocks = segs.filter((s) => s.t === "mathblock").map((s) => s.v.trim());
  const v0 = item.incidentals?.var_name;
  // graph ONE equation: relation-with-y → verbatim; "V = expr(x)" → function (V≡y);
  // else split into y=LHS & y=RHS so the intersection x = the solution.
  const fromEq = (E) => {
    if (hasY(E)) return { kind: "relation", exprs: [cleanLatex(E)] };
    const [l, r] = E.split("=").map((s) => s.trim());
    const vs = nonXYvars(E);
    if (hasX(E) && vs.length === 1) {                     // "P = expr(x)" — treat the lone non-xy var as y
      if (l === vs[0]) return { kind: "function", exprs: ["y=" + cleanLatex(r)] };
      if (r === vs[0]) return { kind: "function", exprs: ["y=" + cleanLatex(l)] };
    }
    if (vs.length > 1) return null;                       // multi-variable literal (e.g. P=9n+5q) → not graphable
    const v = vs.length ? (v0 || vs[0]) : null;
    const g = (s) => (v ? renameVar(cleanLatex(s), v) : cleanLatex(s));
    return { kind: "solve", exprs: ["y=" + g(l), "y=" + g(r)] };
  };
  // collect candidate equations from cases/aligned rows, standalone equation-blocks, and math segs
  const raw = [];
  for (const b of blocks) {
    if (/\\begin\{(cases|aligned|array)\}/.test(b)) {
      const inner = b.replace(/\\begin\{[a-z]+\}(\{[^}]*\})?/i, "").replace(/\\end\{[a-z]+\}/i, "");
      inner.split(/\\\\/).forEach((r) => raw.push(r.trim()));
    } else raw.push(b);
  }
  maths.forEach((m) => raw.push(m));
  // a function definition f(arg)=expr takes precedence (highest-precision case)
  for (const m of maths) {
    const fm = m.match(/^[A-Za-z]\s*\(\s*([A-Za-z])\s*\)\s*=\s*(.+)$/);
    if (fm) return { kind: "function", exprs: [renameVar("y=" + cleanLatex(fm[2]), fm[1])] };
  }
  const eqs = raw.filter(substantiveEq);
  if (eqs.length === 1) return fromEq(eqs[0]) || { kind: null, exprs: [] };
  if (eqs.length >= 2) {                                  // graph the relations that actually involve x or y
    const rel = eqs.filter((e) => hasX(e) || hasY(e));
    if (rel.length >= 2) return { kind: "system", exprs: rel.map(cleanLatex) };
    if (rel.length === 1) return fromEq(rel[0]) || { kind: null, exprs: [] };
  }
  return { kind: null, exprs: [] };
}
// the fast Desmos method per item category (Desmos is allowed on the digital SAT)
const DESMOS_HINT = {
  solve: "graph each side of the equation as its own function — the x-coordinate(s) where the curves cross are the solution(s). No algebra needed.",
  system: "graph both equations and read the intersection point(s) — those coordinates are the solution to the system.",
  function: "graph the function and read the key feature straight off the curve (vertex/min-max, an intercept, or the value at a point).",
  relation: "graph the equation directly to see the line or curve, then read the feature the question asks for off the graph.",
};

function main() {
  const lines = readFileSync(BANK, "utf8").trim().split("\n").filter(Boolean);
  let items = lines.map((l) => JSON.parse(l));
  const dorder = ["algebra", "advanced_math", "psda", "geometry_trig"];
  items.sort((a, b) =>
    originOf(a).localeCompare(originOf(b)) || (dorder.indexOf(a.domain) - dorder.indexOf(b.domain)) ||
    String(a.band).localeCompare(String(b.band)) || String(a.skill).localeCompare(String(b.skill)));
  items.forEach((it, i) => { it.id = i + 1; });

  const counts = { domain: {}, band: {}, origin: {} };
  let withDesmos = 0;
  for (const it of items) {
    counts.domain[it.domain] = (counts.domain[it.domain] || 0) + 1;
    counts.band[it.band] = (counts.band[it.band] || 0) + 1;
    counts.origin[originOf(it)] = (counts.origin[originOf(it)] || 0) + 1;
  }

  const cards = items.map((it) => {
    const og = originOf(it);
    const dataQ = esc(stemText(it.stem) + " " + (it.skill || ""));
    const dz = desmosExprs(it);
    if (dz.exprs.length) withDesmos++;
    const desmos = dz.exprs.length
      ? `<div class="dz-hint">⚡ <b>Desmos shortcut:</b> ${DESMOS_HINT[dz.kind] || ""}</div><button class="dz-btn" type="button">📈 Graph in Desmos</button><div class="dz-graph" data-dz='${esc(JSON.stringify(dz.exprs))}'></div>`
      : "";
    const sol = `<details class="bk-sol"><summary>Worked solution${dz.exprs.length ? " + Desmos shortcut" : ""}</summary>${renderSolution({ ...it, id: "s" + it.id })}${desmos}</details>`;
    return `<div class="bankitem" data-origin="${og}" data-domain="${esc(it.domain)}" data-band="${esc(it.band)}" data-type="${esc(it.type)}" data-skill="${esc(it.skill)}" data-q="${dataQ}">
  <div class="bk-meta"><span class="bk-orig">${esc(ORIGIN_LABEL[og])}</span><span class="bk-dom">${esc(DOMAIN_LABEL[it.domain] || it.domain)}</span><span class="bk-band">${esc(it.band)}</span><span class="bk-skill">${esc(it.skill || "")}</span><span class="bk-src">${esc(it.source || "")}</span></div>
  ${renderQuestion(it)}
  ${sol}
</div>`;
  }).join("\n");

  const opt = (v, label, n) => `<option value="${v}">${label}${n != null ? ` (${n})` : ""}</option>`;
  const originOpts = `<option value="all">All sources</option>` + Object.keys(counts.origin).sort().map((o) => opt(o, ORIGIN_LABEL[o] || o, counts.origin[o])).join("");
  const domOpts = `<option value="all">All domains</option>` + dorder.filter((d) => counts.domain[d]).map((d) => opt(d, DOMAIN_LABEL[d], counts.domain[d])).join("");
  const bandKeys = Object.keys(counts.band).sort((a, b) => ((a === "M2") - (b === "M2")) || a.localeCompare(b));
  const bandOpts = `<option value="all">All bands</option>` + bandKeys.map((b) => opt(b, b, counts.band[b])).join("");

  const CSS = `<style>
  .bankbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #d7dde6;padding:12px 0;margin:0 0 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .bankbar select,.bankbar input{font:14px inherit;padding:6px 9px;border:1px solid #c3ccd8;border-radius:8px;background:#fff}
  .bankbar input{min-width:200px;flex:1}
  .bankbar .count{margin-left:auto;color:#647084;font-size:13px;white-space:nowrap}
  .bankitem{margin:0 0 14px}
  .bk-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:#647084;margin:0 0 -6px}
  .bk-meta span{background:#eef2f7;border-radius:5px;padding:1px 7px}
  .bk-meta .bk-orig{background:#fef3e8;color:#c2410c;font-weight:600}
  .bk-meta .bk-band{background:#e8f0fe;color:#2563eb;font-weight:600}
  .bk-meta .bk-dom{background:#e6f4f1;color:#0f766e;font-weight:600}
  .bankitem.hide{display:none}
  .bk-sol{margin:8px 0 0;border:1px solid #e2e8f0;border-radius:8px;background:#fafcff;padding:2px 12px}
  .bk-sol>summary{cursor:pointer;color:#0f766e;font-weight:600;font-size:14px;padding:8px 0}
  .bk-sol .sol{border:0;padding:6px 0}
  .dz-hint{font-size:13.5px;color:#3b4759;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:7px 11px;margin:6px 0}
  .dz-btn{font:13px inherit;color:#2563eb;background:#eef4ff;border:1px solid #c3d4f5;border-radius:7px;padding:5px 11px;cursor:pointer;margin:4px 0 8px}
  .dz-graph{display:none;width:100%;height:340px;margin:4px 0 12px;border:1px solid #d7dde6;border-radius:8px;overflow:hidden}
  </style>`;

  const filterJS = `<script>
  (function(){
    const items=[].slice.call(document.querySelectorAll('.bankitem'));
    const o=document.getElementById('f-origin'),d=document.getElementById('f-domain'),b=document.getElementById('f-band'),t=document.getElementById('f-type'),q=document.getElementById('f-search'),c=document.getElementById('f-count');
    function apply(){
      const ov=o.value,dv=d.value,bv=b.value,tv=t.value,qv=q.value.toLowerCase().trim();let n=0;
      for(const el of items){const ok=(ov==='all'||el.dataset.origin===ov)&&(dv==='all'||el.dataset.domain===dv)&&(bv==='all'||el.dataset.band===bv)&&(tv==='all'||el.dataset.type===tv)&&(!qv||el.dataset.q.indexOf(qv)>=0);el.classList.toggle('hide',!ok);if(ok)n++;}
      c.textContent='showing '+n+' of '+items.length;
    }
    [o,d,b,t].forEach(e=>e.addEventListener('change',apply));q.addEventListener('input',apply);apply();
  })();</script>`;

  // Desmos: lazy-instantiate a calculator the first time a "Graph in Desmos" button is clicked.
  const desmosJS = `<script src="https://www.desmos.com/api/v1.10/calculator.js?apiKey=${DESMOS_KEY}"></script>
  <script>
  document.addEventListener('click',function(e){
    const btn=e.target.closest('.dz-btn'); if(!btn)return;
    const g=btn.nextElementSibling; if(!g||!g.classList.contains('dz-graph'))return;
    if(g.dataset.loaded){g.style.display=g.style.display==='none'?'block':'none';return;}
    if(typeof Desmos==='undefined'){g.style.display='block';g.innerHTML='<p style="padding:12px;color:#647084">Desmos needs an internet connection to load.</p>';g.dataset.loaded='1';return;}
    g.dataset.loaded='1'; g.style.display='block'; btn.textContent='📈 Hide Desmos graph';
    const calc=Desmos.GraphingCalculator(g,{expressionsCollapsed:false,settingsMenu:false,border:false,lockViewport:false});
    try{(JSON.parse(g.dataset.dz||'[]')).forEach((l,i)=>calc.setExpression({id:'e'+i,latex:l}));}catch(err){}
  });</script>`;

  const srcSummary = Object.entries(counts.origin).map(([k, v]) => `${ORIGIN_LABEL[k]} ${v}`).join(" · ");
  const indexHtml = head(`Item Bank (${items.length}) — SAT-Insight-Gen`, 2) + FIG_OPT_CSS + CSS + `
<header class="masthead"><h1>Item Bank</h1><p class="sub">${items.length} items · ${srcSummary} · ${Object.keys(counts.domain).length} domains · worked solutions inline · ${withDesmos} with Desmos graphs</p></header>
<div class="bankbar">
  <select id="f-origin">${originOpts}</select>
  <select id="f-domain">${domOpts}</select>
  <select id="f-band">${bandOpts}</select>
  <select id="f-type"><option value="all">All types</option><option value="mcq">Multiple choice</option><option value="spr">Student-response</option></select>
  <input id="f-search" type="search" placeholder="search stems / skills…" autocomplete="off">
  <span class="count" id="f-count"></span>
</div>
<main class="qs">
${cards}
</main>
` + filterJS + desmosJS + foot(2);

  const sols = items.map(renderSolution).join("\n");
  const solHtml = head(`Item Bank — solutions`, 2) + `<header class="masthead"><h1>Item Bank — worked solutions</h1></header><main class="sols">${sols}</main>` + foot(2);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "index.html"), indexHtml);
  writeFileSync(join(OUT, "solutions.html"), solHtml);
  console.log(`✓ bank → tests/bank/index.html (${items.length} items · ${withDesmos} with Desmos graphs)`);
  console.log(`  origin: ${JSON.stringify(counts.origin)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
