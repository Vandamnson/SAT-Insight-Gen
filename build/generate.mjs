/* ============================================================================
   generate.mjs — the band-targeted generation orchestrator.
   For each target (statement × band × type): author → recompute leash →
   figure-math consistency → difficulty measure (ACCEPT iff measured band ==
   target band) → blinded deep-verify → anti-repeat ledger. Failures re-prompt
   within a repair budget; exhausted targets become holes.

   Usage: node build/generate.mjs [pilot|<count>]
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { author } from "./author.mjs";
import { deepVerify } from "../verify/deep-verify.mjs";
import { recomputeCheck, toFloat, close } from "../verify/recompute.js";
import { measureFigure } from "../figures/consistency.js";
import * as FIGS from "../figures/index.js";
import * as DIFF from "../difficulty/index.js";
import { retargetHint } from "../difficulty/judge.mjs";
import { Ledger, cellId } from "./ledger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const matrix = JSON.parse(readFileSync(join(ROOT, "taxonomy", "matrix.json"), "utf8"));
const skills = JSON.parse(readFileSync(join(ROOT, "taxonomy", "skills.json"), "utf8")).templates;
const VARIANTS = JSON.parse(readFileSync(join(ROOT, "taxonomy", "variants.json"), "utf8")).variants;   // structural variants per symbolic template
const CONTEXTS = JSON.parse(readFileSync(join(ROOT, "taxonomy", "contexts.json"), "utf8")).contexts;    // real-world scenario seeds for contextual items
// symbolic-manipulation skills get a STRUCTURAL variant; everything else gets a scenario CONTEXT.
const SYMBOLIC = /factor|expand|combine|gcf|distribut|polynomial|exponent|radical|rational_rearrange|rewrite|simplif|abs_value|operations|monomial|binomial|equiv|quad_factored|system_solve|lin_solve/i;
const isContextual = (skill, hint) => !(SYMBOLIC.test(skill) || SYMBOLIC.test(hint || ""));

const STMT = {};                       // statementId -> {text, domain, band, programs}
for (const c of matrix.cells) for (const s of c.statements) STMT[s.id] = { text: s.text, domain: c.domain, band: c.band, programs: s.programs };
const BAND = Object.fromEntries(matrix.bands.map((b) => [b.id, b]));
const segText = (arr) => (Array.isArray(arr) ? arr : [arr]).map((s) => (typeof s === "string" ? s : s?.segs ? segText(s.segs) : `${s?.v ?? ""}`)).join(" ");

function resolveTarget({ statementId, skill, type, figureReq = "none", program = "SAT", varIdx = 0 }) {
  const st = STMT[statementId], tmpl = skills[skill], band = STMT[statementId].band;
  if (!st || !tmpl) throw new Error(`bad target ${statementId}/${skill}`);
  // VARIATION: symbolic skills rotate a STRUCTURAL variant (different ask/manipulation,
  // same contract → still leash-verifiable); contextual skills rotate a real-world
  // scenario. varIdx is a per-skill occurrence counter so successive items differ.
  const vpool = VARIANTS[skill];
  const structure = vpool && vpool.length ? vpool[varIdx % vpool.length] : null;
  const context = isContextual(skill, tmpl.hint) ? CONTEXTS[varIdx % CONTEXTS.length] : null;
  return {
    program, statementId, skill, type, figureReq, domain: tmpl.domain, band,
    scaleRange: BAND[band].label, statementText: st.text, hint: tmpl.hint,
    paramsContract: tmpl.paramsContract, recompute: tmpl.recompute,
    bandLevers: (tmpl.bands[band] || {}).levers || [],
    structure, context,
  };
}

// flattenGrid — a grid file is DOMAIN → subdomains{ key → {label, statements, cells} }.
// Flatten to a single cell list, tagging each cell with its subdomain + the domain levers.
function flattenGrid(grid) {
  const out = [];
  for (const [sd, body] of Object.entries(grid.subdomains || {})) {
    for (const cell of (body.cells || [])) out.push({ ...cell, domain: grid.domain, subdomain: sd, subdomainLabel: body.label, _levers: (grid.levers || {})[cell.band] || [] });
  }
  return out;
}

// resolveGridCell — build a pipeline target from a VARIETY-GRID cell. A cell is
// self-contained (its own band + statement + contract + structural ask + subdomain),
// so it drives generation directly: the (rep × target × form) cell IS the structure.
function resolveGridCell(cell, { levers = cell._levers || [], domain = cell.domain || "algebra", varIdx = 0 } = {}) {
  const st = STMT[cell.statementId];
  if (!st) throw new Error(`grid cell ${cell.key}: unknown statement ${cell.statementId}`);
  const type = cell.type === "both" ? (varIdx % 2 ? "spr" : "mcq") : cell.type;
  const context = cell.contextual ? CONTEXTS[varIdx % CONTEXTS.length] : null;
  return {
    program: "SAT", statementId: cell.statementId, skill: cell.key, type,
    figureReq: cell.figure || "none", domain, subdomain: cell.subdomain, band: cell.band,
    scaleRange: BAND[cell.band].label, statementText: st.text,
    hint: `${cell.rep} → ${cell.target}`, paramsContract: cell.contract, recompute: cell.recompute,
    bandLevers: levers, structure: cell.ask, context,
    rep: cell.rep, targetAxis: cell.target, form: cell.form,
  };
}

// resolveOpenTarget — an OPEN-LANE target: same skill statement + band as a grid
// cell, but no contract/structure (author free to be inventive), gated by deep-verify.
function resolveOpenTarget({ statementId, type = "mcq", subdomain = null, idx = 0, bandLevers = [] }) {
  const st = STMT[statementId];
  if (!st) throw new Error(`open target: unknown statement ${statementId}`);
  return {
    open: true, program: "SAT", statementId, skill: `open_${subdomain || st.domain}_${idx}`, type,
    figureReq: "none", domain: st.domain, subdomain, band: st.band, scaleRange: BAND[st.band].label,
    statementText: st.text, recompute: "needs-deep-verify", bandLevers,
  };
}

function answerValue(item) {
  if (item.type === "spr") return (item.answer?.accept || [])[0];
  const o = (item.options || []).find((x) => x.key === item.answer?.correct);
  return o ? segText(o.seg) : undefined;
}

function deepAgrees(item, v) {
  if (!v || v.verdict === "FAIL" || v.ambiguous === true) return false;
  if (item.type === "mcq") {
    if (v.mcqExactlyOne === false) return false;
    const m = String(v.independentAnswer || "").match(/\b([A-D])\b/);
    if (m && m[1] !== item.answer.correct) return false;
  } else {
    if (v.sprUnique === false) return false;
    try { if (!close(v.independentAnswer, (item.answer.accept || [])[0])) return false; } catch { /* unparseable → rely on verdict */ }
  }
  if (item.figure && v.figureConsistent === false) return false;
  return true;
}

