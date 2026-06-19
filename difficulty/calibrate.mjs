/* ============================================================================
   calibrate.mjs — fit the judge calibration map against College Board's own
   band-labeled exemplars. The judge ranks difficulty well (ρ≈0.96) but
   COMPRESSES the extremes; a monotone linear map true_mid ≈ a + b·judgeRP67
   (b>1 stretches the compressed scale back out) de-compresses it.

   Two phases (collection is the only one that costs LLM calls; it's RESUMABLE):
     node difficulty/calibrate.mjs collect   # run judge on every exemplar → judge-raw.json (resumes)
     node difficulty/calibrate.mjs fit        # least-squares + LOO-CV → calibration.json  ($0)
     node difficulty/calibrate.mjs            # collect (if needed) then fit
   ============================================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { judgePanel } from "./judge.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BANDS = JSON.parse(readFileSync(join(ROOT, "taxonomy", "matrix.json"), "utf8")).bands;
const MID = Object.fromEntries(BANDS.map((b) => [b.id, b.midpoint]));
const IDX = Object.fromEntries(BANDS.map((b, i) => [b.id, i]));
const bandOf = (s) => { for (let i = BANDS.length - 1; i >= 0; i--) if (s >= BANDS[i].scaleMin) return BANDS[i].id; return BANDS[0].id; };
const RAW = join(__dirname, "judge-raw.json");
const CAL = join(__dirname, "calibration.json");

const toItem = (it) => {
  const mcq = /^[A-D]$/.test(String(it.key || ""));
  return { stem: it.stem, domain: it.domain, type: mcq ? "mcq" : "spr", answer: mcq ? { correct: it.key } : { accept: [String(it.key)] }, options: [], solution: "" };
};

async function collect(n) {
  const items = JSON.parse(readFileSync(join(ROOT, "taxonomy", "exemplars.clean.json"), "utf8"))
    .map((it, i) => ({ id: i, ...it }));
  const done = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : [];
  const haveIds = new Set(done.map((d) => d.id));
  console.log(`collect: ${done.length}/${items.length} already done; running judge (n=${n}, raw) on the rest…`);
  for (const it of items) {
    if (haveIds.has(it.id)) continue;
    const p = await judgePanel(toItem(it), { n, raw: true });
    if (!p) { console.log(`  · #${it.id} ${it.band}: judge failed (will retry next run)`); continue; }
    done.push({ id: it.id, domain: it.domain, trueBand: it.band, trueMid: MID[it.band], judgeRP67: p.rawThetaJudge });
    writeFileSync(RAW, JSON.stringify(done, null, 1));   // incremental → resumable
    console.log(`  ✓ #${it.id} ${it.domain} ${it.band}: judgeRP67=${p.rawThetaJudge}`);
  }
  return done;
}

function lsq(pts) {  // fit y = a + b x  (x=judgeRP67, y=trueMid)
  const n = pts.length, sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0), sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
  return { a, b };
}
const spearman = (xs, ys) => {
  const rank = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(a.length); s.forEach(([_, i], k) => r[i] = k); return r; };
  const rx = rank(xs), ry = rank(ys), n = xs.length, m = (n - 1) / 2;
  let c = 0, vx = 0, vy = 0; for (let i = 0; i < n; i++) { c += (rx[i] - m) * (ry[i] - m); vx += (rx[i] - m) ** 2; vy += (ry[i] - m) ** 2; }
  return c / Math.sqrt(vx * vy || 1);
};

function fit() {
  const data = JSON.parse(readFileSync(RAW, "utf8"));
  const pts = data.map((d) => ({ x: d.judgeRP67, y: d.trueMid, band: d.trueBand }));
  const all = lsq(pts);
  // metrics: RAW (judge band directly) vs CALIBRATED via leave-one-out CV
  let rawExact = 0, rawW1 = 0, calExact = 0, calW1 = 0;
  const calMids = [];
  for (let i = 0; i < pts.length; i++) {
    const train = pts.filter((_, j) => j !== i), { a, b } = lsq(train);
    const calMid = Math.max(340, Math.min(720, a + b * pts[i].x));
    calMids.push(calMid);
    const rawBand = bandOf(pts[i].x), calBand = bandOf(calMid), trueBand = pts[i].band;
    if (rawBand === trueBand) rawExact++; if (Math.abs(IDX[rawBand] - IDX[trueBand]) <= 1) rawW1++;
    if (calBand === trueBand) calExact++; if (Math.abs(IDX[calBand] - IDX[trueBand]) <= 1) calW1++;
  }
  const n = pts.length;
  const rmse = (arr) => Math.round(Math.sqrt(arr.reduce((s, v, i) => s + (v - pts[i].y) ** 2, 0) / n));
  const metrics = {
    n, slope_b: +all.b.toFixed(3), intercept_a: Math.round(all.a),
    raw:  { exact: +(rawExact / n).toFixed(2), within1: +(rawW1 / n).toFixed(2), rho: +spearman(pts.map(p => p.x), pts.map(p => p.y)).toFixed(2), rmse: rmse(pts.map(p => p.x)) },
    cal_LOO: { exact: +(calExact / n).toFixed(2), within1: +(calW1 / n).toFixed(2), rho: +spearman(calMids, pts.map(p => p.y)).toFixed(2), rmse: rmse(calMids) },
  };
  // Only DEPLOY the map if it beats the raw judge on held-out CV — otherwise the
  // raw judge is already well-calibrated and a map would only add variance.
  const deployed = metrics.cal_LOO.within1 > metrics.raw.within1
    || (metrics.cal_LOO.within1 === metrics.raw.within1 && metrics.cal_LOO.exact > metrics.raw.exact);
  writeFileSync(CAL, JSON.stringify({ a: Math.round(all.a), b: +all.b.toFixed(4), deployed, method: "linear-decompress", fittedOn: "skills-insight-exemplars", ...metrics }, null, 2));
  console.log("\n── calibration fit (true_mid ≈ a + b·judgeRP67) ──");
  console.log(`  a=${Math.round(all.a)}  b=${all.b.toFixed(3)}`);
  console.log(`  RAW judge:       exact ${(100*metrics.raw.exact)|0}%  ±1 ${(100*metrics.raw.within1)|0}%  ρ ${metrics.raw.rho}  RMSE ${metrics.raw.rmse}`);
  console.log(`  CALIBRATED(LOO): exact ${(100*metrics.cal_LOO.exact)|0}%  ±1 ${(100*metrics.cal_LOO.within1)|0}%  ρ ${metrics.cal_LOO.rho}  RMSE ${metrics.cal_LOO.rmse}   [held-out]`);
  console.log(deployed
    ? `\n→ map beats raw on held-out CV; DEPLOYED (judge applies it automatically).`
    : `\n→ map does NOT beat raw on held-out CV; NOT deployed. The raw judge is already well-calibrated (±1=${(100*metrics.raw.within1)|0}%, ρ=${metrics.raw.rho}); judge uses raw.`);
}

const mode = process.argv[2] || "all";
if (mode === "fit") { fit(); }
else { await collect(Number(process.env.SIG_PANEL_N || 2)); if (mode !== "collect") fit(); }
