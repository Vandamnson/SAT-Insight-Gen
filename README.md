# SAT-Insight-Gen

An SAT Math problem generator **indexed by the College Board "Skills Insight" taxonomy** (4 content domains × 7 performance score bands), producing **perfect figures** (math-consistent · geometrically verified · legible-at-extremes · pixel-QA'd) and attaching to every item an **accurate, RP67-style difficulty estimate** (SAT scale-score point + band + uncertainty).

It is a fresh project that **reuses proven code** from two prior generators — `SAT-Mod2-Novel-Tests` (figure library, build-time KaTeX static site, blinded SymPy verify) and `SAT-AI` (the pure-Python recompute leash, coverage ledger, product profiles) — with the **band (B1–B7) as a first-class axis** that neither parent modeled.

## Why
- **Skills taxonomy as the spine.** `taxonomy/matrix.json` is the full 4×7 Skills-Insight matrix (28 cells, 66 skill/knowledge statements, program-gating for SAT vs PSAT). `taxonomy/skills.json` decomposes those statements into ~91 *generatable templates*, each tied to a recompute branch, a params contract, and the bands it serves.
- **Difficulty mirrors College Board's own method.** Difficulty = the **RP67** location (the scale score where P(correct) = 0.67). Items are generated *targeting* a band and accepted only if their *measured* band matches — the same assignment rule College Board uses.
- **Figures are never drawn by the LLM.** The author emits a structured numeric `figure: {fn, spec}`; deterministic code renders and independently verifies it.

## Layout
```
taxonomy/   matrix.json (4×7 spine) · skills.json + crosswalk.json (generated) · item.schema.json · seed/
build/      _build_taxonomy.mjs · validate-taxonomy.mjs · render.mjs   (+ Phase-1: plan/author/generate/rebalance/coverage/ledger)
verify/     (Phase 1) recompute.js (JS leash) · deep-verify.mjs (blinded SymPy) · venv/
difficulty/ index.js (LLM-judge measure) · judge.mjs (panel) · calibrate.mjs · validate.mjs · exemplars.clean.json
figures/    figures.js (ported renderer) · index.js (interface) · verify.mjs (adversarial; generalized in Phase 1-2) · audit.wf.js
assets/     base.css · print.css · theme.css · app.js · katex/ · fonts/
data/       generated item pool + assembled sets (test-99.json = fixture)
tests/      rendered offline static site (served from repo root, like SAT-Mod2)
```

## Commands
```bash
node build/_build_taxonomy.mjs       # regenerate skills.json + crosswalk.json from matrix.json
node build/validate-taxonomy.mjs     # spine + interface gate (CI); exits non-zero on any error
node build/render.mjs data/test-99.json   # render one item set to tests/test-NN/
python3 -m http.server 8000          # then open http://localhost:8000/tests/test-99/
```

## Status
**Phases 0–2 complete.**
- **Pipeline:** band-targeted generation — author (Claude via the `claude` CLI) → recompute leash (Algebra) / deep-verify defer (others) → figure math-consistency + adversarial verification → **LLM-judge difficulty** (accept iff measured band ≈ target) → blinded deep-verify → anti-repeat ledger → render.
- **Difficulty = LLM-judge only.** `difficulty/index.js measure()` runs a multi-panelist judge grounded in CB's own per-domain Skills-Insight statements; RP67 crossing → band. Validated vs College Board's own band-labeled exemplars: **Spearman ρ=0.90, within ±1 band 88%.** (The old deterministic estimator was removed — it was a brittle proxy.)
- **Showcase:** `data/test-81.json` covers the full **4×7 grid (28/28 cells)**, judge-graded → `tests/test-81/`. Regenerate: `SIG_LLM_TIMEOUT=300000 node build/generate.mjs matrix`. Re-grade an existing set: `node build/regrade.mjs data/test-81.json`.
- **Figures:** deterministic renderer + math-consistency + adversarial verification (`figures/verify-all.mjs`) + pixel/vision QA (the layer that catches arrowhead/legibility issues a box-checker can't).

**Optional remaining:** OCR the Geometry figure-exemplars (image-based) to extend difficulty validation to the 4th domain. See `HANDOFF.md`; full design `~/.claude/plans/cuddly-dazzling-reef.md`.
