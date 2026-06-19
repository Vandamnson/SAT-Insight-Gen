// Adversarial geometric verifier for parallelLines figures (readme_diagram_adversarial).
// INDEPENDENT of the generator's intent: it re-renders from figures.js, parses the
// actual SVG, reconstructs geometry from the drawn coordinates, and tries to PROVE
// the figure is broken. Fails loud. "Looks fine" is not a pass.
import * as FIG from "../../assets/figures.js";
import { readFileSync } from "node:fs";

const MIN_CLEAR = 2.5;     // px: label box must clear every non-own element by this
const OWN_ARC_MIN = 0.5;   // px: label must not overlap even its OWN arc
const FRAME_PAD = 1.0;     // px: nothing may sit within this of the viewBox edge

/* ---------- geometry ---------- */
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
function ptSeg(p, a, b) {
  const vx = b[0]-a[0], vy = b[1]-a[1], wx = p[0]-a[0], wy = p[1]-a[1];
  const c1 = vx*wx+vy*wy; if (c1 <= 0) return dist(p, a);
  const c2 = vx*vx+vy*vy; if (c2 <= c1) return dist(p, b);
  const t = c1/c2; return dist(p, [a[0]+t*vx, a[1]+t*vy]);
}
function ccw(a, b, c) { return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]); }
function segHit(a, b, c, d) {
  const d1=ccw(c,d,a), d2=ccw(c,d,b), d3=ccw(a,b,c), d4=ccw(a,b,d);
  return ((d1>0&&d2<0)||(d1<0&&d2>0)) && ((d3>0&&d4<0)||(d3<0&&d4>0));
}
function segSeg(a, b, c, d) {
  if (segHit(a,b,c,d)) return 0;
  return Math.min(ptSeg(a,c,d), ptSeg(b,c,d), ptSeg(c,a,b), ptSeg(d,a,b));
}
const inBox = (p, B) => p[0]>=B.x0 && p[0]<=B.x1 && p[1]>=B.y0 && p[1]<=B.y1;
function boxSeg(B, a, b) {
  if (inBox(a, B) || inBox(b, B)) return 0;
  const c = [[B.x0,B.y0],[B.x1,B.y0],[B.x1,B.y1],[B.x0,B.y1]];
  const e = [[0,1],[1,2],[2,3],[3,0]];
  let m = Infinity;
  for (const [i,j] of e) m = Math.min(m, segSeg(c[i], c[j], a, b));
  return m;
}
const lineIntersect = (a, b, c, d) => {           // intersection of segment-lines ab, cd
  const den = (a[0]-b[0])*(c[1]-d[1]) - (a[1]-b[1])*(c[0]-d[0]);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((a[0]-c[0])*(c[1]-d[1]) - (a[1]-c[1])*(c[0]-d[0])) / den;
  return [a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])];
};
const norm = (deg) => ((deg % 360) + 360) % 360;
const angDiff = (x, y) => { let d = Math.abs(norm(x)-norm(y)); return d > 180 ? 360-d : d; };

/* ---------- parse the SVG into geometry (textW mirrors figures.js: len*size*0.6) ---------- */
const textW = (s, size) => String(s).length * size * 0.6;
function parse(svg) {
  const W = +svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)[1];
  const H = +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];
  const lines = [...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)]
    .map(m => ({ a:[+m[1],+m[2]], b:[+m[3],+m[4]] }));
  const arrows = [], arcs = [];
  for (const m of svg.matchAll(/<path d="([^"]+)"[^>]*?(stroke-linejoin|stroke-width="1.1")/g)) {
    const d = m[1];
    if (m[2] === "stroke-linejoin") {            // arrowhead: M L L
      const n = d.match(/M([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+)/);
      if (n) arrows.push({ p1:[+n[1],+n[2]], tip:[+n[3],+n[4]], p2:[+n[5],+n[6]] });
    } else {                                     // arc: M .. A r r 0 0 sweep ..
      const n = d.match(/M([\d.-]+) ([\d.-]+) A([\d.]+) [\d.]+ 0 0 1 ([\d.-]+) ([\d.-]+)/);
      if (n) arcs.push({ p0:[+n[1],+n[2]], r:+n[3], p1:[+n[3+1],+n[5]] });
    }
  }
  const texts = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]+)<\/text>/g)]
    .map(m => {
      const x=+m[1], y=+m[2], anchor=m[3], size=+m[4], t=m[5];
      const w = textW(t, size), h = size;
      let x0 = anchor==="middle" ? x-w/2 : anchor==="end" ? x-w : x;
      return { x, y, t, size, anchor, box:{ x0, y0:y-h/2, x1:x0+w, y1:y+h/2 }, center:[anchor==="middle"?x:x0+w/2, y] };
    });
  return { W, H, lines, arrows, arcs, texts };
}

