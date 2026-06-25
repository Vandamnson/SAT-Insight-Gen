/* ============================================================================
   figures.js — parametric, monochromatic, print-safe inline-SVG figure library.
   Every export is a pure function  spec -> SVG string  (deterministic: same
   spec always yields the same markup). Colours come only from CSS classes
   (.fig-axis/.fig-grid/.fig-stroke/.fig-fill/.fig-marker/.fig-label/...) so a
   single theme drives every figure and print.css can flatten fills to hairlines.

   Shared model: a fixed viewBox with a margin frame; one world->screen
   projector keeps points, curves and labels aligned; a deterministic
   8-direction label placer avoids collisions.
   Usable in Node (build-time render) and the browser.
   ========================================================================== */

const FONT = 11;                 // figure label size (px, user units)
const ESC = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmt = (n) => {
  if (!isFinite(n)) return "0";
  const r = Math.round(n * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toString();
};

function svg(w, h, body, opts = {}) {
  const a = opts.aria ? ` role="img" aria-label="${ESC(opts.aria)}"` : "";
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"${a} class="fig">${body}</svg>`;
}
const line = (x1, y1, x2, y2, cls = "fig-stroke", extra = "") =>
  `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${cls}" stroke-width="var(--line-w,1.4)" ${extra}/>`;
const poly = (pts, cls = "fig-stroke", extra = "") =>
  `<polyline points="${pts.map(p => `${fmt(p[0])},${fmt(p[1])}`).join(" ")}" class="${cls}" fill="none" stroke-width="var(--line-w,1.4)" ${extra}/>`;
const path = (d, cls = "fig-stroke", extra = "") =>
  `<path d="${d}" class="${cls}" fill="none" stroke-width="var(--line-w,1.4)" ${extra}/>`;
const circ = (cx, cy, r, cls = "fig-marker", extra = "") =>
  `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" class="${cls}" ${extra}/>`;
const txt = (x, y, s, { anchor = "middle", cls = "fig-label", size = FONT, baseline = "middle", style = "" } = {}) =>
  `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="${baseline}" class="${cls}" font-size="${size}" ${style}>${ESC(s)}</text>`;

/* approximate text box (no DOM available at gen-time) */
const textW = (s, size = FONT) => String(s).length * size * 0.6;

/* ---- a deterministic 8-direction label placer --------------------------- */
function makePlacer() {
  const placed = [];           // AABBs already taken {x0,y0,x1,y1}
  const overlaps = (b) => placed.some(p =>
    !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  // dir order of preference
  const DIRS = {
    ne: [1, -1, "start"], n: [0, -1, "middle"], e: [1, 0, "start"],
    se: [1, 1, "start"], nw: [-1, -1, "end"], w: [-1, 0, "end"],
    s: [0, 1, "middle"], sw: [-1, 1, "end"],
  };
  return {
    place(px, py, label, { pref = ["ne", "n", "e", "se", "nw", "w", "s", "sw"], gap = 7, bounds = null, size = FONT } = {}) {
      const w = textW(label, size), h = size;
      for (const d of pref) {
        const [dx, dy, anchor] = DIRS[d];
        const lx = px + dx * gap + (anchor === "middle" ? 0 : 0);
        const ly = py + dy * gap;
        // box around the label given its anchor
        let x0 = lx, x1 = lx + w;
        if (anchor === "middle") { x0 = lx - w / 2; x1 = lx + w / 2; }
        else if (anchor === "end") { x0 = lx - w; x1 = lx; }
        const y0 = ly - h / 2, y1 = ly + h / 2;
        const box = { x0, y0, x1, y1 };
        const inBounds = !bounds || (x0 >= bounds.x0 && x1 <= bounds.x1 && y0 >= bounds.y0 && y1 <= bounds.y1);
        if (inBounds && !overlaps(box)) { placed.push(box); return { x: lx, y: ly, anchor }; }
      }
      // fallback: place to the NE anyway, register it (leader not drawn — rare)
      const dx = 1, dy = -1, anchor = "start";
      const lx = px + dx * gap, ly = py + dy * gap;
      placed.push({ x0: lx, y0: ly - h / 2, x1: lx + w, y1: ly + h / 2 });
      return { x: lx, y: ly, anchor };
    },
    reserve(x0, y0, x1, y1) { placed.push({ x0, y0, x1, y1 }); },
  };
}

/* =========================================================================
   coordPlane — grid, axes, curves, points, optional shaded inequality region
   ========================================================================= */
export function coordPlane(spec) {
  const [xmin, xmax] = spec.xRange, [ymin, ymax] = spec.yRange;
  const xspan = (xmax - xmin) || 1, yspan = (ymax - ymin) || 1;
  const M = spec.margin || 32, ext = 10;   // ext = axis overshoot for arrowheads
  // EQUAL scaling: one data-unit is the SAME number of pixels on both axes, so
  // grid cells are square and a line's slope is undistorted.
  const unit = (spec.plot || 270) / Math.max(xspan, yspan);
  const plotW = xspan * unit, plotH = yspan * unit;
  const L = M, T = M, R = L + plotW, B = T + plotH;
  const W = R + M, H = B + M;
  const sx = (x) => L + (x - xmin) * unit;
  const sy = (y) => B - (y - ymin) * unit;
  const xStep = spec.xStep || niceStep(xmin, xmax);
  const yStep = spec.yStep || niceStep(ymin, ymax);
  const xLab = labelStep(xStep, unit), yLab = labelStep(yStep, unit);  // same rule both axes
  const out = [];                       // defs() is prepended once at return (avoid duplicate IDs)
  const xticks = ticks(xmin, xmax, xStep), yticks = ticks(ymin, ymax, yStep);

  if (spec.showGrid !== false) {
    for (const x of xticks) out.push(line(sx(x), T, sx(x), B, "fig-grid", `stroke-width="0.7"`));
    for (const y of yticks) out.push(line(L, sy(y), R, sy(y), "fig-grid", `stroke-width="0.7"`));
  }
  // axes through 0 (or border), extended past the grid for the arrowheads
  const ax = (ymin <= 0 && ymax >= 0) ? sy(0) : B;       // x-axis screen y
  const ay = (xmin <= 0 && xmax >= 0) ? sx(0) : L;       // y-axis screen x
  out.push(line(L - ext, ax, R + ext, ax, "fig-axis", `marker-start="url(#arrowL)" marker-end="url(#arrow)" stroke-width="1.3"`));
  out.push(line(ay, B + ext, ay, T - ext, "fig-axis", `marker-start="url(#arrowD)" marker-end="url(#arrowU)" stroke-width="1.3"`));   // arrowheads on BOTH ends of the y-axis (4-way axes)
  const [xl, yl] = spec.axisLabels || ["x", "y"];
  out.push(txt(R + ext + 4, ax, xl, { anchor: "start", style: 'font-style="italic"' }));   // on the axis line, past the arrow
  out.push(txt(ay + 9, T - ext + 1, yl, { anchor: "start", baseline: "hanging", style: 'font-style="italic"' }));
  if (spec.origin) out.push(txt(ay - 6, ax + 11, "O", { anchor: "end" }));

  // tick numerals — same label step both axes; reserve their boxes so a point
  // label can never overlap an axis number
  const placer = makePlacer();
  const onStep = (v, s) => Math.abs(v / s - Math.round(v / s)) < 1e-6;
  for (const x of xticks) if (x !== 0 && onStep(x, xLab)) {
    const lab = niceLabel(x), w = textW(lab, FONT - 1);
    out.push(txt(sx(x), ax + 12, lab, { size: FONT - 1 }));
    placer.reserve(sx(x) - w / 2 - 1, ax + 5, sx(x) + w / 2 + 1, ax + 19);
  }
  for (const y of yticks) if (y !== 0 && onStep(y, yLab)) {
    const lab = niceLabel(y), w = textW(lab, FONT - 1);
    out.push(txt(ay - 7, sy(y), lab, { anchor: "end", size: FONT - 1 }));
    placer.reserve(ay - 8 - w, sy(y) - 7, ay - 4, sy(y) + 7);
  }
  if (spec.origin) placer.reserve(ay - 15, ax + 3, ay - 2, ax + 17);
  placer.reserve(ay - 5, T - ext - 5, ay + 15, T - ext + 13);   // y-axis name
  placer.reserve(R + ext + 1, ax - FONT / 2 - 3, R + ext + 6 + textW(xl, FONT), ax + FONT / 2 + 3);  // x-axis name (on axis line)
  placer.reserve(ay - 4, T, ay + 4, B);                         // keep point labels off the y-axis line
  placer.reserve(L, ax - 4, R, ax + 4);                         // and off the x-axis line

  // shaded inequality region — clip the window rectangle to the correct side of
  // y = mx + b (Sutherland–Hodgman half-plane clip). Robust for ANY slope, incl.
  // steep boundaries that exit the window through the top/bottom edges (the old
  // corner-clamp only worked for shallow lines spanning left→right).
  if (spec.shaded) {
    const regions = Array.isArray(spec.shaded) ? spec.shaded : [spec.shaded];   // one half-plane, or a system (overlap reads darker)
    const rect = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]];
    for (const { m, b, ineq } of regions) {
      const above = ineq === ">" || ineq === ">=";
      const sideVal = (p) => (above ? p[1] - (m * p[0] + b) : (m * p[0] + b) - p[1]);   // ≥0 ⇒ in the shaded half-plane
      const isect = (A, B) => { const t = sideVal(A) / (sideVal(A) - sideVal(B)); return [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]; };
      const poly = [];
      for (let i = 0; i < rect.length; i++) {
        const A = rect[i], B = rect[(i + 1) % rect.length], inA = sideVal(A) >= -1e-9, inB = sideVal(B) >= -1e-9;
        if (inA) poly.push(A);
        if (inA !== inB) poly.push(isect(A, B));
      }
      if (poly.length >= 3) out.push(`<polygon points="${poly.map((p) => `${fmt(sx(p[0]))},${fmt(sy(p[1]))}`).join(" ")}" class="fig-fill" opacity="0.5"/>`);
    }
  }

  // dashed reference guides — axis of symmetry (kind "v") / asymptote (kind "h").
  // drawn under the curves (the solid curve overlays) but over the grid/axes.
  for (const g of spec.guides || []) {
    if (g.kind === "v") {
      const gx = sx(g.at);
      out.push(line(gx, T, gx, B, "fig-stroke fig-dash"));
      if (g.label) { const w = textW(g.label); out.push(txt(gx + 5, T + 7, g.label, { anchor: "start", baseline: "hanging" })); placer.reserve(gx + 4, T + 1, gx + 6 + w, T + 15); }   // beside the line, not struck through by it
    } else if (g.kind === "h") {
      const gy = sy(g.at);
      out.push(line(L, gy, R, gy, "fig-stroke fig-dash"));
      if (g.label) { const w = textW(g.label); out.push(txt(R - 3, gy - 5, g.label, { anchor: "end" })); placer.reserve(R - 3 - w, gy - 13, R - 3, gy - 1); }
    }
  }

  // curves — render, and reserve obstacle boxes along them so point labels dodge the line
  for (const c of spec.curves || []) {
    out.push(renderCurve(c, sx, sy, xmin, xmax, ymin, ymax));
    for (const p of curveScreenPts(c, sx, sy, xmin, xmax, ymin, ymax)) placer.reserve(p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4);
  }

  // points + labels (kept off the curve)
  for (const p of spec.points || []) {
    const [px, py] = [sx(p.at[0]), sy(p.at[1])];
    out.push(p.fill === "open" ? circ(px, py, 3.2, "fig-open", `stroke-width="1.4"`) : circ(px, py, 3.2, "fig-marker"));
    const labelText = p.coords ? `(${fmt(p.at[0])}, ${fmt(p.at[1])})` : p.label;   // coords:true → label the point with its coordinates
    if (labelText) {
      const pos = placer.place(px, py, labelText, { gap: 10, bounds: { x0: 2, y0: 2, x1: W - 2, y1: H - 2 } });
      // hard clamp the label box inside the frame so an edge point can never clip
      const lw = textW(labelText, FONT - 0.5), lh = FONT - 0.5;
      const bx0 = pos.anchor === "end" ? pos.x - lw : pos.anchor === "middle" ? pos.x - lw / 2 : pos.x;
      let dx = 0; if (bx0 < 2) dx = 2 - bx0; else if (bx0 + lw > W - 2) dx = (W - 2) - (bx0 + lw);
      let dy = 0; if (pos.y - lh / 2 < 2) dy = 2 - (pos.y - lh / 2); else if (pos.y + lh / 2 > H - 2) dy = (H - 2) - (pos.y + lh / 2);
      out.push(txt(pos.x + dx, pos.y + dy, labelText, { anchor: pos.anchor, size: FONT - 0.5 }));
    }
  }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "coordinate plane" });
}