async function generateOne(target, id, ledger, maxRepairs = Number(process.env.SIG_MAX_REPAIRS ?? 2), allowBands = null) {
  const log = [];
  let feedback = null;   // critique→revise: judge's retarget instruction from the last band miss
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    let draft;
    try { draft = await author(target, feedback); }
    catch (e) { log.push(`author failed: ${e.message}`); continue; }

    const item = {
      id, program: target.program, domain: target.domain, band: target.band, target_band: target.band,
      statementId: target.statementId, skill: target.skill, type: target.type,
      stem: draft.stem, solution: draft.solution || [], answer: draft.answer,
      options: draft.options, figure: draft.figure || null, params: draft.params || {},
      spec: draft.spec || {}, figureReq: target.figureReq, tier: "band-targeted",
    };
    item.cellId = cellId(item);

    // 1. recompute leash (independent re-derivation from params)
    const av = answerValue(item);
    const rc = recomputeCheck({ params: item.params, answer: av }, target.recompute);
    // deferred = branch not yet ported (non-Algebra) or qualitative → the blinded
    // deep-verify is the sole correctness gate for these (Algebra is doubly-verified).
    const deferred = rc.deferred || target.recompute === "needs-deep-verify";
    if (!deferred && !rc.verified) { log.push(`[a${attempt}] recompute REJECT: ${rc.errors.join("; ")}`); continue; }

    // 2. figure-math consistency (gate 1)
    const mf = measureFigure(item.figure, item.params, av);
    if (!mf.ok) { log.push(`[a${attempt}] figure-consistency REJECT: ${(mf.errors || []).join("; ")}`); continue; }
    // 2b. structural figure render check (gate 2 stub)
    const fv = await FIGS.verify(item.figure, item);
    if (!fv.ok) { log.push(`[a${attempt}] figure-render REJECT: ${fv.reason}`); continue; }

    // 3. difficulty — ACCEPT iff measured band within ACCEPT_TOL of target (RP67-style).
    // Phase 1 uses ±1 band: the a-priori estimator is uncalibrated, so exact-band
    // (tol 0) would over-reject and waste LLM calls. Phase 2 calibration + judge
    // panel tightens this to tol 0. The exact scalePoint is recorded either way.
    const d = await DIFF.measure(item);   // LLM-judge difficulty (the only estimator)
    // Band gate. drift = measured − target (in band steps). Default is SYMMETRIC ±1
    // (held pending the grid + band-tuning pass). The ASYMMETRIC capability — reject
    // items that measure HARDER than target (set SIG_TOL_UP=0) to stop the upward
    // drift that let B3 targets pass as B4 — is available via env when we tune bands.
    const TOL = Number(process.env.SIG_BAND_TOL ?? 1);
    const tolUp = Number(process.env.SIG_TOL_UP ?? TOL);
    const tolDown = Number(process.env.SIG_TOL_DOWN ?? TOL);
    const drift = DIFF.bandIndex(d.band) - DIFF.bandIndex(target.band);   // + = harder than target
    const inRange = !allowBands || allowBands.includes(d.band);
    if (drift > tolUp || -drift > tolDown || !inRange) {
      log.push(`[a${attempt}] band REJECT: target ${target.band}, measured ${d.band} @${d.scalePoint}${!inRange ? " (out of range)" : drift > tolUp ? " (too hard)" : " (too easy)"}`);
      feedback = await retargetHint(item, target.band, d.band, d.signals?.judge?.perBand);   // judge critique → next attempt
      if (feedback) log.push(`   ↳ retarget: ${feedback.slice(0, 110)}`);
      continue;
    }

    // 4. blinded deep-verify (independent solve from scratch)
    let v;
    try { v = await deepVerify(item); }
    catch (e) { log.push(`[a${attempt}] deep-verify transport failed: ${e.message}`); continue; }
    if (!deepAgrees(item, v)) { log.push(`[a${attempt}] deep-verify REJECT: verdict=${v.verdict} indep=${v.independentAnswer} amb=${v.ambiguous}`); continue; }

    // 5. anti-repeat
    if (!ledger.record(item)) { log.push(`[a${attempt}] duplicate (ledger)`); continue; }

    item.band = d.band;   // the item IS its MEASURED band; target_band keeps provenance
    item.difficulty = { scalePoint: d.scalePoint, band: d.band, se_scale: d.se_scale, pBand: d.pBand, band_ambiguous: d.band_ambiguous, method: d.method, rp67_statement: d.rp67_statement, signals: d.signals, feature_vector: d.feature_vector };
    item.verify = { leash: deferred ? "deferred-to-deep-verify" : "pass", deepVerdict: v.verdict, independentAnswer: String(v.independentAnswer ?? ""), figureVerify: { ok: fv.ok } };
    delete item.figureReq; delete item.spec;
    log.push(`[a${attempt}] ACCEPT @ ${d.scalePoint} (${d.band})`);
    return { item, log };
  }
  return { item: null, log };
}