/* ---------- the adversarial checks ---------- */
function verify(key, spec) {
  const svg = FIG.parallelLines(spec);
  const g = parse(svg);
  const fails = [];

  // classify lines: 2 horizontal parallels, 1 transversal
  const horiz = g.lines.filter(l => Math.abs(l.a[1]-l.b[1]) < 1).sort((p,q)=>p.a[1]-q.a[1]);
  const trans = g.lines.find(l => Math.abs(l.a[1]-l.b[1]) >= 1);
  if (horiz.length !== 2 || !trans) fails.push(`expected 2 parallels + 1 transversal, got ${g.lines.length} lines`);
  const vertices = horiz.map(h => lineIntersect(h.a, h.b, trans.a, trans.b)).filter(Boolean);

  // assign each arc to its CENTER vertex by best fit (dist to both endpoints ~= r),
  // record its angular span (short way a0 -> a0+span), sampled segments, endpoints-on-line.
  const onLine = (p) => Math.min(ptSeg(p,horiz[0].a,horiz[0].b), ptSeg(p,horiz[1].a,horiz[1].b), ptSeg(p,trans.a,trans.b));
  const arcInfo = g.arcs.map(arc => {
    let best = { v:null, e:Infinity };
    for (const v of vertices) {
      const e = Math.max(Math.abs(dist(v,arc.p0)-arc.r), Math.abs(dist(v,arc.p1)-arc.r));
      if (e < best.e) best = { v, e };
    }
    const v = best.v;
    let a0 = norm(Math.atan2(arc.p0[1]-v[1], arc.p0[0]-v[0])*180/Math.PI);
    let a1 = norm(Math.atan2(arc.p1[1]-v[1], arc.p1[0]-v[0])*180/Math.PI);
    let span = norm(a1-a0); if (span > 180) { [a0,a1]=[a1,a0]; span = 360-span; }   // short way
    const pts = []; for (let i=0;i<=10;i++){ const a=(a0+span*i/10)*Math.PI/180; pts.push([v[0]+arc.r*Math.cos(a), v[1]+arc.r*Math.sin(a)]); }
    const segs = pts.slice(1).map((p,i)=>[pts[i],p]);
    if (best.e > 2) fails.push(`arc (r=${arc.r}) not centered on a vertex (fit err ${best.e.toFixed(1)}px)`);
    if (onLine(arc.p0) > 1.5 || onLine(arc.p1) > 1.5) fails.push(`arc endpoint not on a line (${onLine(arc.p0).toFixed(1)}, ${onLine(arc.p1).toFixed(1)}px off)`);
    return { arc, v, a0, span, segs };
  });

  const allLineSegs = g.lines.map(l => [l.a, l.b]);
  const arrowSegs = g.arrows.flatMap(a => [[a.p1,a.tip],[a.tip,a.p2]]);

  // CHECK 1 — every label clears every non-own element by MIN_CLEAR (own arc = the one it hugs)
  for (const L of g.texts) {
    const isAng = /°/.test(L.t);
    let ownArc = null, ownD = Infinity;
    if (isAng) for (const a of arcInfo) { const d = Math.min(...a.segs.map(([p,q])=>boxSeg(L.box,p,q))); if (d < ownD) { ownD = d; ownArc = a; } }
    for (const [a,b] of allLineSegs) { const d = boxSeg(L.box,a,b); if (d < MIN_CLEAR) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from a line`); }
    for (const [a,b] of arrowSegs) { const d = boxSeg(L.box,a,b); if (d < MIN_CLEAR) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from an arrowhead`); }
    for (const a of arcInfo) {
      const d = Math.min(...a.segs.map(([p,q])=>boxSeg(L.box,p,q)));
      const thresh = (a===ownArc) ? OWN_ARC_MIN : MIN_CLEAR;
      if (d < thresh) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from ${a===ownArc?'its OWN':'another'} arc`);
    }
    for (const O of g.texts) if (O!==L) { const d = rectRect(L.box,O.box); if (d < MIN_CLEAR) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from label "${O.t}"`); }
  }

  // CHECK 2 — each angle label's center lies inside the angular span its OWN arc opens into
  for (const L of angLabels()) {
    let own = null, ownD = Infinity;
    for (const a of arcInfo) { const d = Math.min(...a.segs.map(([p,q])=>boxSeg(L.box,p,q))); if (d < ownD) { ownD = d; own = a; } }
    if (!own) { fails.push(`angle label "${L.t}" has no arc`); continue; }
    const la = norm(Math.atan2(L.center[1]-own.v[1], L.center[0]-own.v[0])*180/Math.PI);
    const into = norm(la - own.a0);
    if (into > own.span + 10) fails.push(`angle label "${L.t}" sits outside its arc's wedge (${into.toFixed(0)}° into a ${own.span.toFixed(0)}° wedge)`);
  }
  function angLabels(){ return g.texts.filter(t => /°/.test(t.t)); }

  // CHECK 3 — nothing clipped by the frame
  const allPts = [...g.lines.flatMap(l=>[l.a,l.b]), ...g.arrows.flatMap(a=>[a.p1,a.tip,a.p2]),
                  ...g.arcs.flatMap(a=>[a.p0,a.p1])];
  for (const p of allPts) if (p[0]<FRAME_PAD||p[0]>g.W-FRAME_PAD||p[1]<FRAME_PAD||p[1]>g.H-FRAME_PAD) fails.push(`drawn point (${p[0].toFixed(0)},${p[1].toFixed(0)}) clipped by frame`);
  for (const t of g.texts) { const B=t.box; if (B.x0<FRAME_PAD||B.x1>g.W-FRAME_PAD||B.y0<FRAME_PAD||B.y1>g.H-FRAME_PAD) fails.push(`label "${t.t}" clipped by frame (box ${B.x0.toFixed(0)}..${B.x1.toFixed(0)})`); }

  return { key, nLines:g.lines.length, nArcs:g.arcs.length, nArrows:g.arrows.length, nLabels:g.texts.length, fails:[...new Set(fails)] };
}
function rectRect(A,B){
  const dx = Math.max(0, Math.max(A.x0-B.x1, B.x0-A.x1));
  const dy = Math.max(0, Math.max(A.y0-B.y1, B.y0-A.y1));
  return Math.hypot(dx,dy);
}

