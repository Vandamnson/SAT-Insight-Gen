/* ============================================================================
   engine/types.mjs — typed-quantity system for the path-composition engine,
   plus the shared seeded RNG (one canonical copy; cell.mjs/_composecheck have
   local duplicates that predate the engine).

   CLOSED vocabulary + CLOSED, NAMED coercions: a chain binding may only connect
   equal types or a coercion listed in COERCE. No implicit conversion anywhere —
   coarse-type nonsense is bounded by making every cross-type hop a reviewable name.
   ============================================================================ */

/* ---- seeded PRNG (mulberry-style; identical to cell.mjs/_composecheck) ---- */
export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const nzint = (r, lo, hi) => { let v = 0; while (v === 0) v = randint(r, lo, hi); return v; };

/* ---- quantity types ---- */
const fin = (v) => typeof v === "number" && Number.isFinite(v);
export const TYPES = {
  value:        { check: fin },
  int:          { check: (v) => fin(v) && Number.isInteger(v) },
  count:        { check: (v) => fin(v) && Number.isInteger(v) && v >= 0 },
  param:        { check: fin },
  slope:        { check: fin },
  point:        { check: (v) => Array.isArray(v) && v.length === 2 && fin(v[0]) && fin(v[1]) },
  linear_fn:    { check: (v) => v && fin(v.m) && fin(v.b) },
  system2x2:    { check: (v) => v && ["a1", "b1", "c1", "a2", "b2", "c2"].every((k) => fin(v[k])) },
  quadratic_fn: { check: (v) => v && fin(v.a) && fin(v.h) && fin(v.k) && v.a !== 0 },   // vertex form a(x−h)²+k
  exp_fn:       { check: (v) => v && fin(v.A) && fin(v.b) && v.A !== 0 && v.b > 0 && v.b !== 1 },  // A·bˣ
  root_set:     { check: (v) => Array.isArray(v) && v.every(fin) },
  inequality1:  { check: (v) => v && v.lhs && v.rhs && fin(v.lhs.m) && fin(v.lhs.b) && fin(v.rhs.m) && fin(v.rhs.b) && [">", ">=", "<", "<="].includes(v.dir) },
};

/** qty(type, value) — validated quantity constructor; throws on shape violation. */
export function qty(type, value) {
  const t = TYPES[type];
  if (!t) throw new Error(`unknown quantity type '${type}'`);
  if (!t.check(value)) throw new Error(`value does not satisfy type '${type}': ${JSON.stringify(value)}`);
  return { type, value };
}

/* ---- CLOSED named coercions (the only cross-type hops a binding may name) ---- */
export const COERCE = {
  "point→value:x":          { from: "point", to: "value", fn: (p) => p[0] },
  "point→value:y":          { from: "point", to: "value", fn: (p) => p[1] },
  "param→value":            { from: "param", to: "value", fn: (v) => v },
  "param→slope":            { from: "param", to: "slope", fn: (v) => v },
  "int→value":              { from: "int", to: "value", fn: (v) => v },
  "count→value":            { from: "count", to: "value", fn: (v) => v },
  "linear_fn→slope":        { from: "linear_fn", to: "slope", fn: (f) => f.m },
  "quadratic_fn→point:vertex": { from: "quadratic_fn", to: "point", fn: (f) => [f.h, f.k] },
  "root_set→value:sum":     { from: "root_set", to: "value", fn: (rs) => rs.reduce((a, b) => a + b, 0) },
  "root_set→value:max":     { from: "root_set", to: "value", fn: (rs) => Math.max(...rs) },
};

/** applyCoerce(name, q) → coerced qty. Throws on unknown name or type mismatch. */
export function applyCoerce(name, q) {
  const c = COERCE[name];
  if (!c) throw new Error(`unknown coercion '${name}'`);
  if (q.type !== c.from) throw new Error(`coercion '${name}' expects ${c.from}, got ${q.type}`);
  return qty(c.to, c.fn(q.value));
}

/** bindable(fromType, toType) → null (identity) | coercion-name | false. */
export function bindable(fromType, toType) {
  if (fromType === toType) return null;
  for (const [name, c] of Object.entries(COERCE)) if (c.from === fromType && c.to === toType) return name;
  return false;
}

export default { rng, pick, randint, nzint, TYPES, qty, COERCE, applyCoerce, bindable };
