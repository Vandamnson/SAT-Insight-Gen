/* ============================================================================
   app.js — thin progressive enhancement for the test pages. Optional: pages are
   fully correct & printable with JS off. Adds option selection, grid-in entry,
   per-question reveal, "Check answers" self-grading, and a score chip.
   Correctness is shown by fill/weight/hatch + ✓/✕ glyphs — never colour.
   ============================================================================ */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---- MCQ selection (radiogroup semantics) ---------------------------- */
  $$(".q[data-type='mcq']").forEach((q) => {
    const opts = $$(".opt", q);
    opts.forEach((opt) => {
      opt.addEventListener("click", () => select(q, opt));
      opt.addEventListener("keydown", (e) => {
        const i = opts.indexOf(opt);
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
        else if (e.key === " " || e.key === "Enter") { e.preventDefault(); select(q, opt); }
      });
    });
  });
  function select(q, opt) {
    if (q.classList.contains("revealed")) return;
    $$(".opt", q).forEach((o) => o.setAttribute("aria-checked", String(o === opt)));
    q.dataset.chosen = opt.dataset.key;
  }

  /* ---- reveal one question's correctness ------------------------------- */
  function revealQuestion(q) {
    q.classList.add("revealed");
    if (q.dataset.type === "mcq") {
      const correct = q.dataset.correct;
      const chosen = q.dataset.chosen;
      $$(".opt", q).forEach((o) => {
        if (o.dataset.key === correct) o.classList.add("correct");
        else if (o.dataset.key === chosen) o.classList.add("chosen-wrong");
      });
    } else {
      const input = $("input", q);
      if (!input) return;
      const ok = gradeSPR(input);
      const spr = input.closest(".spr");
      if (input.value.trim() !== "") spr.classList.add(ok ? "right" : "wrong");
    }
  }

  /* ---- grid-in grading -------------------------------------------------- */
  function normalize(s) {
    s = s.trim().replace(/\s+/g, "").replace(/^\$/, "");
    return s;
  }
  function toNumber(s) {
    s = normalize(s);
    if (/^[-+]?\d+\/\d+$/.test(s)) { const [a, b] = s.split("/").map(Number); return b ? a / b : NaN; }
    const v = Number(s);
    return isFinite(v) ? v : NaN;
  }
  function gradeSPR(input) {
    const accept = JSON.parse(input.dataset.accept || "[]");
    const tol = Number(input.dataset.tol || 0);
    const val = input.value;
    if (!val.trim()) return false;
    const nv = toNumber(val);
    for (const a of accept) {
      if (normalize(String(a)) === normalize(val)) return true;
      const na = toNumber(String(a));
      if (isFinite(nv) && isFinite(na) && Math.abs(nv - na) <= (tol || 1e-9)) return true;
    }
    return false;
  }

  /* ---- toolbar buttons -------------------------------------------------- */
  const printBtn = $("#print");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  const revealBtn = $("#reveal"), gradeBtn = $("#grade"), scoreChip = $("#score");
  if (revealBtn) revealBtn.addEventListener("click", () => {
    $$(".q").forEach(revealQuestion);
    revealBtn.setAttribute("aria-pressed", "true");
    showScore();
  });
  if (gradeBtn) gradeBtn.addEventListener("click", () => {
    $$(".q").forEach(revealQuestion);
    showScore();
  });
  function showScore() {
    if (!scoreChip) return;
    const qs = $$(".q");
    let correct = 0, answered = 0;
    qs.forEach((q) => {
      if (q.dataset.type === "mcq") {
        if (q.dataset.chosen) answered++;
        if (q.dataset.chosen === q.dataset.correct) correct++;
      } else {
        const input = $("input", q);
        if (input && input.value.trim()) { answered++; if (gradeSPR(input)) correct++; }
      }
    });
    scoreChip.textContent = `Score ${correct}/${qs.length}`;
    scoreChip.classList.add("show");
  }
})();