function renderCurve(c, sx, sy, xmin, xmax, ymin, ymax) {
  if (!c.type && typeof c.m === "number") c = { ...c, type: "line" };   // legacy specs: bare {m,b} ⇒ a line
  if (c.type === "line" || c.type === "line2pt") {
    let m, b;
    if (c.type === "line2pt") { m = (c.p2[1] - c.p1[1]) / (c.p2[0] - c.p1[0]); b = c.p1[1] - m * c.p1[0]; }
    else { m = c.m; b = c.b; }
    // clip to box
    const pts = clipLine(m, b, xmin, xmax, ymin, ymax);
    if (!pts) return "";
    return poly(pts.map(([x, y]) => [sx(x), sy(y)]), c.dash ? "fig-stroke fig-curve fig-dash" : "fig-stroke fig-curve");
  }
  if (c.type === "segment") {
    return line(sx(c.p1[0]), sy(c.p1[1]), sx(c.p2[0]), sy(c.p2[1]), "fig-stroke fig-curve", c.dash ? `stroke-dasharray="4 3"` : "");
  }
  if (c.type === "fn" || c.type === "quadratic" || c.type === "cubic" || c.type === "exponential") {
    const f = c.f || (
      c.type === "quadratic" ? (x) => c.a * x * x + c.b * x + c.c
      : c.type === "exponential" ? (x) => c.a * Math.pow(c.b, x) + (c.k || 0)   // y = a·b^x + k  (asymptote y = k)
      : (x) => c.a * x ** 3 + c.b * x ** 2 + c.c * x + c.d);
    const N = c.samples || 160;
    // Clip to the y-window by INTERPOLATING the exact boundary crossing, then breaking the
    // polyline. (The old code clamped out-of-range points to the edge with a ±1 tolerance,
    // which drew a flat tail where a steep arm exits the frame, or a flat floor when the
    // vertex fell just below the window.) Now the curve leaves/enters exactly at the edge.
    const segs = []; let cur = []; let prev = null;
    const cross = (p, q) => { const out = p.in ? q : p; const yb = out.y > ymax ? ymax : ymin; const t = (yb - p.y) / (q.y - p.y); return [sx(p.x + t * (q.x - p.x)), sy(yb)]; };
    for (let i = 0; i <= N; i++) {
      const x = xmin + (xmax - xmin) * i / N, y = f(x), within = y >= ymin && y <= ymax;
      if (prev) {
        if (prev.in && !within) { cur.push(cross(prev, { x, y })); segs.push(cur); cur = []; }   // exit: add edge crossing, break
        else if (!prev.in && within) cur.push(cross(prev, { x, y }));                              // re-enter: add edge crossing
      }
      if (within) cur.push([sx(x), sy(y)]);
      prev = { x, y, in: within };
    }
    if (cur.length) segs.push(cur);
    return segs.map((s) => poly(s, c.dash ? "fig-stroke fig-curve fig-dash" : "fig-stroke fig-curve")).join("");
  }
  return "";
}

/* =========================================================================
   scatter — markers + optional line of best fit
   ========================================================================= */
export function scatter(spec) {
  const W = spec.w || 340, H = spec.h || 280, M = spec.margin || 34;
  const ML = M + 12;                 // extra LEFT room: y-title + up-to-3-digit tick labels
  const xs = spec.data.map(d => Array.isArray(d) ? d[0] : d.x);
  const ys = spec.data.map(d => Array.isArray(d) ? d[1] : d.y);
  const xmin = spec.xRange ? spec.xRange[0] : 0;
  const xmax = spec.xRange ? spec.xRange[1] : niceMax(Math.max(...xs));
  const ymin = spec.yRange ? spec.yRange[0] : 0;
  const ymax = spec.yRange ? spec.yRange[1] : niceMax(Math.max(...ys));
  const L = ML, R = W - M, T = M - 8, B = H - M;
  const sx = (x) => L + (x - xmin) / (xmax - xmin) * (R - L);
  const sy = (y) => B - (y - ymin) / (ymax - ymin) * (B - T);
  const out = [defs()];
  const xStep = spec.xStep || niceStep(xmin, xmax), yStep = spec.yStep || niceStep(ymin, ymax);
  const xticks = ticks(xmin, xmax, xStep), yticks = ticks(ymin, ymax, yStep);
  for (const x of xticks) out.push(line(sx(x), T, sx(x), B, "fig-grid", `stroke-width="0.6"`));
  for (const y of yticks) out.push(line(L, sy(y), R, sy(y), "fig-grid", `stroke-width="0.6"`));
  out.push(line(L, B, R, B, "fig-axis", `marker-end="url(#arrow)" stroke-width="1.2"`));
  out.push(line(L, B, L, T - 10, "fig-axis", `marker-end="url(#arrowU)" stroke-width="1.2"`)); // arrow above top tick
  const xThin = thinFactor(xticks.length, R - L), yThin = thinFactor(yticks.length, B - T);
  xticks.forEach((x, i) => { if (i % xThin === 0) out.push(txt(sx(x), B + 12, niceLabel(x), { size: FONT - 1 })); });
  yticks.forEach((y, i) => { if (i % yThin === 0 && y !== ymin) out.push(txt(L - 6, sy(y), niceLabel(y), { anchor: "end", size: FONT - 1 })); });
  if (spec.fit) {
    let m, b;
    if (spec.fit.auto) { ({ m, b } = leastSquares(xs, ys)); } else { m = spec.fit.m; b = spec.fit.b; }
    const pts = clipLine(m, b, xmin, xmax, ymin, ymax);
    if (pts) out.push(poly(pts.map(([x, y]) => [sx(x), sy(y)]), "fig-stroke", `stroke-width="1.5"`));
  }
  const r = spec.markerR || 3;
  for (const d of spec.data) {
    const x = Array.isArray(d) ? d[0] : d.x, y = Array.isArray(d) ? d[1] : d.y;
    // NB: for an array point `d.fill` is Array.prototype.fill (truthy) — guard it
    // so spec.marker:"open" is honoured instead of being short-circuited away.
    const open = ((Array.isArray(d) ? null : d.fill) || spec.marker) === "open";
    out.push(open ? circ(sx(x), sy(y), r, "fig-open", `stroke-width="1.3"`) : circ(sx(x), sy(y), r, "fig-marker"));
  }
  const [xl, yl] = spec.axisLabels || ["x", "y"];
  out.push(txt((L + R) / 2, H - 5, xl, { size: FONT }));
  out.push(`<text x="12" y="${(T + B) / 2}" text-anchor="middle" class="fig-label" font-size="${FONT}" transform="rotate(-90 12 ${(T + B) / 2})">${ESC(yl)}</text>`);
  return svg(W, H, out.join(""), { aria: spec.title || "scatterplot" });
}

