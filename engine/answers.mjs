/* answers — the ONE answer normalizer/comparator (extracted from engine/harvest.mjs,
   where three rounds of "disagreements" turned out to be answer-format artifacts:
   letters vs values, nested parens, "(or …)"/"(choice X)"/"(accept …)" qualifiers,
   fraction↔decimal). Node-side; assets/suite.js carries a verbatim client copy. */

export function normAnswer(a) {
  let s = String(a ?? "").toLowerCase().replace(/π/g, "pi").replace(/°/g, "")
    .replace(/\s|%|degrees|\*/g, "");
  let letter = null;
  const q = s.match(/\(choice([abcd])\)/); // "(choice B)" carries the letter — capture BEFORE stripping
  if (q) letter = q[1];
  s = s.replace(/\((choice[abcd]|or[^)]*|accept[^)]*)\)/g, "");
  const m = s.match(/^([abcd])[)(](.*)$/);
  if (m) { letter = m[1]; s = m[2]; }
  else if (/^[abcd]$/.test(s)) { letter = s; s = ""; }
  s = s.replace(/\(\.?\d[^)]*\)$/, "").replace(/[()]/g, "");
  return { letter, val: s };
}

export function asNum(s) {
  const f = String(s).match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function answersAgree(x, y) {
  const a = normAnswer(x), b = normAnswer(y);
  if (a.letter && b.letter) return a.letter === b.letter;
  if (a.val && a.val === b.val) return true;
  const na = asNum(a.val ?? ""), nb = asNum(b.val ?? "");
  return na != null && nb != null && Math.abs(na - nb) < 1e-9;
}

/** acceptForms(answer) — SPR accept list: the normalized value plus its
 *  fraction/decimal twin so students can grid either form. */
export function acceptForms(answer) {
  const { val } = normAnswer(answer);
  const out = new Set([val]);
  const n = asNum(val);
  if (n != null) {
    if (val.includes("/")) { const d = String(+n.toFixed(4)); if (asNum(d) != null && Math.abs(asNum(d) - n) < 1e-9) out.add(d); }
    else if (Number.isFinite(n) && !Number.isInteger(n)) out.add(String(n));
  }
  return [...out].filter(Boolean);
}

export default { normAnswer, asNum, answersAgree, acceptForms };
