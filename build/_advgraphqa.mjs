/* ============================================================================
   _advgraphqa.mjs — render the banked ADV-2 graph items QUESTION-ONLY (neutral Qids,
   NO answer shown) for a BLIND vision audit, and emit a PRIVATE answer key (NOT shown
   to the agents) for adjudication.  node build/_advgraphqa.mjs [testNum]
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderQuestion, head, foot, FIG_OPT_CSS } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCR = "/private/tmp/claude-501/-Users-vandanpokal/7ddbcd9c-3a2f-46cb-bbd8-2282dd893e0c/scratchpad";
const testNum = Number(process.argv[2] || 109);
const t = JSON.parse(readFileSync(join(ROOT, "data", `test-${testNum}.json`), "utf8"));

const key = {};
const cards = t.questions.map((q, i) => {
  const qid = `Q${String(i + 1).padStart(2, "0")}`;
  // PRIVATE key — never rendered into the page
  key[qid] = {
    task: (q.fingerprint || [])[0], band: q.band, type: q.type,
    answer: q.type === "mcq" ? q.answer.correct : q.answer.accept[0],
    statementId: q.statementId,
    curves: q.figure ? q.figure.spec.curves : (q.options || []).map((o) => o.fig?.spec?.curves),
  };
  // render question-only: renderQuestion shows stem + figure + options/answer-box but NOT the key
  return `<div class="qa" id="${qid}"><div class="qid">${qid}</div>${renderQuestion({ ...q, id: qid })}</div>`;
}).join("\n");

const CSS = `<style>.qa{border:1px solid #d7dde6;border-radius:10px;padding:12px 16px;margin:0 0 22px}.qid{font:700 14px monospace;color:#1e293b;margin-bottom:6px}</style>`;
mkdirSync(join(ROOT, "tests", "figverify"), { recursive: true });
writeFileSync(join(ROOT, "tests", "figverify", "adv-qa.html"), head(`ADV-2 blind QA (test-${testNum})`, 2) + FIG_OPT_CSS + CSS + `<main class="qs">${cards}</main>` + foot(2));
writeFileSync(join(SCR, "adv-qa-key.json"), JSON.stringify(key, null, 2));
console.log(`→ tests/figverify/adv-qa.html · ${t.questions.length} question-only cards`);
console.log(`→ private key → ${SCR}/adv-qa-key.json`);
console.log("  ids:", Object.keys(key).join(" "));
