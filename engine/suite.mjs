/* suite — the diagnostic sequence: Module 1 → (adaptive route) → Module 2, plus the
   EMBEDDED PRACTICE POOL that lets the whole mastery loop run inside one static page.

   Sources: the engine two-tier bank (families/variants incl. clean-room authored via
   render-adapter) AND the v1 item bank (bank-source.mjs — 900+ verified render-schema
   items, all four domains). Modules are DOMAIN-AWARE (real DSAT shape: ~8 algebra /
   8 advanced / 3 psda / 3 geometry per 22) and band-mixed per module. Novelty by
   construction: ≤1 per family/pseudo-group per student-visible path; ungrouped v1
   items pass a pairwise surface floor instead (no family identity — REPO-REVIEW debt,
   guarded not ignored). All KaTeX/SVG is rendered at BUILD time; the page works from
   file:// with zero network.

     node engine/cli.mjs suite <id> [--student <id>]     (reserve → assemble → render) */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies, loadVariants } from "./family.mjs";
import { mintVariants } from "./variants.mjs";
import { rng } from "./types.mjs";
import { shingles, stemText } from "./distance.mjs";
import { toSuiteQuestion, loadAssets } from "./render-adapter.mjs";
import { loadBankQuestions } from "./bank-source.mjs";
import { renderQuestion, renderSolution, head, FIG_OPT_CSS } from "../build/render.mjs";
import * as FIG from "../figures/figures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = 2; // suite asset cache-buster
const BAND_CUTS = [370, 420, 470, 550, 610, 680]; // B1<370 … B7 680–800 (Skills-Insight)
const SURFACE_FLOOR = 0.6; // pairwise jaccard ≥ this = same-structure risk for ungrouped v1 items

/* ---- module shape: bands × domains (sums = 22) ---- */
export const MIX = {
  m1: { B1: 1, B2: 2, B3: 3, B4: 4, B5: 4, B6: 4, B7: 4 },
  m2e: { B1: 2, B2: 3, B3: 4, B4: 5, B5: 4, B6: 3, B7: 1 },
  m2h: { B1: 0, B2: 1, B3: 2, B4: 3, B5: 4, B6: 4, B7: 8 },
};
export const DOM_MIX = { algebra: 8, advanced_math: 8, psda: 3, geometry_trig: 3 };
export const ROUTE_THRESHOLD = 0.6;

/* v1 figure-family subdomain names → Skills-Insight subdomains */
const SUB_MAP = { solid_figures: "area_volume", circle_figures: "circles" };
const COMPOSITE_BY_TASK = { right_triangle_altitude_fig: "right_triangles_trig", intersecting_chords_fig: "circles", tangent_length_fig: "circles" };
export function normSubdomain(fam) {
  const raw = fam.subdomains?.[0] ?? fam.domain ?? "algebra";
  if (raw === "composite_figures") return COMPOSITE_BY_TASK[fam.spec?.task] ?? "right_triangles_trig";
  return SUB_MAP[raw] ?? raw;
}

/* ---- reserve: top up $0-reseed engine families so the embedded pool is deep ---- */
export async function mintReserve({ depth = 6 } = {}) {
  const counts = {};
  for (const v of loadVariants()) counts[v.familyId] = (counts[v.familyId] || 0) + 1;
  let minted = 0, skipped = 0;
  for (const f of loadFamilies()) {
    if (f.generator === "authored") continue;                 // finite by nature
    if (f.generator === "cell") { skipped++; continue; }      // llm-gated — needs the CLI
    const have = counts[f.familyId] || 0;
    if (have >= depth) continue;
    try { minted += (await mintVariants(f, depth - have)).length; } catch { skipped++; }
  }
  console.log(`reserve: +${minted} reseed variants (llm-gated skipped: ${skipped})`);
  return minted;
}

/* ---- unified pool: engine variants + v1 bank items ----
   entry: {q, id, familyId (family | pseudo-group | single:<id>), row (deficit-map row),
           band, domain, grouped, src, sh (lazy shingles)} */
