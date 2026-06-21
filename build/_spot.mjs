// model-first spot-check driver. `node build/_spot.mjs quick` → 1 live item (cheap
// path smoke). `node build/_spot.mjs` → ~8 items spanning bands/subdomains → data/test-97.json.
import { writeFileSync } from "node:fs";
import { generateCell, toRenderItem } from "./pipeline.mjs";

const quick = process.argv[2] === "quick";
const testNum = Number(process.argv[2]) || 97;
const ctr = { i: 0 }, kept = [];

if (quick) {
  kept.push(...await generateCell("algebra", "linear_equations_one_variable", 1, ["B2"], ctr));
} else {
  // run the four subdomain draws concurrently — the LLM transport's global
  // semaphore still caps actual `claude` processes, so this just fills the pool.
  const groups = await Promise.all([
    generateCell("algebra", "linear_equations_one_variable", 3, ["B1", "B3", "B4"], ctr),
    generateCell("algebra", "linear_equations_two_variables", 2, ["B6", "B7"], ctr),
    generateCell("algebra", "systems_of_linear_equations", 2, ["B5", "B7"], ctr),
    generateCell("algebra", "linear_inequalities", 1, ["B5"], ctr),
  ]);
  for (const g of groups) kept.push(...g);
}

const questions = kept.map((s, i) => toRenderItem(s, i + 1));
if (!quick) writeFileSync(`data/test-${testNum}.json`, JSON.stringify({ number: testNum, title: "model-first spot-check (v2: abstract-task + few-shot + phrasing)", questions }, null, 2));

console.log(`\n=== ${quick ? "QUICK SMOKE" : "SPOT-CHECK"}: ${questions.length} item(s) ===`);
for (const q of questions) {
  const stem = q.stem.map((s) => s.v).join("");
  console.log(`\n[${q.band} ${q.skill} ${q.type}]`);
  console.log(`  ${stem}`);
  if (q.options) q.options.forEach((o) => console.log(`    ${o.key}) ${o.seg.map((s) => s.v).join("")}`));
  console.log(`  ANSWER: ${q.type === "mcq" ? q.answer.correct : q.answer.accept.join(" | ")}   verify: ${q.verify.correctness}`);
}
