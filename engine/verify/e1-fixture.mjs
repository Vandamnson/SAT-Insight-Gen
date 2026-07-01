/* E1 fixture — proves the two-tier bank end-to-end using a REAL family (capstone
   C7, one of the 12 curated anchors):
     1. selftest the structure (80 draws through the independent resolver)
     2. mint the family (verify-first persistence)
     3. NEGATIVE gates: unverified family / bad variant / orphan variant must THROW
     4. realize 4 variants ($0 reseed) and persist them
     5. assemble a drill ladder → data/test-201.json (render-schema proof)
   node engine/verify/e1-fixture.mjs */
import { drawCross } from "../../build/compose.mjs";
import { resolveCapstone } from "../../build/_composecheck.mjs";
import { rng } from "../types.mjs";
import { familyKey, addFamily, addVariant, summary } from "../family.mjs";
import { realizeVariant, mintVariants } from "../variants.mjs";
import { drillLadder } from "../assemble.mjs";

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? "✓" : "✗"} ${name}`); if (!cond) failures++; };

// 1. selftest C7 (the structure's own verification record)
let draws = 0, mismatches = 0, trivial = 0;
for (let i = 0; i < 80; i++) {
  const it = drawCross("C7", rng(`e1|C7|${i}`)); draws++;
  const v = resolveCapstone(it._p);
  if (!v.ok || Math.round(v.ans) !== Number(it.answer.accept[0])) mismatches++;
  if (!v.essential2step) trivial++;
}
check(`selftest C7: 80 draws, 0 mismatches, 0 trivial`, draws === 80 && mismatches === 0 && trivial === 0);

// 2. mint the family
const spec = { crossType: "C7" };
const family = {
  familyId: familyKey("capstone", spec),
  generator: "capstone", spec, domain: "algebra",
  subdomains: ["linear_inequalities", "systems_of_linear_equations"],
  statementId: "ALG.B7.s2",
  fingerprint: ["cross_skill", "C7", "ineq-system+varconst"],
  difficulty: { scalePoint: 800, band: "B7", method: "curated" },
  selftest: { draws, mismatches, trivial, yield: 1 },
  bandpass: { mode: "record" },                     // E3 tightens this to enforced scores
  stemPreview: "system of two inequalities with variable constant k → greatest feasible x",
};
const minted = addFamily(family);
check(`family minted (${minted.familyId})`, !!minted.familyId);

// 3. NEGATIVE gates — each must throw
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
check("unverified family REFUSED (no selftest)", throws(() => addFamily({ generator: "capstone", spec: { crossType: "C1" }, difficulty: family.difficulty, bandpass: {} })));
check("failing selftest REFUSED (mismatches>0)", throws(() => addFamily({ ...family, familyId: "fam_bogus1", selftest: { draws: 80, mismatches: 1, trivial: 0 } })));
check("variant without verdicts REFUSED", throws(() => addVariant({ familyId: minted.familyId, answer: { accept: ["1"] }, item: {} })));
check("variant with failing resolver REFUSED", throws(() => addVariant({ familyId: minted.familyId, answer: { accept: ["1"] }, verdicts: { resolver: { ok: false }, answerPin: true } })));
check("orphan variant REFUSED (unknown family)", throws(() => addVariant({ familyId: "fam_nope", answer: { accept: ["1"] }, verdicts: { resolver: { ok: true }, answerPin: true } })));

// 4. realize + persist 4 variants (mintVariants retries salted seeds on content collision)
const mintedVars = await mintVariants(family, 4);
check(`4 variants realized + persisted (fresh numbers each)`, mintedVars.length === 4);

// distinctness: the 4 variants must differ in params (fresh numbers, same structure)
import { loadVariants } from "../family.mjs";
const vs = loadVariants().filter((v) => v.familyId === minted.familyId);
const distinctParams = new Set(vs.map((v) => JSON.stringify(v.params))).size;
check(`variants carry distinct params (${distinctParams}/${vs.length} unique)`, distinctParams === vs.length && vs.length >= 4);

// 5. drill ladder → render-schema file
const lad = drillLadder(minted.familyId, { k: 4, testNum: 201 });
check(`drill ladder written (${lad.count} items → ${lad.fp.split("/").pop()})`, lad.count === 4);

console.log("\n" + JSON.stringify(summary()));
process.exit(failures ? 1 : 0);
