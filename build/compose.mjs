/* ============================================================================
   compose.mjs — CROSS-SKILL Band-7 (≈800) algebra items. Construct-backward, no
   LLM. Each item CHAINS two algebra structures with a forced dependency: step B's
   input IS step A's output, so the item cannot be answered without doing both, in
   order (the guard against "trivially represented" cross-skill). Every answer is
   correct by construction; build/_composecheck.mjs re-derives it independently and
   enforces non-triviality.

     C1  solve a 2×2 system → use the solution (x,y) to find a missing coefficient
     C2  find k so a system has NO solution → use that k to solve a linear equation
     C3  model a 2-quantity context as a system → solve → report a derived quantity
     C4  translate a line by k → its graph meets a line ON the x-axis → find k
   ============================================================================ */

export const CROSS_TYPES = ["C1", "C2", "C3", "C4"];

const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };
const pick = (r, a) => a[Math.floor(r() * a.length)];

/* LaTeX formatting */
const xt = (c) => (c === 1 ? "x" : c === -1 ? "-x" : `${c}x`);
const signed = (n) => (n < 0 ? `- ${-n}` : `+ ${n}`);
const yt = (c) => `${c < 0 ? "-" : "+"} ${Math.abs(c) === 1 ? "" : Math.abs(c)}y`;   // "+ y" / "- 2y"
const lc = (a, b) => `${xt(a)} ${yt(b)}`;                                              // "3x + 2y"
const lc1 = (m, b) => `${xt(m)}${b === 0 ? "" : " " + signed(b)}`;                     // "3x + 2", "-x - 4", "2x"

/* render-stem segment helpers */
const mb = (v) => ({ t: "mathblock", v });
const tx = (v) => ({ t: "text", v });
const mt = (v) => ({ t: "math", v });
const par = (...segs) => ({ t: "p", segs });
const sp = (...d) => d.map((s, i) => ({ step: i + 1, op: s.op, detail: s.detail }));

/* ---- C1: 2×2 system → embedded coefficient ---- */
function c1(r) {
  let sx, sy; do { sx = nz(r, -6, 6); sy = nz(r, -6, 6); } while (Math.abs(sx) < 2 || Math.abs(sy) < 2);
  let a1, b1, a2, b2; do { a1 = nz(r, -4, 4); b1 = nz(r, -4, 4); a2 = nz(r, -4, 4); b2 = nz(r, -4, 4); } while (a1 * b2 - a2 * b1 === 0);
  const c1c = a1 * sx + b1 * sy, c2c = a2 * sx + b2 * sy;
  const ans = nz(r, -5, 5), q = nz(r, -5, 5), rr = ans * sx + q * sy;
  return {
    chain: "C1", skill: "systems_of_linear_equations", scalePoint: 760,
    stem: [
      mb(`\\begin{cases} ${lc(a1, b1)} = ${c1c} \\\\ ${lc(a2, b2)} = ${c2c} \\end{cases}`),
      par(tx("The solution to the given system of equations is "), mt("(x, y)"), tx(". If "), mt(`ax ${yt(q)} = ${rr}`), tx(", what is the value of "), mt("a"), tx("?")),
    ],
    answer: { accept: [String(ans)], tol: 0 },
    solution: [
      par(tx("Solve the system (e.g. by elimination): "), mt(`(x, y) = (${sx}, ${sy})`), tx(".")),
      par(tx("Substitute into "), mt(`ax ${yt(q)} = ${rr}`), tx(":  "), mt(`a(${sx}) ${yt(q).replace("y", `(${sy})`)} = ${rr}`), tx(",  so  "), mt(`a = ${ans}`), tx(".")),
    ],
    fingerprint: ["cross_skill", "C1", "system+coeff"],
    _p: { kind: "C1", a1, b1, c1c, a2, b2, c2c, q, rr, ans },
  };
}

/* ---- C2: no-solution parameter → reuse k to solve a linear equation ---- */
function c2(r) {
  let a1, b1, b2, k; do { a1 = nz(r, -4, 4); b1 = pick(r, [-2, -1, 1, 2]); b2 = nz(r, -4, 4); k = (a1 * b2) / b1; } while (!Number.isInteger(k) || k === 0 || Math.abs(k) > 9);
  const scale = b2 / b1; let c1c = nz(r, -9, 9), c2c; do { c2c = nz(r, -9, 9); } while (c2c === scale * c1c);   // parallel + NOT coincident ⇒ no solution
  const e = nz(r, -6, 6); let f; do { f = nz(r, -5, 5); } while (f === k); const xT = nz(r, -6, 6), g = e + (k - f) * xT;
  return {
    chain: "C2", skill: "systems_of_linear_equations", scalePoint: 790,
    stem: [
      mb(`\\begin{cases} ${lc(a1, b1)} = ${c1c} \\\\ kx ${yt(b2)} = ${c2c} \\end{cases}`),
      par(tx("In the given system of equations, "), mt("k"), tx(" is a constant and the system has no solution. For that value of "), mt("k"), tx(", what value of "), mt("x"), tx(" satisfies "), mt(`kx ${signed(e)} = ${xt(f)} ${signed(g)}`), tx("?")),
    ],
    answer: { accept: [String(xT)], tol: 0 },
    solution: [
      par(tx("No solution ⇒ the lines are parallel: equal slopes. Matching coefficients, "), mt(`k = ${k}`), tx("  (and the constants are not proportional, so it is truly no solution, not coincident).")),
      par(tx("Substitute "), mt(`k = ${k}`), tx(":  "), mt(`${k}x ${signed(e)} = ${xt(f)} ${signed(g)}`), tx(",  so  "), mt(`x = ${xT}`), tx(".")),
    ],
    fingerprint: ["cross_skill", "C2", "nosol-k+solve"],
    _p: { kind: "C2", a1, b1, c1c, b2, c2c, k, e, f, g, xT },
  };
}

