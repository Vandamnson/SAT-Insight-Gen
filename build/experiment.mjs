/* ============================================================================
   experiment.mjs — paired A/B to test whether the GRID's specificity caps the
   generator. For each of N cells in a subdomain, generate the SAME skill+band
   two ways: GRID (specific cell + params contract + recompute leash) vs OPEN
   (rubric statement only + "be a hard, inventive SAT item", deep-verify only).
   Prints side by side; writes test-74 (grid) / test-75 (open) for rendering.
   Run: SIG_PANEL_N=1 SIG_MAX_REPAIRS=1 SIG_LLM_CONCURRENCY=3 \
        node build/experiment.mjs [domain=advanced] [subdomain=nonlinear_functions] [n=5]
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateOne, resolveGridCell, resolveOpenTarget, flattenGrid } from "./generate.mjs";
import { llmComplete, parseJson } from "./llm.mjs";
import { Ledger } from "./ledger.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const domain = process.argv[2] || "advanced";
const subdomain = process.argv[3] || "nonlinear_equations_systems";
const N = Number(process.argv[4] || 8);
const grid = JSON.parse(readFileSync(join(ROOT, "taxonomy", "grids", `${domain}.json`), "utf8"));
const seg = (a) => (Array.isArray(a) ? a : [a]).map((s) => (typeof s === "string" ? s : s?.segs ? seg(s.segs) : (s?.v ?? ""))).join("");
const stem = (it) => seg(it.stem).replace(/\s+/g, " ").trim();

async function pool(tasks, cap) {
  const out = []; let i = 0;
  const w = async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = null; } } };
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, w));
  return out;
}

// Blind head-to-head reviewer: scores both sets on richness / variety / SAT-realism.
// Run twice with arms swapped to cancel position bias; the caller averages.
async function review(setA, setB) {
  const fmt = (items) => items.map((it, i) => `${i + 1}. ${stem(it)}  [ans: ${it.type === "mcq" ? it.answer.correct : (it.answer.accept || []).join("|")}]`).join("\n");
  const base = `You are a critical Digital SAT Math item reviewer. Two item generators produced problems for the SAME set of skills. Judge how authentic and strong each SET is as HARD Digital SAT Math.

SET A:
${fmt(setA)}

SET B:
${fmt(setB)}

Score each set 1–10 on:
- richness: multi-step / blends concepts / non-obvious setup (vs single-step, canonical, "plug-in")
- variety: structural diversity ACROSS the set (vs the same shape with different numbers)
- realism: reads like a real released hard SAT item (numbers, phrasing, framing)
Be critical and discriminating — do not give both sets the same scores unless they truly earn it.`;
  const schema = `Return ONLY one JSON object: {"A":{"richness":n,"variety":n,"realism":n},"B":{"richness":n,"variety":n,"realism":n},"winner":"A"|"B"|"tie","why":"..."}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const strict = attempt ? `\n\nIMPORTANT: output ONLY a single-line minified JSON object — no prose, no markdown, and keep "why" short with NO quotation marks inside it.` : "";
    const raw = await llmComplete(`${base}\n${schema}${strict}`, { system: "You are a meticulous, critical SAT item reviewer. Return only one JSON object." });
    try { return parseJson(raw); } catch (e) { if (attempt) throw e; }
  }
}

async function main() {
  const cells = flattenGrid(grid).filter((c) => c.subdomain === subdomain).slice(0, N);
  if (!cells.length) { console.error(`no cells for ${domain}/${subdomain}`); process.exit(1); }
  console.log(`A/B experiment — ${domain} / ${subdomain}: ${cells.length} pairs (GRID vs OPEN), matched skill+band\n`);
  const ledgerG = new Ledger(null), ledgerO = new Ledger(null);
  const tasks = [];
  const repairs = Number(process.env.SIG_MAX_REPAIRS ?? 2);
  cells.forEach((cell, i) => {
    const type = cell.type === "both" ? "mcq" : cell.type;
    tasks.push(async () => ({ arm: "grid", i, res: await generateOne(resolveGridCell(cell, { varIdx: i }), i + 1, ledgerG, repairs) }));
    tasks.push(async () => ({ arm: "open", i, res: await generateOne(resolveOpenTarget({ statementId: cell.statementId, type, subdomain, idx: i, bandLevers: cell._levers }), 100 + i, ledgerO, repairs) }));
  });
  const out = await pool(tasks, Number(process.env.SIG_POOL || 4));
  const pairs = cells.map((c) => ({ cell: c, grid: null, gridLog: null, open: null, openLog: null }));
  for (const o of out) if (o && o.res) { pairs[o.i][o.arm] = o.res.item; pairs[o.i][o.arm + "Log"] = o.res.log; }

  const gridItems = [], openItems = [];
  for (const p of pairs) {
    console.log(`\n──── ${p.cell.statementId} [${p.cell.band}] · ${p.cell.key} ────`);
    for (const arm of ["grid", "open"]) {
      const it = p[arm];
      if (!it) { const lg = p[arm + "Log"] || []; console.log(`  ${arm.toUpperCase()}: (hole) — ${lg[lg.length - 1] || "no attempts"}`); continue; }
      (arm === "grid" ? gridItems : openItems).push(it);
      const leashed = it.verify.leash === "pass";
      console.log(`  ${arm.toUpperCase()} [${it.difficulty.band}@${it.difficulty.scalePoint}] verify: ${leashed ? "LEASH+deep" : "deep-only"} (${it.verify.deepVerdict})`);
      console.log(`    ${stem(it).slice(0, 240)}`);
    }
  }
  writeFileSync(join(ROOT, "data", "test-74.json"), JSON.stringify({ number: 74, title: `A/B GRID arm — ${domain}/${subdomain}`, questions: gridItems.map((q, i) => ({ ...q, id: i + 1 })) }, null, 2));
  writeFileSync(join(ROOT, "data", "test-75.json"), JSON.stringify({ number: 75, title: `A/B OPEN arm — ${domain}/${subdomain}`, questions: openItems.map((q, i) => ({ ...q, id: i + 1 })) }, null, 2));
  const lG = gridItems.filter((x) => x.verify.leash === "pass").length;
  console.log(`\nGRID: ${gridItems.length}/${cells.length} items, ${lG} leash-double-verified`);
  console.log(`OPEN: ${openItems.length}/${cells.length} items, deep-verify only`);

  if (gridItems.length && openItems.length) try {
    console.log("\n● blind head-to-head review (2 orderings, to cancel position bias)…");
    const [r1, r2] = await Promise.all([review(gridItems, openItems), review(openItems, gridItems)]);
    const g = { richness: (r1.A.richness + r2.B.richness) / 2, variety: (r1.A.variety + r2.B.variety) / 2, realism: (r1.A.realism + r2.B.realism) / 2 };
    const o = { richness: (r1.B.richness + r2.A.richness) / 2, variety: (r1.B.variety + r2.A.variety) / 2, realism: (r1.B.realism + r2.A.realism) / 2 };
    const avg = (s) => ((s.richness + s.variety + s.realism) / 3).toFixed(1);
    console.log("\n═════════ REVIEWER VERDICT (avg of 2 orderings) ═════════");
    console.log(`  GRID  richness ${g.richness.toFixed(1)} · variety ${g.variety.toFixed(1)} · realism ${g.realism.toFixed(1)}  →  ${avg(g)}`);
    console.log(`  OPEN  richness ${o.richness.toFixed(1)} · variety ${o.variety.toFixed(1)} · realism ${o.realism.toFixed(1)}  →  ${avg(o)}`);
    console.log(`  • order1 (grid=A): winner ${r1.winner === "A" ? "GRID" : r1.winner === "B" ? "OPEN" : "tie"} — ${r1.why}`);
    console.log(`  • order2 (open=A): winner ${r2.winner === "A" ? "OPEN" : r2.winner === "B" ? "GRID" : "tie"} — ${r2.why}`);
  } catch (e) { console.log(`  (reviewer skipped: ${e.message} — items still saved; render and inspect)`); }
  console.log(`\n→ data/test-74.json (grid) · data/test-75.json (open) · render: node build/render.mjs`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
