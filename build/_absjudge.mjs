/* ABSOLUTE authenticity judge — rates each item 1–10 ALONE (no pairing, no "which
   is real"), so it measures authenticity without the recognition confound that the
   matched-pairs judge has (there the judge just recognizes the memorized official).
   Groups: pass test files and/or the literal "official" (= clean CB algebra
   exemplars). Each item is judged blind by a fresh `claude`.
     node build/_absjudge.mjs official data/test-97.json data/test-98.json */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { llmComplete, parseJson } from "./llm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCS = process.argv.slice(2);
if (!SRCS.length) { console.error("usage: node build/_absjudge.mjs <official|test.json> ..."); process.exit(1); }

const texToPlain = (s) => String(s ?? "")
  .replace(/\\\(|\\\)/g, "")
  .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
  .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
  .replace(/\\le(?![a-z])/g, "≤").replace(/\\ge(?![a-z])/g, "≥").replace(/\\neq/g, "≠")
  .replace(/\\ell\b/g, "ℓ").replace(/\\pi\b/g, "π").replace(/\\circ\b/g, "°").replace(/\\%/g, "%")
  .replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();   // KEEP $ (currency)
function figureText(fig) {
  if (fig?.fn !== "table") return "";
  const { headers = [], rows = [] } = fig.spec || {};
  return `\n${headers.join("  |  ")}\n${rows.map((r) => r.join("  |  ")).join("\n")}`;
}
function normalizeOurs(q) {
  const stem = texToPlain(q.stem.map((s) => s.v).join("")) + figureText(q.figure);
  if (q.options) return `${stem}\nAnswer choices: ${q.options.map((o) => texToPlain(o.seg.map((s) => s.v).join(""))).join("  ;  ")}`;
  return stem;
}
function loadGroup(src) {
  if (src === "official") {
    const raw = JSON.parse(readFileSync(join(ROOT, "taxonomy/exemplars.clean.json"), "utf8"));
    const arr = Array.isArray(raw) ? raw : (raw.items || raw.exemplars || Object.values(raw).find(Array.isArray));
    return arr.filter((e) => /alg/i.test(e.domain || "") && e.stem && !/ax\+8|x\+613/.test(e.stem)).map((e) => ({ band: e.band, text: texToPlain(e.stem) }));
  }
  return JSON.parse(readFileSync(join(ROOT, src), "utf8")).questions.filter((q) => q.domain === "algebra").map((q) => ({ band: q.band, text: normalizeOurs(q) }));
}

const SYS = "You are a veteran Digital SAT Math content expert who has reviewed thousands of officially released College Board items.";
const prompt = (item) => `Below is a single Digital SAT Math item. Rate how authentically it reads as an OFFICIALLY RELEASED College Board item — judging by wording, phrasing, scenario realism, and economy. Do NOT judge difficulty, and IGNORE formatting (such as how answer choices are displayed).

ITEM:
${item}

Respond with ONLY this JSON: {"score": 1-10 (10 = indistinguishable from a genuine released item), "why": "one sentence on the main reason"}`;

async function rate(text) { return parseJson(await llmComplete(prompt(text), { system: SYS })); }

async function main() {
  const groups = SRCS.map((src) => ({ src, items: loadGroup(src) }));
  console.log(`\nABSOLUTE AUTHENTICITY — ${groups.map((g) => `${g.src}(${g.items.length})`).join(", ")}\n`);
  const jobs = [];
  groups.forEach((g) => g.items.forEach((it, k) => jobs.push(rate(it.text).then((v) => ({ src: g.src, band: it.band, score: v.score, why: v.why })).catch((e) => ({ src: g.src, band: it.band, err: e.message })))));
  const res = await Promise.all(jobs);
  for (const g of groups) {
    const rs = res.filter((r) => r.src === g.src && !r.err);
    const mean = rs.reduce((a, r) => a + Number(r.score), 0) / (rs.length || 1);
    console.log(`\n■ ${g.src} — mean authenticity ${mean.toFixed(1)}  (n=${rs.length})`);
    rs.sort((a, b) => a.band.localeCompare(b.band)).forEach((r) => console.log(`   ${r.band} ${String(r.score).padStart(2)}  — ${r.why}`));
  }
  console.log(`\n================ SUMMARY ================`);
  for (const g of groups) { const rs = res.filter((r) => r.src === g.src && !r.err); console.log(`  ${g.src.padEnd(22)} mean ${(rs.reduce((a, r) => a + Number(r.score), 0) / (rs.length || 1)).toFixed(1)}`); }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
