/* suite — the diagnostic sequence: Module 1 → (adaptive route) → Module 2.
   assembleSuite() picks from the two-tier bank (≤1 family per student-visible path,
   band-mix targets per module, seen-ledger aware); renderSuite() emits ONE
   self-contained static page through the unchanged v1 render chain
   (renderQuestion + KaTeX at build time + figures registry incl. the raw passthrough).

   Honesty rules baked in: strict-pass families preferred, shortfalls filled from
   record-mode with an explicit log + manifest note; domain coverage is whatever the
   bank holds (geometry_trig + algebra today) — the page says so.

     node engine/cli.mjs suite <id> [--student <id>]     (assemble + render)      */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies, loadVariants } from "./family.mjs";
import { rng } from "./types.mjs";
import { toSuiteQuestion, loadAssets } from "./render-adapter.mjs";
import { renderQuestion, renderSolution, head, FIG_OPT_CSS } from "../build/render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = 1; // suite asset cache-buster

/* ---- module band-mix targets (sums = 22; respects current bank supply) ---- */
export const MIX = {
  m1: { B1: 1, B2: 2, B3: 3, B4: 4, B5: 4, B6: 4, B7: 4 },
  m2e: { B1: 2, B2: 3, B3: 4, B4: 5, B5: 4, B6: 3, B7: 1 },
  m2h: { B1: 0, B2: 1, B3: 2, B4: 3, B5: 4, B6: 4, B7: 8 },
};
export const ROUTE_THRESHOLD = 0.6; // M1 raw ≥ 60% → m2h

/* v1 figure-family subdomain names → Skills-Insight subdomains (the authored tier
   already uses the canonical four; without this map one skill area fragments into
   two deficit-map rows and prescription can't see parametric supply). */
const SUB_MAP = { solid_figures: "area_volume", circle_figures: "circles" };
const COMPOSITE_BY_TASK = { right_triangle_altitude_fig: "right_triangles_trig", intersecting_chords_fig: "circles", tangent_length_fig: "circles" };
export function normSubdomain(fam) {
  const raw = fam.subdomains?.[0] ?? fam.domain ?? "algebra";
  if (raw === "composite_figures") return COMPOSITE_BY_TASK[fam.spec?.task] ?? "right_triangles_trig";
  return SUB_MAP[raw] ?? raw;
}

/* ---- question pool: every renderable variant, tagged with family meta ---- */
export function buildPool({ seen = new Set() } = {}) {
  const fams = Object.fromEntries(loadFamilies().map((f) => [f.familyId, f]));
  const assets = loadAssets();
  const pool = [];
  for (const v of loadVariants()) {
    if (seen.has(v.variantId)) continue;
    const fam = fams[v.familyId];
    if (!fam || !v.item) continue;
    const strict = v.realization?.mode === "authored-cleanroom"
      ? v.quality?.strictPass !== false
      : fam.bandpass?.strictPass !== false;
    let q;
    if (v.realization?.mode === "authored-cleanroom") {
      try { q = toSuiteQuestion(v, assets, { subdomain: fam.spec?.subdomain }); } catch { continue; }
    } else {
      q = { ...v.item, _variantId: v.variantId, _familyId: v.familyId, _subdomain: normSubdomain(fam) };
    }
    const band = q.band || fam.difficulty?.band;
    pool.push({ q, band, familyId: v.familyId, variantId: v.variantId, subdomain: q._subdomain, strict });
  }
  return pool;
}

/** pick per band-mix: unused families only, strict preferred, subdomain spread,
 *  adjacent-band borrow as last resort. Deterministic per seed. Returns {picked, log}. */
function pickModule(pool, mix, usedFams, r) {
  const log = [], picked = [];
  const shuffled = [...pool].sort(() => r() - 0.5);
  const take = (band, wantStrict) => {
    const c = shuffled.find((p) => p.band === band && p.strict === wantStrict && !usedFams.has(p.familyId) && !picked.includes(p));
    return c ?? null;
  };
  for (const [band, n] of Object.entries(mix)) {
    for (let i = 0; i < n; i++) {
      let c = take(band, true) ?? take(band, false);
      if (c && !c.strict) log.push(`${band}: filled with record-mode ${c.variantId}`);
      if (!c) { // borrow adjacent band
        const bn = Number(band[1]);
        for (const nb of [`B${bn - 1}`, `B${bn + 1}`]) { c = take(nb, true) ?? take(nb, false); if (c) { log.push(`${band}: borrowed ${nb} (${c.variantId})`); break; } }
      }
      if (!c) { log.push(`${band}: UNFILLED slot`); continue; }
      picked.push(c); usedFams.add(c.familyId);
    }
  }
  return { picked, log };
}