/* =========================================================================
   dotPlot — stacked dots over a number line (one or more series stacked label)
   ========================================================================= */
export function dotPlot(spec) {
  const [lo, hi] = spec.axisRange;
  const step = spec.step || 1;
  const vals = ticks(lo, hi, step);
  const W = spec.w || 360;
  const seriesArr = spec.series;
  const maxCount = Math.max(1, ...seriesArr.flatMap(s => Object.values(s.counts)));
  const dotR = spec.dotR || 5, gap = 2.5, pitch = 2 * dotR + gap;
  const hasTitle = seriesArr.some(s => s.label);
  const titleH = hasTitle ? 22 : 8;
  const stackH = maxCount * pitch + dotR + 8;
  const ticksH = 16;
  const axisLabelH = spec.axisLabel ? 20 : 0;
  const pad = 12;
  const rowH = titleH + stackH + ticksH + axisLabelH + pad;
  const H = spec.h || (seriesArr.length * rowH);
  const M = 30, L = M, R = W - M;
  const sx = (v) => L + (v - lo) / (hi - lo) * (R - L);
  const out = [];
  seriesArr.forEach((s, si) => {
    const top = si * rowH;
    const baseY = top + titleH + stackH;          // the number line for this series
    if (s.label) out.push(txt((L + R) / 2, top + 14, s.label, { size: FONT + 1, cls: "fig-label", style: 'font-weight="600"' }));
    out.push(line(L, baseY, R, baseY, "fig-axis", `stroke-width="1.2"`));
    for (const v of vals) {
      out.push(line(sx(v), baseY - 3, sx(v), baseY + 3, "fig-axis", `stroke-width="1"`));
      out.push(txt(sx(v), baseY + 14, niceLabel(v), { size: FONT - 1 }));
      const n = s.counts[v] || 0;
      for (let k = 0; k < n; k++) {
        const cy = baseY - dotR - 4 - k * pitch;
        out.push((s.fill === "open")
          ? circ(sx(v), cy, dotR, "fig-open", `stroke-width="1.3"`)
          : circ(sx(v), cy, dotR, "fig-marker"));
      }
    }
    if (spec.axisLabel) out.push(txt((L + R) / 2, baseY + 30, spec.axisLabel, { size: FONT }));
  });
  return svg(W, H, out.join(""), { aria: spec.title || "dot plot" });
}

/* =========================================================================
   histogram — bars over numeric bins; one or two series rendered side-by-side
   ========================================================================= */
export function histogram(spec) {
  // spec.bins: [{from,to}|{label}], spec.series: [{values:[freq...], fill, label}]
  const panels = spec.series.length > 1 && spec.sideBySide !== false
    ? spec.series.map((s, i) => ({ bins: spec.binsList ? spec.binsList[i] : spec.bins, series: [s] }))
    : [{ bins: spec.bins, series: spec.series }];
  const pw = spec.panelW || 240, H = spec.h || 220, gap = 28;
  const W = panels.length * pw + (panels.length - 1) * gap;
  const out = [];
  panels.forEach((pan, pi) => {
    const ox = pi * (pw + gap);
    out.push(`<g transform="translate(${ox},0)">${histPanel(pan, pw, H, spec)}</g>`);
  });
  return svg(W, H, out.join(""), { aria: spec.title || "histogram" });
}
function histPanel(pan, W, H, spec) {
  const M = 34, L = M, R = W - 6, T = 26, B = H - 34;
  const all = pan.series.flatMap(s => s.values);
  const ymax = spec.yMax || niceMax(Math.max(...all, 1));
  const yStep = spec.yStep || niceStep(0, ymax);
  const n = pan.bins.length;
  const bw = (R - L) / n;
  const sy = (v) => B - v / ymax * (B - T);
  const out = [];
  for (const y of ticks(0, ymax, yStep)) {
    out.push(line(L, sy(y), R, sy(y), "fig-grid", `stroke-width="0.6"`));
    out.push(txt(L - 6, sy(y), niceLabel(y), { anchor: "end", size: FONT - 1 }));
  }
  out.push(line(L, B, R, B, "fig-axis", `stroke-width="1.2"`));
  out.push(line(L, B, L, T, "fig-axis", `stroke-width="1.2"`));
  const s = pan.series[0];
  s.values.forEach((v, i) => {
    const x = L + i * bw, h = B - sy(v);
    out.push(`<rect x="${fmt(x + 2)}" y="${fmt(sy(v))}" width="${fmt(bw - 4)}" height="${fmt(h)}" class="fig-fill-strong" stroke="var(--ink)" stroke-width="0.8"/>`);
  });
  // bin labels: an explicit per-bin `label` (a midpoint like "10" or a range
  // like "0–4") names the WHOLE bar, so center it under the bar. Boundary-style
  // bins (numeric `from`, no label) keep edge placement + a final upper edge.
  pan.bins.forEach((b, i) => {
    if (b.label != null) {
      out.push(txt(L + i * bw + bw / 2, B + 12, b.label, { size: FONT - 2 }));
    } else {
      out.push(txt(L + i * bw, B + 12, niceLabel(b.from), { size: FONT - 2 }));
      if (i === n - 1) out.push(txt(R, B + 12, niceLabel(b.to), { size: FONT - 2 }));
    }
  });
  if (s.label) out.push(txt((L + R) / 2, 12, s.label, { size: FONT + 1, style: 'font-weight="600"' }));
  if (spec.xLabel) out.push(txt((L + R) / 2, H - 4, spec.xLabel, { size: FONT - 1 }));
  if (spec.yLabel) out.push(`<text x="11" y="${(T + B) / 2}" text-anchor="middle" class="fig-label" font-size="${FONT - 1}" transform="rotate(-90 11 ${(T + B) / 2})">${ESC(spec.yLabel)}</text>`);
  return out.join("");
}

/* =========================================================================
   barChart — categorical bars
   ========================================================================= */
export function barChart(spec) {
  const W = spec.w || 360, H = spec.h || 240, M = 40, L = M, R = W - 14, T = 20, B = H - 40;
  const cats = spec.categories;
  const vals = spec.values;
  const ymax = spec.yMax || niceMax(Math.max(...vals, 1));
  const yStep = spec.yStep || niceStep(0, ymax);
  const sy = (v) => B - v / ymax * (B - T);
  const bw = (R - L) / cats.length;
  const out = [];
  for (const y of ticks(0, ymax, yStep)) {
    out.push(line(L, sy(y), R, sy(y), "fig-grid", `stroke-width="0.6"`));
    out.push(txt(L - 6, sy(y), niceLabel(y), { anchor: "end", size: FONT - 1 }));
  }
  out.push(line(L, B, R, B, "fig-axis", `stroke-width="1.2"`));
  out.push(line(L, B, L, T, "fig-axis", `stroke-width="1.2"`));
  vals.forEach((v, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    out.push(`<rect x="${fmt(x)}" y="${fmt(sy(v))}" width="${fmt(w)}" height="${fmt(B - sy(v))}" class="fig-fill-strong" stroke="var(--ink)" stroke-width="0.8"/>`);
    out.push(txt(L + i * bw + bw / 2, B + 13, cats[i], { size: FONT - 1 }));
  });
  if (spec.xLabel) out.push(txt((L + R) / 2, H - 4, spec.xLabel, { size: FONT }));
  if (spec.yLabel) out.push(`<text x="12" y="${(T + B) / 2}" text-anchor="middle" class="fig-label" font-size="${FONT}" transform="rotate(-90 12 ${(T + B) / 2})">${ESC(spec.yLabel)}</text>`);
  return svg(W, H, out.join(""), { aria: spec.title || "bar chart" });
}

/* =========================================================================
   Geometry primitives
   ========================================================================= */
