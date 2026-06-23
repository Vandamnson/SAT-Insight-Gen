/* ============================================================================
   render.mjs — deterministic build. Reads data/test-NN.json (the question
   model) and emits the Slate site: tests/test-NN/index.html (interactive),
   tests/test-NN/solutions.html (key + worked solutions), and the root index.html.
   Math is rendered with KaTeX at BUILD TIME so pages need no JS to display it.

   Usage:
     node render.mjs                # render all data/*.json
     node render.mjs ../data/test-fixture.json   # render one file
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import katex from "katex";
import * as FIG from "../figures/figures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const TESTS = join(ROOT, "tests");

let MATH_ERRORS = [];
let FIG_ERRORS = [];

/* ---- math + segment rendering ------------------------------------------- */
function tex(s, display = false) {
  try {
    return katex.renderToString(s, {
      displayMode: display, throwOnError: false, strict: "ignore",
      errorColor: "var(--ink)", trust: false,
    });
  } catch (e) {
    MATH_ERRORS.push({ s, err: e.message });
    return `<span class="math-err">${escapeHtml(s)}</span>`;
  }
}
const escapeHtml = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// a segment is {t:'text'|'math'|'money'|'mathblock', v:'...'}
// a plain string is treated as text.
function seg(s) {
  if (typeof s === "string") return escapeHtml(s);
  switch (s.t) {
    case "text": return escapeHtml(s.v);
    case "math": return tex(s.v, false);
    case "mathblock": return `<div class="eqn math-scroll">${tex(s.v, true)}</div>`;
    case "money": return escapeHtml(s.v);   // literal "$3.50" — never KaTeX
    case "br": return "<br>";
    default: return escapeHtml(s.v || "");
  }
}
// Join segments, inserting a space at inline-math↔text boundaries that lack one
// (so "value of"+math("y")+"in" renders "value of y in", not "value ofyin"),
// while never adding a space next to punctuation or an opening bracket.
const _textEdge = (x) => (typeof x === "string" ? x : (x.t === "text" || x.t === "money") ? (x.v || "") : null);
const _isInlineMath = (x) => typeof x === "object" && x && x.t === "math";
function _needsSpace(left, right) {
  const lInline = _isInlineMath(left), rInline = _isInlineMath(right);
  if (lInline === rInline) return false;                  // both math or both text → author controls
  if (lInline) {                                          // math then text
    const rt = _textEdge(right); if (!rt) return false;
    const c = rt[0];
    // also suppress before a hyphen: math("xy")+text("-plane") → "xy-plane", not "xy -plane"
    return !(/\s/.test(c) || ")]},.?!;:%°'\"-".includes(c));
  }
  const lt = _textEdge(left); if (!lt) return false;       // text then math
  const c = lt[lt.length - 1];
  return !(/\s/.test(c) || "([{$".includes(c));
}
function segs(arr) {
  const items = Array.isArray(arr) ? arr : [arr];
  let out = "", prev = null;
  for (const s of items) { if (prev !== null && _needsSpace(prev, s)) out += " "; out += seg(s); prev = s; }
  return out;
}
// stem: array of paragraphs OR flat segment array. We support paragraphs via {t:'p',segs:[...]}.
function renderStem(stem) {
  if (Array.isArray(stem) && stem.some(x => x && x.t === "p")) {
    return stem.map(b => b.t === "p" ? `<p>${segs(b.segs)}</p>` : seg(b)).join("");
  }
  return `<p>${segs(stem)}</p>`;
}

/* ---- figure ------------------------------------------------------------- */
function renderFigure(fig) {
  if (!fig) return "";
  const fn = FIG[fig.fn] || (FIG.default && FIG.default[fig.fn]);
  if (!fn) { console.warn("unknown figure fn:", fig.fn); return ""; }
  let inner;
  try { inner = fn(fig.spec); }
  catch (e) { console.warn(`figure ${fig.fn} threw: ${e.message} — degrading to no figure`); FIG_ERRORS.push({ fn: fig.fn, err: e.message }); return ""; }
  if (!inner) return "";
  const cap = [];
  if (fig.caption) cap.push(fig.caption);
  if (fig.note) cap.push(fig.note);
  const caption = cap.length ? `<figcaption>${cap.map(escapeHtml).join(" · ")}</figcaption>` : "";
  // tables return <table>, others return <svg>
  return `<figure class="q-fig">${inner}${caption}</figure>`;
}

/* ---- one question on the test page -------------------------------------- */
const TAGS = { algebra: "Algebra", advanced_math: "Advanced Math", psda: "Data Analysis", geometry_trig: "Geometry & Trig" };

