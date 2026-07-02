/* harvest — fold clean-room authored items into the two-tier bank (ENGINE v2).
   The inverted architecture's intake: solo agents AUTHOR; the engine INDUSTRIALIZES.

     HARVEST_DIR=<workdir> STEERED_DIR=<workdir2> node engine/harvest.mjs [--dry]

   Inputs (all measured before this runs — the gate consumes records, it never trusts):
     repo:      tests/cleanroom/{a1..a5,pilot,steered35}/items.json
     HARVEST_DIR: groups.json (blind structural grouping incl. kinOf-banked flags),
                  auth60.json, solve60-answers.json, audit60-result.json, audit60-map.json
     STEERED_DIR: work/auth.json, work/band-audit.json, work/solver1.json (steered gates)

   Policy (doctrine: floors are recorded, never lowered; rejection is the ledger working):
   - kinOf a banked parametric family → ALL members rejected (structural duplicate of a
     family that already mints $0 variants) → data/engine/harvest-rejections.jsonl
   - cross-model blind-solve disagreement → rejected (needs adjudication, not banking)
   - band-audit delta ≥2 → rejected pending re-band (recorded)
   - one FAMILY per structural group (generator "authored", band-free key), one VARIANT
     per member item; strictPass = auth≥7 ∧ novelty floors ∧ solver agreement.
   - variants carry format "cleanroom-text-v0" (no render schema yet) — assemble.mjs
     skips them; they serve the ledger, steering avoid-lists, and future adaptation. */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { familyKey, addFamily, addVariant, loadFamilies } from "./family.mjs";
import { loadCorpus, nearestSurface } from "./distance.mjs";
import { answersAgree } from "./answers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = process.env.HARVEST_DIR, S = process.env.STEERED_DIR;
if (!H || !S) { console.error("need HARVEST_DIR and STEERED_DIR env"); process.exit(2); }
const DRY = process.argv.includes("--dry");
const ANCHOR = { B1: 340, B2: 395, B3: 445, B4: 510, B5: 580, B6: 645, B7: 740 };
const J = (p) => JSON.parse(readFileSync(p, "utf8"));

/* ---- load the 95 items ---- */
const items = new Map();
for (const set of ["a1", "a2", "a3", "a4", "a5", "pilot", "steered35"]) {
  const pfx = set === "steered35" ? "s35" : set;
  for (const it of J(join(ROOT, "tests", "cleanroom", set, "items.json")))
    items.set(`${pfx}#${it.n}`, { ...it, id: `${pfx}#${it.n}`, set });
}

/* ---- attach measured verdicts (normalizer lives in engine/answers.mjs now) ---- */
const agree = answersAgree;

for (const o of J(join(H, "auth60.json"))) items.get(o.id).auth = o.score;
for (const o of J(join(S, "work", "auth.json"))) items.get(o.id.replace("set#", "s35#")).auth = o.score;
for (const o of J(join(H, "solve60-answers.json"))) { const it = items.get(o.id); it.solverAnswer = o.answer; it.solverAgrees = agree(o.answer, it.answer); }
for (const o of J(join(S, "work", "solver1.json"))) { const it = items.get(o.id.replace("set#", "s35#")); it.solverAnswer = o.answer; it.solverAgrees = agree(o.answer, it.answer); }
const amap60 = J(join(H, "audit60-map.json"));
for (const o of J(join(H, "audit60-result.json"))) { const it = items.get(amap60[o.id]); it.auditBand = o.band; it.auditGate = o.gate; }
const ba = J(join(S, "work", "band-audit.json"));
for (const [sid, o] of Object.entries(ba)) { const it = items.get(sid.replace("set#", "s35#")); it.auditBand = o.band; it.auditGate = o.gate; }

/* ---- fold groups → families + variants, rejections → ledger ---- */
const groups = J(join(H, "groups.json"));
const seen = new Set(groups.flatMap((g) => g.members));
if (seen.size !== items.size) throw new Error(`grouping covers ${seen.size}/${items.size} items`);
const corpus = loadCorpus();
const rejections = [], minted = { families: 0, variants: 0 }, flagged = [];
const rejLog = join(ROOT, "data", "engine", "harvest-rejections.jsonl");