export function buildPool({ seen = new Set() } = {}) {
  const fams = Object.fromEntries(loadFamilies().map((f) => [f.familyId, f]));
  const assets = loadAssets();
  const pool = [];
  for (const v of loadVariants()) {
    if (seen.has(v.variantId)) continue;
    const fam = fams[v.familyId];
    if (!fam || !v.item) continue;
    const strict = v.realization?.mode === "authored-cleanroom" ? v.quality?.strictPass !== false : fam.bandpass?.strictPass !== false;
    let q;
    if (v.realization?.mode === "authored-cleanroom") {
      try { q = toSuiteQuestion(v, assets, { subdomain: fam.spec?.subdomain }); } catch { continue; }
    } else {
      q = { ...v.item, _variantId: v.variantId, _familyId: v.familyId, _subdomain: normSubdomain(fam) };
    }
    pool.push({ q, id: v.variantId, familyId: v.familyId, row: q._subdomain, band: q.band || fam.difficulty?.band,
      domain: fam.domain ?? q.domain ?? "algebra", grouped: true, strict, src: "engine" });
  }
  for (const b of loadBankQuestions()) {
    if (seen.has(b.id)) continue;
    const q = { ...b.q, _variantId: b.id, _familyId: b.group ?? `single:${b.id}`, _subdomain: b.skill };
    pool.push({ q, id: b.id, familyId: b.group ?? `single:${b.id}`, row: b.skill, band: b.band,
      domain: b.domain, grouped: b.group != null, strict: true, src: "bank" });
  }
  return pool;
}
const shOf = (p) => (p.sh ??= shingles(typeof p.q.stem === "string" ? p.q.stem : stemText(p.q.stem)));
const jac = (A, B) => { let i = 0; for (const x of A) if (B.has(x)) i++; const u = A.size + B.size - i; return u ? i / u : 0; };

/* ---- slotting: expand (band mix × domain mix) into 22 (domain, band) slots ---- */
function slotify(mix, r) {
  const bands = Object.entries(mix).flatMap(([b, n]) => Array(n).fill(b));
  const doms = Object.entries(DOM_MIX).flatMap(([d, n]) => Array(n).fill(d));
  doms.sort(() => r() - 0.5);
  return bands.map((band, i) => ({ band, domain: doms[i % doms.length] }));
}

function pickModule(pool, mix, usedFams, r, log) {
  const picked = [];
  const shuffled = [...pool].sort(() => r() - 0.5);
  const ok = (p, slot, { anyDomain = false, band = slot.band } = {}) =>
    p.band === band && (anyDomain || p.domain === slot.domain) && !usedFams.has(p.familyId)
    && !picked.includes(p)
    && (p.grouped || !picked.some((x) => jac(shOf(p), shOf(x)) >= SURFACE_FLOOR)); // ungrouped: surface floor
  const strictFirst = (pred) => shuffled.find((p) => p.strict && pred(p)) ?? shuffled.find(pred);
  for (const slot of slotify(mix, r)) {
    const bn = Number(slot.band[1]);
    let c = strictFirst((p) => ok(p, slot));
    if (!c) for (const nb of [`B${bn - 1}`, `B${bn + 1}`]) if ((c = strictFirst((p) => ok(p, slot, { band: nb })))) { log.push(`${slot.domain} ${slot.band}: borrowed ${nb}`); break; }
    if (!c && (c = strictFirst((p) => ok(p, slot, { anyDomain: true })))) log.push(`${slot.domain} ${slot.band}: cross-domain fill (${c.domain})`);
    if (!c) { log.push(`${slot.domain} ${slot.band}: UNFILLED`); continue; }
    if (!c.strict) log.push(`${slot.domain} ${slot.band}: record-mode ${c.id}`);
    picked.push(c); usedFams.add(c.familyId);
  }
  return picked;
}