const PILOT = [
  { statementId: "ALG.B2.s1", skill: "lin_solve_value", type: "spr", figureReq: "none" },
  { statementId: "ALG.B4.s2", skill: "lin_from_2pt", type: "mcq", figureReq: "req" },
  { statementId: "ALG.B6.s2", skill: "system_solve", type: "mcq", figureReq: "none" },
];

// one target per (band × domain) cell — the full 4×7 Skills-Insight matrix.
function matrixTargets() {
  const BANDS = ["B1","B2","B3","B4","B5","B6","B7"], DOMAINS = ["algebra","advanced_math","psda","geometry_trig"];
  const targets = []; let k = 0;
  for (const band of BANDS) for (const domain of DOMAINS) {
    const cell = matrix.cells.find((c) => c.domain === domain && c.band === band);
    let pick = null;
    outer: for (const st of cell.statements) for (const tk of st.templates) {
      const t = skills[tk]; if (!t) continue;
      pick = { st, tk, t };
      if (t.recompute !== "needs-deep-verify") break outer;   // prefer a verifiable template
    }
    const allowed = (pick.st.types || ["mcq"]).filter((x) => (pick.t.types || ["mcq","spr"]).includes(x));
    const type = (allowed.length ? allowed : ["mcq"])[allowed.length > 1 ? (k % 2) : 0];
    targets.push(resolveTarget({ statementId: pick.st.id, skill: pick.tk, type, figureReq: pick.st.figureLoad, program: "SAT" }));
    k++;
  }
  return targets;
}