/* ---- C3: model a 2-quantity context → system → derived quantity ---- */
const CTX3 = [
  { a: "adult tickets", b: "student tickets", venue: "a school play" },
  { a: "hardcover books", b: "paperback books", venue: "a book fair" },
  { a: "large candles", b: "small candles", venue: "a craft fundraiser" },
  { a: "premium passes", b: "basic passes", venue: "an expo" },
];
function c3(r) {
  const c = pick(r, CTX3);
  let x = randint(r, 6, 16), y = randint(r, 4, 14); if (x <= y) { const t = x; x = y + randint(r, 1, 4); y = t > x ? x - 1 : y; }   // ensure x > y
  if (x <= y) y = x - 2;
  const p1 = randint(r, 4, 9), p2 = randint(r, 2, p1 - 1);   // the "a" item is the pricier one
  const T = x + y, R = p1 * x + p2 * y;
  return {
    chain: "C3", skill: "systems_of_linear_equations", scalePoint: 750,
    stem: [
      par(tx(`At ${c.venue}, ${c.a} cost $${p1} each and ${c.b} cost $${p2} each. A total of `), mt(`${T}`), tx(` were sold for $${R}. How many more ${c.a} than ${c.b} were sold?`)),
    ],
    answer: { accept: [String(x - y)], tol: 0 },
    solution: [
      par(tx("Let the counts be "), mt("x"), tx(" and "), mt("y"), tx(". System:  "), mt(`x + y = ${T}`), tx(",  "), mt(`${p1}x + ${p2}y = ${R}`), tx(".")),
      par(tx("Solve: "), mt(`x = ${x}`), tx(", "), mt(`y = ${y}`), tx(".  The difference is  "), mt(`x - y = ${x - y}`), tx(".")),
    ],
    fingerprint: ["cross_skill", "C3", "model-system-derived"],
    _p: { kind: "C3", p1, p2, T, R, x, y, ans: x - y },
  };
}

/* ---- C4: vertical translation → graphs meet ON the x-axis → find the shift ---- */
function c4(r) {
  const m = nz(r, -4, 4), b = nz(r, -6, 6); let n; do { n = nz(r, -4, 4); } while (n === m);
  const x0 = nz(r, -6, 6), d = -n * x0;            // line L: y = n x + d passes through (x0, 0)
  const k = -(m * x0 + b);                          // g(x) = f(x) + k must have g(x0) = 0
  return {
    chain: "C4", skill: "linear_equations_two_variables", scalePoint: 785,
    stem: [
      par(tx("The function "), mt("f"), tx(" is defined by "), mt(`f(x) = ${lc1(m, b)}`), tx(". The function "), mt("g"), tx(" is defined by "), mt("g(x) = f(x) + k"), tx(", where "), mt("k"), tx(" is a constant. In the "), mt("xy"), tx("-plane, the graph of "), mt("y = g(x)"), tx(" and the line "), mt(`y = ${lc1(n, d)}`), tx(" intersect at a point on the "), mt("x"), tx("-axis. What is the value of "), mt("k"), tx("?")),
    ],
    answer: { accept: [String(k)], tol: 0 },
    solution: [
      par(tx("The line "), mt(`y = ${lc1(n, d)}`), tx(" meets the "), mt("x"), tx("-axis where "), mt(`${lc1(n, d)} = 0`), tx(", i.e. "), mt(`x = ${x0}`), tx(". So the common point is "), mt(`(${x0}, 0)`), tx(".")),
      par(tx("Then "), mt(`g(${x0}) = f(${x0}) + k = 0`), tx(":  "), mt(`(${m * x0 + b}) + k = 0`), tx(",  so  "), mt(`k = ${k}`), tx(".")),
    ],
    fingerprint: ["cross_skill", "C4", "translate-xintercept"],
    _p: { kind: "C4", m, b, n, d, x0, k },
  };
}

const BUILD = { C1: c1, C2: c2, C3: c3, C4: c4 };

/** drawCross(type, r) → a complete cross-skill B7 item (band B7, tier cross-skill). */
export function drawCross(type, r) {
  const it = BUILD[type](r);
  return { program: "SAT", domain: "algebra", band: "B7", target_band: "B7", statementId: "ALG.B7.s1", type: "spr", tier: "cross-skill", difficulty: { scalePoint: it.scalePoint, band: "B7", method: "curated" }, verify: { tier: "cross-skill", correctness: "construct-backward + sympy" }, ...it };
}

export default { drawCross, CROSS_TYPES };
