/* prescribe — the training half of the mastery loop.
   Reads a results.json from the suite player, updates the per-student ledger
   (data/students/<id>/), diagnoses per-cell (subdomain × band) mastery, and emits
   a TARGETED practice set — drill items on the exact structures the student missed
   plus unseen-family transfer items — until every measured cell is mastered.

   Mastery model (deterministic, explainable):
     recent = last 4 in-cell attempts (chronological across all sessions)
     MASTERED   = ≥3 recent attempts AND ≥75% of recent correct
     DEFICIENT  = ≥2 attempts AND <50% of recent correct
     REVIEW/OK  = see assessCells — errors are chased, lone correct answers are not
   The AI-assist seam: when a deficient cell has no unseen bank supply,
   --fill-gaps emits a STEERING PACKET (target cell + banned-structure avoid-list
   computed from the live bank) ready for a steered clean-room author run.

     node engine/cli.mjs prescribe <results.json> --student <id> [--fill-gaps]   */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadFamilies } from "./family.mjs";
import { mintVariants } from "./variants.mjs";
import { buildPool, renderPlayerPage, normSubdomain } from "./suite.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sdir = (student) => join(ROOT, "data", "students", student);

export function loadSeen(student) {
  const p = join(sdir(student), "seen.json");
  return new Set(existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : []);
}
const saveSeen = (student, seen) => writeFileSync(join(sdir(student), "seen.json"), JSON.stringify([...seen], null, 1));

export function loadHistory(student) {
  const p = join(sdir(student), "history.jsonl");
  return existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
}

/* ---- the mastery model ----
   MASTERED  ≥3 recent attempts, ≥75% correct — evidence of mastery
   DEFICIENT ≥2 attempts, <50% recent — drill it
   REVIEW    has at least one error but neither of the above — chase to evidence
   OK        all attempts correct so far but <3 — passing; confirm lightly, NEVER blocks
   (blocking set = DEFICIENT ∪ REVIEW: errors are always chased; single correct
   answers are not drilled to exhaustion — kept in sync with assets/suite.js) */
export function assessCells(history) {
  const byCell = {};
  for (const row of history) (byCell[`${row.subdomain}|${row.band}`] ||= []).push(row);
  const cells = {};
  for (const [key, rows] of Object.entries(byCell)) {
    const recent = rows.slice(-4);
    const rate = recent.filter((r) => r.isCorrect).length / recent.length;
    const errors = rows.filter((r) => !r.isCorrect).length;
    // recovered = an error followed by ≥2 consecutive correct (standard tutoring bar;
    // also what 3-item cell supply can actually evidence)
    const recovered = rows.length >= 3 && rows.slice(-2).every((r) => r.isCorrect);
    const status = (recent.length >= 3 && rate >= 0.75) || recovered ? "MASTERED"
      : rows.length >= 2 && rate < 0.5 ? "DEFICIENT"
      : errors > 0 ? "REVIEW" : "OK";
    const [subdomain, band] = key.split("|");
    cells[key] = { subdomain, band, attempts: rows.length, recentRate: +rate.toFixed(2), status,
      missedFamilies: [...new Set(rows.filter((r) => !r.isCorrect).map((r) => r.familyId))] };
  }
  return cells;
}

/* ---- steering packet: the dynamic avoid-list, straight from the bank ---- */
function steeringPacket(cell) {
  const structures = loadFamilies().map((f) =>
    f.generator === "authored" ? f.spec.structure : (f.spec?.task ?? f.spec?.chain ?? f.stemPreview ?? f.familyId));
  return {
    kind: "steering-packet", target: { subdomain: cell.subdomain, band: cell.band, domain: "geometry_trig-or-algebra" },
    task: `Author 5 original Digital SAT items for the target cell (subdomain ${cell.subdomain}, band ${cell.band}).`,
    noveltyObjective: "Novelty is co-equal with authenticity. For each item, first name the modal realization, then write something structurally different — in-distribution but unwritten.",
    bannedStructures: [...new Set(structures)].sort(),
    rubricFiles: ["tests/cleanroom/geo-rubric.md", "taxonomy/geo-banding-guide.md"],
    protocol: "STEERED-35.md (clean-room author → cross-model blind solve ×2 → authenticity floor → band audit → harvest.mjs)",
  };
}

