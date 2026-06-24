/* ============================================================================
   advfig.mjs — "GLOVES-OFF" Band-7 (≈800) ADVANCED-MATH FIGURE capstones. Each shows
   a nonlinear graph and forces a CHAIN: read key features → reconstruct the equation
   → apply a transformation / solve a condition → report a derived quantity. The
   rubric has no B7 figure statement, so these compose the hardest figure-bearing
   skills (ADV.B5.s1 reconstruct-from-graph + ADV.B6.s3 translation↔equation, with
   ADV.B7.s1/s2 conditions). Construct-backward, NO LLM; correct by construction;
   build/_advfigcheck.mjs re-derives every answer independently. Figures use the
   standardized square grid + 4-way arrowheads (figures.js coordPlane).

     G1  parabola: reconstruct a (vertex + y-intercept) → translate f(x-s) → y-int of g
     G2  parabola: read the vertex → vertical shift c so g=f+c is tangent to the x-axis
     G3  parabola: reconstruct a → rewrite to standard form ax^2+bx+c → report b+c
     G4  exponential: reconstruct a,b (two marked points) → unknown constant k via a point
     G5  parabola + line: reconstruct → solve the system → the OTHER intersection's x
   ============================================================================ */
import { parabolaFromVertex, parabVertex, expCurve, frameForCurve, vertexTex } from "./graph.mjs";
import { legibilityCheck } from "../verify/legibility.mjs";

export const FIG_TYPES = ["G1", "G2", "G3", "G4", "G5"];

