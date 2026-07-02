/* render-adapter — makes AUTHORED clean-room variants renderable through the
   unchanged v1 chain (build/render.mjs renderQuestion + assets/app.js).

   Two jobs:
   1. extractAssets(): parse tests/cleanroom/{a1..a5,pilot,steered35}/index.html →
      per item: the author's inline SVG + solution HTML → data/engine/authored-assets.json
      keyed by cleanroom id ("a1#3", "s35#12"). Items are matched by DOCUMENT ORDER
      (only a5/pilot/steered35 carry id="qN"); validated by count per set + the
      band label found inside each block vs items.json.
   2. toSuiteQuestion(variant, assets) → a v1 render-schema question:
      stem text (choices tail stripped) → paragraphs, MCQ options parsed from the
      "A) … B) …" tail, figure = {fn:"raw", spec:{svg}}, answer via engine/answers.mjs.
      Unparseable MCQs THROW — fail loudly, never ship a broken item.

   Run standalone to (re)extract + report coverage:  node engine/render-adapter.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normAnswer, acceptForms } from "./answers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "data", "engine", "authored-assets.json");

/* per-set item-block opening pattern (pinned by exploration; hand-authored files) */
const SETS = {
  a1: { pfx: "a1", open: /<section class="item">/g },
  a2: { pfx: "a2", open: /<div class="card">/g },
  a3: { pfx: "a3", open: /<article class="item">/g },
  a4: { pfx: "a4", open: /<article class="item"[^>]*>/g },
  a5: { pfx: "a5", open: /<article class="item" id="q\d+">/g },
  pilot: { pfx: "pilot", open: /<article class="item" id="q\d+">/g },
  steered35: { pfx: "s35", open: /<section class="item" id="q\d+">/g },
};

export function extractAssets({ write = true } = {}) {
  const out = {}, report = [];
  for (const [set, cfg] of Object.entries(SETS)) {
    const html = readFileSync(join(ROOT, "tests", "cleanroom", set, "index.html"), "utf8");
    const items = JSON.parse(readFileSync(join(ROOT, "tests", "cleanroom", set, "items.json"), "utf8"));
    const starts = [...html.matchAll(cfg.open)].map((m) => m.index);
    if (starts.length !== items.length) throw new Error(`${set}: ${starts.length} blocks vs ${items.length} items — extraction pattern wrong`);
    let bandMatch = 0;
    for (let i = 0; i < starts.length; i++) {
      const block = html.slice(starts[i], starts[i + 1] ?? html.length);
      const svg = (block.match(/<svg[\s\S]*?<\/svg>/) || [null])[0];
      if (!svg) throw new Error(`${set}#${items[i].n}: no <svg> in block`);
      const det = block.match(/<details[\s\S]*?<\/details>/);
      let solutionHtml = null;
      if (det) solutionHtml = det[0].replace(/<\/?details[^>]*>/g, "").replace(/<summary[\s\S]*?<\/summary>/, "").trim();
      if (block.includes(items[i].band)) bandMatch++;
      out[`${cfg.pfx}#${items[i].n}`] = { svg, solutionHtml };
    }
    report.push(`${set}: ${starts.length}/${items.length} extracted, band-label match ${bandMatch}/${items.length}`);
  }
  if (write) writeFileSync(ASSETS, JSON.stringify(out, null, 1));
  return { assets: out, report };
}

export const loadAssets = () => JSON.parse(readFileSync(ASSETS, "utf8"));

/* ---- text helpers ---- */
const pretty = (s) => String(s).replace(/\bpi\b/g, "π").replace(/(\d)\s*degrees\b/g, "$1°");
const textSegs = (s) => [{ t: "text", v: pretty(s) }];

/** parse the choices tail off an authored MCQ stem — lettered ("A) … B) …") or
 *  bare list ("Options: 16, 64, 120, 158." — a5's style, semicolons when values
 *  contain structure). Trailing "(Figure not drawn to scale.)" stays in the body. */
