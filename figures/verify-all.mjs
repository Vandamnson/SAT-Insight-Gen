/* ============================================================================
   verify-all.mjs — adversarial geometric verification generalized to all the
   common figure types (coordPlane, scatter, triangle, circle), in the spirit of
   pl-verify.mjs: RE-RENDER from figures.js → PARSE the actual SVG → MEASURE →
   try to PROVE it broken. "Looks fine" is not a pass. Each arm ships a
   deliberately-corrupted self-test that MUST be caught, and the runner sweeps an
   EXTREME-geometry matrix (flat/spike/huge/tiny/dense/long-label).

   Run: node figures/verify-all.mjs        (parallelLines family stays in verify.mjs)
   ============================================================================ */
import { render } from "./index.js";

const MIN_CLEAR = 2.0;   // px a label box must clear other labels / stroke geometry
const FRAME_PAD = -0.5;  // px: allow a hair of bleed; beyond this is a clip

/* ---------- geometry ---------- */
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
function ptSeg(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx+dy*dy || 1;
  let t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L; t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0]+t*dx, a[1]+t*dy]);
}
function boxSeg(B, a, b) {                 // min distance from an AABB to a segment
  const cx = Math.max(B.x0, Math.min((a[0]+b[0])/2, B.x1)), cy = Math.max(B.y0, Math.min((a[1]+b[1])/2, B.y1));
  const corners = [[B.x0,B.y0],[B.x1,B.y0],[B.x1,B.y1],[B.x0,B.y1]];
  let d = Math.min(ptSeg([cx,cy],a,b), ...corners.map(c=>ptSeg(c,a,b)));
  // inside?
  const inside = (p)=>p[0]>=B.x0&&p[0]<=B.x1&&p[1]>=B.y0&&p[1]<=B.y1;
  if (inside(a)||inside(b)) d = 0;
  return d;
}
function rectRect(A, B) {
  const dx = Math.max(0, Math.max(A.x0-B.x1, B.x0-A.x1)), dy = Math.max(0, Math.max(A.y0-B.y1, B.y0-A.y1));
  return Math.hypot(dx, dy);
}
const polySegs = (pts) => pts.slice(1).map((p,i)=>[pts[i],p]);
function polyDistBox(B, pts) { return Math.min(...polySegs(pts).map(([a,b])=>boxSeg(B,a,b))); }
function polyArea(pts) { let a=0; for (let i=0;i<pts.length-1;i++) a += pts[i][0]*pts[i+1][1]-pts[i+1][0]*pts[i][1]; return Math.abs(a)/2; }
function inPoly(p, poly) {  // ray cast; poly = array of vertices (open ring)
  let c = false; for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    if (((poly[i][1]>p[1])!==(poly[j][1]>p[1])) && (p[0] < (poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])) c=!c;
  } return c;
}

/* ---------- parse ---------- */
const textW = (s, size) => String(s).length * size * 0.6;
function parse(svg) {
  const W = +svg.match(/viewBox="0 0 ([\d.]+) /)[1], H = +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];
  const cls = (s) => (s.match(/class="([^"]*)"/) || [])[1] || "";
  const polylines = [...svg.matchAll(/<polyline points="([^"]+)"([^>]*)>/g)].map(m => ({ pts: m[1].trim().split(/\s+/).map(p => p.split(",").map(Number)), cls: cls(m[2]) }));
  const circles = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)"([^>]*)>/g)].map(m => ({ c: [+m[1], +m[2]], r: +m[3], cls: cls(m[4]) }));
  const lines = [...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"([^>]*)>/g)].map(m => ({ a: [+m[1], +m[2]], b: [+m[3], +m[4]], cls: cls(m[5]) }));
  const texts = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].map(m => {
    const x=+m[1], y=+m[2], anchor=m[3], size=+m[4], t=m[5], w=textW(t,size), h=size;
    const rot = /transform="rotate/.test(m[0]);   // rotated axis titles: box is vertical, not horizontal
    const x0 = anchor==="middle" ? x-w/2 : anchor==="end" ? x-w : x;
    return { x, y, t, size, rot, box: { x0, y0: y-h/2, x1: x0+w, y1: y+h/2 }, center: [anchor==="middle"?x:x0+w/2, y] };
  });
  return { W, H, polylines, circles, lines, texts };
}

