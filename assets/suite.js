/* suite.js — diagnostic-suite player: module flow (M1 → adaptive route → M2),
   answer capture, grading, deficit map, results export. No network, no accounts:
   attempts persist to localStorage and export as results.json for `cli prescribe`.
   Answer comparison is a verbatim client copy of engine/answers.mjs. */
(() => {
  "use strict";

  /* ---- answers.mjs (client copy — keep in sync) ---- */
  function normAnswer(a) {
    let s = String(a ?? "").toLowerCase().replace(/π/g, "pi").replace(/°/g, "").replace(/\s|%|degrees|\*/g, "");
    let letter = null;
    const q = s.match(/\(choice([abcd])\)/);
    if (q) letter = q[1];
    s = s.replace(/\((choice[abcd]|or[^)]*|accept[^)]*)\)/g, "");
    const m = s.match(/^([abcd])[)(](.*)$/);
    if (m) { letter = m[1]; s = m[2]; }
    else if (/^[abcd]$/.test(s)) { letter = s; s = ""; }
    s = s.replace(/\(\.?\d[^)]*\)$/, "").replace(/[()]/g, "");
    return { letter, val: s };
  }
  function asNum(s) {
    const f = String(s).match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (f) return Number(f[1]) / Number(f[2]);
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function answersAgree(x, y) {
    const a = normAnswer(x), b = normAnswer(y);
    if (a.letter && b.letter) return a.letter === b.letter;
    if (a.val && a.val === b.val) return true;
    const na = asNum(a.val ?? ""), nb = asNum(b.val ?? "");
    return na != null && nb != null && Math.abs(na - nb) < 1e-9;
  }

  const DATA = JSON.parse(document.getElementById("suite-data").textContent);
  const BANDS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"];
  const state = { student: null, route: null, results: [] };
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  /* ---- MCQ option selection ---- */
  $$(".opts").forEach((ol) => ol.addEventListener("click", (e) => {
    const btn = e.target.closest(".opt");
    if (!btn || ol.closest(".module").hasAttribute("data-locked")) return;
    $$(".opt", ol).forEach((o) => o.setAttribute("aria-checked", "false"));
    btn.setAttribute("aria-checked", "true");
  }));

  const givenFor = (meta) => {
    const art = $(`[data-qid="${meta.qid}"]`);
    if (meta.type === "mcq") return $('.opt[aria-checked="true"]', art)?.dataset.key ?? null;
    return $("input", art)?.value.trim() || null;
  };
  const gradeOne = (meta, given) => {
    if (given == null) return false;
    if (meta.type === "mcq") return given.toUpperCase() === String(meta.correct).toUpperCase();
    return (meta.accept || []).some((acc) => answersAgree(given, acc));
  };
  function gradeModule(key) {
    return DATA.modules[key].map((meta) => {
      const given = givenFor(meta);
      return { ...meta, given, isCorrect: gradeOne(meta, given), module: key };
    });
  }

  const show = (id) => { $$("#view-start, .module, #view-results").forEach((s) => (s.hidden = true)); const el = $(id); el.hidden = false; window.scrollTo(0, 0); };

  $("#begin").addEventListener("click", () => {
    state.student = $("#student-id").value.trim() || "anonymous";
    show("#mod-" + (DATA.first || "m1"));
  });

  $$("[data-submit]").forEach((btn) => btn.addEventListener("click", () => {
    const key = btn.dataset.submit;
    const blank = DATA.modules[key].filter((m) => givenFor(m) == null).length;
    if (blank && !confirm(`${blank} unanswered question${blank > 1 ? "s" : ""} — submit anyway?`)) return;
    const rows = gradeModule(key);
    $(`#mod-${key}`).setAttribute("data-locked", "1");
    state.results.push(...rows);
    if (key === "m1") {
      const score = rows.filter((r) => r.isCorrect).length / rows.length;
      state.route = score >= DATA.threshold ? "m2h" : "m2e";
      show(`#mod-${state.route}`);
    } else {
      finish();
    }
  }));

  function cellStats(rows) {
    const cells = {};
    for (const r of rows) {
      const k = `${r.subdomain}|${r.band}`;
      (cells[k] ||= { subdomain: r.subdomain, band: r.band, n: 0, c: 0 }).n++;
      if (r.isCorrect) cells[k].c++;
    }
    return cells;
  }

  function deficitMapHtml(rows) {
    const cells = cellStats(rows);
    const subs = [...new Set(rows.map((r) => r.subdomain))].sort();
    let h = `<table class="deficit"><thead><tr><th>skill area</th>${BANDS.map((b) => `<th>${b}</th>`).join("")}</tr></thead><tbody>`;
    for (const s of subs) {
      h += `<tr><th>${s.replace(/_/g, " ")}</th>`;
      for (const b of BANDS) {
        const c = cells[`${s}|${b}`];
        if (!c) { h += `<td class="dm-none"></td>`; continue; }
        const pct = c.c / c.n;
        const cls = pct >= 0.75 ? "dm-good" : pct >= 0.5 ? "dm-mid" : "dm-weak";
        h += `<td class="${cls}" title="${s} ${b}: ${c.c}/${c.n}">${c.c}/${c.n}</td>`;
      }
      h += "</tr>";
    }
    return h + "</tbody></table>";
  }

  function finish() {
    const rows = state.results;
    const total = rows.length, correct = rows.filter((r) => r.isCorrect).length;
    const m1rows = rows.filter((r) => r.module === "m1");
    const routed = m1rows.length
      ? ` (Module 1: ${m1rows.filter((r) => r.isCorrect).length}/${m1rows.length} → routed to ${state.route === "m2h" ? "harder" : "easier"} Module 2).`
      : ".";
    $("#results-summary").textContent =
      `${state.student} · ${correct}/${total} correct${routed} ` +
      `Cells below are your skill-by-band map — download results.json and run the prescriber for a targeted practice set.`;
    $("#deficit-map").innerHTML = deficitMapHtml(rows);
    $("#review").innerHTML = rows.map((r) => `
      <details class="rev ${r.isCorrect ? "rev-ok" : "rev-bad"}">
        <summary><span class="chip">${r.isCorrect ? "✓" : "✗"}</span> ${r.qid} · ${r.subdomain.replace(/_/g, " ")} · ${r.band} —
          your answer: <b>${r.given ?? "—"}</b>${r.type === "mcq" ? ` · correct: <b>${r.correct}</b>` : ` · accepted: <b>${(r.accept || []).join(" or ")}</b>`}</summary>
        <div class="rev-sol">${r.solutionHtml || ""}</div>
      </details>`).join("");
    const payload = {
      suiteId: DATA.id, student: state.student, ts: new Date().toISOString(), route: state.route,
      scores: { total: `${correct}/${total}`, m1: m1rows.length ? `${m1rows.filter((r) => r.isCorrect).length}/${m1rows.length}` : null },
      items: rows.map(({ solutionHtml, ...r }) => r),
    };
    try {
      const k = "sig-suite-attempts";
      const hist = JSON.parse(localStorage.getItem(k) || "[]");
      hist.push(payload); localStorage.setItem(k, JSON.stringify(hist));
    } catch {}
    $("#download-results").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" }));
      a.download = `results-${state.student}-${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    });
    show("#view-results");
  }
})();
