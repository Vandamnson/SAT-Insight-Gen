/* engine/registry.mjs — loads every step module in engine/steps/, validates its
   shape, and indexes by id + produced/consumed types. */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateStep } from "./steps/_iface.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "steps");

const STEPS = {};
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))) {
  const mod = await import(join(DIR, f));
  validateStep(mod, f);
  if (STEPS[mod.spec.id]) throw new Error(`duplicate step id '${mod.spec.id}' (${f})`);
  STEPS[mod.spec.id] = mod;
}

export const stepIds = () => Object.keys(STEPS);
export const step = (id) => { const s = STEPS[id]; if (!s) throw new Error(`unknown step '${id}'`); return s; };
export const openers = () => Object.values(STEPS).filter((m) => m.spec.role === "open");
export const closers = () => Object.values(STEPS).filter((m) => m.spec.role === "close");
export const stepFile = (id) => join(DIR, `${id}.mjs`);

export default { stepIds, step, openers, closers, stepFile };
