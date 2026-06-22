// offline self-test for the construct-backward graph generator — no LLM, no cost.
import { drawGraphItem, GRAPH_TASKS } from "./graph.mjs";

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const onAnyCurve = (curves, x, y) => curves.some((c) => c.m !== undefined && Math.abs(c.m * x + c.b - y) < 1e-9);

let n = 0, exc = 0, badPt = 0, badMcq = 0, badSpr = 0;
const fps = {}; const samples = [];
for (const task of GRAPH_TASKS) {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const r = rng(`${task}|${i}`);
    let it;
    try { it = drawGraphItem(task, 5, r); } catch (e) { exc++; console.error(`EXC ${task}#${i}: ${e.message}`); continue; }
    n++;
    const curves = it.figure?.spec?.curves || [];
    if (!curves.length || curves.some((c) => c.type !== "line" || typeof c.m !== "number")) { badPt++; console.error(`BAD CURVES ${task}#${i}`); }
    for (const p of (it.figure.spec.points || [])) if (!onAnyCurve(curves, p.at[0], p.at[1])) { badPt++; console.error(`OFF-CURVE ${task}#${i}: ${JSON.stringify(p.at)}`); }
    if (it.format === "mcq") {
      const ch = it.choices || [];
      const uniq = new Set(ch).size;
      const idx = "ABCD".indexOf(it.correct_choice);
      if (ch.length !== 4 || uniq !== 4 || idx < 0 || ch[idx] !== it.answer) { badMcq++; console.error(`BAD MCQ ${task}#${i}: len=${ch.length} uniq=${uniq} cc=${it.correct_choice} ans=${it.answer} :: ${JSON.stringify(ch)}`); }
    } else {
      if (!it.answer || /\\\(|\\\)/.test(it.answer)) { badSpr++; console.error(`BAD SPR ANSWER ${task}#${i}: ${it.answer}`); }
    }
    const fp = (it.fingerprint || []).join(">"); fps[fp] = (fps[fp] || 0) + 1; seen.add(fp);
    if (samples.length < 7 && i === 3) samples.push(it);
  }
  console.log(`${task.padEnd(20)} distinct fingerprints over 50 draws: ${seen.size}`);
}
console.log(`\ndrawn=${n} exceptions=${exc} badPoints=${badPt} badMcq=${badMcq} badSpr=${badSpr}`);
console.log(`total distinct fingerprints: ${Object.keys(fps).length}`);
console.log("\n--- one sample per task ---");
for (const s of samples) {
  console.log(`\n[${s.task} ${s.format || "spr"}] ${s.statement}`);
  if (s.choices) s.choices.forEach((c, i) => console.log(`   ${"ABCD"[i]}${s.correct_choice === "ABCD"[i] ? "*" : " "}) ${c}`));
  console.log(`   answer: ${s.answer}   fp: ${(s.fingerprint || []).join(">")}`);
  console.log(`   figure: ${s.figure.spec.curves.length} curve(s)${s.figure.spec.shaded ? " + shaded" : ""}${s.figure.spec.points ? " + " + s.figure.spec.points.length + " pt" : ""}  window x${JSON.stringify(s.figure.spec.xRange)} y${JSON.stringify(s.figure.spec.yRange)}`);
}
