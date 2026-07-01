/* ============================================================================
   engine/cli.mjs — drive the engine.
     node engine/cli.mjs status
     node engine/cli.mjs mint-chains [--enforce] [--skip-auth]   # enumerate → selftest 80 → band-pass → mint
     node engine/cli.mjs mint-capstones                          # C1–C7 + G1–G5 as curated families
     node engine/cli.mjs variants <N>                            # mint N variants per family
     node engine/cli.mjs module <testNum> <n>                    # mock module (≤1/family)
     node engine/cli.mjs ladder <familyId> <testNum> [k]
   ============================================================================ */
import { enumerateChains, chainSignature, chainScale, drawChain } from "./composer.mjs";
import { rng } from "./types.mjs";
import { familyKey, addFamily, loadFamilies, summary } from "./family.mjs";
import { mintVariants, CROSS_TYPES, FIG_TYPES } from "./variants.mjs";
import { bandpassFamily } from "./bandpass.mjs";
import { loadCorpus } from "./distance.mjs";
import { mockModule, drillLadder } from "./assemble.mjs";
import { scoreToBand } from "../difficulty/lltm.mjs";
import { drawCross } from "../build/compose.mjs";
import { resolveCapstone } from "../build/_composecheck.mjs";
import { drawAdvFig } from "../build/advfig.mjs";
import { resolveAdvFig } from "../build/_advfigcheck.mjs";

const [, , cmd, ...args] = process.argv;
const flag = (f) => args.includes(f);

async function mintChains() {
  const corpus = loadCorpus();
  const mode = flag("--enforce") ? "enforce" : "record";
  let minted = 0, rejected = 0;
  for (const spec of enumerateChains({})) {
    const sig = chainSignature(spec);
    const famId = familyKey("chain", { chainSpec: spec });
    if (loadFamilies().some((f) => f.familyId === famId)) { console.log(`  = ${sig} (already minted)`); continue; }
    let ok = 0; for (let i = 0; i < 80; i++) { try { drawChain(spec, rng(`fam|${sig}|${i}`)); ok++; } catch { /* redraw-exhaust */ } }
    if (ok < 76) { console.log(`  ✗ ${sig}: selftest yield ${ok}/80 — not mintable`); rejected++; continue; }
    const sample = drawChain(spec, rng(`fam|${sig}|sample`));
    const bp = await bandpassFamily(sample, sample.fingerprint, { corpus, mode, skipAuth: flag("--skip-auth"), excludeId: famId });
    if (!bp.pass) { console.log(`  ✗ ${sig}: band-pass REJECT — ${bp.reasons.join("; ")}`); rejected++; continue; }
    const scale = chainScale(spec);
    addFamily({
      familyId: famId, generator: "chain", spec: { chainSpec: spec }, domain: spec.domain,
      subdomains: [...new Set(spec.steps.map((id) => id))], statementId: "ALG.B7.s1",
      fingerprint: sample.fingerprint,
      difficulty: { scalePoint: scale, band: scoreToBand(scale, spec.domain), method: "lltm_chain_v1" },
      selftest: { draws: 80, mismatches: 80 - ok, trivial: 0, yield: ok / 80 },
      bandpass: { mode, strictPass: bp.strictPass, ...bp.noveltyDist, authenticityScore: bp.authenticityScore, reasons: bp.reasons },
      stemPreview: sig,
    });
    console.log(`  ✓ ${sig} minted (${bp.strictPass ? "band-pass PASS" : "record mode — strict floors NOT met: " + bp.reasons.join("; ")})`);
    minted++;
  }
  console.log(`\nchains: ${minted} minted, ${rejected} rejected`);
}

