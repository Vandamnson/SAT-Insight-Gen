/* diagramgen self-check + render test ($0). Run: node gen/diagramgen.test.mjs */
import { writeFileSync } from "node:fs";
import { buildDiagramItem, DISABLED } from "./diagramgen.mjs";
import { render } from "../figures/index.js";
if (DISABLED) { console.log("diagramgen is DISABLED (SAT-alignment rework pending — see FIGURE-PLAN.md); skipping."); process.exit(0); }

let ok = 0, fail = 0; const samples = [];
for (let i = 0; i < 16; i++) {
  let item; try { item = buildDiagramItem(); } catch (e) { fail++; console.error("  ✗ self-check:", e.message); continue; }
  let svg; try { svg = render(item.figure); } catch (e) { fail++; console.error("  ✗ render:", e.message); continue; }
  const poly = (svg.match(/<polyline/g) || []).length, angles = (svg.match(/circ/g) || []).length;
  if (poly < 1) { fail++; console.error("  ✗ no polygon outline"); continue; }
  ok++; if (samples.length < 5) samples.push(item);
}
const seg = (a) => a.map((s) => s.v || "").join("");
console.log(`diagramgen: ${ok}/${ok + fail} items self-checked + rendered cleanly\n`);
for (const s of samples) {
  console.log("Q:", seg(s.stem));
  console.log(`   answer=${s.answer.accept[0]}°  ${s.meta.N}-gon  x=${s.meta.x}  angles=[${s.params.angles}]  target=∠${s.meta.target}\n`);
}
writeFileSync(new URL("../data/test-diagram.json", import.meta.url),
  JSON.stringify({ number: 91, title: "Novel polygon vertex-angle items (procedural, self-verified)", questions: samples.map((q, i) => ({ id: i + 1, program: "SAT", band: "B7", target_band: "B7", ...q })) }, null, 2));
console.log(`wrote data/test-diagram.json (${samples.length} items)`);
process.exit(fail ? 1 : 0);
