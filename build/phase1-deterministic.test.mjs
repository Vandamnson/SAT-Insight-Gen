/* Ledger + figure-consistency tests. Run: node build/phase1-deterministic.test.mjs */
import { Ledger, cellId } from "./ledger.mjs";
import { measureFigure } from "../figures/consistency.js";
let pass = 0, fail = 0;
const ok = (c, m, x = "") => { if (c) pass++; else { fail++; console.error("  ✗", m, x); } };

/* ---- Ledger ---- */
const L = new Ledger(null);
const itemA = { program: "SAT", domain: "algebra", band: "B3", statementId: "ALG.B3.s1", skill: "lin_solve_value", type: "mcq", stem: [{ t: "text", v: "If 5x minus 7 equals 3x plus 11 what is the value of x" }] };
ok(L.record(itemA), "ledger records a fresh item");
ok(!L.record(itemA), "ledger rejects exact-cell repeat");
const itemReworded = { ...itemA, statementId: "ALG.B3.s2", stem: [{ t: "text", v: "If 5x minus 7 equals 3x plus 11 what is the value of x" }] };
ok(!L.record(itemReworded), "ledger rejects surface-duplicate stem (different cell)");
const itemDiff = { program: "SAT", domain: "algebra", band: "B5", statementId: "ALG.B5.s2", skill: "system_solve", type: "spr", stem: [{ t: "text", v: "A theater sells adult and child tickets totaling four hundred dollars find the count" }] };
ok(L.record(itemDiff), "ledger records a genuinely different item");
ok(L.size === 2, "ledger size = 2", `(got ${L.size})`);
ok(typeof cellId(itemA) === "string" && cellId(itemA).length === 16, "cellId is a 16-char hash");

/* ---- figure-math consistency ---- */
// consistent coordPlane: line through (-3,7),(5,-9), slope -2
const goodFig = { fn: "coordPlane", spec: { curves: [{ type: "line2pt", p1: [-3, 7], p2: [5, -9] }], points: [{ at: [-3, 7] }, { at: [5, -9] }] } };
ok(measureFigure(goodFig, { p1: [-3, 7], p2: [5, -9], target: "slope" }).ok, "consistent coordPlane passes");
// broken: a plotted point off the line
const offPt = { fn: "coordPlane", spec: { curves: [{ type: "line2pt", p1: [-3, 7], p2: [5, -9] }], points: [{ at: [0, 0] }] } };
ok(!measureFigure(offPt, null).ok, "coordPlane with point off the line is REJECTED");
// broken: params slope contradicts the drawn line
const badSlope = { fn: "coordPlane", spec: { curves: [{ m: 3, b: 1 }], points: [] } };
ok(!measureFigure(badSlope, { report: "slope", m: -2 }).ok, "coordPlane slope/params mismatch is REJECTED");
// unknown type passes with a note (no false negative)
ok(measureFigure({ fn: "triangle", spec: {} }, {}).ok, "unknown figure type passes (Phase-2 arm)");

console.log(`\nledger + consistency: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
