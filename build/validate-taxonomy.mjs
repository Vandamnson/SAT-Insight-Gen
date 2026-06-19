/* ============================================================================
   validate-taxonomy.mjs — Phase-0 exit gate / CI guard for the taxonomy spine.

   Asserts the invariants the whole generator relies on:
     • every template referenced by a matrix statement exists in skills.json
     • every template has a recompute branch, ≥1 band, a params contract, and a
       single coherent domain
     • every statement has ≥1 template; figureLoad="req" statements have a
       figure-capable template; ids are well-formed and unique; programs cohere
     • the A (difficulty) and B (figures) module interfaces load and run, and the
       fixture's figures resolve in the figures registry.
   Exits non-zero on any error. Run: node build/validate-taxonomy.mjs
   ============================================================================ */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as FIGS from "../figures/index.js";
import * as DIFF from "../difficulty/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX = join(__dirname, "..", "taxonomy");
const matrix = JSON.parse(readFileSync(join(TAX, "matrix.json"), "utf8"));
const skills = JSON.parse(readFileSync(join(TAX, "skills.json"), "utf8")).templates;

const errs = [], warns = [];
const E = (m) => errs.push(m), W = (m) => warns.push(m);
const BAND_IDS = new Set(matrix.bands.map((b) => b.id));
const DOMAIN_IDS = new Set(matrix.domains.map((d) => d.id));
const ID_RE = /^(ALG|ADV|PSDA|GEO)\.B[1-7]\.s[0-9]+$/;
const figFns = new Set(FIGS.knownFns());

/* ---- 1. matrix structural checks ---- */
const seenCells = new Set(), seenStmt = new Set();
const tmplStatements = {};   // template key -> Set(statementId)
const tmplDomains = {};      // template key -> Set(domain)
for (const cell of matrix.cells) {
  if (!DOMAIN_IDS.has(cell.domain)) E(`cell has unknown domain ${cell.domain}`);
  if (!BAND_IDS.has(cell.band)) E(`cell has unknown band ${cell.band}`);
  const ck = cell.domain + "/" + cell.band;
  if (seenCells.has(ck)) E(`duplicate cell ${ck}`);
  seenCells.add(ck);
  if (!cell.statements?.length) E(`cell ${ck} has no statements`);
  for (const st of cell.statements || []) {
    if (!ID_RE.test(st.id)) E(`bad statement id "${st.id}"`);
    if (seenStmt.has(st.id)) E(`duplicate statement id ${st.id}`);
    seenStmt.add(st.id);
    if (!["none", "opt", "req"].includes(st.figureLoad)) E(`${st.id}: bad figureLoad ${st.figureLoad}`);
    for (const t of st.types || []) if (!["mcq", "spr"].includes(t)) E(`${st.id}: bad type ${t}`);
    if (!st.programs?.length) E(`${st.id}: no programs`);
    if (!st.templates?.length) E(`${st.id}: no templates`);
    for (const k of st.templates || []) {
      (tmplStatements[k] || (tmplStatements[k] = new Set())).add(st.id);
      (tmplDomains[k] || (tmplDomains[k] = new Set())).add(cell.domain);
    }
  }
}
// all 28 cells present
for (const d of DOMAIN_IDS) for (const b of BAND_IDS) if (!seenCells.has(d + "/" + b)) E(`missing cell ${d}/${b}`);

/* ---- 2. every referenced template exists + is well-formed ---- */
for (const [key, stSet] of Object.entries(tmplStatements)) {
  const t = skills[key];
  if (!t) { E(`template "${key}" referenced by ${[...stSet][0]} is missing from skills.json`); continue; }
  if (!t.recompute) E(`template ${key}: empty recompute branch`);
  if (!t.paramsContract) E(`template ${key}: empty paramsContract`);
  if (!t.bands || !Object.keys(t.bands).length) E(`template ${key}: no bands`);
  for (const b of Object.keys(t.bands || {})) {
    if (!BAND_IDS.has(b)) E(`template ${key}: unknown band ${b}`);
    if (!t.bands[b].levers?.length) E(`template ${key} band ${b}: no bandLevers`);
  }
  // domain coherence: a template must not span domains
  const doms = tmplDomains[key];
  if (doms.size > 1) E(`template ${key} spans multiple domains: ${[...doms].join(",")}`);
  if (t.domain && !doms.has(t.domain)) E(`template ${key}: skills.json domain ${t.domain} not among matrix domains ${[...doms]}`);
}

/* ---- 3. figureLoad=req statements have a figure-capable template ---- */
for (const cell of matrix.cells) for (const st of cell.statements) {
  if (st.figureLoad === "req") {
    const ok = st.templates.some((k) => skills[k] && ["opt", "req"].includes(skills[k].figure));
    if (!ok) W(`${st.id} (figureLoad=req) has no figure-capable template`);
  }
}

/* ---- 4. A/B interfaces load + run; fixture figures resolve ---- */
try {
  const m = DIFF.measure({ band: "B5" });
  if (m.band !== "B5") W(`difficulty.measure sanity: expected B5, got ${m.band}`);
  if (!DIFF.accept("B5", m)) W(`difficulty.accept sanity failed for B5`);
} catch (e) { E(`difficulty module failed: ${e.message}`); }

const fixturePath = join(__dirname, "..", "data", "test-99.json");
if (existsSync(fixturePath)) {
  const fix = JSON.parse(readFileSync(fixturePath, "utf8"));
  for (const q of fix.questions) {
    if (q.figure && !figFns.has(q.figure.fn)) E(`fixture q${q.id}: figure fn ${q.figure.fn} not in registry`);
    if (q.figure) {
      const v = await FIGS.verify(q.figure, q);
      if (!v.ok) E(`fixture q${q.id}: figure verify failed: ${v.reason}`);
    }
  }
} else W("no fixture data/test-99.json to smoke-test");

/* ---- report ---- */
const nStmt = seenStmt.size, nTmpl = Object.keys(skills).length;
const nGated = matrix.cells.flatMap((c) => c.statements).filter((s) => s.programs.length < 4).length;
console.log(`Spine: ${seenCells.size}/28 cells · ${nStmt} statements (${nGated} program-gated) · ${nTmpl} templates · ${figFns.size} figure fns`);
if (warns.length) { console.warn(`\n⚠ ${warns.length} warning(s):`); warns.forEach((w) => console.warn("  ·", w)); }
if (errs.length) { console.error(`\n✗ ${errs.length} error(s):`); errs.forEach((e) => console.error("  ✗", e)); process.exit(1); }
console.log("\n✓ taxonomy spine valid — Phase-0 exit gate PASSED");