export function triangle(spec) {
  // spec.vertices: [[x,y],[x,y],[x,y]] in a 0..100 box; labels:["A","B","C"]
  const W = spec.w || 300, H = spec.h || 240, pad = 38;
  const V = spec.vertices;
  const xs = V.map(p => p[0]), ys = V.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const P = V.map(([x, y]) => [ox + (x - x0) * sc, oy + (y1 - y) * sc]);  // flip y
  const out = [poly([...P, P[0]], "fig-stroke", `stroke-width="1.5"`)];
  const labels = spec.labels || ["A", "B", "C"];
  const cen = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
  P.forEach((p, i) => {
    const dx = p[0] - cen[0], dy = p[1] - cen[1];
    const n = Math.hypot(dx, dy) || 1;
    out.push(txt(p[0] + dx / n * 13, p[1] + dy / n * 13, labels[i], { anchor: "middle", size: FONT + 1, style: 'font-style="italic"' }));
  });
  // right-angle mark
  if (spec.right != null) {
    const i = labels.indexOf(spec.right) >= 0 ? labels.indexOf(spec.right) : spec.right;
    out.push(rightAngleMark(P[i], P[(i + 1) % 3], P[(i + 2) % 3]));
  }
  // altitude from a vertex to opposite side
  if (spec.altitudeFrom != null) {
    const i = labels.indexOf(spec.altitudeFrom) >= 0 ? labels.indexOf(spec.altitudeFrom) : spec.altitudeFrom;
    const A = P[i], Bp = P[(i + 1) % 3], C = P[(i + 2) % 3];
    const foot = footOfPerp(A, Bp, C);
    out.push(line(A[0], A[1], foot[0], foot[1], "fig-stroke", `stroke-dasharray="4 3" stroke-width="1.2"`));
    out.push(rightAngleMark(foot, A, Bp));
    if (spec.altitudeFootLabel) {           // label the foot (e.g. "D"), nudged off the triangle
      const dx = foot[0] - cen[0], dy = foot[1] - cen[1], n = Math.hypot(dx, dy) || 1;
      out.push(txt(foot[0] + dx / n * 13, foot[1] + dy / n * 13, spec.altitudeFootLabel, { anchor: "middle", size: FONT + 1, style: 'font-style="italic"' }));
    }
  }
  // side labels: keys are any two vertex labels, in any order (e.g. "AB","CA",
  // "AC","PR"); resolved via the labels array so custom vertex names work.
  if (spec.sideLabels) {
    for (const [k, val] of Object.entries(spec.sideLabels)) {
      if (!val || typeof k !== "string" || k.length !== 2) continue;
      const a = labels.indexOf(k[0]), b = labels.indexOf(k[1]);
      if (a < 0 || b < 0) continue;
      const mx = (P[a][0] + P[b][0]) / 2, my = (P[a][1] + P[b][1]) / 2;
      const dx = mx - cen[0], dy = my - cen[1], n = Math.hypot(dx, dy) || 1;
      out.push(txt(mx + dx / n * 13, my + dy / n * 13, val, { size: FONT }));
    }
  }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "triangle" });
}

/* =========================================================================
   polygon — a convex N-gon (quadrilateral / pentagon …) with vertex labels,
   optional side labels, optional INTERIOR angle labels, optional diagonal.
   Generalizes triangle(); used for line-intersection / vertex-angle diagrams.
   ========================================================================= */
export function polygon(spec) {
  const W = spec.w || 320, H = spec.h || 260, pad = 44;
  const V = spec.vertices, N = V.length;
  const xs = V.map(p => p[0]), ys = V.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const P = V.map(([x, y]) => [ox + (x - x0) * sc, oy + (y1 - y) * sc]);   // flip y
  const out = [poly([...P, P[0]], "fig-stroke", `stroke-width="1.5"`)];
  const labels = spec.labels || "ABCDEFGH".slice(0, N).split("");
  const cen = [P.reduce((s, p) => s + p[0], 0) / N, P.reduce((s, p) => s + p[1], 0) / N];
  const nudge = (p, dir, d) => { const dx = dir[0] - p[0], dy = dir[1] - p[1], n = Math.hypot(dx, dy) || 1; return [p[0] + dx / n * d, p[1] + dy / n * d]; };
  if (spec.diagonal && spec.diagonal.length === 2) {
    const a = labels.indexOf(spec.diagonal[0]), b = labels.indexOf(spec.diagonal[1]);
    if (a >= 0 && b >= 0) out.push(line(P[a][0], P[a][1], P[b][0], P[b][1], "fig-stroke", `stroke-dasharray="4 3" stroke-width="1.2"`));
  }
  // interior angle labels: just inside each vertex (toward the centroid)
  if (spec.angleLabels) for (const [k, val] of Object.entries(spec.angleLabels)) {
    if (!val) continue; const i = labels.indexOf(k); if (i < 0) continue;
    const q = nudge(P[i], cen, 22);
    out.push(txt(q[0], q[1], val, { anchor: "middle", size: FONT - 1 }));
  }
  // vertex labels: just outside (away from centroid)
  P.forEach((p, i) => { const q = nudge(p, cen, -15); out.push(txt(q[0], q[1], labels[i], { anchor: "middle", size: FONT + 1, style: 'font-style="italic"' })); });
  // side labels at edge midpoints, nudged outward
  if (spec.sideLabels) for (const [k, val] of Object.entries(spec.sideLabels)) {
    if (!val || k.length !== 2) continue; const a = labels.indexOf(k[0]), b = labels.indexOf(k[1]); if (a < 0 || b < 0) continue;
    const mid = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2], q = nudge(mid, cen, -13);
    out.push(txt(q[0], q[1], val, { size: FONT }));
  }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "polygon" });
}

export function rectangle(spec) {
  const W = spec.w || 300, H = spec.h || 200, pad = 40;
  const rw = W - 2 * pad, rh = H - 2 * pad;
  const x = pad, y = pad;
  const out = [`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" class="fig-stroke" stroke-width="1.5"/>`];
  if (spec.diagonal) out.push(line(x, y + rh, x + rw, y, "fig-stroke", `stroke-dasharray="4 3"`));
  const L = spec.labels || {};
  if (L.bottom) out.push(txt(x + rw / 2, y + rh + 14, L.bottom, { size: FONT }));
  if (L.left) out.push(txt(x - 10, y + rh / 2, L.left, { anchor: "end", size: FONT }));
  if (L.diagonal) out.push(txt(x + rw / 2 - 13, y + rh / 2 - 13, L.diagonal, { anchor: "end", size: FONT, style: 'font-style="italic"' }));
  // corner labels
  if (spec.corners) {
    const c = spec.corners; // [TL,TR,BR,BL]
    const pos = [[x, y, "end", "auto"], [x + rw, y, "start", "auto"], [x + rw, y + rh, "start", "hanging"], [x, y + rh, "end", "hanging"]];
    c.forEach((lab, i) => { if (lab) out.push(txt(pos[i][0] + (pos[i][2] === "end" ? -6 : 6), pos[i][1] + (i < 2 ? -6 : 12), lab, { anchor: pos[i][2], size: FONT, style: 'font-style="italic"' })); });
  }
  return svg(W, H, out.join(""), { aria: spec.title || "rectangle" });
}

/* =========================================================================
   prism — a rectangular box (right rectangular prism / cube) in cabinet oblique
   projection: front face true-size, depth receding up-right at 45° at half scale.
   Hidden back edges dashed. Edge labels: width (front-bottom), height (front-left),
   length/depth (top receding edge). spec.dims {l,w,h} set the DRAWN proportions
   (clamped so no edge becomes a sliver — the extreme-geometry rule); spec.labels
   {l,w,h} are the displayed measures. cube => pass equal dims.
   ========================================================================= */
export function prism(spec) {
  const d = spec.dims || { l: 1, w: 1, h: 1 };
  const maxd = Math.max(d.l, d.w, d.h) || 1;
  const base = 130, clamp = (v) => Math.max(0.4, Math.min(1, v / maxd));
  const fw = base * clamp(d.w), fh = base * clamp(d.h), dp = base * clamp(d.l) * 0.5;   // dp = receding half-depth (cabinet)
  const W = fw + dp + 96, H = fh + dp + 70, ox = 48, oy = H - 36;                        // front-bottom-left
  const FBL = [ox, oy], FBR = [ox + fw, oy], FTR = [ox + fw, oy - fh], FTL = [ox, oy - fh];
  const off = (p) => [p[0] + dp, p[1] - dp];
  const BBL = off(FBL), BBR = off(FBR), BTR = off(FTR), BTL = off(FTL);
  const seg = (a, b, dash) => line(a[0], a[1], b[0], b[1], "fig-stroke", `stroke-width="1.5"${dash ? ' stroke-dasharray="4 3"' : ""}`);
  const L = spec.labels || {};
  const out = [
    // hidden back edges first (dashed), so solid edges overlay
    seg(FBL, BBL, 1), seg(BBL, BBR, 1), seg(BBL, BTL, 1),
    // front face
    seg(FBL, FBR), seg(FBR, FTR), seg(FTR, FTL), seg(FTL, FBL),
    // receding + back-visible edges
    seg(FTL, BTL), seg(FTR, BTR), seg(BTL, BTR), seg(FBR, BBR), seg(BBR, BTR),
  ];
  if (L.w) out.push(txt((FBL[0] + FBR[0]) / 2, oy + 15, L.w, { size: FONT }));
  if (L.h) out.push(txt(ox - 9, oy - fh / 2, L.h, { anchor: "end", size: FONT }));
  if (L.l) { const m = [(FTR[0] + BTR[0]) / 2, (FTR[1] + BTR[1]) / 2]; out.push(txt(m[0] + 8, m[1] - 4, L.l, { anchor: "start", size: FONT })); }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "rectangular prism" });
}