const randint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => { let v; do { v = randint(r, lo, hi); } while (v === 0); return v; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const sgn = (r) => (r() < 0.5 ? -1 : 1);
// stem segment helpers (same shapes the renderer/bank consume)
const mb = (v) => ({ t: "mathblock", v });
const tx = (v) => ({ t: "text", v });
const mt = (v) => ({ t: "math", v });
const par = (...segs) => ({ t: "p", segs });
const sp = (...d) => d.map((s, i) => ({ step: i + 1, op: s.op, detail: s.detail }));
const sgnNum = (n) => (n < 0 ? `- ${-n}` : `+ ${n}`);
const legible = (spec) => legibilityCheck({ incidentals: { numbers: { figure: { fn: "coordPlane", spec } } } }).keep;
const finish = (it) => ({ program: "SAT", domain: "advanced_math", band: "B7", target_band: "B7", type: "spr", tier: "cross-skill", skill: "nonlinear_graphs", difficulty: { scalePoint: it.scalePoint, band: "B7", method: "curated" }, verify: { tier: "cross-skill", correctness: "construct-backward + sympy" }, ...it });

/* ---- G1: reconstruct a (vertex + y-intercept), translate, off-graph y-intercept ---- */
function g1(r) {
  for (let t = 0; t < 400; t++) {
    const a = pick(r, [2, -2, 3, -3]), h = nz(r, -2, 2), vy = a > 0 ? nz(r, -10, -3) : nz(r, 3, 10);
    const c0 = a * h * h + vy;                                  // y-intercept
    if (Math.abs(c0) > 10) continue;
    const q = parabolaFromVertex(a, h, vy), arm = a * 4 + vy;   // arm = f(h±2)
    const spec = frameForCurve([h - 2, h, h + 2, 0], [vy, c0, arm, 0]);
    spec.curves = [q]; spec.points = [{ at: [h, vy], coords: true }, { at: [0, c0], coords: true }];   // BOTH the vertex AND the y-intercept labeled — a is recoverable unambiguously (steep arms make an unlabeled crossing a coin-flip)
    if (!legible(spec)) continue;
    const s = pick(r, [4, 5, 6]) * sgn(r), ans = a * (-s - h) ** 2 + vy;   // g(0)=f(-s)
    return finish({
      chain: "G1", scalePoint: 780, statementId: "ADV.B6.s3",
      stem: [par(tx("The graph of the quadratic function "), mt("f"), tx(" is shown in the "), mt("xy"), tx("-plane, where the vertex is the labeled point "), mt(`(${h}, ${vy})`), tx(". The function "), mt("g"), tx(" is defined by "), mt(`g(x) = f(x ${sgnNum(-s)})`), tx(". What is the "), mt("y"), tx("-coordinate of the "), mt("y"), tx("-intercept of the graph of "), mt("y = g(x)"), tx("?"))],
      answer: { accept: [String(ans)], tol: 0 },
      solution: [
        par(tx("The graph crosses the "), mt("y"), tx("-axis at "), mt(`(0, ${c0})`), tx(". With "), mt(`f(x)=a(x ${sgnNum(-h)})^2 ${sgnNum(vy)}`), tx(", substitute "), mt(`(0, ${c0})`), tx(":  "), mt(`${c0}=a(${-h})^2 ${sgnNum(vy)}`), tx(",  so  "), mt(`a=${a}`), tx(".")),
        par(tx("g(x)=f(x ${sgnNum(-s)}) shifts "), mt("f"), tx(`, so  `), mt(`g(0)=f(${-s})=${a}(${-s} ${sgnNum(-h)})^2 ${sgnNum(vy)}=${ans}`), tx(".")),
      ],
      figure: { fn: "coordPlane", spec },
      fingerprint: ["cross_skill", "G1", "parab-reconstruct-translate-eval"],
      _p: { kind: "G1", a, h, vy, c0, s, ans },
    });
  }
  throw new Error("g1: retries exhausted");
}

/* ---- G2: read the vertex → vertical shift making g=f+c tangent to the x-axis ---- */
function g2(r) {
  for (let t = 0; t < 400; t++) {
    const a = pick(r, [1, 2, -1, -2]), h = nz(r, -3, 3), vy = a > 0 ? nz(r, -9, -2) : nz(r, 2, 9);
    const c0 = a * h * h + vy;
    if (Math.abs(c0) > 11) continue;
    const q = parabolaFromVertex(a, h, vy), arm = a * 4 + vy;
    const spec = frameForCurve([h - 2, h, h + 2, 0], [vy, c0, arm, 0]);
    spec.curves = [q]; spec.points = [{ at: [h, vy], coords: true }];
    if (!legible(spec)) continue;
    const ans = -vy;   // g=f+c tangent to x-axis ⇔ min/max value vy + c = 0 ⇔ c = -vy
    return finish({
      chain: "G2", scalePoint: 770, statementId: "ADV.B7.s1",
      stem: [par(tx("The graph of the quadratic function "), mt("f"), tx(" is shown in the "), mt("xy"), tx("-plane, with vertex "), mt(`(${h}, ${vy})`), tx(". The function "), mt("g"), tx(" is defined by "), mt("g(x) = f(x) + c"), tx(", where "), mt("c"), tx(" is a constant. If the graph of "), mt("y = g(x)"), tx(" intersects the "), mt("x"), tx("-axis at exactly one point, what is the value of "), mt("c"), tx("?"))],
      answer: { accept: [String(ans)], tol: 0 },
      solution: [
        par(tx("Adding "), mt("c"), tx(" shifts the graph vertically, so the "), mt(a > 0 ? "minimum" : "maximum"), tx(" value of "), mt("g"), tx(" is "), mt(`${vy} + c`), tx(".")),
        par(tx("One "), mt("x"), tx("-intercept ⇔ the vertex lies on the "), mt("x"), tx("-axis ⇔ "), mt(`${vy} + c = 0`), tx(",  so  "), mt(`c = ${ans}`), tx(".")),
      ],
      figure: { fn: "coordPlane", spec },
      fingerprint: ["cross_skill", "G2", "parab-vertical-shift-tangent"],
      _p: { kind: "G2", a, h, vy, ans },
    });
  }
  throw new Error("g2: retries exhausted");
}

/* ---- G3: reconstruct a → rewrite to standard form ax^2+bx+c → report b+c ---- */
function g3(r) {
  for (let t = 0; t < 400; t++) {
    const a = pick(r, [2, -2, 3, -3]), h = nz(r, -2, 2), vy = a > 0 ? nz(r, -9, -2) : nz(r, 2, 9);
    const c0 = a * h * h + vy;                          // standard-form constant term c
    if (Math.abs(c0) > 10) continue;
    const q = parabolaFromVertex(a, h, vy), arm = a * 4 + vy;
    const spec = frameForCurve([h - 2, h, h + 2, 0], [vy, c0, arm, 0]);
    spec.curves = [q]; spec.points = [{ at: [h, vy], coords: true }, { at: [0, c0], coords: true }];   // vertex AND y-intercept labeled ⇒ a is recoverable unambiguously
    if (!legible(spec)) continue;
    const b = -2 * a * h, ans = b + c0;                 // f = a x^2 + b x + c0
    return finish({
      chain: "G3", scalePoint: 775, statementId: "ADV.B7.s2",
      stem: [par(tx("The graph of the quadratic function "), mt("f"), tx(" is shown in the "), mt("xy"), tx("-plane, with vertex "), mt(`(${h}, ${vy})`), tx(". When "), mt("f(x)"), tx(" is written in the form "), mt("ax^2 + bx + c"), tx(", what is the value of "), mt("b + c"), tx("?"))],
      answer: { accept: [String(ans)], tol: 0 },
      solution: [
        par(tx("The "), mt("y"), tx("-intercept gives "), mt(`c = ${c0}`), tx("; substituting it into "), mt(`f(x)=a(x ${sgnNum(-h)})^2 ${sgnNum(vy)}`), tx(" gives "), mt(`a = ${a}`), tx(".")),
        par(tx("Expand:  "), mt(`f(x)=${a}x^2 ${sgnNum(b)}x ${sgnNum(c0)}`), tx(",  so  "), mt(`b + c = ${b} ${sgnNum(c0)} = ${ans}`), tx(".")),
      ],
      figure: { fn: "coordPlane", spec },
      fingerprint: ["cross_skill", "G3", "parab-reconstruct-standard-form"],
      _p: { kind: "G3", a, h, vy, b, c0, ans },
    });
  }
  throw new Error("g3: retries exhausted");
}

/* ---- G4: reconstruct an exponential (two marked points) → unknown constant via a point ---- */
function g4(r) {
  for (let t = 0; t < 400; t++) {
    const A = randint(r, 1, 3), b = pick(r, [2, 3]);
    const e = expCurve(A, b, 0), p1 = A * b;            // points (0,A) and (1,A·b)
    const spec = frameForCurve([-1, 0, 1, 2], [0, A, Math.min(p1, 12)]);
    spec.curves = [e]; spec.points = [{ at: [0, A], coords: true }, { at: [1, p1], coords: true }];
    if (!legible(spec)) continue;
    const ans = A * b * b;                              // g(2)=0 ⇒ k=f(2)=A·b^2
    return finish({
      chain: "G4", scalePoint: 770, statementId: "ADV.B7.s1",
      stem: [par(tx("The graph of the exponential function "), mt("f"), tx(" passes through the labeled points "), mt(`(0, ${A})`), tx(" and "), mt(`(1, ${p1})`), tx(", as shown. The function "), mt("g"), tx(" is defined by "), mt("g(x) = f(x) - k"), tx(", where "), mt("k"), tx(" is a constant. If the graph of "), mt("y = g(x)"), tx(" passes through "), mt("(2, 0)"), tx(", what is the value of "), mt("k"), tx("?"))],
      answer: { accept: [String(ans)], tol: 0 },
      solution: [
        par(tx("For "), mt("f(x)=a\\cdot b^{x}"), tx(":  "), mt(`f(0)=a=${A}`), tx("  and  "), mt(`f(1)=ab=${p1}`), tx(",  so  "), mt(`b=${b}`), tx(".  Thus  "), mt(`f(x)=${A}\\cdot ${b}^{x}`), tx(".")),
        par(tx("g(2)=0 ⇒ "), mt(`k=f(2)=${A}\\cdot ${b}^{2}=${ans}`), tx(".")),
      ],
      figure: { fn: "coordPlane", spec },
      fingerprint: ["cross_skill", "G4", "exp-reconstruct-unknown-constant"],
      _p: { kind: "G4", A, b, ans },
    });
  }
  throw new Error("g4: retries exhausted");
}

/* ---- G5: parabola + line → solve the system → the OTHER intersection's x ---- */
function g5(r) {
  for (let t = 0; t < 600; t++) {
    const a = pick(r, [1, -1]), h = nz(r, -2, 2), vy = a > 0 ? nz(r, -6, -2) : nz(r, 2, 6);
    let p1, p2; do { p1 = nz(r, -4, 4); p2 = nz(r, -4, 4); } while (p1 === p2 || p1 === h || p2 === h);   // P distinct from the vertex
    const m = a * (p1 + p2 - 2 * h), c = a * h * h + vy - a * p1 * p2;   // line y=mx+c meets the parabola at x=p1,p2
    const f = (x) => a * (x - h) ** 2 + vy, y1 = f(p1), y2 = f(p2);
    if (Math.abs(y1) > 11 || Math.abs(y2) > 11 || Math.abs(c) > 11) continue;
    const q = parabolaFromVertex(a, h, vy);
    const spec = frameForCurve([h, p1, p2, 0], [vy, y1, y2, 0]);
    spec.curves = [q, { type: "line", m, b: c }]; spec.points = [{ at: [p1, y1], label: "P" }];
    if (!legible(spec)) continue;
    const ans = p2;
    return finish({
      chain: "G5", scalePoint: 800, statementId: "ADV.B6.s3",
      stem: [par(tx("In the "), mt("xy"), tx("-plane, the graph of the quadratic function "), mt("f"), tx(" (vertex "), mt(`(${h}, ${vy})`), tx(") and the line "), mt(`y = ${m === 1 ? "x" : m === -1 ? "-x" : m + "x"} ${sgnNum(c)}`), tx(" intersect at the point "), mt("P"), tx(" shown and one other point. What is the "), mt("x"), tx("-coordinate of the other point of intersection?"))],
      answer: { accept: [String(ans)], tol: 0 },
      solution: [
        par(tx("From the vertex and the "), mt("y"), tx("-intercept, "), mt(`f(x)=${a === 1 ? "" : a === -1 ? "-" : a}(x ${sgnNum(-h)})^2 ${sgnNum(vy)}`), tx(".  Set "), mt("f(x)"), tx(" equal to the line and collect terms:  "), mt(`${a === 1 ? "" : a === -1 ? "-" : a}(x ${sgnNum(-h)})^2 ${sgnNum(vy)} = ${m === 1 ? "x" : m === -1 ? "-x" : m + "x"} ${sgnNum(c)}`), tx(".")),
        par(tx("P is at "), mt(`x = ${p1}`), tx("; the quadratic's two solutions are "), mt(`x = ${Math.min(p1, p2)}`), tx(" and "), mt(`x = ${Math.max(p1, p2)}`), tx(", so the other intersection is at "), mt(`x = ${ans}`), tx(".")),
      ],
      figure: { fn: "coordPlane", spec },
      fingerprint: ["cross_skill", "G5", "parab-line-system-other-root"],
      _p: { kind: "G5", a, h, vy, p1, p2, m, c, ans },
    });
  }
  throw new Error("g5: retries exhausted");
}

const BUILD = { G1: g1, G2: g2, G3: g3, G4: g4, G5: g5 };

/** drawAdvFig(type, r) → a complete ADV Band-7 figure-capstone item. */
export function drawAdvFig(type, r) { return BUILD[type](r); }

export default { drawAdvFig, FIG_TYPES };