export async function assembleSuite({ id = "001", seen = new Set() } = {}) {
  await mintReserve();
  const r = rng(`suite|${id}`);
  const pool = buildPool({ seen });
  const log = [];
  const usedM1 = new Set();
  const m1 = pickModule(pool, MIX.m1, usedM1, r, log);
  const m2e = pickModule(pool, MIX.m2e, new Set(usedM1), r, log);
  const m2h = pickModule(pool, MIX.m2h, new Set(usedM1), r, log);
  const dir = join(ROOT, "data", "suite", id);
  mkdirSync(dir, { recursive: true });
  const mods = { m1, m2e, m2h };
  const inModules = new Set(Object.values(mods).flat().map((p) => p.id));
  for (const [key, picked] of Object.entries(mods))
    writeFileSync(join(dir, `${key}.json`), JSON.stringify({ number: key, title: `Suite ${id} — ${key.toUpperCase()}`,
      // id LAST — v1 bank items carry their own `id`, which must not survive the spread
      questions: picked.map((p, i) => ({ ...p.q, id: i + 1 })) }, null, 1));

  /* embedded practice pool: leftover unseen entries, capped per (row, band) cell.
     Only M1 picks are excluded — the student takes ONE of m2e/m2h, and the routed
     module's items become seen at submit; the unrouted module's items are prime
     practice supply and must not be locked away. */
  const CAP = 8;
  const m1Ids = new Set(m1.map((p) => p.id));
  const cellCount = {};
  const poolPick = [];
  for (const p of pool.sort(() => r() - 0.5)) {
    if (m1Ids.has(p.id)) continue;
    const k = `${p.row}|${p.band}`;
    if ((cellCount[k] || 0) >= CAP) continue;
    cellCount[k] = (cellCount[k] || 0) + 1;
    poolPick.push(p);
  }
  writeFileSync(join(dir, "pool.json"), JSON.stringify({ cap: CAP, entries: poolPick.map((p) => ({ ...p.q, _row: p.row, _band: p.band, _domain: p.domain })) }, null, 1));

  const domCount = {};
  for (const p of Object.values(mods).flat()) domCount[p.domain] = (domCount[p.domain] || 0) + 1;
  const manifest = {
    id, threshold: ROUTE_THRESHOLD, createdAt: new Date().toISOString(),
    coverage: Object.entries(domCount).map(([d, n]) => `${d} ${n}`).join(" · ") + ` · practice pool ${poolPick.length}`,
    caveats: ["advanced_math bands carry the known judge drift (~+1); recorded, not corrected",
      "ungrouped v1 items have no family identity — guarded by the pairwise surface floor"],
    relaxations: log,
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
  log.forEach((l) => console.log(`  [assembly] ${l}`));
  console.log(`suite ${id}: m1=${m1.length} m2e=${m2e.length} m2h=${m2h.length} · pool=${poolPick.length} → ${dir}`);
  return { dir, manifest };
}

/* ---- rendering ---- */
const stripAnswerLeaks = (html) => html
  .replace(/<div class="answer">[\s\S]*?<\/div>/g, "")
  .replace(/<div class="reveal-answer">[\s\S]*?<\/div>/g, "");

function renderModuleQuestion(q, modKey) {
  let html = stripAnswerLeaks(renderQuestion(q));
  const qid = `${modKey}-q${q.id}`;
  html = html.replace(`id="q${q.id}"`, `id="${qid}" data-qid="${qid}"`);
  html = html.replaceAll(`id="spr-${q.id}"`, `id="spr-${qid}"`).replaceAll(`for="spr-${q.id}"`, `for="spr-${qid}"`);
  return html;
}

const qMeta = (q, qid) => ({
  qid, type: q.type,
  correct: q.type === "mcq" ? q.answer.correct : null,
  accept: q.type === "spr" ? q.answer.accept : null, tol: q.answer.tol ?? null,
  variantId: q._variantId, familyId: q._familyId,
  row: q._row ?? q._subdomain ?? q.skill ?? q.domain ?? "?", band: q._band ?? q.band ?? "?",
  domain: q._domain ?? q.domain ?? "?",
  solutionHtml: q._solutionHtml ?? renderSolution({ ...q, id: qid }),
});

/** one self-contained player page: modules + embedded pool + client mastery loop. */
export function renderPlayerPage({ id, dir, outDirName, keys, first, threshold, coverage, heading, sub, includePool = true }) {
  const data = { id, first, threshold, coverage, bandCuts: BAND_CUTS, modules: {}, pool: [] };
  let body = "";
  const MOD_TITLES = { m1: "Module 1", m2e: "Module 2", m2h: "Module 2", p1: "Practice Set" };
  for (const key of keys) {
    const test = JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8"));
    data.modules[key] = test.questions.map((q) => qMeta(q, `${key}-q${q.id}`));
    body += `<section class="module" id="mod-${key}" hidden>
  ${test.questions.map((q) => renderModuleQuestion(q, key)).join("\n")}
</section>\n`;
  }
  if (includePool) {
    /* the pool ships as COMPACT DATA, not pre-rendered HTML — build-time KaTeX HTML
       is ~20KB/item (an 18MB page at pool scale); instead the client renders stems
       with the vendored katex.min.js on inject. Figures ARE pre-rendered here
       (figures.js is Node-side): raw passthrough for authored, registry for parametric. */
    const svgOf = (fig) => !fig ? "" : fig.fn === "raw" ? (fig.spec?.svg ?? "") : (FIG[fig.fn]?.(fig.spec) ?? "");
    const { entries } = JSON.parse(readFileSync(join(dir, "pool.json"), "utf8"));
    entries.forEach((q, i) => {
      const qid = `pool-q${i + 1}`;
      data.pool.push({
        qid, type: q.type,
        correct: q.type === "mcq" ? q.answer.correct : null,
        accept: q.type === "spr" ? q.answer.accept : null, tol: q.answer.tol ?? null,
        variantId: q._variantId, familyId: q._familyId,
        row: q._row, band: q._band, domain: q._domain,
        stem: q.stem, figureSvg: svgOf(q.figure),
        options: q.type === "mcq" ? (q.options || []).map((o) => ({ key: o.key, seg: o.seg ?? null, figSvg: o.fig ? svgOf(o.fig) : undefined })) : null,
        solution: q._solutionHtml ? { html: q._solutionHtml } : { segs: q.solution ?? null },
      });
    });
  }
  const page = head(`${heading} — Digital SAT Math`, 2) + FIG_OPT_CSS +
    `<link rel="stylesheet" href="../../assets/suite.css?v=${V}">` +
    `<section id="view-start">
  <header class="masthead"><p class="eyebrow">Digital SAT · Math</p>
  <h1>${heading}</h1>
  <p class="sub">${sub}</p>
  <p class="sub small">Coverage: ${coverage}. Difficulty bands are rubric/expert-calibrated (not yet student-data-calibrated); the score estimate is a calibration-pending estimate, not a prediction.</p>
  <label class="student-label">Student name or ID <input id="student-id" autocomplete="off" placeholder="e.g. maya-t"></label>
  <button class="btn primary" id="begin">Begin</button>
  <div id="progress-home"></div></header>
</section>\n` +
    `<div id="testbar" hidden>
  <span id="tb-student"></span><span id="tb-module"></span>
  <span class="spacer"></span>
  <span id="tb-timer" title="soft timer — does not lock the module"></span>
  <button class="btn" id="tb-flag">⚑ Flag</button>
  <button class="btn" id="tb-palette">Questions</button>
</div>
<div id="palette" hidden></div>\n` + body +
    `<section class="module" id="mod-practice" hidden></section>
<div id="qnav" hidden><button class="btn" id="nav-prev">← Back</button><span id="qnav-pos"></span><button class="btn primary" id="nav-next">Next →</button></div>
<section id="view-review" hidden>
  <header class="masthead"><h1>Check your work</h1><p class="sub" id="review-summary"></p></header>
  <div id="review-grid"></div>
  <div class="suite-actions"><button class="btn" id="review-back">Back to questions</button><button class="btn primary" id="review-submit">Submit module</button></div>
</section>
<section id="view-interstitial" hidden>
  <header class="masthead"><h1 id="inter-title"></h1><p class="sub" id="inter-sub"></p></header>
  <div class="suite-actions"><button class="btn primary" id="inter-go">Continue</button></div>
</section>
<section id="view-results" hidden>
  <header class="masthead"><h1 id="results-title">Results</h1><p class="sub" id="results-summary"></p></header>
  <div id="score-estimate"></div>
  <div id="mastery-banner" hidden></div>
  <div id="deficit-map"></div>
  <div id="progress-view"></div>
  <div class="suite-actions">
    <button class="btn primary" id="gen-practice">Generate targeted practice</button>
    <button class="btn" id="download-results">Download results.json</button>
  </div>
  <h2>Review</h2><div id="review"></div>
</section>
<script type="application/json" id="suite-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
</div><script src="../../assets/katex/katex.min.js" defer></script><script src="../../assets/suite.js?v=${V}" defer></script></body></html>`;
  const outDir = join(ROOT, "tests", outDirName);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), page);
  console.log(`rendered → tests/${outDirName}/index.html (${(page.length / 1024).toFixed(0)}KB)`);
  return join(outDir, "index.html");
}

export function renderSuite(id) {
  const dir = join(ROOT, "data", "suite", id);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  return renderPlayerPage({
    id, dir, outDirName: `suite-${id}`, keys: ["m1", "m2e", "m2h"], first: "m1",
    threshold: manifest.threshold, coverage: manifest.coverage,
    heading: `Diagnostic Suite ${id}`,
    sub: "Module 1 (22 questions) → adaptive Module 2 (22 questions) → your skill-by-band map, a score estimate, and targeted practice — all in this page, no internet needed.",
  });
}