async function main() {
  const arg = process.argv[2] || "pilot";
  const isMatrix = arg === "matrix";
  const targets = isMatrix ? matrixTargets() : (arg === "pilot" ? PILOT : PILOT.slice(0, Number(arg) || PILOT.length)).map(resolveTarget);
  const ledger = new Ledger(join(ROOT, "data", isMatrix ? "ledger-matrix.json" : "ledger.json"));
  const number = isMatrix ? 81 : 80;
  const title = isMatrix ? "Digital SAT Math — Skills-Insight coverage (all 7 bands × all 4 domains)" : "Algebra · band-targeted pilot (Phase 1)";
  const outPath = join(ROOT, "data", `test-${number}.json`);
  // matrix mode is RESUMABLE: keep already-filled cells, generate only the gaps.
  const questions = (isMatrix && existsSync(outPath)) ? (JSON.parse(readFileSync(outPath, "utf8")).questions || []) : [];
  const covered = new Set(questions.map((q) => (q.target_band || q.band) + "/" + q.domain));
  let id = questions.length ? Math.max(...questions.map((q) => q.id)) + 1 : 1;
  const write = () => writeFileSync(outPath, JSON.stringify({ number, title, questions }, null, 2));
  for (const t of targets) {
    if (isMatrix && covered.has(t.band + "/" + t.domain)) continue;   // cell already filled
    process.stdout.write(`\n● ${t.statementId} ${t.skill} ${t.type} [${t.band}] …`);
    const { item, log } = await generateOne(t, id, ledger);
    log.forEach((l) => process.stdout.write(`\n    ${l}`));
    if (item) { questions.push(item); id++; if (isMatrix) write(); }   // incremental → resumable-ish
  }
  ledger.save();
  write();
  console.log(`\n\n✓ ${questions.length}/${targets.length} accepted → ${outPath}`);
  if (questions.length) {
    const grid = {}; questions.forEach((q) => { (grid[q.difficulty.band] ||= []).push(q.domain.slice(0,3)); });
    console.log("  coverage:", Object.keys(grid).sort().map((b) => `${b}:[${grid[b].join(",")}]`).join("  "));
  }
}
export { generateOne, resolveTarget, resolveGridCell, flattenGrid, resolveOpenTarget };
// run main() only when executed directly (so the demo/tests can import generateOne)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