// CYLINDER (cabinet-oblique): top ellipse solid, bottom front-arc solid + back-arc
// dashed (hidden), vertical sides; radius drawn across the top, height on the left.
export function cylinder(spec) {
  const d = spec.dims || { r: 1, h: 1 };
  const maxd = Math.max(d.r * 2, d.h) || 1;
  const base = 150, clamp = (v) => Math.max(0.34, Math.min(1, v / maxd));
  const rx = base * clamp(d.r * 2) / 2;            // horizontal (visual) radius
  const ry = Math.max(9, rx * 0.30);               // perspective squash of the ellipses
  const bh = base * clamp(d.h);                    // body height
  const W = rx * 2 + 92, H = bh + ry * 2 + 44, cx = 50 + rx, topY = 24 + ry, botY = topY + bh;
  const L = spec.labels || {};
  const ell = (cy, cls, extra = "") => `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" class="${cls}" fill="none" stroke-width="1.5" ${extra}/>`;
  const arc = (sweep, dash) => path(`M ${fmt(cx - rx)},${fmt(botY)} A ${fmt(rx)},${fmt(ry)} 0 0 ${sweep} ${fmt(cx + rx)},${fmt(botY)}`, "fig-stroke", `stroke-width="1.5"${dash ? ' stroke-dasharray="4 3"' : ""}`);
  const out = [
    arc(1, 1),                                       // bottom BACK half — hidden (dashed)
    line(cx - rx, topY, cx - rx, botY, "fig-stroke", `stroke-width="1.5"`),   // left side
    line(cx + rx, topY, cx + rx, botY, "fig-stroke", `stroke-width="1.5"`),   // right side
    arc(0, 0),                                       // bottom FRONT half — visible (solid)
    ell(topY, "fig-stroke"),                         // top rim (solid)
  ];
  if (L.r) { out.push(line(cx, topY, cx + rx, topY, "fig-stroke", `stroke-width="1"`), circ(cx, topY, 1.8, "fig-marker"), txt(cx + rx / 2, topY - 6, L.r, { size: FONT })); }
  if (L.h) out.push(txt(cx - rx - 9, (topY + botY) / 2, L.h, { anchor: "end", size: FONT }));
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "cylinder" });
}

// PYRAMID (rectangular base, cabinet-oblique): base parallelogram, apex above the
// base centroid, lateral edges to each corner (the back-left one dashed), dashed
// altitude to the centroid. Labels: base length l, depth w, height h (the altitude).
export function pyramid(spec) {
  const d = spec.dims || { l: 1, w: 1, h: 1 };
  const maxd = Math.max(d.l, d.w, d.h) || 1;
  const base = 118, clamp = (v) => Math.max(0.4, Math.min(1, v / maxd));
  const fw = base * clamp(d.l), dp = base * clamp(d.w) * 0.5, ph = base * clamp(d.h);
  const W = fw + dp + 92, H = ph + dp + 60, ox = 46, oy = H - 30;
  const FBL = [ox, oy], FBR = [ox + fw, oy], off = (p) => [p[0] + dp, p[1] - dp];
  const BBL = off(FBL), BBR = off(FBR);
  const ctr = [(FBL[0] + FBR[0] + BBL[0] + BBR[0]) / 4, (FBL[1] + FBR[1] + BBL[1] + BBR[1]) / 4];
  const APX = [ctr[0], ctr[1] - ph];
  const seg = (a, b, dash) => line(a[0], a[1], b[0], b[1], "fig-stroke", `stroke-width="1.5"${dash ? ' stroke-dasharray="4 3"' : ""}`);
  const L = spec.labels || {};
  const out = [
    seg(BBL, BBR, 1), seg(BBL, FBL, 1),              // hidden base edges (back + back-left)
    seg(APX, BBL, 1),                                // hidden lateral edge (to back-left)
    seg(APX, ctr, 1),                                // dashed altitude (apex → centroid)
    seg(FBL, FBR), seg(FBR, BBR),                    // visible base edges
    seg(APX, FBL), seg(APX, FBR), seg(APX, BBR),     // visible lateral edges
  ];
  if (L.l) out.push(txt((FBL[0] + FBR[0]) / 2, oy + 15, L.l, { size: FONT }));
  if (L.w) { const m = [(FBR[0] + BBR[0]) / 2, (FBR[1] + BBR[1]) / 2]; out.push(txt(m[0] + 8, m[1] + 2, L.w, { anchor: "start", size: FONT })); }
  if (L.h) out.push(txt((APX[0] + ctr[0]) / 2 - 6, (APX[1] + ctr[1]) / 2, L.h, { anchor: "end", size: FONT }));
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "rectangular pyramid" });
}

// TRIANGULAR PRISM (cabinet-oblique): front triangle extruded back; only the
// back-bottom edge is hidden (dashed). Labels: base b, triangle height ht (dashed
// altitude on the front face), prism length L (a receding edge).
export function triPrism(spec) {
  const d = spec.dims || { b: 1, ht: 1, L: 1 };
  const maxd = Math.max(d.b, d.ht, d.L) || 1;
  const base = 120, clamp = (v) => Math.max(0.4, Math.min(1, v / maxd));
  const tw = base * clamp(d.b), th = base * clamp(d.ht), dp = base * clamp(d.L) * 0.5;
  const W = tw + dp + 96, H = th + dp + 64, ox = 46, oy = H - 32;
  const FA = [ox, oy], FB = [ox + tw, oy], FC = [ox + tw / 2, oy - th], off = (p) => [p[0] + dp, p[1] - dp];
  const BA = off(FA), BB = off(FB), BC = off(FC);
  const seg = (a, b, dash, w = 1.5) => line(a[0], a[1], b[0], b[1], "fig-stroke", `stroke-width="${w}"${dash ? ' stroke-dasharray="4 3"' : ""}`);
  const L = spec.labels || {};
  const M = [(FA[0] + FB[0]) / 2, oy];                // foot of the front-face altitude
  const out = [
    seg(BA, BB, 1),                                  // back-bottom edge — hidden
    seg(FA, FB), seg(FB, FC), seg(FC, FA),           // front triangle (solid)
    seg(FA, BA), seg(FB, BB), seg(FC, BC),           // receding edges (visible silhouette)
    seg(BA, BC), seg(BB, BC),                         // back triangle upper edges (visible)
    seg(FC, M, 1, 1),                                // front-face altitude (dashed)
  ];
  if (L.b) out.push(txt((FA[0] + FB[0]) / 2, oy + 15, L.b, { size: FONT }));
  if (L.ht) out.push(txt(FC[0] + 5, (FC[1] + M[1]) / 2, L.ht, { anchor: "start", size: FONT }));
  if (L.L) { const m = [(FB[0] + BB[0]) / 2, (FB[1] + BB[1]) / 2]; out.push(txt(m[0] + 8, m[1] + 2, L.L, { anchor: "start", size: FONT })); }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "triangular prism" });
}