export function assembleSuite({ id = "001", seen = new Set() } = {}) {
  const r = rng(`suite|${id}`);
  const pool = buildPool({ seen });
  const usedM1 = new Set();
  const m1 = pickModule(pool, MIX.m1, usedM1, r);
  // M2E and M2H may overlap each other (a student sees only one) but never M1.
  const m2e = pickModule(pool, MIX.m2e, new Set(usedM1), r);
  const m2h = pickModule(pool, MIX.m2h, new Set(usedM1), r);
  const dir = join(ROOT, "data", "suite", id);
  mkdirSync(dir, { recursive: true });
  const mods = { m1, m2e, m2h };
  for (const [key, mod] of Object.entries(mods)) {
    const questions = mod.picked.map((p, i) => ({ id: i + 1, ...p.q }));
    writeFileSync(join(dir, `${key}.json`), JSON.stringify({ number: key, title: `Suite ${id} — ${key.toUpperCase()}`, questions }, null, 1));
  }
  const manifest = {
    id, threshold: ROUTE_THRESHOLD, createdAt: new Date().toISOString(),
    coverage: "geometry_trig + algebra (current bank coverage — no PSDA/Advanced Math yet)",
    relaxations: Object.fromEntries(Object.entries(mods).map(([k, m]) => [k, m.log])),
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
  for (const [k, m] of Object.entries(mods)) m.log.forEach((l) => console.log(`  [${k}] ${l}`));
  console.log(`suite ${id}: m1=${m1.picked.length} m2e=${m2e.picked.length} m2h=${m2h.picked.length} → ${dir}`);
  return { dir, manifest };
}

/* ---- rendering: one self-contained page ---- */
const stripAnswerLeaks = (html) => html
  .replace(/<div class="answer">[\s\S]*?<\/div>/g, "")
  .replace(/<div class="reveal-answer">[\s\S]*?<\/div>/g, "");

function renderModuleQuestion(q, modKey) {
  let html = renderQuestion(q);
  html = stripAnswerLeaks(html);
  const qid = `${modKey}-q${q.id}`;
  html = html.replace(`id="q${q.id}"`, `id="${qid}" data-qid="${qid}"`);
  html = html.replaceAll(`id="spr-${q.id}"`, `id="spr-${qid}"`).replaceAll(`for="spr-${q.id}"`, `for="spr-${qid}"`);
  return html;
}

/** generic player-page renderer — serves the 3-module adaptive suite AND
 *  single-module practice sets (prescribe.mjs) through one assets/suite.js. */
export function renderPlayerPage({ id, dir, outDirName, keys, first, threshold, coverage, heading, sub }) {
  const data = { id, first, threshold, coverage, modules: {} };
  let body = "";
  const MOD_TITLES = { m1: "Module 1", m2e: "Module 2", m2h: "Module 2", p1: "Practice Set" };
  for (const key of keys) {
    const test = JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8"));
    data.modules[key] = test.questions.map((q) => ({
      qid: `${key}-q${q.id}`, type: q.type,
      correct: q.type === "mcq" ? q.answer.correct : null,
      accept: q.type === "spr" ? q.answer.accept : null, tol: q.answer.tol ?? null,
      variantId: q._variantId, familyId: q._familyId,
      subdomain: q._subdomain ?? q.domain ?? "?", band: q.band ?? "?",
      solutionHtml: q._solutionHtml ?? renderSolution({ ...q, id: `${key}-${q.id}` }),
    }));
    body += `<section class="module" id="mod-${key}" hidden>
  <header class="masthead"><h1>${MOD_TITLES[key] ?? key}</h1>
  <p class="sub">${test.questions.length} questions · answer every question, then submit. ${key === "m1" ? "Module 2 adapts to your Module 1 performance." : ""}</p></header>
  ${test.questions.map((q) => renderModuleQuestion(q, key)).join("\n")}
  <div class="suite-actions"><button class="btn primary" data-submit="${key}">Submit ${MOD_TITLES[key] ?? key}</button></div>
</section>\n`;
  }
  const page = head(`${heading} — Digital SAT Math`, 2) + FIG_OPT_CSS +
    `<link rel="stylesheet" href="../../assets/suite.css?v=${V}">` +
    `<section id="view-start">
  <header class="masthead"><p class="eyebrow">Digital SAT · Math</p>
  <h1>${heading}</h1>
  <p class="sub">${sub} Coverage: ${coverage}.</p>
  <label class="student-label">Student name or ID <input id="student-id" autocomplete="off" placeholder="e.g. maya-t"></label>
  <button class="btn primary" id="begin">Begin</button></header>
</section>\n` + body +
    `<section id="view-results" hidden>
  <header class="masthead"><h1>Results</h1><p class="sub" id="results-summary"></p></header>
  <div id="deficit-map"></div>
  <div class="suite-actions"><button class="btn primary" id="download-results">Download results.json</button></div>
  <h2>Review</h2><div id="review"></div>
</section>
<script type="application/json" id="suite-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
</div><script src="../../assets/suite.js?v=${V}" defer></script></body></html>`;
  const outDir = join(ROOT, "tests", outDirName);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), page);
  console.log(`rendered → tests/${outDirName}/index.html`);
  return join(outDir, "index.html");
}

export function renderSuite(id) {
  const dir = join(ROOT, "data", "suite", id);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  return renderPlayerPage({
    id, dir, outDirName: `suite-${id}`, keys: ["m1", "m2e", "m2h"], first: "m1",
    threshold: manifest.threshold, coverage: manifest.coverage,
    heading: `Diagnostic Suite ${id}`,
    sub: "Module 1 (22 questions) → adaptive Module 2 (22 questions) → your skill-by-band deficit map and a targeted practice plan.",
  });
}