/* ---- prescription ---- */
export async function prescribe(resultsPath, { student = "anonymous", fillGaps = false } = {}) {
  const results = JSON.parse(readFileSync(resultsPath, "utf8"));
  mkdirSync(sdir(student), { recursive: true });

  // 1. ledger: history + seen (idempotent — re-running on the same results file
  // must not double-count attempts)
  const stamp = results.ts ?? new Date().toISOString();
  const already = new Set(loadHistory(student).map((h) => `${h.ts}|${h.variantId}`));
  for (const it of results.items) {
    if (already.has(`${stamp}|${it.variantId}`)) continue;
    appendFileSync(join(sdir(student), "history.jsonl"),
      JSON.stringify({ ts: stamp, session: results.suiteId ?? resultsPath, ...it }) + "\n");
  }
  const seen = loadSeen(student);
  results.items.forEach((it) => seen.add(it.variantId));

  // 2. diagnosis
  const cells = assessCells(loadHistory(student));
  const list = Object.values(cells);
  console.log(`\nmastery map for ${student} (${list.length} measured cells):`);
  for (const c of list.sort((a, b) => a.subdomain.localeCompare(b.subdomain) || a.band.localeCompare(b.band)))
    console.log(`  ${c.status.padEnd(9)} ${c.subdomain} ${c.band} — ${c.attempts} attempts, recent ${Math.round(c.recentRate * 100)}%`);
  const deficient = list.filter((c) => c.status === "DEFICIENT");
  const review = list.filter((c) => c.status === "REVIEW");
  const okCells = list.filter((c) => c.status === "OK");
  writeFileSync(join(sdir(student), "mastery.json"), JSON.stringify({ updatedAt: stamp, cells }, null, 1));

  if (!deficient.length && !review.length) {
    saveSeen(student, seen);
    console.log("\nMASTERY ACHIEVED — no deficient or review cells remain (OK cells are passing on all evidence). No practice set emitted.");
    return { mastered: true, cells };
  }

  // 3. targeted practice set: drills on missed structures + transfer + measurement
  const pool = buildPool({ seen });
  const questions = [], unsupplied = [];
  const usedFams = new Set();
  const takeCell = (cell, { fromFamilies = null, n = 1, allowUsedFam = false } = {}) => {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const c = pool.find((p) => p.row === cell.subdomain && p.band === cell.band
        && (!fromFamilies || fromFamilies.includes(p.familyId))
        && (allowUsedFam || !usedFams.has(p.familyId))
        && !questions.some((q) => q._variantId === p.id));
      if (!c) break;
      usedFams.add(c.familyId);
      questions.push({ ...c.q, _cellStatus: cell.status });
      got++;
    }
    return got;
  };
  // mintForCell: parametric families in-cell mint fresh $0 reseed variants when
  // the unseen pool runs dry (drills prefer the exact missed family; measurement
  // takes any parametric family in the cell). Authored families are finite.
  const mintForCell = async (cell, k, preferFamilies = null) => {
    const fams = loadFamilies().filter((f) => f.generator !== "authored"
      && normSubdomain(f) === cell.subdomain && f.difficulty?.band === cell.band
      && (!preferFamilies || preferFamilies.includes(f.familyId)));
    let added = 0;
    for (const fam of fams) {
      if (added >= k) break;
      try {
        const minted = await mintVariants(fam, k - added);
        for (const v of minted.filter((m) => !seen.has(m.variantId) && !pool.some((p) => p.id === m.variantId))) {
          pool.push({ q: { ...v.item, _variantId: v.variantId, _familyId: fam.familyId, _subdomain: cell.subdomain }, band: cell.band, familyId: fam.familyId, id: v.variantId, row: cell.subdomain, domain: "geometry_trig", grouped: true, strict: true, src: "engine" });
          added++;
        }
      } catch { /* llm-gated family without CLI available — skip */ }
    }
    return added;
  };
  for (const cell of deficient) {
    // drills: unseen variants of the structures the student actually missed
    let drills = takeCell(cell, { fromFamilies: cell.missedFamilies, n: 2, allowUsedFam: true });
    if (drills < 2 && (await mintForCell(cell, 2 - drills, cell.missedFamilies)))
      drills += takeCell(cell, { fromFamilies: cell.missedFamilies, n: 2 - drills, allowUsedFam: true });
    let transfer = takeCell(cell, { n: 2 });
    if (!transfer && (await mintForCell(cell, 1))) transfer = takeCell(cell, { n: 1, allowUsedFam: true });
    if (drills + transfer === 0) unsupplied.push(cell);
  }
  for (const cell of review) {
    let got = takeCell(cell, { n: 2, allowUsedFam: true }) || takeCell(cell, { n: 1 });
    if (!got && (await mintForCell(cell, 2))) got = takeCell(cell, { n: 2, allowUsedFam: true });
    if (!got) unsupplied.push(cell);
  }
  // light confirmation on OK cells — never blocking, max 3 per set
  for (const cell of okCells.slice(0, 3)) takeCell(cell, { n: 1 });

  // 4. gaps → steering packets (the AI-assist seam)
  for (const cell of unsupplied) {
    if (!fillGaps) { console.log(`  ⚠ no unseen supply for ${cell.subdomain} ${cell.band} — rerun with --fill-gaps to emit a steering packet`); continue; }
    const pdir = join(sdir(student), "packets");
    mkdirSync(pdir, { recursive: true });
    const fp = join(pdir, `packet-${cell.subdomain}-${cell.band}.json`);
    writeFileSync(fp, JSON.stringify(steeringPacket(cell), null, 1));
    console.log(`  ⚠ no unseen supply for ${cell.subdomain} ${cell.band} → steering packet: ${fp}`);
  }

  if (!questions.length) {
    saveSeen(student, seen);
    // honest terminal state: targets remain but the bank has nothing unseen for them —
    // NOT mastery; surfaces the exact cells needing new authoring
    console.log(`\nno practice set emitted — ${deficient.length + review.length} target cell(s) have no unseen supply. Cells: ` +
      [...deficient, ...review].map((c) => `${c.subdomain} ${c.band}`).join(", "));
    return { mastered: false, blocked: [...deficient, ...review], cells, emitted: null };
  }

  // 5. emit + render (single-module player page); emitted items are marked seen NOW
  const n = loadHistory(student).length; // monotone counter for file naming
  const setId = `${student}-${String(n).padStart(4, "0")}`;
  const dir = sdir(student);
  writeFileSync(join(dir, "p1.json"), JSON.stringify({ number: "p1", title: `Targeted practice — ${setId}`, questions: questions.map((q, i) => ({ ...q, id: i + 1 })) }, null, 1));
  questions.forEach((q) => seen.add(q._variantId));
  saveSeen(student, seen);
  const page = renderPlayerPage({
    id: setId, dir, outDirName: `practice-${setId}`, keys: ["p1"], first: "p1", includePool: false,
    threshold: 1, coverage: "targeted at your deficit cells",
    heading: `Targeted Practice — ${student}`,
    sub: `${questions.length} questions chosen from your deficit map: drills on the structures you missed, plus transfer questions on unseen structures in the same cells.`,
  });
  console.log(`\npractice set: ${questions.length} items (${deficient.length} deficient, ${review.length} review cells) → ${page}`);
  return { mastered: false, cells, emitted: page };
}