// arrowhead as a path (rule 1: compute-don't-eyeball). Legs are the back-
// direction (unit vector pointing FROM the tip back into the line) rotated by
// +-halfAngle, so the head stays symmetric about the line's axis at ANY slope.
function arrowHead(tipX, tipY, bx, by, leg = 9, halfDeg = 26) {
  const n = Math.hypot(bx, by) || 1; bx /= n; by /= n;
  const a = halfDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const p1x = tipX + (bx * c - by * s) * leg, p1y = tipY + (bx * s + by * c) * leg;
  const p2x = tipX + (bx * c + by * s) * leg, p2y = tipY + (-bx * s + by * c) * leg;
  return `<path d="M${fmt(p1x)} ${fmt(p1y)} L${fmt(tipX)} ${fmt(tipY)} L${fmt(p2x)} ${fmt(p2y)}" class="fig-stroke" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
}
// minor angle arc filling the wedge named by `pos` at a transversal vertex
// (rules 2-3). The wedge is bounded by one ray of the horizontal line and one
// ray of the transversal; we always take the SHORT way between them (< 180).
function angleArc(cx, cy, r, pos, ang) {
  const angDeg = ang * 180 / Math.PI;
  const rays = {
    "top-right": [-angDeg, 0], "top-left": [-angDeg, 180],
    "bottom-right": [180 - angDeg, 0], "bottom-left": [180 - angDeg, 180],
  }[pos] || [180 - angDeg, 0];
  let [a0, a1] = rays, d = ((a1 - a0) % 360 + 360) % 360;
  if (d > 180) { [a0, a1] = [a1, a0]; }          // sweep the short way (minor arc)
  const P = (ad) => [cx + r * Math.cos(ad * Math.PI / 180), cy + r * Math.sin(ad * Math.PI / 180)];
  const [x0, y0] = P(a0), [x1, y1] = P(a1);
  return `<path d="M${fmt(x0)} ${fmt(y0)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x1)} ${fmt(y1)}" class="fig-stroke" fill="none" stroke-width="1.1"/>`;
}

export function parallelLines(spec) {
  // two horizontal parallels p (upper) and q (lower) cut by a transversal r
  const W = spec.w || 360, H = spec.h || 240;
  // reserve right margin for the line-name labels (placed at xR+8) so long names
  // like "boundary 1" / "stripe 2" are not clipped at the viewBox edge.
  const rLblW = Math.max(textW(spec.upperLabel || "p", FONT), textW(spec.lowerLabel || "q", FONT));
  const yU = H * 0.36, yL = H * 0.64, xL = 40, xR = W - Math.max(40, rLblW + 16);
  const ang = (spec.transversalAngleDeg || 50) * Math.PI / 180;  // from horizontal
  const cx = W / 2;
  const dx = (H * 0.5) / Math.tan(ang);
  // transversal through (cx, mid) with slope
  const mid = (yU + yL) / 2;
  const tx = (y) => cx + (mid - y) / Math.tan(ang);  // x at given y (going up increases x for typical)
  // transversal endpoints + its unit vector (pointing UP toward the top tip)
  const tTop = [tx(yU - 30), yU - 30], tBot = [tx(yL + 34), yL + 34];
  const ux = Math.cos(ang), uy = -Math.sin(ang);
  const out = [
    line(xL, yU, xR, yU),
    line(xL, yL, xR, yL),
    line(tTop[0], tTop[1], tBot[0], tBot[1]),
    // arrowheads derived from each line's unit vector — symmetric on any slope
    arrowHead(xL, yU, 1, 0), arrowHead(xR, yU, -1, 0),
    arrowHead(xL, yL, 1, 0), arrowHead(xR, yL, -1, 0),
    arrowHead(tTop[0], tTop[1], -ux, -uy), arrowHead(tBot[0], tBot[1], ux, uy),
  ];
  out.push(txt(xR + 8, yU, spec.upperLabel || "p", { anchor: "start", style: 'font-style="italic"' }));
  out.push(txt(xR + 8, yL, spec.lowerLabel || "q", { anchor: "start", style: 'font-style="italic"' }));
  out.push(txt(tTop[0] + 8, tTop[1] - 4, spec.transversalLabel || "r", { anchor: "start", style: 'font-style="italic"' }));

  // ---- angle labels: each label sits in the wedge it names, HUGGING its own
  // intersection ---------------------------------------------------------------
  // The four wedges around an intersection are formed by the horizontal line
  // (rays +x / -x) and the slanted transversal (rays +T up / -T down). A pos
  // like "bottom-right" means the wedge between the +x ray and the downward
  // transversal ray. We seat each label a SMALL, BOUNDED distance out along
  // that wedge's exact bisector so its near edge is ~8-22px from the vertex,
  // and we never let the search push it across the midline toward the other
  // intersection: a label assigned to "lower" must hug line m, "upper" must
  // hug line ℓ. Residual crowding is resolved by small radial/perpendicular
  // nudges (within a tight band) or by shrinking — not by drifting.
  const aSize = FONT;
  const placedBoxes = [];                       // AABBs already occupied
  const hits = (b) => placedBoxes.some(p =>
    !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  // reserve the two horizontal lines + transversal as obstacle bands so a
  // label can never sit on a line.
  const lineBand = 7;
  placedBoxes.push({ x0: xL - 12, y0: yU - lineBand, x1: xR + 12, y1: yU + lineBand });
  placedBoxes.push({ x0: xL - 12, y0: yL - lineBand, x1: xR + 12, y1: yL + lineBand });
  for (let y = yU - 34; y <= yL + 34; y += 5) {
    const x = tx(y);
    placedBoxes.push({ x0: x - lineBand, y0: y - 3, x1: x + lineBand, y1: y + 3 });
  }
  // reserve the line names (right edge) and the transversal name (top)
  placedBoxes.push({ x0: xR + 4, y0: yU - 9, x1: xR + 12 + rLblW, y1: yU + 9 });
  placedBoxes.push({ x0: xR + 4, y0: yL - 9, x1: xR + 12 + rLblW, y1: yL + 9 });
  placedBoxes.push({ x0: tx(yU - 30) + 1, y0: yU - 42, x1: tx(yU - 30) + 16, y1: yU - 26 });
  // unit vector along the transversal pointing UP (toward smaller y)
  const tvx = Math.cos(ang), tvy = -Math.sin(ang);   // up-right for ang in (0,90)
  const Iu = [tx(yU), yU], Il = [tx(yL), yL];
  // how far a label center may sit from ITS line, vertically. Keep it under
  // half the line gap so a label always stays clearly on its own side of the
  // midline (mid = (yU+yL)/2) and can't be read against the wrong intersection.
  const halfGap = (yL - yU) / 2;
  const bandY = Math.min(24, halfGap - 4);           // max |label.y - lineY|
  const rArc = Math.min(18, halfGap - 8);            // angle-arc radius (rule 2)
  for (const a of spec.angles || []) {
    const I = a.at === "lower" ? Il : Iu;
    const lineY = I[1];
    const pos = a.pos || "bottom-right";
    const isTop = pos.startsWith("top");
    const isLeft = pos.endsWith("left");
    // draw the minor arc in THIS wedge; the label below shares the same wedge
    out.push(angleArc(I[0], I[1], rArc, pos, ang));
    // horizontal ray for this side, transversal ray for top(up)/bottom(down)
    const hrx = isLeft ? -1 : 1, hry = 0;
    const trx = isTop ? tvx : -tvx, trry = isTop ? tvy : -tvy;
    // exact wedge bisector
    let dirx = hrx + trx, diry = hry + trry;
    const dn = Math.hypot(dirx, diry) || 1; dirx /= dn; diry /= dn;
    // does the wedge lie above (toward ℓ) or below (toward m) the line? Used to
    // keep the label on the correct side of its own line.
    const sideUp = diry < 0;                          // true => above the line
    // try progressively smaller sizes so a long label can shrink rather than
    // drift across the figure.
    let placed = null;
    for (const size of [aSize, aSize - 1, aSize - 2]) {
      const w = textW(a.text, size), h = size;
      // near edge of the box ~8-22px from the vertex: start so the box just
      // clears the line band, then allow only a few short radial steps.
      const reach = Math.max(Math.abs(dirx) * (w / 2), Math.abs(diry) * (h / 2));
      const start = Math.ceil(Math.max(lineBand + 2, rArc + 5) + reach);  // clear the arc
      // cap the radial distance: the label center must stay within bandY of its
      // own line vertically. |diry|*dist <= bandY  =>  dist <= bandY/|diry|.
      const distCapY = Math.abs(diry) > 1e-3 ? (bandY + h / 2) / Math.abs(diry) : Infinity;
      const maxDist = Math.max(start, Math.min(start + 16, distCapY));
      // candidate offsets: a couple of short radial steps, each with small
      // perpendicular nudges that slide the label along its line, away from
      // the transversal (in the wedge's horizontal direction) to dodge crowding
      // without leaving the band.
      const nudge = isLeft ? -1 : 1;                  // slide further out along the line
      const cands = [];
      for (let dist = start; dist <= maxDist + 0.5; dist += 4) {
        for (const slide of [0, 8, 16, -6]) {
          cands.push([I[0] + dirx * dist + slide * nudge, I[1] + diry * dist]);
        }
      }
      for (const [cxC, cyRaw] of cands) {
        // clamp the center to the band on the correct side of the line so a
        // residual push can never cross toward the other intersection.
        const lo = sideUp ? lineY - bandY : lineY + lineBand + h / 2;
        const hi = sideUp ? lineY - lineBand - h / 2 : lineY + bandY;
        const cyC = Math.max(Math.min(cyRaw, Math.max(lo, hi)), Math.min(lo, hi));
        const box = { x0: cxC - w / 2 - 2, y0: cyC - h / 2 - 2, x1: cxC + w / 2 + 2, y1: cyC + h / 2 + 2 };
        if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2) continue;  // keep in frame
        if (!hits(box)) { placed = { x: cxC, y: cyC, box, size }; break; }
      }
      if (placed) break;
    }
    if (!placed) {
      // last resort: seat it at the bounded start distance even if tight, but
      // clamped to its own band so it still belongs to the right intersection.
      const w = textW(a.text, aSize), h = aSize;
      const reach = Math.max(Math.abs(dirx) * (w / 2), Math.abs(diry) * (h / 2));
      const start = Math.ceil(lineBand + 2 + reach);
      const cxC = I[0] + dirx * start;
      const cyC = sideUp ? lineY - lineBand - h / 2 : lineY + lineBand + h / 2;
      placed = { x: cxC, y: cyC, size: aSize, box: { x0: cxC - w / 2 - 2, y0: cyC - h / 2 - 2, x1: cxC + w / 2 + 2, y1: cyC + h / 2 + 2 } };
    }
    placedBoxes.push(placed.box);
    out.push(txt(placed.x, placed.y, a.text, { size: placed.size, anchor: "middle" }));
  }
  return svg(W, H, out.join(""), { aria: spec.title || "parallel lines cut by a transversal" });
}

export function parallelBend(spec) {
  // Two horizontal parallels with a BENT transversal A(on upper)->P(between)->B(on
  // lower). Marked angle at A = angle segment AP makes with the upper line (to the
  // right); at B = angle BP makes with the lower line (to the right); unknown at P =
  // angle APB, which equals (A-angle)+(B-angle) via a parallel drawn through P.
  // All positions are computed from aDeg/bDeg — nothing hand-placed.
  const W = spec.w || 360, H = spec.h || 240;
  const yU = H * 0.30, yL = H * 0.74, midY = (yU + yL) / 2, xL = 40, xR = W - 40;
  const aDeg = spec.aDeg, bDeg = spec.bDeg;
  const a = aDeg * Math.PI / 180, b = bDeg * Math.PI / 180;
  const Px = W * 0.54, Py = midY;
  const A = [Px - (midY - yU) / Math.tan(a), yU];   // on upper line, up-left of P
  const B = [Px - (yL - midY) / Math.tan(b), yL];   // on lower line, down-left of P
  const nrm = (d) => ((d % 360) + 360) % 360;
  const angTo = (f, t) => Math.atan2(t[1] - f[1], t[0] - f[0]) * 180 / Math.PI;
  const out = [
    line(xL, yU, xR, yU), line(xL, yL, xR, yL),
    arrowHead(xL, yU, 1, 0), arrowHead(xR, yU, -1, 0), arrowHead(xL, yL, 1, 0), arrowHead(xR, yL, -1, 0),
    `<polyline points="${fmt(A[0])},${fmt(A[1])} ${fmt(Px)},${fmt(Py)} ${fmt(B[0])},${fmt(B[1])}" class="fig-stroke" fill="none" stroke-width="1.5"/>`,
  ];
  for (const p of [A, B, [Px, Py]]) out.push(circ(p[0], p[1], 2.4, "fig-marker"));
  out.push(txt(xR + 8, yU, spec.upperLabel || "p", { anchor: "start", style: 'font-style="italic"' }));
  out.push(txt(xR + 8, yL, spec.lowerLabel || "q", { anchor: "start", style: 'font-style="italic"' }));
  const rArc = 16;
  // collision-aware: draw the arc, then push the label out along the wedge bisector
  // until its box clears every bounding ray (line + cable) by a margin (rule: the
  // algorithm pushes out and measures; a fixed offset fails for narrow wedges).
  const arcLbl = (C, r1, r2, text, colliders) => {
    let a0 = nrm(r1), a1 = nrm(r2), span = nrm(a1 - a0); if (span > 180) { [a0, a1] = [a1, a0]; span = 360 - span; }
    const P0 = [C[0] + rArc * Math.cos(a0 * Math.PI / 180), C[1] + rArc * Math.sin(a0 * Math.PI / 180)];
    const P1 = [C[0] + rArc * Math.cos(a1 * Math.PI / 180), C[1] + rArc * Math.sin(a1 * Math.PI / 180)];
    out.push(`<path d="M${fmt(P0[0])} ${fmt(P0[1])} A${rArc} ${rArc} 0 0 1 ${fmt(P1[0])} ${fmt(P1[1])}" class="fig-stroke" fill="none" stroke-width="1.1"/>`);
    if (!text) return;
    const bis = (a0 + span / 2) * Math.PI / 180, w = textW(text, FONT), h = FONT;
    const r0 = rArc + Math.max(w, h) / 2 + 3;   // start far enough out to clear the OWN arc
    let pos = null;
    for (let r = r0; r <= r0 + 40; r += 2) {
      const cx = C[0] + r * Math.cos(bis), cy = C[1] + r * Math.sin(bis);
      const box = { x0: cx-w/2-1.5, y0: cy-h/2-1.5, x1: cx+w/2+1.5, y1: cy+h/2+1.5 };
      if (Math.min(...colliders.map(([a,b]) => boxSegD(box, a, b))) >= 2.6) { pos = [cx, cy]; break; }
    }
    if (!pos) pos = [C[0] + (r0+20)*Math.cos(bis), C[1] + (r0+20)*Math.sin(bis)];
    out.push(txt(pos[0], pos[1], text, { anchor: "middle" }));
  };
  const upRay = [[xL,yU],[xR,yU]], loRay = [[xL,yL],[xR,yL]], capA = [A,[Px,Py]], capB = [[Px,Py],B];
  if (spec.labels?.A) arcLbl(A, 0, angTo(A, [Px, Py]), spec.labels.A, [upRay, capA]);
  if (spec.labels?.B) arcLbl(B, angTo(B, [Px, Py]), 0, spec.labels.B, [loRay, capB]);
  if (spec.labels?.P) arcLbl([Px, Py], angTo([Px, Py], A), angTo([Px, Py], B), spec.labels.P, [capA, capB]);
  return svg(W, H, out.join(""), { aria: spec.title || "bent transversal between two parallel lines" });
}

export function parallelogram(spec) {
  // Slanted parallelogram ABCD (A bottom-left, B bottom-right, C top-right, D top-left;
  // AB || DC, AD || BC). Interior angle at A = spec.angleA. Vertices and interior-angle
  // arcs are all computed; angle labels use collision-aware placement toward the interior.
  const W = spec.w || 340, H = spec.h || 240, pad = 46, angleA = (spec.angleA || 110) * Math.PI / 180;
  const baseW = spec.baseW || 150, side = spec.side || 110;
  // math coords (y up), then center + flip to SVG
  const Am = [0, 0], Bm = [baseW, 0], Dm = [side * Math.cos(angleA), side * Math.sin(angleA)];
  const Cm = [Bm[0] + Dm[0], Dm[1]];
  const xs = [Am, Bm, Cm, Dm].map(p => p[0]), ys = [Am, Bm, Cm, Dm].map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const map = (p) => [ox + (p[0] - x0) * sc, oy + (y1 - p[1]) * sc];     // flip y
  const A = map(Am), B = map(Bm), C = map(Cm), D = map(Dm);
  const V = { A, B, C, D };
  const cen = [(A[0] + B[0] + C[0] + D[0]) / 4, (A[1] + B[1] + C[1] + D[1]) / 4];
  const out = [`<polygon points="${[A, B, C, D].map(p => `${fmt(p[0])},${fmt(p[1])}`).join(" ")}" class="fig-stroke" fill="none" stroke-width="1.5"/>`];
  if (spec.diagonal) out.push(line(A[0], A[1], C[0], C[1], "fig-stroke", `stroke-dasharray="4 3"`));
  // vertex letters, nudged OUTWARD from the centroid
  const names = spec.vertexLabels || { A: "A", B: "B", C: "C", D: "D" };
  for (const k of ["A", "B", "C", "D"]) {
    if (!names[k]) continue;
    const p = V[k], dx = p[0] - cen[0], dy = p[1] - cen[1], n = Math.hypot(dx, dy) || 1;
    out.push(txt(p[0] + dx / n * 14, p[1] + dy / n * 14, names[k], { anchor: "middle", size: FONT + 1, style: 'font-style="italic"' }));
  }
  // interior-angle arcs + collision-aware labels at requested vertices
  const adj = { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["A", "C"] };
  const nrm = (d) => ((d % 360) + 360) % 360;
  const sides = [[A, B], [B, C], [C, D], [D, A]];
  const rArc = 18;
  for (const [k, text] of Object.entries(spec.angles || {})) {
    const P = V[k], [u, w_] = adj[k];
    let a0 = nrm(Math.atan2(V[u][1] - P[1], V[u][0] - P[0]) * 180 / Math.PI);
    let a1 = nrm(Math.atan2(V[w_][1] - P[1], V[w_][0] - P[0]) * 180 / Math.PI);
    let span = nrm(a1 - a0); if (span > 180) { [a0, a1] = [a1, a0]; span = 360 - span; }
    const P0 = [P[0] + rArc * Math.cos(a0 * Math.PI / 180), P[1] + rArc * Math.sin(a0 * Math.PI / 180)];
    const P1 = [P[0] + rArc * Math.cos(a1 * Math.PI / 180), P[1] + rArc * Math.sin(a1 * Math.PI / 180)];
    out.push(`<path d="M${fmt(P0[0])} ${fmt(P0[1])} A${rArc} ${rArc} 0 0 1 ${fmt(P1[0])} ${fmt(P1[1])}" class="fig-stroke" fill="none" stroke-width="1.1"/>`);
    const bis = (a0 + span / 2) * Math.PI / 180, tw = textW(text, FONT), th = FONT;
    const r0 = rArc + Math.max(tw, th) / 2 + 3;
    let pos = null;
    for (let r = r0; r <= r0 + 40; r += 2) {
      const cx = P[0] + r * Math.cos(bis), cy = P[1] + r * Math.sin(bis);
      const box = { x0: cx - tw / 2 - 1.5, y0: cy - th / 2 - 1.5, x1: cx + tw / 2 + 1.5, y1: cy + th / 2 + 1.5 };
      if (Math.min(...sides.map(([a, b]) => boxSegD(box, a, b))) >= 2.6) { pos = [cx, cy]; break; }
    }
    if (!pos) pos = [P[0] + (r0 + 18) * Math.cos(bis), P[1] + (r0 + 18) * Math.sin(bis)];
    out.push(txt(pos[0], pos[1], text, { anchor: "middle" }));
  }
  return svg(W, H, out.join(""), { aria: spec.title || "parallelogram" });
}

export function circle(spec) {
  const W = spec.w || 280, H = spec.h || 280, cx = W / 2, cy = H / 2, R = spec.R || Math.min(W, H) / 2 - 40;
  const out = [`<circle cx="${cx}" cy="${cy}" r="${R}" class="fig-stroke" stroke-width="1.5"/>`];
  if (spec.showCenter !== false) { out.push(circ(cx, cy, 2.2, "fig-marker")); out.push(txt(cx - 6, cy + 10, spec.centerLabel || "O", { anchor: "end", style: 'font-style="italic"' })); }
  const P = {};
  for (const p of spec.pointsOnCircle || []) {
    const a = (p.angleDeg) * Math.PI / 180;
    const px = cx + R * Math.cos(a), py = cy - R * Math.sin(a);
    P[p.label] = [px, py];
    out.push(circ(px, py, 2.6, "fig-marker"));
    out.push(txt(px + 12 * Math.cos(a), py - 12 * Math.sin(a), p.label, { style: 'font-style="italic"' }));
  }
  for (const r of spec.radii || []) { const a = r * Math.PI / 180; out.push(line(cx, cy, cx + R * Math.cos(a), cy - R * Math.sin(a), "fig-stroke")); }
  for (const ch of spec.chords || []) {
    const a1 = ch[0] * Math.PI / 180, a2 = ch[1] * Math.PI / 180;
    out.push(line(cx + R * Math.cos(a1), cy - R * Math.sin(a1), cx + R * Math.cos(a2), cy - R * Math.sin(a2), "fig-stroke"));
  }
  for (const t of spec.tangents || []) {
    const a = t.atAngleDeg * Math.PI / 180; const px = cx + R * Math.cos(a), py = cy - R * Math.sin(a);
    const ext = t.to || [px + 60 * Math.sin(a), py + 60 * Math.cos(a)];
    out.push(line(px, py, ext[0], ext[1], "fig-stroke"));
    if (t.label) out.push(txt(ext[0], ext[1] + 12, t.label, { style: 'font-style="italic"' }));
  }
  return svg(W, H, defs() + out.join(""), { aria: spec.title || "circle" });
}

/* ---- HTML tables (not SVG: reflow + print-clean) ------------------------- */
export function table(spec) {
  // spec.kind: 'xy'|'frequency'|'twoway'|'value' ; headers:[...]; rows:[[...]]
  const ruled = spec.kind === "xy" || spec.kind === "value";
  const cap = spec.caption ? `<caption>${ESC(spec.caption)}</caption>` : "";
  const head = `<thead><tr>${spec.headers.map(h => `<th>${ESC(h)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${spec.rows.map(r => `<tr>${r.map(c => `<td>${ESC(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<table class="data${ruled ? " ruled" : ""}">${cap}${head}${body}</table>`;
}

/* ---- shared helpers ----------------------------------------------------- */
function defs() {
  return `<defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--ink)" stroke-width="1"/></marker>
    <marker id="arrowL" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="none" stroke="var(--ink)" stroke-width="1"/></marker>
    <marker id="arrowU" markerWidth="8" markerHeight="8" refX="3" refY="0" orient="0"><path d="M0,6 L3,0 L6,6" fill="none" stroke="var(--ink)" stroke-width="1"/></marker>
    <marker id="arrowD" markerWidth="8" markerHeight="8" refX="3" refY="6" orient="0"><path d="M0,0 L3,6 L6,0" fill="none" stroke="var(--ink)" stroke-width="1"/></marker>
  </defs>`;
}
function rightAngleMark(corner, a, b) {
  const u = unit(corner, a), v = unit(corner, b), s = 9;
  const p1 = [corner[0] + u[0] * s, corner[1] + u[1] * s];
  const p3 = [corner[0] + v[0] * s, corner[1] + v[1] * s];
  const p2 = [p1[0] + v[0] * s, p1[1] + v[1] * s];
  return poly([p1, p2, p3], "fig-stroke", `stroke-width="1"`);
}
function unit(from, to) { const dx = to[0] - from[0], dy = to[1] - from[1], n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n]; }
// distance from point to segment, and from an AABB to a segment (for collision-aware
// label placement — push out & measure rather than hand-tuning offsets).
function ptSegD(p, a, b) {
  const vx = b[0]-a[0], vy = b[1]-a[1], wx = p[0]-a[0], wy = p[1]-a[1];
  const c1 = vx*wx+vy*wy; if (c1 <= 0) return Math.hypot(wx, wy);
  const c2 = vx*vx+vy*vy; if (c2 <= c1) return Math.hypot(p[0]-b[0], p[1]-b[1]);
  const t = c1/c2; return Math.hypot(p[0]-(a[0]+t*vx), p[1]-(a[1]+t*vy));
}
function _ccw(a,b,c){ return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]); }
function _segHit(p1,p2,p3,p4){ const d1=_ccw(p3,p4,p1),d2=_ccw(p3,p4,p2),d3=_ccw(p1,p2,p3),d4=_ccw(p1,p2,p4);
  return ((d1>0&&d2<0)||(d1<0&&d2>0)) && ((d3>0&&d4<0)||(d3<0&&d4>0)); }
function boxSegD(B, a, b) {
  const inb = (p)=> p[0]>=B.x0&&p[0]<=B.x1&&p[1]>=B.y0&&p[1]<=B.y1;
  if (inb(a) || inb(b)) return 0;
  const c=[[B.x0,B.y0],[B.x1,B.y0],[B.x1,B.y1],[B.x0,B.y1]], e=[[0,1],[1,2],[2,3],[3,0]];
  let m=Infinity;
  for (const [i,j] of e) { if (_segHit(c[i],c[j],a,b)) return 0; m=Math.min(m, ptSegD(c[i],a,b), ptSegD(c[j],a,b), ptSegD(a,c[i],c[j]), ptSegD(b,c[i],c[j])); }
  return m;
}
function footOfPerp(P, A, B) {
  const ax = A[0], ay = A[1], bx = B[0], by = B[1];
  const dx = bx - ax, dy = by - ay, t = ((P[0] - ax) * dx + (P[1] - ay) * dy) / (dx * dx + dy * dy);
  return [ax + t * dx, ay + t * dy];
}
function clipLine(m, b, xmin, xmax, ymin, ymax) {
  const pts = [];
  const add = (x, y) => { if (x >= xmin - 1e-6 && x <= xmax + 1e-6 && y >= ymin - 1e-6 && y <= ymax + 1e-6) pts.push([x, y]); };
  add(xmin, m * xmin + b); add(xmax, m * xmax + b);
  if (m !== 0) { add((ymin - b) / m, ymin); add((ymax - b) / m, ymax); }
  // dedupe
  const uniq = pts.filter((p, i) => pts.findIndex(q => Math.abs(q[0] - p[0]) < 1e-4 && Math.abs(q[1] - p[1]) < 1e-4) === i);
  return uniq.length >= 2 ? uniq.slice(0, 2) : null;
}
function leastSquares(xs, ys) {
  const n = xs.length, sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx); const b = (sy - m * sx) / n; return { m, b };
}
// smallest multiple of `step` whose on-screen spacing is >= minPx (same rule
// applied to both axes, so x and y get a consistent label density)
function labelStep(step, unit, minPx = 24) {
  let s = step, guard = 0;
  while (s * unit < minPx && guard++ < 24) s += step;
  return s;
}
// sample a curve's on-screen points (for label-collision obstacles)
function curveScreenPts(c, sx, sy, xmin, xmax, ymin, ymax) {
  const seg = (p1, p2, n) => { const o = []; for (let i = 0; i <= n; i++) o.push([sx(p1[0] + (p2[0] - p1[0]) * i / n), sy(p1[1] + (p2[1] - p1[1]) * i / n)]); return o; };
  if (c.type === "line" || c.type === "line2pt") {
    let m, b;
    if (c.type === "line2pt") { m = (c.p2[1] - c.p1[1]) / (c.p2[0] - c.p1[0]); b = c.p1[1] - m * c.p1[0]; } else { m = c.m; b = c.b; }
    const pts = clipLine(m, b, xmin, xmax, ymin, ymax);
    return pts ? seg(pts[0], pts[1], 12) : [];
  }
  if (c.type === "segment") return seg(c.p1, c.p2, 12);
  const f = c.f || (c.type === "quadratic" ? (x) => c.a * x * x + c.b * x + c.c : (x) => c.a * x ** 3 + c.b * x ** 2 + c.c * x + c.d);
  const out = [];
  for (let i = 0; i <= 40; i++) { const x = xmin + (xmax - xmin) * i / 40, y = f(x); if (y >= ymin && y <= ymax) out.push([sx(x), sy(y)]); }
  return out;
}
function niceStep(lo, hi) {
  const span = Math.abs(hi - lo) || 1, raw = span / 8, pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const cands = [1, 2, 2.5, 5, 10].map(c => c * pow);
  return cands.find(c => span / c <= 12) || pow * 10;
}
function ticks(lo, hi, step) {
  const out = []; const start = Math.ceil(lo / step) * step;
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
function thinFactor(count, px) { const need = count * 26; return Math.max(1, Math.ceil(need / Math.max(px, 1))); }
function niceMax(v) { if (v <= 0) return 1; const pow = Math.pow(10, Math.floor(Math.log10(v))); const c = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * pow); return c.find(k => k >= v) || pow * 10; }
function niceLabel(n) { const r = Math.round(n * 100) / 100; return (Object.is(r, -0) ? 0 : r).toString(); }

export const FIGURES = { coordPlane, scatter, dotPlot, histogram, barChart, triangle, polygon, rectangle, parallelLines, parallelBend, parallelogram, circle, table };
export default FIGURES;
