/* graphgen self-check + render test ($0). Run: node gen/graphgen.test.mjs */
import { writeFileSync } from "node:fs";
import { buildGraphItem, DISABLED } from "./graphgen.mjs";
import { render } from "../figures/index.js";
if (DISABLED) { console.log("graphgen is DISABLED (SAT-alignment rework pending — see FIGURE-PLAN.md); skipping."); process.exit(0); }

let ok = 0, fail = 0; const samples = [];
for (let i = 0; i < 16; i++) {
  let item;
  try { item = buildGraphItem(); } catch (e) { fail++; console.error("  ✗ self-check:", e.message); continue; }
  let svg; try { svg = render(item.figure); } catch (e) { fail++; console.error("  ✗ render:", e.message); continue; }
  const curves = (svg.match(/<polyline/g) || []).length;
  if (curves < 2) { fail++; console.error(`  ✗ expected ≥2 curves, got ${curves}`); continue; }
  ok++; if (samples.length < 5) samples.push(item);
}
const seg = (a) => a.map((s) => s.v || "").join("");
console.log(`graphgen: ${ok}/${ok + fail} items self-checked + rendered cleanly\n`);
for (const s of samples) {
  console.log("Q:", seg(s.stem));
  console.log(`   answer=${s.answer.accept[0]}  roots=[${s.meta.roots}]  ask=${s.meta.ask}  f deg ${s.meta.fDeg}, g deg ${s.meta.gDeg}\n`);
}
writeFileSync(new URL("../data/test-graph.json", import.meta.url),
  JSON.stringify({ number: 90, title: "Novel graph-intersection items (procedural, self-verified)", questions: samples.map((q, i) => ({ id: i + 1, program: "SAT", band: "B7", target_band: "B7", ...q })) }, null, 2));
console.log(`wrote data/test-graph.json (${samples.length} items)`);
process.exit(fail ? 1 : 0);
