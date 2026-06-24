/* Stage 4/2 reports — figure-vs-problem vision findings (report only) + triviality drops.
   Embeds the blind agents' verdicts, maps refs → source/skill, writes FIGURE-AUDIT.md +
   data/figure-audit.json + data/triviality-drops.json. node build/cleanup-report.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const bank = readFileSync(join(ROOT, "data", "item-bank.jsonl"), "utf8").trim().split("\n").map((l, i) => { const o = JSON.parse(l); return { idx: i, source: o.source, skill: o.skill, domain: o.domain, fn: o.figure?.fn, origin: String(o.source || "").startsWith("mod2/") ? "mod2" : "insight-gen" }; });
const N_FIG_AUDITED = 88;

const defects = [
  { ref: 30, severity: "blocker", issue: "Grid is empty — the two system lines are not drawn, so x cannot be read", fix: "Draw both lines intersecting at x=2" },
  { ref: 156, severity: "blocker", issue: "Rectangle is blank; stem says the width is shown but no '6' is labeled", fix: "Label the 6 m width (and 9 m length)" },
  { ref: 159, severity: "blocker", issue: "Lines labeled p/q not m/n, transversal r not t, no angle x marked, no given value", fix: "Relabel m/n/t, mark angle x, add the given angle" },
  { ref: 681, severity: "blocker", issue: "Dot plots show 14 & 16 points (stem says 18 each); B is not a +4 shift of A's shape", fix: "Redraw both with 18 points; B = A shifted +4 identically" },
  { ref: 22, severity: "major", issue: "Stem says a line is shown with P on it, but no line is drawn — only point P(3,5)", fix: "Render the line through P" },
  { ref: 554, severity: "minor", issue: "74° drawn lower-left at n while (a+b) is lower-right at m — alternate, not corresponding as stated", fix: "Move the 74° arc to the lower-right position at line n" },
  { ref: 163, severity: "nit", issue: "Points A,B,C,D correctly placed on two lines through O; the lines themselves are unlabeled", fix: "Optionally label lines ℓ and m" },
  { ref: 455, severity: "nit", issue: "Three labeled angles positioned plausibly; math yields x=35 consistent with the answer", fix: "" },
  { ref: 726, severity: "nit", issue: "Alternate-interior config correct; caption has a stray '·' separator", fix: "Remove the trailing '·' in the caption" },
];
const rank = { blocker: 0, major: 1, minor: 2, nit: 3 };
defects.sort((a, b) => rank[a.severity] - rank[b.severity] || a.ref - b.ref);
for (const d of defects) { const b = bank[d.ref]; d.origin = b.origin; d.source = b.source; d.skill = b.skill; d.fn = b.fn; }

writeFileSync(join(ROOT, "data", "figure-audit.json"), JSON.stringify({ audited: N_FIG_AUDITED, clean: N_FIG_AUDITED - defects.length, defects }, null, 1));

const counts = defects.reduce((a, d) => { a[d.severity] = (a[d.severity] || 0) + 1; return a; }, {});
let md = `# Figure audit — blind vision pass (report only)\n\n_2026-06-23 · ${N_FIG_AUDITED} figure-bearing items rendered + screenshotted; each judged against its stem + answer by a blind vision agent. No edits applied — fixing is a follow-up._\n\n`;
md += `**${N_FIG_AUDITED - defects.length} of ${N_FIG_AUDITED} figures clean.** Defects: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}\n\n`;
md += `| ref | severity | origin · figure · skill | issue | suggested fix |\n|---|---|---|---|---|\n`;
for (const d of defects) md += `| #${d.ref} | **${d.severity}** | ${d.origin} · ${d.fn} · ${d.skill || ""} | ${d.issue} | ${d.fix || "—"} |\n`;
md += `\n> Blockers/major are items whose figure fails to depict the problem (missing line/grid/label) — they should be fixed or dropped in the follow-up pass. Nits are cosmetic. All other ${N_FIG_AUDITED - defects.length} figures correctly match their stem + answer.\n`;
writeFileSync(join(ROOT, "FIGURE-AUDIT.md"), md);

// triviality drops (3 blind agents over Insight-Gen B1/B2)
const trivRefs = [0, 1, 5, 123, 124, 192, 223, 252];
const triv = trivRefs.map((r) => ({ idx: r, source: bank[r].source, skill: bank[r].skill, origin: bank[r].origin }));
writeFileSync(join(ROOT, "data", "triviality-drops.json"), JSON.stringify({ count: triv.length, drops: triv }, null, 1));

console.log(`FIGURE-AUDIT.md: ${defects.length} defects (${JSON.stringify(counts)}) of ${N_FIG_AUDITED}`);
console.log(`  blockers/major: ${defects.filter((d) => rank[d.severity] <= 1).map((d) => `#${d.ref}(${d.origin}/${d.fn})`).join(", ")}`);
console.log(`triviality-drops.json: ${triv.length} items → ${triv.map((t) => "#" + t.idx).join(", ")}`);
