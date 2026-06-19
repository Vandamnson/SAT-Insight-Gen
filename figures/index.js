/* ============================================================================
   figures/index.js — Subsystem B interface (perfect figures).
     render(figure) -> SVG/HTML string   (deterministic; the LLM never draws)
     verify(figure, item) -> { ok, consistentWithStem, pixelOk, reason? }

   PHASE 0 (here): render delegates to the ported figures.js registry; verify is
   a structural stub (does the fn exist / does it render).
   PHASE 1 adds gate-1 figure-math CONSISTENCY (measureFigure: the drawn data
   must satisfy item.params/answer) and gate-2 ADVERSARIAL geometry (verify.mjs,
   generalizing pl-verify.mjs to all types).
   PHASE 2 adds gate-3 extreme-geometry matrix + gate-4 Playwright pixel-QA.
   ============================================================================ */
import * as FIG from "./figures.js";
const REG = FIG.default || FIG.FIGURES || FIG;

export const knownFns = () => Object.keys(REG).filter((k) => typeof REG[k] === "function");

export function render(figure) {
  if (!figure) return "";
  const fn = REG[figure.fn];
  if (typeof fn !== "function") throw new Error("unknown figure fn: " + figure.fn);
  return fn(figure.spec);
}

/** Phase-0 stub: confirms the figure renders to a non-empty string. */
export async function verify(figure, _item) {
  if (!figure) return { ok: true, consistentWithStem: true, pixelOk: true, note: "no figure" };
  if (!knownFns().includes(figure.fn)) return { ok: false, reason: `unknown fn ${figure.fn}` };
  let svg = "";
  try { svg = render(figure); } catch (e) { return { ok: false, reason: `render threw: ${e.message}` }; }
  if (!svg || svg.length < 8) return { ok: false, reason: "empty render" };
  return { ok: true, consistentWithStem: true, pixelOk: true, note: "phase-0 stub: structural render only" };
}

export default { render, verify, knownFns };