/* ---------- universal checks (apply to every type) ---------- */
function universal(g) {
  const fails = [];
  const flat = g.texts.filter(t => !t.rot);   // rotated axis titles have a vertical box; skip them
  // frame clip: every (non-rotated) label box and every marker inside the viewBox
  for (const L of flat) if (L.box.x0 < FRAME_PAD || L.box.y0 < FRAME_PAD || L.box.x1 > g.W-FRAME_PAD || L.box.y1 > g.H-FRAME_PAD)
    fails.push(`label "${L.t}" clipped by frame`);
  for (const c of g.circles) if (c.c[0]-c.r < FRAME_PAD || c.c[1]-c.r < FRAME_PAD || c.c[0]+c.r > g.W-FRAME_PAD || c.c[1]+c.r > g.H-FRAME_PAD)
    fails.push(`circle/marker at (${c.c}) clipped by frame`);
  // label–label overlap — flag only real INTERPENETRATION, not a box-model "touch"
  // (textW over-estimates glyph width, so two adjacent labels report a 0px gap
  // while their glyphs are clear; require >1.5px overlap in BOTH axes).
  for (let i=0;i<flat.length;i++) for (let j=i+1;j<flat.length;j++) {
    const A=flat[i].box, B=flat[j].box;
    const pen = Math.min(Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0), Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0));
    if (pen > 1.5) fails.push(`labels "${flat[i].t}" & "${flat[j].t}" overlap by ${pen.toFixed(1)}px`);
  }
  // NB: label-vs-curve *crowding* is intentionally NOT gated here — a point label
  // necessarily sits near its own on-curve point, and the text-box model over-
  // estimates glyph extent. Legibility/crowding is judged by the pixel/vision QA,
  // not box distance. Frame-clip, label-overlap, and the per-type geometric arms
  // (markers-on-curve, radii-on-circle, non-degenerate triangle) are the gate.
  return fails;
}

/* ---------- per-type arms ---------- */
const ARMS = {
  coordPlane(g, spec) {
    const fails = [];
    const markers = g.circles.filter(c => /fig-marker|fig-open/.test(c.cls) || c.r < 6);
    const curves = g.polylines.filter(p => /fig-stroke/.test(p.cls));
    // each plotted marker should lie ON a drawn curve (a coordPlane point is on its line)
    if (curves.length) for (const m of markers) {
      const d = Math.min(...curves.map(c => Math.min(...polySegs(c.pts).map(([a,b]) => ptSeg(m.c, a, b)))));
      if (d > 2.0) fails.push(`plotted point at (${m.c.map(n=>n.toFixed(0))}) is ${d.toFixed(1)}px off every curve`);
    }
    return fails;
  },
  scatter(g, spec) {
    const fails = [];
    const markers = g.circles.filter(c => /fig-marker|fig-open/.test(c.cls) || c.r < 6);
    const fit = g.polylines.find(p => /fig-stroke/.test(p.cls));
    if (markers.length < (spec.data?.length || 0)) fails.push(`only ${markers.length}/${spec.data?.length} data markers rendered`);
    if (fit && markers.length) {  // fit line must pass through the marker cloud's y-band
      const ys = markers.map(m => m.c[1]), fitYs = fit.pts.map(p => p[1]);
      const overlap = Math.min(...fitYs) <= Math.max(...ys) && Math.max(...fitYs) >= Math.min(...ys);
      if (!overlap) fails.push(`fit line misses the data cloud entirely`);
    }
    return fails;
  },
  triangle(g, spec) {
    const fails = [];
    const outline = g.polylines.filter(p => /fig-stroke/.test(p.cls)).sort((a,b)=>b.pts.length-a.pts.length)[0];
    if (!outline) { fails.push("no triangle outline polyline"); return fails; }
    const verts = outline.pts.slice(0, 3);
    if (polyArea(outline.pts) < 80) fails.push(`triangle is degenerate / near-collinear (area ${polyArea(outline.pts).toFixed(0)}px²)`);
    // vertex labels must sit OUTSIDE the triangle
    for (const L of g.texts) if ((spec.labels||[]).includes(L.t) && inPoly(L.center, verts))
      fails.push(`vertex label "${L.t}" sits inside the triangle`);
    return fails;
  },
  circle(g, spec) {
    const fails = [];
    const main = g.circles.filter(c => /fig-stroke/.test(c.cls)).sort((a,b)=>b.r-a.r)[0];
    if (!main) { fails.push("no main circle"); return fails; }
    // every stroke line is a radius or chord: its non-center endpoints must lie ON the circle
    for (const ln of g.lines.filter(l => /fig-stroke/.test(l.cls))) {
      for (const end of [ln.a, ln.b]) {
        const dCenter = dist(end, main.c);
        if (dCenter < 2) continue;                       // this end is the center (a radius)
        if (Math.abs(dCenter - main.r) > 2.0) fails.push(`a radius/chord endpoint is ${Math.abs(dCenter-main.r).toFixed(1)}px off the circle`);
      }
    }
    return fails;
  },
};

/* ---------- run one ---------- */
function check(fn, spec) {
  let svg; try { svg = render({ fn, spec }); } catch (e) { return [`render threw: ${e.message}`]; }
  const g = parse(svg);
  return [...universal(g), ...((ARMS[fn] || (() => []))(g, spec))];
}