async function mintCapstones() {
  const corpus = loadCorpus();
  const CURATED = { C1: 760, C2: 790, C3: 750, C4: 785, C5: 770, C6: 795, C7: 800, G1: 785, G2: 770, G3: 790, G4: 775, G5: 800 };
  for (const [gen, types, draw, resolve, dom] of [
    ["capstone", CROSS_TYPES, drawCross, resolveCapstone, "algebra"],
    ["figcapstone", FIG_TYPES, drawAdvFig, resolveAdvFig, "advanced_math"],
  ]) {
    for (const t of types) {
      const spec = gen === "capstone" ? { crossType: t } : { figType: t };
      const famId = familyKey(gen, spec);
      if (loadFamilies().some((f) => f.familyId === famId)) { console.log(`  = ${gen}:${t}`); continue; }
      let ok = 0;
      for (let i = 0; i < 80; i++) {
        const it = draw(t, rng(`cap|${t}|${i}`));
        const v = resolve(it._p);
        if (v.ok && Math.round(v.ans) === Number(it.answer.accept[0]) && (v.essential2step ?? v.essential)) ok++;
      }
      if (ok !== 80) { console.log(`  ✗ ${gen}:${t} selftest ${ok}/80`); continue; }
      const sample = draw(t, rng(`cap|${t}|sample`));
      const bp = await bandpassFamily(sample, sample.fingerprint, { corpus, mode: "record", skipAuth: true, excludeId: famId });
      addFamily({
        familyId: famId, generator: gen, spec, domain: dom, subdomains: [sample.skill].filter(Boolean),
        statementId: sample.statementId || (dom === "algebra" ? "ALG.B7.s1" : "ADV.B7.s1"),
        fingerprint: sample.fingerprint,
        difficulty: { scalePoint: CURATED[t], band: "B7", method: "curated" },
        selftest: { draws: 80, mismatches: 0, trivial: 0, yield: 1 },
        bandpass: { mode: "record", strictPass: bp.strictPass, ...bp.noveltyDist, note: "curated v1 anchors — surface-close to their own banked v1 instances by design" },
        stemPreview: `${gen} ${t}`,
      });
      console.log(`  ✓ ${gen}:${t} minted (curated ${CURATED[t]})`);
    }
  }
}

async function main() {
  if (cmd === "status") { console.log(JSON.stringify(summary(), null, 1)); return; }
  if (cmd === "mint-chains") return mintChains();
  if (cmd === "mint-capstones") return mintCapstones();
  if (cmd === "variants") {
    const N = Number(args[0] || 3);
    for (const f of loadFamilies()) {
      const opts = flag("--llm") && f.generator === "chain" && f.bandpass?.strictPass !== false ? { realize: "llm" } : {};
      const got = await mintVariants(f, N, opts);
      const voiced = got.filter((g) => g.realization?.mode === "llm-voice").length;
      console.log(`  ${f.familyId} (${f.stemPreview || f.generator}): +${got.length} variants${voiced ? ` (${voiced} llm-voiced)` : ""}`);
    }
    return;
  }
  if (cmd === "generate") {
    // the production loop, one command: families → voiced variants → products
    const perFam = Number(args[0] || 3), modN = Number(args[1] || 22);
    console.log("── 1/4 mint capstone families ──"); await mintCapstones();
    console.log("── 2/4 mint chain families (band-passed) ──"); await mintChains();
    console.log("── 3/4 variants (chains llm-voiced where strict-pass) ──");
    for (const f of loadFamilies()) {
      const opts = f.generator === "chain" && f.bandpass?.strictPass !== false ? { realize: "llm" } : {};
      const got = await mintVariants(f, perFam, opts);
      const voiced = got.filter((g) => g.realization?.mode === "llm-voice").length;
      console.log(`  ${f.familyId}: +${got.length}${voiced ? ` (${voiced} voiced)` : ""}`);
    }
    console.log("── 4/4 products ──");
    const m = mockModule({ testNum: 200, n: modN });
    console.log(`  module: ${m.count} items / ${m.families} families → ${m.fp}`);
    console.log(JSON.stringify(summary(), null, 1));
    return;
  }
  if (cmd === "module") { const r = mockModule({ testNum: Number(args[0] || 200), n: Number(args[1] || 22) }); console.log(`module: ${r.count} items from ${r.families} families → ${r.fp}`); return; }
  if (cmd === "ladder") { const r = drillLadder(args[0], { testNum: Number(args[1] || 201), k: Number(args[2] || 5) }); console.log(`ladder: ${r.count} items → ${r.fp}`); return; }
  console.log("usage: node engine/cli.mjs status|mint-chains|mint-capstones|variants|module|ladder");
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
