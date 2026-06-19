/* ============================================================================
   grid-demo.mjs — generate ONE item per cell of a variety GRID (taxonomy/grids/
   <type>.json) and print them, to demonstrate STRUCTURAL variety within a single
   skill type (different representation × target × form per cell, not renumbered
   reskins). Each item runs the full verified pipeline. Run:
     SIG_PANEL_N=1 SIG_MAX_REPAIRS=1 SIG_POOL=5 node build/grid-demo.mjs [type=linear]
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateOne, resolveGridCell, flattenGrid } from "./generate.mjs";
import { Ledger } from "./ledger.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const type = process.argv[2] || "algebra";
const grid = JSON.parse(readFileSync(join(ROOT, "taxonomy", "grids", `${type}.json`), "utf8"));
const CAP = Number(process.env.SIG_POOL || 5);
const seg = (a) => (Array.isArray(a) ? a : [a]).map((s) => (typeof s === "string" ? s : s?.segs ? seg(s.segs) : (s?.v ?? ""))).join("");

async function pool(tasks, cap) {
  const out = []; let i = 0;
  const w = async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = null; console.log("  cell err:", e.message); } } };
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, w));
  return out;
}

const TYPE_NUM = { algebra: 70, advanced: 71, psda: 72, geometry: 73 };

async function main() {
  const ledger = new Ledger(null);
  const num = TYPE_NUM[type] || 79;
  const out = join(ROOT, "data", `test-${num}.json`);
  const allCells = flattenGrid(grid);   // DOMAIN → subdomain → cells, flattened (each cell carries subdomain + levers)
  // resumable: keep cells already generated (by cell key = item.skill), regenerate only the rest
  const existing = existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")).questions || []) : [];
  const done = new Set(existing.map((q) => q.skill));
  const todo = allCells.map((cell, i) => ({ cell, i })).filter(({ cell }) => !done.has(cell.key));
  console.log(`Variety grid: ${type} — ${allCells.length} cells across ${Object.keys(grid.subdomains).length} subdomains (${existing.length} done, ${todo.length} to go), ${CAP} parallel\n`);
  const tasks = todo.map(({ cell, i }) => async () => {
    const target = resolveGridCell(cell, { varIdx: i });
    const { item, log } = await generateOne(target, i + 1, ledger, Number(process.env.SIG_MAX_REPAIRS ?? 1));
    return { cell, item, log };
  });
  const res = await pool(tasks, CAP);
  const items = [...existing];
  for (const r of res) {
    if (!r) continue;
    const { cell, item, log } = r;
    if (!item) { console.log(`✗ ${cell.key.padEnd(26)} ${cell.band}  HOLE — ${log[log.length - 1] || "?"}`); continue; }
    items.push(item);
    const ans = item.type === "mcq"
      ? `${item.answer.correct}) ${seg((item.options.find((o) => o.key === item.answer.correct) || {}).seg)}`
      : (item.answer.accept || []).join("|");
    console.log(`\n✓ ${cell.key}  [target ${cell.band} → measured ${item.difficulty.band} @${item.difficulty.scalePoint}]  ${cell.rep} → ${cell.target} (${cell.form})`);
    console.log(`   Q: ${seg(item.stem).slice(0, 240)}`);
    console.log(`   A: ${String(ans).slice(0, 90)}   [leash ${item.verify.leash}, deep ${item.verify.deepVerdict}${item.figure ? ", fig " + item.figure.fn : ""}]`);
  }
  items.forEach((it, i) => (it.id = i + 1));
  writeFileSync(out, JSON.stringify({ number: num, title: `Variety grid demo — ${type} (one item per cell)`, questions: items }, null, 2));
  console.log(`\n${items.length}/${allCells.length} cells produced an item → ${out}  (render: node build/render.mjs)`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
