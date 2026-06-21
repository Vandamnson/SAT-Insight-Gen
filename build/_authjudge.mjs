/* blind matched-pairs AUTHENTICITY judge. Pairs each generated algebra item with an
   official College Board Skills-Insight exemplar at the SAME band, shows both to a
   fresh `claude` (no project context) in BOTH orderings to cancel position bias, and
   asks which is the genuine released item + an authenticity score. The judge is told
   to weigh WORDING / SCENARIO REALISM and ignore formatting — targeting the prior
   tell ("contrived contexts"). Lower identification accuracy (→50% = chance) and a
   higher score-for-ours both mean the model-first fix worked.
     node build/_authjudge.mjs [testFile] [maxPairs] */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { llmComplete, parseJson } from "./llm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST = process.argv[2] || "data/test-97.json";
const MAX_PAIRS = Number(process.argv[3] || 8);

// strip LaTeX to readable plain text so a \(...\) span can't give our item away.
const texToPlain = (s) => String(s ?? "")
  .replace(/\\\(|\\\)/g, "")
  .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
  .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
  .replace(/\\le(?![a-z])/g, "≤").replace(/\\ge(?![a-z])/g, "≥").replace(/\\neq/g, "≠")
  .replace(/\\ell\b/g, "ℓ").replace(/\\pi\b/g, "π").replace(/\\circ\b/g, "°").replace(/\\%/g, "%")
  .replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();   // KEEP $ (currency)

// a table figure lives outside the stem — fold it back in as text so the judge
// sees a COMPLETE item (otherwise our table items look truncated = unfair tell).
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
const normalizeOfficial = (e) => texToPlain(e.stem);

const SYS = "You are a veteran Digital SAT Math content expert who has reviewed thousands of officially released College Board items.";
const judgePrompt = (a, b) => `Below are two Digital SAT Math items, ITEM 1 and ITEM 2. Exactly ONE is a genuine, officially released College Board SAT item; the OTHER was produced by an automated item generator.

Judge primarily by WORDING, SCENARIO REALISM, and PHRASING — how a real released item actually reads. IGNORE superficial formatting (such as whether/how the answer choices are displayed); that is not evidence.

ITEM 1:
${a}

ITEM 2:
${b}

Respond with ONLY this JSON, no prose:
{"real": 1 or 2 (which item is the genuine released SAT item), "confidence": 0-100, "score1": 1-10 (how authentically ITEM 1 reads as a released item), "score2": 1-10, "tell": "the single biggest giveaway you used"}`;

async function judgeOnce(itemA, itemB) {
  const raw = await llmComplete(judgePrompt(itemA, itemB), { system: SYS });
  return parseJson(raw);
}

async function main() {
  const ours = JSON.parse(readFileSync(join(ROOT, TEST), "utf8")).questions.filter((q) => q.domain === "algebra");
  const exAll = JSON.parse(readFileSync(join(ROOT, "taxonomy/exemplars.clean.json"), "utf8"));
  const exArr = Array.isArray(exAll) ? exAll : (exAll.items || exAll.exemplars || Object.values(exAll).find(Array.isArray));
  const officialByBand = {};
  for (const e of exArr.filter((e) => /alg/i.test(e.domain || ""))) (officialByBand[e.band] ||= []).push(e);
  const cursor = {};

  // build same-band pairs (nearest band if exact is missing)
  const bandsAvail = Object.keys(officialByBand);
  const nearestBand = (b) => { const n = +b.slice(1); return bandsAvail.map((x) => [x, Math.abs(+x.slice(1) - n)]).sort((p, q) => p[1] - q[1])[0][0]; };
  const pairs = [];
  for (const q of ours.slice(0, MAX_PAIRS)) {
    const band = officialByBand[q.band] ? q.band : nearestBand(q.band);
    const pool = officialByBand[band]; cursor[band] = (cursor[band] || 0);
    const off = pool[cursor[band] % pool.length]; cursor[band]++;
    pairs.push({ band: q.band, offBand: band, ours: normalizeOurs(q), official: normalizeOfficial(off), label: `${q.band} ${q.skill} ${q.type}` });
  }

  console.log(`\nBLIND AUTHENTICITY JUDGE — ${pairs.length} matched pairs, both orderings (${2 * pairs.length} judgments)\n`);
  const jobs = [];
  pairs.forEach((p, i) => {
    // ordering 1: official = ITEM 1, ours = ITEM 2
    jobs.push(judgeOnce(p.official, p.ours).then((v) => ({ i, order: "O1=official", caughtOfficial: v.real === 1, sOurs: v.score2, sOff: v.score1, tell: v.tell, conf: v.confidence })).catch((e) => ({ i, err: e.message })));
    // ordering 2: ours = ITEM 1, official = ITEM 2
    jobs.push(judgeOnce(p.ours, p.official).then((v) => ({ i, order: "O2=ours", caughtOfficial: v.real === 2, sOurs: v.score1, sOff: v.score2, tell: v.tell, conf: v.confidence })).catch((e) => ({ i, err: e.message })));
  });
  const res = await Promise.all(jobs);

  let caught = 0, nOk = 0, sumOurs = 0, sumOff = 0;
  const tells = [];
  for (const p of pairs) {
    const mine = res.filter((r) => r.i === pairs.indexOf(p) && !r.err);
    for (const r of mine) { nOk++; if (r.caughtOfficial) caught++; sumOurs += r.sOurs; sumOff += r.sOff; if (r.tell) tells.push(`[${p.label}] ${r.tell}`); }
    const c = mine.map((r) => `${r.order}: caught_official=${r.caughtOfficial} ours=${r.sOurs} off=${r.sOff}`).join("  |  ");
    console.log(`• ${p.label}  (vs official ${p.offBand})\n    ${c}`);
  }
  console.log(`\n================ AGGREGATE (n=${nOk} judgments) ================`);
  console.log(`identification accuracy (judge picked the OFFICIAL as real): ${(100 * caught / nOk).toFixed(0)}%   [50% = indistinguishable = best; prior = 100%]`);
  console.log(`mean authenticity score — OURS: ${(sumOurs / nOk).toFixed(1)}   OFFICIAL: ${(sumOff / nOk).toFixed(1)}   [prior ours 4.1 vs 8.1]`);
  console.log(`\nTELLS the judge cited:`);
  tells.slice(0, 16).forEach((t) => console.log(`   - ${t}`));
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