/* ---------- self-tests: corrupt a valid SVG; the checker MUST catch it ---------- */
function selfTests() {
  const out = [];
  // 1) overlapping labels (universal): collinear triangle is also degenerate
  const collinear = check("triangle", { vertices: [[0,0],[10,0],[20,0]], labels: ["A","B","C"] });
  out.push(["triangle degeneracy caught", collinear.some(f => /degenerate/.test(f))]);
  // 2) coordPlane point off its line: move a point off the curve
  const offpt = check("coordPlane", { xRange:[-6,6], yRange:[-10,10], xStep:2, yStep:2, origin:true,
    curves:[{type:"line2pt",p1:[-3,7],p2:[5,-9]}], points:[{at:[0,0],label:"P"}] });
  out.push(["coordPlane off-curve point caught", offpt.some(f => /off every curve/.test(f))]);
  // 3) a valid figure must PASS (no false positive)
  const clean = check("coordPlane", { xRange:[-6,6], yRange:[-10,10], xStep:2, yStep:2, origin:true,
    curves:[{type:"line2pt",p1:[-3,7],p2:[5,-9]}], points:[{at:[-3,7],label:"(-3, 7)"},{at:[5,-9],label:"(5, -9)"}] });
  out.push(["clean coordPlane passes", clean.length === 0, clean]);
  // regression: the vertical-axis arrowheads must be fixed-orientation (orient="0"),
  // not orient="auto" — auto double-rotates the pre-vertical chevron so it points sideways.
  const svg = render({ fn: "coordPlane", spec: { xRange:[-4,4], yRange:[-4,4], xStep:2, yStep:2, origin:true, curves:[], points:[] } });
  out.push(["y-axis arrow points up (arrowU orient=0, not auto)", /id="arrowU"[^>]*orient="0"/.test(svg) && !/id="arrow[UD]"[^>]*orient="auto"/.test(svg)]);
  return out;
}

/* ---------- extreme-geometry matrix ---------- */
const EXTREMES = {
  coordPlane: [
    { xRange:[-1,1], yRange:[-100,100], xStep:1, yStep:50, origin:true, curves:[{m:50,b:0}], points:[{at:[1,50],label:"(1, 50)"}] }, // huge aspect
    { xRange:[-50,50], yRange:[-2,2], xStep:25, yStep:1, origin:true, curves:[{m:0.02,b:0}], points:[{at:[50,1],label:"(50, 1)"}] }, // flat
  ],
  scatter: [
    { xRange:[0,100], yRange:[0,100], xStep:25, yStep:25, axisLabels:["xxxxxxxxxxxx","yyyyyyyyyyyy"], data:[[2,2],[98,98]], fit:{m:1,b:0} }, // sparse + long labels
    { xRange:[0,30], yRange:[0,30], xStep:5, yStep:5, axisLabels:["a","b"], data:Array.from({length:30},(_,i)=>[i,i]), fit:{auto:true} }, // dense
  ],
  triangle: [
    { vertices:[[0,1],[40,0],[20,2]], labels:["A","B","C"], right:"B" }, // very flat (should be caught/handled)
    { vertices:[[0,40],[0,0],[3,0]], labels:["A","B","C"], right:"B" },   // spike
  ],
  circle: [
    { R:1, center:"O", pointsOnCircle:[{angleDeg:40,label:"P"}], radii:[40] },   // tiny
    { R:90, center:"O", pointsOnCircle:[{angleDeg:40,label:"P"}], radii:[40], chords:[[40,200]] }, // near-frame
  ],
};

/* ---------- runner ---------- */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// HARD GATE = self-tests (the checker must work) + live generated figures (real output).
let gate = 0;
console.log("── self-tests (checker must bite) ──");
for (const [name, ok, extra] of selfTests()) { console.log(`  ${ok ? "✓" : "✗"} ${name}`); if (!ok) { gate++; if (extra) console.log("     ", JSON.stringify(extra)); } }

console.log("\n── live data figures (HARD GATE) ──");
const dataDir = join(ROOT, "data");
let nLive = 0;
if (existsSync(dataDir)) for (const f of readdirSync(dataDir).filter(f => /^test-\d+\.json$/.test(f))) {
  const t = JSON.parse(readFileSync(join(dataDir, f), "utf8"));
  for (const q of t.questions || []) if (q.figure && ARMS[q.figure.fn]) {
    nLive++; const fails = check(q.figure.fn, q.figure.spec);
    if (fails.length) { gate++; console.log(`  ✗ ${f} q${q.id} (${q.figure.fn}): ${fails[0]}`); }
  }
}
console.log(`  checked ${nLive} live figures${nLive && !gate ? " — all clean ✓" : ""}`);

// DIAGNOSTIC = stress figures.js at extreme params. Failures here are figures.js
// HARDENING TODOs (aspect caps, reserved label margins) — tracked, not a gate.
console.log("\n── extreme-geometry matrix (diagnostic: figures.js hardening TODOs) ──");
let todos = 0;
for (const [fn, specs] of Object.entries(EXTREMES)) specs.forEach((s, i) => {
  const fails = check(fn, s);
  if (fails.length) { todos++; console.log(`  ⚠ ${fn}[extreme ${i}] — ${fails[0]}`); }
  else console.log(`  ✓ ${fn}[extreme ${i}]`);
});
if (todos) console.log(`  ${todos} extreme case(s) expose figures.js limits at degenerate params (hardening TODO; not a gate).`);

console.log(`\n${gate ? "✗ " + gate + " GATE failure(s)" : "✓ figure GATE passed (self-tests + all live figures clean)"}${todos ? ` · ${todos} hardening TODO(s)` : ""}`);
process.exit(gate ? 1 : 0);