function renderQuestion(q) {
  const cellBand = (q.target_band || q.band || "").slice(1);
  const meas = q.difficulty ? ` · measured ~${q.difficulty.scalePoint} (B${q.difficulty.band.slice(1)})` : "";
  const bandTxt = cellBand ? ` · Band ${cellBand}${meas}` : "";
  const tag = q.skill ? `<span class="q-tag">${escapeHtml((TAGS[q.domain] || q.domain || "") + bandTxt)}</span>` : "";
  let body = `<div class="q-num">${q.id}</div>${tag}<div class="stem">${renderStem(q.stem)}</div>`;
  body += renderFigure(q.figure);
  if (q.type === "mcq") {
    const figOpts = (q.options || []).some(o => o.fig);   // "which graph" — each option is a figure
    if (figOpts) {
      const opts = q.options.map(o => `
        <li><button class="opt opt-fig" role="radio" aria-checked="false" data-key="${o.key}">
          <span class="chip">${o.key}</span>
          <span class="ofig">${renderFigure(o.fig)}</span>
          <span class="verdict"></span>
        </button></li>`).join("");
      body += `<ol class="opts fig-opts" role="radiogroup" aria-label="answer choices">${opts}</ol>`;
    } else {
      const twoCol = (q.options || []).every(o => textLen(o.seg) <= 14) ? " two-col" : "";
      const opts = q.options.map(o => `
        <li><button class="opt" role="radio" aria-checked="false" data-key="${o.key}">
          <span class="chip">${o.key}</span>
          <span class="otxt">${segs(o.seg)}</span>
          <span class="verdict"></span>
        </button></li>`).join("");
      body += `<ol class="opts${twoCol}" role="radiogroup" aria-label="answer choices">${opts}</ol>`;
    }
    body += `<div class="answer">Correct answer: <b>${q.answer.correct}</b> · <a href="solutions.html#q${q.id}">See worked solution →</a></div>`;
  } else {
    const accept = (q.answer.accept || []).join("  ·  ");
    body += `<div class="spr">
      <label for="spr-${q.id}">Your answer</label>
      <input id="spr-${q.id}" inputmode="text" autocomplete="off" spellcheck="false"
             data-accept='${escapeAttr(JSON.stringify(q.answer.accept || []))}' ${q.answer.tol ? `data-tol="${q.answer.tol}"` : ""}>
      <div class="reveal-answer">Accepted answer${(q.answer.accept || []).length > 1 ? "s" : ""}: <b>${escapeHtml(accept)}</b> · <a href="solutions.html#q${q.id}">See worked solution →</a></div>
    </div>`;
  }
  return `<article class="q" id="q${q.id}" data-type="${q.type}"${q.type === "mcq" ? ` data-correct="${q.answer.correct}"` : ""}>${body}</article>`;
}
function textLen(arr) { return (Array.isArray(arr) ? arr : [arr]).reduce((a, s) => a + (typeof s === "string" ? s.length : (s.v || "").length), 0); }
const escapeAttr = (s) => String(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

/* ---- one worked solution ------------------------------------------------ */
function renderSolution(q) {
  const finalTxt = q.type === "mcq"
    ? `Answer: <b>${q.answer.correct}</b>`
    : `Answer: <b>${escapeHtml((q.answer.accept || [])[0] || "")}</b>`;
  const restate = q.restate ? `<div class="restate">${segs(q.restate)}</div>` : "";
  return `<article class="sol" id="q${q.id}">
    <div class="q-num">${q.id}</div>
    ${restate}
    <div class="work">${renderStem(q.solution)}</div>
    <div class="final">${finalTxt}</div>
  </article>`;
}

/* ---- page shells -------------------------------------------------------- */
const V = "6";   // asset cache-busting version — bump when CSS/JS change
// "which graph" items: lay the four option figures out in a 2×2 grid.
const FIG_OPT_CSS = `<style>
.opts.fig-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;list-style:none;padding:0;margin:1rem 0}
.opts.fig-opts .opt{display:flex;align-items:flex-start;gap:8px;width:100%;height:100%;text-align:left}
.opts.fig-opts .ofig{flex:1;min-width:0}
.opts.fig-opts .ofig .q-fig{margin:0}
.opts.fig-opts .ofig svg{width:100%;height:auto;display:block}
@media (max-width:540px){.opts.fig-opts{grid-template-columns:1fr}}
</style>`;
function head(title, depth) {
  const up = "../".repeat(depth);
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${up}assets/katex/katex.min.css">
<link rel="stylesheet" href="${up}assets/theme.css?v=${V}">
<link rel="stylesheet" href="${up}assets/base.css?v=${V}">
<link rel="stylesheet" href="${up}assets/print.css?v=${V}">
</head><body><div class="wrap">`;
}
const foot = (depth) => `</div><script src="${"../".repeat(depth)}assets/app.js?v=${V}" defer></script></body></html>`;

function renderTestPage(test) {
  const n = String(test.number).padStart(2, "0");
  const qs = test.questions.map(renderQuestion).join("\n");
  return head(`${test.title || `Practice Set ${n}`} — Digital SAT Math`, 2) + FIG_OPT_CSS + `
<header class="masthead">
  <p class="eyebrow">Digital SAT · Math · Skills-Insight band-targeted</p>
  <h1>${escapeHtml(test.title || `Practice Set ${n}`)}</h1>
  <p class="sub">${test.questions.length} questions · multiple choice &amp; student-produced response · each tagged with its measured difficulty band</p>
  <div class="toolbar">
    <span class="meta">${test.questions.length} questions</span>
    <span class="spacer"></span>
    <span class="score-chip" id="score"></span>
    <button class="btn" id="grade">Check answers</button>
    <button class="btn" id="reveal">Reveal all</button>
    <button class="btn" id="print" title="Print as a compact two-column booklet">Print</button>
    <a class="btn" href="solutions.html">Answer key &amp; solutions</a>
  </div>
</header>
<main class="qlist">
${qs}
</main>
<nav class="pagenav">
  <a href="../../index.html">← All tests</a>
  <a href="solutions.html">Answer key &amp; solutions →</a>
</nav>
` + foot(2);
}

function renderSolutionsPage(test) {
  const n = String(test.number).padStart(2, "0");
  const key = test.questions.map(q => {
    const a = q.type === "mcq" ? q.answer.correct : (q.answer.accept || [])[0];
    return `<li><span class="kq">${q.id}</span><span class="ka">${escapeHtml(a || "")}</span></li>`;
  }).join("");
  const sols = test.questions.map(renderSolution).join("\n");
  return head(`Answer Key — ${test.title || `Practice Set ${n}`}`, 2) + `
<header class="masthead">
  <p class="eyebrow">Digital SAT · Math · Skills-Insight band-targeted</p>
  <h1>${escapeHtml(test.title || `Set ${n}`)} — Answers</h1>
  <div class="toolbar"><a class="btn" href="index.html">← Back to test ${n}</a><a class="btn" href="../../index.html">All tests</a></div>
</header>
<section class="key"><h2>Answer key</h2><ol class="key-grid">${key}</ol></section>
<section class="worked"><h2>Worked solutions</h2>${sols}</section>
<nav class="pagenav"><a href="index.html">← Test ${n}</a><a href="../../index.html">All tests →</a></nav>
` + foot(2);
}

function renderIndex(tests) {
  const cards = tests.map(t => {
    const n = String(t.number).padStart(2, "0");
    return `<li><div class="test-card">
      <span class="tnum">Module 2 · Hard</span>
      <a class="ttitle" href="tests/test-${n}/index.html">Test ${n}</a>
      <div class="tmeta">22 questions</div>
      <div class="tlinks"><a href="tests/test-${n}/index.html">Take test →</a><a href="tests/test-${n}/solutions.html">Answer key</a></div>
    </div></li>`;
  }).join("");
  return head("Digital SAT Math · Module 2 — 20 Practice Tests", 0) + `
<header class="masthead">
  <p class="eyebrow">Practice set</p>
  <h1>Digital SAT Math — Module 2 (Hard)</h1>
  <p class="sub">${tests.length} original practice tests · 22 questions each · self-grading on screen, clean to print.</p>
</header>
<ul class="test-grid">${cards}</ul>
<footer class="foot">Original practice items modeled on the Digital SAT Math Module 2 (Hard) format. Every answer independently verified.</footer>
` + foot(0);
}

/* ---- driver ------------------------------------------------------------- */
function buildOne(file) {
  const test = JSON.parse(readFileSync(file, "utf8"));
  const n = String(test.number).padStart(2, "0");
  const dir = join(TESTS, `test-${n}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), renderTestPage(test));
  writeFileSync(join(dir, "solutions.html"), renderSolutionsPage(test));
  return test;
}

