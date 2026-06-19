/* ============================================================================
   fingerprint.mjs — the STRUCTURAL fingerprint (BUILD_SPEC §4.3). The author's
   typed solve_path (a sequence of {op} operations) is the structural signature of
   a problem. Two items with the same op-sequence are the same STRUCTURE even if
   their numbers/context differ (a reskin). Distance to the cell's canonical
   fingerprint says how far an item sits from the textbook-default instance — the
   reskin gate's input. Start with the gate OFF: just log the distribution.
   ============================================================================ */

/** fingerprint(solve_path) -> array of op tokens (the structural signature). */
export function fingerprint(solvePath) {
  return (Array.isArray(solvePath) ? solvePath : []).map((s) => String(s && s.op ? s.op : s)).filter(Boolean);
}

/** levenshtein over op TOKENS (not characters) — edit distance between two
 *  op-sequences. */
function tokenLevenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** structuralDistance(fp, canonical) -> normalized edit distance in [0,1].
 *  0 = identical op-sequence to the canonical (a pure reskin); 1 = maximally
 *  different structure. */
export function structuralDistance(fp, canonical) {
  const a = fingerprint(fp), b = fingerprint(canonical);
  const denom = Math.max(a.length, b.length) || 1;
  return tokenLevenshtein(a, b) / denom;
}

/** jaccardOps — set-overlap distance on op TYPES (order-independent companion
 *  signal; useful when ordering is incidental). */
export function jaccardOps(fpA, fpB) {
  const A = new Set(fingerprint(fpA)), B = new Set(fingerprint(fpB));
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? 1 - inter / uni : 0;
}

export default { fingerprint, structuralDistance, jaccardOps };