export function parseChoices(stem) {
  const m = String(stem).match(/^([\s\S]*?)(?:\s*\(?(?:choices|options)\s*:?\)?\s*)?A\)\s*([\s\S]+?)\s+B\)\s*([\s\S]+?)\s+C\)\s*([\s\S]+?)\s+D\)\s*([\s\S]+?)\s*$/);
  if (m) return { body: m[1].trim(), options: ["A", "B", "C", "D"].map((key, i) => ({ key, seg: textSegs(m[2 + i].trim()) })) };
  const l = String(stem).match(/^([\s\S]*?)\s*Options:\s*([\s\S]+?)\s*$/i);
  if (!l) return null;
  let tail = l[2].trim(), body = l[1].trim();
  const fig = tail.match(/\s*(\(Figure[^)]*\)\.?)\s*$/i);
  if (fig) { body += " " + fig[1]; tail = tail.slice(0, fig.index).trim(); }
  tail = tail.replace(/\.\s*$/, "");
  const vals = tail.includes(";") ? tail.split(/;\s*/) : tail.split(/,\s*/);
  if (vals.length !== 4) return null;
  return { body, options: ["A", "B", "C", "D"].map((key, i) => ({ key, seg: textSegs(vals[i].trim()) })) };
}

/** authored variant → v1 render-schema question (id assigned by the assembler). */
export function toSuiteQuestion(variant, assets, familyMeta = {}) {
  const it = variant.item;
  const cid = variant.variantId.split("#").slice(1).join("#"); // fam_x#a1#3 → a1#3
  const asset = assets[cid];
  if (!asset) throw new Error(`no extracted asset for ${cid}`);
  const q = {
    type: it.type, domain: "geometry_trig", band: it.band, skill: it.skill,
    _variantId: variant.variantId, _familyId: variant.familyId,
    _subdomain: familyMeta.subdomain ?? null, _solutionHtml: asset.solutionHtml,
    figure: { fn: "raw", spec: { svg: asset.svg } },
  };
  if (it.type === "mcq") {
    const parsed = parseChoices(it.stem);
    if (!parsed) throw new Error(`MCQ choices unparseable for ${cid}: ${it.stem.slice(-120)}`);
    q.stem = [{ t: "p", segs: textSegs(parsed.body) }];
    q.options = parsed.options;
    let { letter } = normAnswer(variant.answer);
    if (!letter) { // answer stored as bare value — find it among the options
      const hit = parsed.options.find((o) => normAnswer(o.seg[0].v).val === normAnswer(variant.answer).val);
      letter = hit?.key.toLowerCase();
    }
    if (!letter) throw new Error(`cannot resolve MCQ correct letter for ${cid} (answer: ${variant.answer})`);
    q.answer = { correct: letter.toUpperCase() };
  } else {
    q.stem = [{ t: "p", segs: textSegs(it.stem) }];
    q.answer = { accept: acceptForms(variant.answer) };
  }
  return q;
}

/* ---- standalone: extract + conversion coverage over the whole bank ---- */
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const { report } = extractAssets();
  report.forEach((l) => console.log(l));
  const assets = loadAssets();
  const { loadVariants, loadFamilies } = await import("./family.mjs");
  const fams = Object.fromEntries(loadFamilies().map((f) => [f.familyId, f]));
  const authored = loadVariants().filter((v) => v.realization?.mode === "authored-cleanroom");
  let ok = 0; const fails = [];
  for (const v of authored) {
    try { toSuiteQuestion(v, assets, { subdomain: fams[v.familyId]?.spec?.subdomain }); ok++; }
    catch (e) { fails.push(`${v.variantId}: ${e.message.slice(0, 100)}`); }
  }
  console.log(`\nconversion: ${ok}/${authored.length} authored variants → render schema`);
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(fails.length ? 1 : 0);
}
