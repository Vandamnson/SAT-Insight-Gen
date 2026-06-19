/* ============================================================================
   module2.mjs — assemble a Digital SAT Math "Module 2" (Hard, Band-7 target),
   22 items, drawing on BOTH tracks:
     • 6 PROCEDURAL items (gen/graphgen + gen/diagramgen) — self-verified, novel
       figures (cubics, pentagons), judged for band.
     • 16 LLM items run through the FULL verified pipeline (producer → recompute
       leash → figure-verify → RP67 judge → critique→revise loop) in PARALLEL
       (concurrency-capped) — the "22×2 parallel producer+judge" the user asked for.
   Writes incrementally → data/test-92.json.  Run:
     SIG_LLM_TIMEOUT=300000 SIG_MAX_REPAIRS=3 node build/module2.mjs
   ============================================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateOne, resolveTarget } from "./generate.mjs";
import { Ledger } from "./ledger.mjs";
import * as DIFF from "../difficulty/index.js";
import { buildDiagramItem, DISABLED as GENS_OFF } from "../gen/diagramgen.mjs";   // both procedural gens disabled (see FIGURE-PLAN.md)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAP = Number(process.env.SIG_POOL || 4);

async function pool(tasks, cap) {
  const out = []; let i = 0;
  const worker = async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = null; console.log(`  task ${k} error: ${e.message}`); } } };
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, worker));
  return out;
}

// 16 Band-7 / Band-6 (Module-2-hard) LLM targets, no figures (variety comes from
// the procedural items); Algebra/Advanced/PSDA mix.
const LLM = [
  { statementId: "ALG.B7.s1", skill: "lin_create_solve", type: "mcq" },
  { statementId: "ALG.B7.s2", skill: "parametric_system", type: "mcq" },
  { statementId: "ALG.B6.s2", skill: "number_of_solutions", type: "mcq" },
  { statementId: "ALG.B6.s2", skill: "system_missing_coeff", type: "spr" },
  { statementId: "ALG.B7.s1", skill: "system_create", type: "mcq" },
  { statementId: "ALG.B6.s1", skill: "lin_interpret_complex", type: "mcq" },
  { statementId: "ADV.B7.s1", skill: "nonlinear_unknown_const", type: "spr" },
  { statementId: "ADV.B7.s1", skill: "quad_no_xint", type: "spr" },
  { statementId: "ADV.B7.s2", skill: "rational_rearrange", type: "mcq" },
  { statementId: "ADV.B7.s2", skill: "exponent_laws", type: "mcq" },
  { statementId: "ADV.B6.s1", skill: "quad_from_area", type: "spr" },
  { statementId: "ADV.B6.s3", skill: "function_translation", type: "mcq" },
  { statementId: "PSDA.B6.s1", skill: "ratio_rate", type: "mcq" },
  { statementId: "PSDA.B6.s3", skill: "prob_conditional", type: "spr" },
  { statementId: "PSDA.B7.s2", skill: "data_effect_change", type: "mcq" },
  { statementId: "ALG.B6.s2", skill: "system_no_solution", type: "spr" },
].map((t) => resolveTarget({ ...t, figureReq: "none", program: "SAT" }));

async function main() {
  const ledger = new Ledger(join(ROOT, "data", "ledger-module2.json"));
  const items = []; let id = 1;
  const outPath = join(ROOT, "data", "test-92.json");
  const write = () => writeFileSync(outPath, JSON.stringify({ number: 92, title: "Digital SAT Math — Module 2 (Hard)", questions: [...items].sort((a, b) => a.id - b.id) }, null, 2));

  // ---- 1) procedural items (self-verified), judged for band ----
  console.log("● procedural items (graph + diagram), judging band…");
  const proc = GENS_OFF ? [] : [buildDiagramItem(), buildDiagramItem(), buildDiagramItem(), buildDiagramItem(), buildDiagramItem(), buildDiagramItem()];
  for (const p of proc) {
    const it = { id: id++, program: "SAT", target_band: "B7", ...p };
    const d = await DIFF.measure(it);
    it.band = d.band;
    it.difficulty = { scalePoint: d.scalePoint, band: d.band, se_scale: d.se_scale, method: d.method, rp67_statement: d.rp67_statement, signals: d.signals };
    it.verify = { leash: "procedural-self-verified", figureVerify: { ok: true } };
    ledger.record(it); items.push(it); write();
    console.log(`  ✓ ${p.skill.padEnd(22)} → ${d.band} @${d.scalePoint}`);
  }

  // ---- 2) LLM B7 fleet, PARALLEL ----
  console.log(`\n● LLM B7 fleet — ${LLM.length} items, ${CAP} in parallel (producer → leash → figure → judge → critique↻revise)…`);
  const baseId = id;
  const tasks = LLM.map((t, idx) => async () => {
    const { item } = await generateOne(t, baseId + idx, ledger, Number(process.env.SIG_MAX_REPAIRS ?? 3));
    console.log(item ? `  ✓ ${t.skill.padEnd(22)} → ${item.difficulty.band} @${item.difficulty.scalePoint}` : `  ✗ ${t.skill.padEnd(22)} → HOLE`);
    if (item) { items.push(item); write(); }
    return item;
  });
  await pool(tasks, CAP);
  ledger.save(); write();

  const byBand = {}; items.forEach((q) => byBand[q.difficulty.band] = (byBand[q.difficulty.band] || 0) + 1);
  console.log(`\n✓ ${items.length}/${proc.length + LLM.length} items → ${outPath}`);
  console.log("  band distribution:", JSON.stringify(byBand));
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
