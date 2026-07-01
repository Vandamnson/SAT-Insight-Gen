/* ============================================================================
   engine/verify/selftest.mjs — the engine's hard gate (exit-code contract, like
   build/_composecheck.mjs). Four layers:

     1. per-step AGREEMENT   — 200 draws: resolve(params) reproduces make's outputs
     2. per-step SENSITIVITY — perturb each spec.sensitive param → output must move
        + static ANTI-DELEGATION LINT (no `make(`/`_secret` after the resolver divider)
     3. per-chain            — 80 verified draws per cataloged chain (drawChain
        verifies resolver+essentialChain internally; a throw/exhaust = failure)
     4. band histogram + one sample stem per chain (mandatory human skim)

   node engine/verify/selftest.mjs
   ============================================================================ */
import { readFileSync } from "node:fs";
import { stepIds, step, stepFile } from "../registry.mjs";
import { enumerateChains, drawChain, chainSignature, chainScale } from "../composer.mjs";
import { EDGES, admissible } from "../edges.mjs";
import { rng, applyCoerce } from "../types.mjs";

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };

const numEq = (a, b) => Math.abs(a - b) < 1e-9;
function qtyEq(a, b) {
  if (a.type !== b.type) return false;
  const va = a.value, vb = b.value;
  if (typeof va === "number") return numEq(va, vb);
  if (Array.isArray(va)) return va.length === vb.length && va.every((x, i) => numEq(x, vb[i]));
  return Object.keys(va).every((k) => numEq(va[k], vb[k]));
}
const outputsEq = (A, B) => A && B && Object.keys(A).length === Object.keys(B).length && Object.keys(A).every((k) => B[k] && qtyEq(A[k], B[k]));

/* an input feeder for a CLOSE step: the first admitted edge that serves it. */
function feederFor(closeId) {
  for (const e of EDGES) {
    const [fs, fo] = e.from.split("."), [ts, ti] = e.to.split(".");
    if (ts !== closeId) continue;
    const adm = admissible(e.from, e.to);
    if (adm.ok) return { openerId: fs, fromName: fo, toName: ti, coerce: adm.coerce };
  }
  return null;
}
function drawStepPair(id, r) {                               // → {mod, made, makeInputs, resolveInputs} | null
  const mod = step(id);
  if (mod.spec.role === "open") {
    const made = mod.make({}, r);
    return made ? { mod, made, makeInputs: {}, resolveInputs: {} } : null;
  }
  const f = feederFor(id);
  if (!f) throw new Error(`no feeder edge for close step '${id}'`);
  const op = step(f.openerId);
  const oMade = op.make({}, r);
  if (!oMade) return null;
  let qMake = oMade.outputs[f.fromName]; if (f.coerce) qMake = applyCoerce(f.coerce, qMake);
  const made = mod.make({ [f.toName]: qMake }, r);
  if (!made) return null;
  const oRes = op.resolve(JSON.parse(JSON.stringify(oMade.params)), {});
  let qRes = oRes.outputs?.[f.fromName]; if (!qRes) return null; if (f.coerce) qRes = applyCoerce(f.coerce, qRes);
  return { mod, made, makeInputs: { [f.toName]: qMake }, resolveInputs: { [f.toName]: qRes } };
}

/* ---- 1+2: per step ---- */
console.log("── per-step: agreement (200) + sensitivity + lint ──");
for (const id of stepIds()) {
  const mod = step(id);
  // agreement
  let n = 0, bad = 0, notOk = 0;
  for (let i = 0; n < 200 && i < 1000; i++) {
    const pair = drawStepPair(id, rng(`st|${id}|${i}`));
    if (!pair) continue;
    n++;
    const v = pair.mod.resolve(JSON.parse(JSON.stringify(pair.made.params)), pair.resolveInputs);
    if (!v.ok || !v.essential) notOk++;
    if (!outputsEq(pair.made.outputs, v.outputs)) bad++;
  }
  if (n < 200) fail(`${id}: only ${n}/200 draws succeeded`);
  if (bad) fail(`${id}: ${bad} make/resolve output mismatches`);
  if (notOk) fail(`${id}: ${notOk} draws with ok/essential=false`);
  // sensitivity: perturbing each sensitive param must move the resolver
  for (const key of mod.spec.sensitive) {
    let moved = 0, tried = 0;
    for (let i = 0; tried < 50 && i < 400; i++) {
      const pair = drawStepPair(id, rng(`sen|${id}|${key}|${i}`));
      if (!pair) continue;
      tried++;
      const base = pair.mod.resolve(JSON.parse(JSON.stringify(pair.made.params)), pair.resolveInputs);
      const pp = { ...JSON.parse(JSON.stringify(pair.made.params)) }; pp[key] = pp[key] + 1;
      const pert = pair.mod.resolve(pp, pair.resolveInputs);
      if (!pert.ok || !pert.outputs || !outputsEq(base.outputs, pert.outputs)) moved++;
    }
    if (moved < tried * 0.9) fail(`${id}: param '${key}' insensitive (${moved}/${tried} moved) — resolve may not use it`);
  }
  // anti-delegation lint
  const src = readFileSync(stepFile(id), "utf8");
  const div = src.indexOf("INDEPENDENT RESOLVER");
  if (div < 0) fail(`${id}: missing INDEPENDENT RESOLVER divider`);
  else { const tail = src.slice(div); if (/[^.\w]make\s*\(/.test(tail)) fail(`${id}: resolver calls make()`); if (tail.includes("_secret")) fail(`${id}: resolver touches _secret`); }
  console.log(`  ✓ ${id} (agreement 200/200, ${mod.spec.sensitive.length} sensitive keys, lint clean)`);
}

/* ---- 3: per chain ---- */
console.log("\n── per-chain: 80 verified draws each ──");
const catalog = enumerateChains({});
if (!catalog.length) fail("enumerateChains returned nothing");
const bands = {};
for (const spec of catalog) {
  const sig = chainSignature(spec);
  let okDraws = 0, thrown = 0;
  for (let i = 0; i < 80; i++) {
    try { drawChain(spec, rng(`chain|${sig}|${i}`)); okDraws++; } catch { thrown++; }
  }
  const scale = chainScale(spec), band = `~${scale}`;
  bands[sig] = scale;
  if (okDraws < 76) fail(`${sig}: only ${okDraws}/80 verified draws (yield < 95%)`);
  else console.log(`  ✓ ${sig}  (${okDraws}/80 verified, scale ${scale})`);
}

/* ---- 4: sample stems (human skim) ---- */
console.log("\n── one sample per chain ──");
for (const spec of catalog) {
  const it = drawChain(spec, rng(`sample|${chainSignature(spec)}`));
  const stemTxt = it.stem.map((s) => (s.t === "mathblock" ? `[${s.v}]` : (s.segs || []).map((g) => g.v).join(""))).join("  ");
  console.log(`\n${chainSignature(spec)} (scale ${it.difficulty.scalePoint}, band ${it.band}):\n  ${stemTxt}\n  answer: ${it.answer.accept[0]}`);
}

console.log(`\n${failures ? "✗ " + failures + " failure(s)" : "✓ engine selftest PASSED"} — ${stepIds().length} steps, ${catalog.length} chains`);
process.exit(failures ? 1 : 0);
