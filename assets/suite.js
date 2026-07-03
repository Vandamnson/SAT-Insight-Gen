/* suite.js — Bluebook-style diagnostic player + IN-PAGE mastery loop.
   One question at a time, palette, flagging, soft module timer, review-before-submit,
   adaptive M1→M2 routing, score estimate, deficit map, and a client-side prescriber
   that generates targeted practice modules from the page's embedded pool — the whole
   loop offline, no accounts, localStorage per student.
   Mastery model + answer normalizer are kept IN SYNC with engine/prescribe.mjs and
   engine/answers.mjs (deliberate duplication — offline-first). */
(() => {
  "use strict";

  /* ---- engine/answers.mjs (client copy — keep in sync) ---- */
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
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  /* ---- per-student store ---- */
  const state = { student: null, store: null, play: null, practiceN: 0, lastRows: [] };
  const storeKey = () => `sig-suite:${DATA.id}:${state.student}`;
  const loadStore = () => { try { return JSON.parse(localStorage.getItem(storeKey())) || { seen: [], history: [], rounds: [] }; } catch { return { seen: [], history: [], rounds: [] }; } };
  const saveStore = () => { try { localStorage.setItem(storeKey(), JSON.stringify(state.store)); } catch {} };

  const VIEWS = "#view-start, .module, #view-review, #view-interstitial, #view-results";
  const show = (sel) => { $$(VIEWS).forEach((s) => (s.hidden = true)); $(sel).hidden = false; window.scrollTo(0, 0); };
  const chrome = (on) => { $("#testbar").hidden = !on; $("#qnav").hidden = !on; if (!on) $("#palette").hidden = true; };

  /* ---- MCQ selection (delegated — covers injected practice articles too) ---- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".opt");
    if (!btn || !state.play) return;
    const art = btn.closest("article.q");
    $$(".opt", art).forEach((o) => o.setAttribute("aria-checked", "false"));
    btn.setAttribute("aria-checked", "true");
    refreshPalette();
  });

  const givenFor = (meta) => {
    const art = $(`[data-qid="${meta.qid}"]`);
    if (!art) return null;
    if (meta.type === "mcq") return $('.opt[aria-checked="true"]', art)?.dataset.key ?? null;
    return $("input", art)?.value.trim() || null;
  };

  /* ---- module play (one question at a time) ---- */
  function playModule(key, metas, label) {
    if (state.play?.timerId) clearInterval(state.play.timerId);
    const secs = metas.length >= 20 ? 35 * 60 : Math.max(300, metas.length * 95);
    state.play = { key, metas, idx: 0, flags: new Set(), startTs: Date.now(), left: secs, label };
    $("#tb-student").textContent = state.student;
    $("#tb-module").textContent = label;
    state.play.timerId = setInterval(tick, 1000);
    tick();
    chrome(true);
    show(`#mod-${key}`);
    renderCurrent();
  }
  function tick() {
    const p = state.play; if (!p) return;
    p.left--;
    const t = Math.abs(p.left), mm = String(Math.floor(t / 60)).padStart(2, "0"), ss = String(t % 60).padStart(2, "0");
    const el = $("#tb-timer");
    el.textContent = (p.left < 0 ? "+" : "") + `${mm}:${ss}`;
    el.classList.toggle("overtime", p.left < 0);
  }
  function renderCurrent() {
    const p = state.play;
    $$(`#mod-${p.key} article.q`).forEach((a) => a.classList.add("q-hidden"));
    const cur = $(`[data-qid="${p.metas[p.idx].qid}"]`);
    cur.classList.remove("q-hidden");
    $("#qnav-pos").textContent = `${p.idx + 1} / ${p.metas.length}`;
    $("#nav-next").textContent = p.idx === p.metas.length - 1 ? "Review →" : "Next →";
    $("#tb-flag").classList.toggle("flagged", p.flags.has(p.metas[p.idx].qid));
    refreshPalette();
  }
  $("#nav-prev").addEventListener("click", () => { const p = state.play; if (p.idx > 0) { p.idx--; renderCurrent(); } });
  $("#nav-next").addEventListener("click", () => {
    const p = state.play;
    if (p.idx < p.metas.length - 1) { p.idx++; renderCurrent(); } else openReview();
  });
  $("#tb-flag").addEventListener("click", () => {
    const p = state.play, qid = p.metas[p.idx].qid;
    p.flags.has(qid) ? p.flags.delete(qid) : p.flags.add(qid);
    renderCurrent();
  });
  document.addEventListener("keydown", (e) => {
    if (!state.play || $("#view-review").hidden === false) return;
    if (e.key === "Enter" && e.target.tagName === "INPUT") $("#nav-next").click();
  });

  /* ---- palette ---- */
  function refreshPalette() {
    const p = state.play; if (!p) return;
    const pal = $("#palette");
    pal.innerHTML = p.metas.map((m, i) => {
      const cls = ["pal-btn", givenFor(m) != null ? "ans" : "", p.flags.has(m.qid) ? "flag" : "", i === p.idx ? "cur" : ""].join(" ");
      return `<button class="${cls}" data-i="${i}">${i + 1}</button>`;
    }).join("");
  }
  $("#tb-palette").addEventListener("click", () => { $("#palette").hidden = !$("#palette").hidden; refreshPalette(); });
  $("#palette").addEventListener("click", (e) => {
    const b = e.target.closest(".pal-btn"); if (!b) return;
    state.play.idx = Number(b.dataset.i);
    $("#palette").hidden = true;
    renderCurrent();
  });

  /* ---- review before submit ---- */
  function openReview() {
    const p = state.play;
    const blank = p.metas.filter((m) => givenFor(m) == null);
    $("#review-summary").textContent = `${p.metas.length - blank.length}/${p.metas.length} answered` +
      (blank.length ? ` · unanswered: ${blank.map((m) => p.metas.indexOf(m) + 1).join(", ")}` : "") +
      (p.flags.size ? ` · flagged: ${[...p.flags].map((q) => p.metas.findIndex((m) => m.qid === q) + 1).join(", ")}` : "");
    $("#review-grid").innerHTML = p.metas.map((m, i) =>
      `<button class="pal-btn ${givenFor(m) != null ? "ans" : ""} ${p.flags.has(m.qid) ? "flag" : ""}" data-i="${i}">${i + 1}</button>`).join("");
    chrome(false);
    show("#view-review");
  }
  $("#review-grid").addEventListener("click", (e) => {
    const b = e.target.closest(".pal-btn"); if (!b) return;
    state.play.idx = Number(b.dataset.i);
    chrome(true); show(`#mod-${state.play.key}`); renderCurrent();
  });
  $("#review-back").addEventListener("click", () => { chrome(true); show(`#mod-${state.play.key}`); renderCurrent(); });
  $("#review-submit").addEventListener("click", submitModule);

  /* ---- grading + flow ---- */
  function submitModule() {
    const p = state.play;
    clearInterval(p.timerId);
    const elapsed = Math.round((Date.now() - p.startTs) / 1000);
    const rows = p.metas.map((m) => {
      const given = givenFor(m);
      const isCorrect = given == null ? false
        : m.type === "mcq" ? given.toUpperCase() === String(m.correct).toUpperCase()
        : (m.accept || []).some((acc) => answersAgree(given, acc));
      return { ...m, given, isCorrect, module: p.key, subdomain: m.row, label: p.label, elapsed };
    });
    rows.forEach((r) => { state.store.history.push({ ts: new Date().toISOString(), ...strip(r) }); state.store.seen.push(r.variantId); });
    state.lastRows.push(...rows);
    saveStore();
    chrome(false);
    if (p.key === "m1") {
      const score = rows.filter((r) => r.isCorrect).length / rows.length;
      const route = score >= DATA.threshold ? "m2h" : "m2e";
      state.route = route;
      $("#inter-title").textContent = `Module 1 complete — ${rows.filter((r) => r.isCorrect).length}/${rows.length}`;
      $("#inter-sub").textContent = `Routing you to the ${route === "m2h" ? "harder" : "easier"} Module 2 (that's how the digital SAT adapts).`;
      $("#inter-go").onclick = () => playModule(route, DATA.modules[route], "Module 2");
      show("#view-interstitial");
    } else {
      finish(p.key === "practice" ? p.label : "Diagnostic");
    }
  }
  const strip = ({ solutionHtml, html, ...r }) => r;

  /* ---- mastery model (engine/prescribe.mjs port — keep in sync) ---- */
  function assessCells(history) {
    const byCell = {};
    for (const row of history) (byCell[`${row.subdomain}|${row.band}`] ||= []).push(row);
    const cells = {};
    for (const [key, rows] of Object.entries(byCell)) {
      const recent = rows.slice(-4);
      const rate = recent.filter((r) => r.isCorrect).length / recent.length;
      const errors = rows.filter((r) => !r.isCorrect).length;
      const recovered = rows.length >= 3 && rows.slice(-2).every((r) => r.isCorrect);
      const status = (recent.length >= 3 && rate >= 0.75) || recovered ? "MASTERED"
        : rows.length >= 2 && rate < 0.5 ? "DEFICIENT"
        : errors > 0 ? "REVIEW" : "OK";
      const [subdomain, band] = key.split("|");
      cells[key] = { subdomain, band, attempts: rows.length, recentRate: rate, status,
        missedFamilies: [...new Set(rows.filter((r) => !r.isCorrect).map((r) => r.familyId))] };
    }
    return cells;
  }

  /* ---- score estimate (RP67 frontier over bandCuts; calibration-pending) ---- */
  function estimate(history) {
    const byBand = {};
    for (const r of history) (byBand[r.band] ||= []).push(r);
    let frontier = 0;
    for (let i = 0; i < 7; i++) {
      const rows = (byBand[BANDS[i]] || []).slice(-6);
      if (rows.length >= 2 && rows.filter((r) => r.isCorrect).length / rows.length >= 0.67) frontier = i + 1;
    }
    if (!frontier) return null;
    const cuts = DATA.bandCuts;
    return { band: BANDS[frontier - 1], lo: frontier === 1 ? 200 : cuts[frontier - 2], hi: frontier === 7 ? 800 : cuts[frontier - 1] };
  }

  /* ---- deficit map + results ---- */
  function deficitMapHtml(cells) {
    const rows = [...new Set(Object.values(cells).map((c) => c.subdomain))].sort();
    let h = `<table class="deficit"><thead><tr><th>skill</th>${BANDS.map((b) => `<th>${b}</th>`).join("")}</tr></thead><tbody>`;
    for (const s of rows) {
      h += `<tr><th>${s.replace(/_/g, " ")}</th>`;
      for (const b of BANDS) {
        const c = cells[`${s}|${b}`];
        if (!c) { h += `<td class="dm-none"></td>`; continue; }
        const cls = c.status === "MASTERED" || c.status === "OK" ? "dm-good" : c.status === "DEFICIENT" ? "dm-weak" : "dm-mid";
        h += `<td class="${cls}" title="${s} ${b}: ${c.status} (${c.attempts} attempts, recent ${Math.round(c.recentRate * 100)}%)">${Math.round(c.recentRate * 100)}%</td>`;
      }
      h += "</tr>";
    }
    return h + `</tbody></table><p class="small">green = mastered or passing on all evidence · red = deficient (drill) · yellow = has an error to chase.</p>`;
  }

  function finish(label) {
    const rows = state.lastRows;
    const correct = rows.filter((r) => r.isCorrect).length;
    const cells = assessCells(state.store.history);
    const est = estimate(state.store.history);
    if (rows.length) {
      state.store.rounds.push({ ts: new Date().toISOString(), label, score: `${correct}/${rows.length}`, est: est ? `${est.lo}–${est.hi}` : "—" });
      saveStore();
    }
    $("#results-title").textContent = label === "Diagnostic" ? "Diagnostic Results" : `${label} Results`;
    $("#results-summary").textContent = rows.length
      ? `${state.student} · ${correct}/${rows.length} correct this round.`
      : `${state.student} · resuming — your accumulated skill map below.`;
    $("#score-estimate").innerHTML = est
      ? `<div class="est">Estimated Math range: <b>${est.lo}–${est.hi}</b> <span class="small">(performing like band ${est.band}; rubric-calibrated estimate — not a score prediction)</span></div>`
      : `<div class="est small">Not enough evidence yet for a score estimate.</div>`;
    $("#deficit-map").innerHTML = deficitMapHtml(cells);
    // blocking set = DEFICIENT ∪ REVIEW (errors chased to evidence; lone correct
    // answers are OK, confirmed lightly, never drilled to exhaustion).
    // Cells whose unseen pool supply is exhausted are split out honestly: they are
    // GENERATION DEMAND (steering packets), not practicable targets.
    const open = Object.values(cells).filter((c) => c.status === "DEFICIENT" || c.status === "REVIEW");
    const seenNow = new Set(state.store.seen);
    const avail = {};
    DATA.pool.forEach((p) => { if (!seenNow.has(p.variantId)) avail[`${p.row}|${p.band}`] = (avail[`${p.row}|${p.band}`] || 0) + 1; });
    const fixable = open.filter((c) => avail[`${c.subdomain}|${c.band}`]);
    const dryCells = open.filter((c) => !avail[`${c.subdomain}|${c.band}`]);
    const banner = $("#mastery-banner");
    const dryNote = dryCells.length
      ? `<div class="dry">${dryCells.length} cell${dryCells.length > 1 ? "s" : ""} (${dryCells.map((c) => `${c.subdomain.replace(/_/g, " ")} ${c.band}`).join(", ")}) exhausted the item bank — these need newly authored items (tutor: <code>node engine/cli.mjs prescribe --fill-gaps</code> emits authoring packets).</div>` : "";
    if (!open.length) {
      banner.hidden = false;
      banner.innerHTML = `<div class="mastery">🎉 MASTERY ACHIEVED — every measured skill cell is mastered or passing on all evidence.</div>`;
      $("#gen-practice").hidden = true;
    } else if (!fixable.length) {
      banner.hidden = false;
      banner.innerHTML = `<div class="mastery">🎉 All practicable cells mastered.</div>${dryNote}`;
      $("#gen-practice").hidden = true;
    } else {
      banner.hidden = !dryCells.length;
      banner.innerHTML = dryNote;
      $("#gen-practice").hidden = false;
      $("#gen-practice").textContent = `Generate targeted practice (${fixable.length} cell${fixable.length > 1 ? "s" : ""} to fix)`;
    }
    $("#progress-view").innerHTML = state.store.rounds.length > 1
      ? `<h2>Progress</h2><ol class="rounds">${state.store.rounds.map((r) => `<li><b>${r.label}</b> — ${r.score} · est ${r.est}</li>`).join("")}</ol>`
      : "";
    $("#review").innerHTML = rows.map((r) => `
      <details class="rev ${r.isCorrect ? "rev-ok" : "rev-bad"}">
        <summary><span class="chip">${r.isCorrect ? "✓" : "✗"}</span> ${r.subdomain.replace(/_/g, " ")} · ${r.band} —
          your answer: <b>${esc(r.given ?? "—")}</b>${r.type === "mcq" ? ` · correct: <b>${r.correct}</b>` : ` · accepted: <b>${esc((r.accept || []).join(" or "))}</b>`}</summary>
        <div class="rev-sol">${r.solutionHtml || ""}</div>
      </details>`).join("");
    state.lastRows = [];
    show("#view-results");
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /* ---- client rendering of pool entries (stems via vendored KaTeX) ---- */
  const ktx = (v, display) => { try { return katex.renderToString(v, { displayMode: display, throwOnError: false, strict: "ignore" }); } catch { return esc(v); } };
  function segHtml(s) {
    if (typeof s === "string") return esc(s);
    switch (s.t) {
      case "text": return esc(s.v);
      case "math": return ktx(s.v, false);
      case "mathblock": return `<div class="mathblock">${ktx(s.v, true)}</div>`;
      case "money": return esc("$" + s.v);
      case "br": return "<br>";
      case "p": return `<p>${(s.segs || []).map(segHtml).join("")}</p>`;
      case "table": return s.html ? s.html : "";
      default: return esc(s.v ?? "");
    }
  }
  function stemHtml(stem) {
    if (typeof stem === "string") return `<p>${esc(stem)}</p>`;
    let out = "", inline = [];
    const flush = () => { if (inline.length) { out += `<p>${inline.map(segHtml).join("")}</p>`; inline = []; } };
    for (const s of stem) {
      if (s && (s.t === "p" || s.t === "mathblock" || s.t === "table")) { flush(); out += segHtml(s); }
      else inline.push(s);
    }
    flush();
    return out;
  }
  function buildArticle(e, n) {
    const body = e.type === "mcq"
      ? `<ol class="opts" role="radiogroup" aria-label="answer choices">${(e.options || []).map((o) => `
          <li><button class="opt${o.figSvg ? " opt-fig" : ""}" role="radio" aria-checked="false" data-key="${o.key}">
            <span class="chip">${o.key}</span><span class="otxt">${o.figSvg ?? (o.seg || []).map(segHtml).join("")}</span><span class="verdict"></span></button></li>`).join("")}</ol>`
      : `<div class="spr"><label for="spr-${e.qid}">Your answer</label><input id="spr-${e.qid}" inputmode="text" autocomplete="off" spellcheck="false"></div>`;
    return `<article class="q q-hidden" id="${e.qid}" data-qid="${e.qid}" data-type="${e.type}">
      <div class="q-num">${n}</div><span class="q-tag">${esc((e.domain || "").replace(/_/g, " "))} · Band ${String(e.band).slice(1)}</span>
      <div class="stem">${stemHtml(e.stem)}</div>
      ${e.figureSvg ? `<figure class="q-fig">${e.figureSvg}</figure>` : ""}${body}</article>`;
  }
  const solutionHtmlOf = (e) => e.solution?.html ?? (e.solution?.segs ? `<div class="sol">${stemHtml(e.solution.segs)}</div>` : "");

  /* ---- the in-page prescriber (engine/prescribe.mjs port — keep in sync) ---- */
  $("#gen-practice").addEventListener("click", () => {
    const cells = assessCells(state.store.history);
    const seen = new Set(state.store.seen);
    const avail = DATA.pool.filter((p) => !seen.has(p.variantId));
    const deficient = Object.values(cells).filter((c) => c.status === "DEFICIENT");
    const review = Object.values(cells).filter((c) => c.status === "REVIEW");
    const okCells = Object.values(cells).filter((c) => c.status === "OK");
    const picked = [], usedFams = new Set(), dry = [];
    const take = (cell, { fams = null, n = 1, allowUsed = false } = {}) => {
      let got = 0;
      for (let i = 0; i < n; i++) {
        const c = avail.find((p) => p.row === cell.subdomain && p.band === cell.band
          && (!fams || fams.includes(p.familyId)) && (allowUsed || !usedFams.has(p.familyId)) && !picked.includes(p));
        if (!c) break;
        usedFams.add(c.familyId); picked.push(c); got++;
      }
      return got;
    };
    for (const cell of deficient) {
      const drills = take(cell, { fams: cell.missedFamilies, n: 2, allowUsed: true });
      const transfer = take(cell, { n: 2 });
      if (drills + transfer === 0) dry.push(cell);
    }
    for (const cell of review) { if (!take(cell, { n: 2, allowUsed: true })) dry.push(cell); }
    for (const cell of okCells.slice(0, 3)) take(cell, { n: 1, allowUsed: true }); // light confirmation, never blocking
    if (!picked.length) {
      $("#mastery-banner").hidden = false;
      $("#mastery-banner").innerHTML = `<div class="dry">No unseen items left for: ${dry.map((c) => `${c.subdomain} ${c.band}`).join(", ")}.<br>These cells need newly authored items — a tutor can run <code>node engine/cli.mjs prescribe results.json --student ${esc(state.student)} --fill-gaps</code> to emit authoring packets.</div>`;
      return;
    }
    state.practiceN++;
    const host = $("#mod-practice");
    host.innerHTML = picked.map((p, i) => buildArticle(p, i + 1)).join("\n");
    DATA.modules.practice = picked.map((p) => ({
      qid: p.qid, type: p.type, correct: p.correct, accept: p.accept, tol: p.tol,
      variantId: p.variantId, familyId: p.familyId, row: p.row, band: p.band, domain: p.domain,
      solutionHtml: solutionHtmlOf(p),
    }));
    if (dry.length) console.warn("dry cells this round:", dry.map((c) => `${c.subdomain} ${c.band}`).join(", "));
    playModule("practice", DATA.modules.practice, `Practice ${state.practiceN}`);
  });

  /* ---- results download ---- */
  $("#download-results").addEventListener("click", () => {
    const payload = {
      suiteId: DATA.id, student: state.student, ts: new Date().toISOString(),
      rounds: state.store.rounds, items: state.store.history,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" }));
    a.download = `results-${state.student}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  /* ---- start ---- */
  $("#begin").addEventListener("click", () => {
    state.student = $("#student-id").value.trim() || "anonymous";
    state.store = loadStore();
    state.lastRows = [];
    if (state.store.history.length) {
      // returning student → straight to results/loop over their accumulated evidence
      finish("Welcome back");
    } else {
      playModule("m1", DATA.modules.m1, "Module 1");
      state.lastRows = [];
    }
  });
  $("#student-id").addEventListener("input", () => {
    const s = $("#student-id").value.trim();
    if (!s) return ($("#progress-home").innerHTML = "");
    try {
      const st = JSON.parse(localStorage.getItem(`sig-suite:${DATA.id}:${s}`));
      $("#progress-home").innerHTML = st?.rounds?.length
        ? `<p class="small">Found ${st.rounds.length} previous round(s) for <b>${esc(s)}</b> — you'll continue where you left off.</p>` : "";
    } catch {}
  });
})();