/* ---------- adversarial verifier for parallelBend (the Z/bend figure) ---------- */
function verifyBend(key, spec) {
  const svg = FIG.parallelBend(spec);
  const g = parse(svg);
  const fails = [];
  const pts = svg.match(/<polyline points="([^"]+)"/)[1].split(" ").map(s=>s.split(",").map(Number));
  const cableSegs = pts.slice(1).map((p,i)=>[pts[i],p]);
  const [A,P,B] = pts, verts = [A,P,B];
  const v1=[A[0]-P[0],A[1]-P[1]], v2=[B[0]-P[0],B[1]-P[1]];
  const apb = Math.acos((v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)))*180/Math.PI;
  if (Math.abs(apb-(spec.aDeg+spec.bDeg))>0.5) fails.push(`angle APB=${apb.toFixed(1)}° != aDeg+bDeg=${spec.aDeg+spec.bDeg}°`);
  const arcSegs = g.arcs.map(arc => {
    let v = verts.reduce((bv,vv)=> Math.max(Math.abs(dist(vv,arc.p0)-arc.r),Math.abs(dist(vv,arc.p1)-arc.r)) < Math.max(Math.abs(dist(bv,arc.p0)-arc.r),Math.abs(dist(bv,arc.p1)-arc.r)) ? vv:bv, verts[0]);
    const e = Math.max(Math.abs(dist(v,arc.p0)-arc.r), Math.abs(dist(v,arc.p1)-arc.r));
    if (e>2) fails.push(`bend arc not centered on A/P/B (err ${e.toFixed(1)}px)`);
    let a0=Math.atan2(arc.p0[1]-v[1],arc.p0[0]-v[0]), a1=Math.atan2(arc.p1[1]-v[1],arc.p1[0]-v[0]);
    let d=a1-a0; while(d<=0)d+=2*Math.PI; if(d>Math.PI)d-=2*Math.PI;
    const s=[]; for(let i=0;i<=8;i++){const a=a0+d*i/8;s.push([v[0]+arc.r*Math.cos(a),v[1]+arc.r*Math.sin(a)]);} return s.slice(1).map((p,i)=>[s[i],p]);
  });
  const lineSegs = g.lines.map(l=>[l.a,l.b]);
  const arrowSegs = g.arrows.flatMap(a=>[[a.p1,a.tip],[a.tip,a.p2]]);
  for (const L of g.texts) {
    const isAng=/°/.test(L.t); let own=-1, ownD=Infinity;
    if (isAng) arcSegs.forEach((a,i)=>{const d=Math.min(...a.map(([p,q])=>boxSeg(L.box,p,q)));if(d<ownD){ownD=d;own=i;}});
    for (const [a,b] of [...lineSegs,...cableSegs]) { const d=boxSeg(L.box,a,b); if(d<MIN_CLEAR) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from a line/cable`); }
    for (const [a,b] of arrowSegs) { const d=boxSeg(L.box,a,b); if(d<MIN_CLEAR) fails.push(`label "${L.t}" only ${d.toFixed(1)}px from an arrowhead`); }
    arcSegs.forEach((a,i)=>{const d=Math.min(...a.map(([p,q])=>boxSeg(L.box,p,q)));const th=i===own?OWN_ARC_MIN:MIN_CLEAR;if(d<th)fails.push(`label "${L.t}" only ${d.toFixed(1)}px from ${i===own?'its OWN':'another'} arc`);});
    for (const O of g.texts) if(O!==L){const d=rectRect(L.box,O.box);if(d<MIN_CLEAR)fails.push(`label "${L.t}" only ${d.toFixed(1)}px from label "${O.t}"`);}
  }
  const allPts=[...g.lines.flatMap(l=>[l.a,l.b]),...pts,...g.arcs.flatMap(a=>[a.p0,a.p1])];
  for (const p of allPts) if(p[0]<FRAME_PAD||p[0]>g.W-FRAME_PAD||p[1]<FRAME_PAD||p[1]>g.H-FRAME_PAD) fails.push(`point (${p[0].toFixed(0)},${p[1].toFixed(0)}) clipped`);
  for (const t of g.texts){const B2=t.box;if(B2.x0<FRAME_PAD||B2.x1>g.W-FRAME_PAD||B2.y0<FRAME_PAD||B2.y1>g.H-FRAME_PAD)fails.push(`label "${t.t}" clipped`);}
  return { key, nLabels:g.texts.length, nArcs:g.arcs.length, apb, fails:[...new Set(fails)] };
}

/* ---------- adversarial verifier for parallelogram ---------- */
function verifyPgram(key, spec) {
  const svg = FIG.parallelogram(spec);
  const g = parse(svg);
  const fails = [];
  const V = svg.match(/<polygon points="([^"]+)"/)[1].split(" ").map(s=>s.split(",").map(Number));
  const [A,B,C,D] = V;
  const sides = [[A,B],[B,C],[C,D],[D,A]];
  const ang = (P,u,w)=>{const v1=[u[0]-P[0],u[1]-P[1]],v2=[w[0]-P[0],w[1]-P[1]];return Math.acos((v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)))*180/Math.PI;};
  const aA=ang(A,B,D), aB=ang(B,A,C), aC=ang(C,B,D);
  if (Math.abs(aA-aC)>0.5) fails.push(`opposite angles A,C not equal (${aA.toFixed(1)} vs ${aC.toFixed(1)})`);
  if (Math.abs(aA+aB-180)>0.5) fails.push(`consecutive A,B not supplementary (${(aA+aB).toFixed(1)})`);
  const arcSegs = g.arcs.map(arc => {
    let v=[A,B,C,D].reduce((bv,vv)=>Math.max(Math.abs(dist(vv,arc.p0)-arc.r),Math.abs(dist(vv,arc.p1)-arc.r))<Math.max(Math.abs(dist(bv,arc.p0)-arc.r),Math.abs(dist(bv,arc.p1)-arc.r))?vv:bv,A);
    const e=Math.max(Math.abs(dist(v,arc.p0)-arc.r),Math.abs(dist(v,arc.p1)-arc.r));
    if(e>2) fails.push(`pgram arc not centered on a vertex (err ${e.toFixed(1)})`);
    let a0=Math.atan2(arc.p0[1]-v[1],arc.p0[0]-v[0]),a1=Math.atan2(arc.p1[1]-v[1],arc.p1[0]-v[0]);let d=a1-a0;while(d<=0)d+=2*Math.PI;if(d>Math.PI)d-=2*Math.PI;
    const s=[];for(let i=0;i<=8;i++){const a=a0+d*i/8;s.push([v[0]+arc.r*Math.cos(a),v[1]+arc.r*Math.sin(a)]);}return s.slice(1).map((p,i)=>[s[i],p]);
  });
  for (const L of g.texts) {
    const isAng=/°/.test(L.t); let own=-1,ownD=Infinity;
    if(isAng) arcSegs.forEach((a,i)=>{const dd=Math.min(...a.map(([p,q])=>boxSeg(L.box,p,q)));if(dd<ownD){ownD=dd;own=i;}});
    for(const [a,b] of sides){const dd=boxSeg(L.box,a,b);if(dd<MIN_CLEAR)fails.push(`label "${L.t}" only ${dd.toFixed(1)}px from a side`);}
    arcSegs.forEach((a,i)=>{const dd=Math.min(...a.map(([p,q])=>boxSeg(L.box,p,q)));const th=i===own?OWN_ARC_MIN:MIN_CLEAR;if(dd<th)fails.push(`label "${L.t}" only ${dd.toFixed(1)}px from ${i===own?'its OWN':'another'} arc`);});
    for(const O of g.texts)if(O!==L){const dd=rectRect(L.box,O.box);if(dd<MIN_CLEAR)fails.push(`label "${L.t}" only ${dd.toFixed(1)}px from label "${O.t}"`);}
  }
  for (const p of [...V, ...g.arcs.flatMap(a=>[a.p0,a.p1])]) if(p[0]<FRAME_PAD||p[0]>g.W-FRAME_PAD||p[1]<FRAME_PAD||p[1]>g.H-FRAME_PAD) fails.push(`point clipped (${p[0].toFixed(0)},${p[1].toFixed(0)})`);
  for (const t of g.texts){const B2=t.box;if(B2.x0<FRAME_PAD||B2.x1>g.W-FRAME_PAD||B2.y0<FRAME_PAD||B2.y1>g.H-FRAME_PAD)fails.push(`label "${t.t}" clipped`);}
  return { key, nLabels:g.texts.length, nArcs:g.arcs.length, aA, aB, fails:[...new Set(fails)] };
}

/* ---------- self-test: a deliberately cramped figure MUST be caught ---------- */
const st = verify("SELFTEST", { transversalAngleDeg:60, h:80, upperLabel:"p", lowerLabel:"q",
  angles:[{at:"upper",pos:"bottom-right",text:"(12x+345)°"},{at:"upper",pos:"bottom-left",text:"(9y+210)°"},
          {at:"lower",pos:"top-right",text:"(7k+88)°"},{at:"lower",pos:"top-left",text:"(3m+44)°"}] });
console.log(`[self-test] cramped h=80 figure -> ${st.fails.length} failures ${st.fails.length ? "✓ (verifier bites)" : "✗ SUSPECT: verifier found nothing on a known-bad case"}\n`);

/* ---------- run on all live parallelLines specs ---------- */
import { readdirSync } from "node:fs";
const targets = [], bendTargets = [], pgramTargets = [];
for (const f of readdirSync("../data").filter(x=>/test-\d+\.json/.test(x)).sort()) {
  const d = JSON.parse(readFileSync(`../data/${f}`,"utf8"));
  for (const q of (d.questions||d)) {
    if (q.figure?.fn==="parallelLines") targets.push({ key:`${f.replace(".json","")}-q${q.id}`, spec:q.figure.spec });
    if (q.figure?.fn==="parallelBend") bendTargets.push({ key:`${f.replace(".json","")}-q${q.id}`, spec:q.figure.spec });
    if (q.figure?.fn==="parallelogram") pgramTargets.push({ key:`${f.replace(".json","")}-q${q.id}`, spec:q.figure.spec });
  }
}
let bad = 0;
for (const { key, spec } of targets) {
  const r = verify(key, spec);
  if (r.fails.length) { bad++; console.log(`✗ ${key}  (${r.nLabels} labels, ${r.nArcs} arcs)`); r.fails.forEach(f=>console.log(`    - ${f}`)); }
  else console.log(`✓ ${key}  (${r.nLabels} labels, ${r.nArcs} arcs, ${r.nArrows} arrowheads) — clean`);
}
for (const { key, spec } of bendTargets) {
  const r = verifyBend(key, spec);
  if (r.fails.length) { bad++; console.log(`✗ ${key} [bend]  (${r.nLabels} labels, ${r.nArcs} arcs)`); r.fails.forEach(f=>console.log(`    - ${f}`)); }
  else console.log(`✓ ${key} [bend]  (∠APB=${r.apb.toFixed(0)}°, ${r.nLabels} labels, ${r.nArcs} arcs) — clean`);
}
for (const { key, spec } of pgramTargets) {
  const r = verifyPgram(key, spec);
  if (r.fails.length) { bad++; console.log(`✗ ${key} [pgram]  (${r.nLabels} labels, ${r.nArcs} arcs)`); r.fails.forEach(f=>console.log(`    - ${f}`)); }
  else console.log(`✓ ${key} [pgram]  (∠A=${r.aA.toFixed(0)}° ∠B=${r.aB.toFixed(0)}°, ${r.nLabels} labels, ${r.nArcs} arcs) — clean`);
}
const total = targets.length + bendTargets.length + pgramTargets.length;
console.log(`\n${bad?`✗ ${bad}/${total} figures have failures`:`✓ all ${total} parallel-line figures pass the adversarial geometric checks`}`);