for (const g of groups) {
  const members = g.members.map((id) => items.get(id));
  if (g.kinOf) {
    for (const it of members) rejections.push({ id: it.id, reason: "kin-of-banked", kinOf: g.kinOf, group: g.group });
    continue;
  }
  const ok = [], drop = [];
  for (const it of members) {
    const dBand = Math.abs(Number((it.auditBand || it.band)[1]) - Number(it.band[1]));
    if (it.solverAgrees !== true) { drop.push({ id: it.id, reason: "cross-model solver disagreement", solver: it.solverAnswer, author: it.answer }); continue; }
    if (dBand >= 2) {
      // legacy sets were banded PRE-guide; the blind audit applies the operative
      // instrument — adopt the audited band (recorded). Steered items were banded
      // per the guide, so a ≥2 delta there means unresolved → reject for review.
      if (it.set !== "steered35") { it.rebanded = { from: it.band, to: it.auditBand, gate: it.auditGate }; it.band = it.auditBand; }
      else { drop.push({ id: it.id, reason: `band-audit delta ${dBand} (author ${it.band}, audit ${it.auditBand})`, gate: it.auditGate }); continue; }
    }
    ok.push(it);
  }
  rejections.push(...drop.map((d) => ({ ...d, group: g.group })));
  if (!ok.length) continue;

  const bandCount = {};
  for (const it of ok) bandCount[it.band] = (bandCount[it.band] || 0) + 1;
  const famBand = Object.entries(bandCount).sort((a, b) => b[1] - a[1])[0][0];
  const spec = { structure: g.group, subdomain: g.subdomain };            // band-free key
  const famId = familyKey("authored", spec);
  const novelty = ok.map((it) => nearestSurface(it.stem, corpus, { excludeId: famId }));
  const worst = Math.max(...novelty.map((n) => n.sim));
  const solversFor = (set) => (set === "steered35" ? { solvers: 2, models: ["opus", "opus"], plus: "fable author recompute" } : { solvers: 2, models: ["fable (original session)", "opus (harvest re-solve)"] });

  if (!DRY && !loadFamilies().some((f) => f.familyId === famId)) {
    addFamily({
      familyId: famId, generator: "authored", spec, domain: "geometry_trig", subdomains: [g.subdomain],
      statementId: null, fingerprint: [],
      difficulty: { scalePoint: ANCHOR[famBand], band: famBand, method: "expert_blind_calibration", bands: bandCount },
      verification: { blindSolve: { agreement: true, solvers: 2, note: "cross-model; see variants" }, provenance: { set: "cleanroom-harvest", members: ok.map((i) => i.id), report: ok[0].set === "steered35" ? "STEERED-35.md" : "SCALE-TEST-50.md" } },
      bandpass: { mode: "record", strictPass: ok.some((it) => it.auth >= 7) && worst < 0.45, nearestSurface: +worst.toFixed(2), note: g.note },
      stemPreview: ok[0].stem.slice(0, 110),
    });
    minted.families++;
  }
  for (let i = 0; i < ok.length; i++) {
    const it = ok[i];
    const strictPass = it.auth >= 7 && novelty[i].sim < 0.45;
    if (!strictPass) flagged.push({ id: it.id, auth: it.auth, sim: +novelty[i].sim.toFixed(2) });
    if (DRY) { minted.variants++; continue; }
    const r = addVariant({
      variantId: `${famId}#${it.id}`,   // natural key — variantKey() expects item fields at top level, which a nested record defeats
      familyId: famId,
      item: { type: it.type, skill: it.skill, stem: it.stem, figure: it.figure ?? null, band: it.band },
      answer: it.answer, seed: null,
      realization: { mode: "authored-cleanroom", format: "cleanroom-text-v0", sourceSet: it.set, sourceHtml: `tests/cleanroom/${it.set}/index.html` },
      verdicts: { blindSolve: { agreement: true, ...solversFor(it.set) } },
      quality: { authenticity: it.auth, nearestSurface: +novelty[i].sim.toFixed(2), auditBand: it.auditBand ?? null, rebanded: it.rebanded ?? null, strictPass },
    });
    if (r.added) minted.variants++;
  }
}

/* ---- ledger + summary ---- */
if (!DRY) for (const r of rejections) appendFileSync(rejLog, JSON.stringify({ at: new Date().toISOString(), ...r }) + "\n");
console.log(`${DRY ? "[DRY] " : ""}harvest: ${minted.families} families minted, ${minted.variants} variants, ${rejections.length} rejections`);
const byReason = {};
for (const r of rejections) byReason[r.reason.split(" (")[0]] = (byReason[r.reason.split(" (")[0]] || 0) + 1;
console.log("rejections:", JSON.stringify(byReason));
for (const r of rejections) console.log(`  ✗ ${r.id}: ${r.reason}${r.kinOf ? " → " + r.kinOf : ""}`);
if (flagged.length) { console.log(`banked but strictPass:false (${flagged.length}):`); flagged.forEach((f) => console.log(`  ~ ${f.id} auth=${f.auth} sim=${f.sim}`)); }