function main() {
  const args = process.argv.slice(2);
  let files;
  if (args.length) files = args.map(a => a.startsWith("/") ? a : join(process.cwd(), a));
  else files = readdirSync(DATA).filter(f => /^test-\d+\.json$/.test(f)).sort().map(f => join(DATA, f));
  if (!files.length) { console.error("no data files found in", DATA); process.exit(1); }
  const tests = [];
  for (const f of files) { tests.push(buildOne(f)); console.log("built", basename(f)); }
  // index only over the numbered set (skip fixtures)
  const real = tests.filter(t => Number.isInteger(t.number) && t.number >= 1 && t.number <= 99 && t.questions.length >= 10)
    .sort((a, b) => a.number - b.number);
  if (real.length) writeFileSync(join(ROOT, "index.html"), renderIndex(real));
  if (MATH_ERRORS.length) {
    console.error(`\n⚠ ${MATH_ERRORS.length} KaTeX errors:`);
    MATH_ERRORS.slice(0, 20).forEach(e => console.error("  ", e.s, "→", e.err));
    process.exitCode = 2;
  } else {
    console.log("✓ all math rendered cleanly");
  }
  if (FIG_ERRORS.length) { console.error(`⚠ ${FIG_ERRORS.length} figure errors:`); FIG_ERRORS.slice(0, 12).forEach(e => console.error("  ", e.fn, "→", e.err)); }
}
main();
