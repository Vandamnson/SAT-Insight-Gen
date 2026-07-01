# SAT-Insight-Gen — whole-repo rigorous review

_2026-06-24 · HEAD `6a4b94a` on `opus-double-gate` · bank = 902 items · 37 test modules · 3 of 4 domains built (algebra, advanced_math, geometry_trig; PSDA absent)_

**Method.** Every deterministic gate was **executed** (not just read): taxonomy spine, recompute leash (21 tests), phase-1 suite (10 tests), cross-skill checker (560 draws), the adversarial figure gate, a full render sweep over all 37 test files, and a fresh dedup scan over the 902-item bank. In parallel, three independent review agents audited (1) the pipeline code, (2) taxonomy/rubric integrity + bank coverage, (3) the figures/verification subsystem. Findings below are file:line-grounded; each was cross-checked against the running gates where possible.

---

## Executive verdict

The **item-quality core is genuinely strong**: construct-backward builders + PROVE/consistency gates, blind QA loops that found and fixed their defects (ADV-2 24/24, B7 capstones 12/12, GEO-1 40/40), zero broken statement ids, zero LLTM gaps, clean renders, 0 duplicate keys, 100% solutions. The problem is **process drift**: the last ~20 commits shipped three new item waves at high speed, and the operational invariants established during the bank cleanup (all-judge bands, near-zero structural dups, everything inside the adversarial figure gate) **silently regressed** because the gates are opt-in and the new banking paths bypass them. Nothing indicates wrong math at scale; several things indicate the *safety net has holes exactly where the newest content sits*.

---

## Gate results (executed this review)

| Gate | Result |
|---|---|
| Taxonomy spine (`validate-taxonomy`) | ✅ pass (2 pre-existing LLM-stub warnings) |
| Recompute leash (21 tests) | ✅ pass |
| Phase-1 deterministic (10 tests) | ✅ pass |
| Cross-skill checker (`_composecheck`, 560 draws C1–C7) | ✅ 0 mismatches / 0 trivial |
| Full render sweep (37 test files) | ✅ 0 KaTeX / figure errors |
| **Adversarial figure gate** (`figures/verify-all`) | ❌ **FAIL** — `test-109 q10` label overlap 3.5px (item is banked) |
| **Fresh dedup scan** (902 items) | ⚠️ structural clusters **1 → 38** (107 items); context 30 → 64 |

---

## A. Process / bank-integrity findings

**A1 · HIGH — The dedup + judge invariants regressed silently on waves 108–117 (+216 items).**
- All 216 new items carry **non-judge bands** (`apriori_v1`/`curated`), breaking the 686/686 judge-banded invariant (`bank-rejudge` was simply never run on them).
- Structural near-dup clusters went **1 → 38** (107 items), concentrated *within* the new figure waves (12× inside test-117, 7× test-115, 5× each 109/110). Nuance: the scan signature is text-only, and templated figure stems ("What is the volume of the prism shown?") inflate it — a blind adjudication pass (the established standard) is needed before deleting anything. But the direction is unambiguous: cross-run dedup was not in force for these runs.

**A2 · HIGH — `assemble()` always banks (`build/pipeline.mjs:235`).** Every run — including proofs, experiments, and the no-arg smoke test — permanently appends to `data/item-bank.jsonl`. No `--no-bank`/env guard exists. This already caused one hand-revert (test-107) and is the standing mechanism for bank pollution.

**A3 · HIGH — `SIG_BANK_DEDUP=1` alone half-works and lies about it (`selector.mjs:26,102` + `pipeline.mjs:296`).** It seeds structural fingerprints and logs them as active, but `verifyAndGate` consults them **only if `SIG_STRUCT_DEDUP=1` is also set** (default off). Cross-run *structural* dedup is a silent no-op under the flag most likely to be used.

**A4 · MEDIUM — `keyOf` embeds the mutable `band` (`bank.mjs:21`), and re-judging mutated bands in place without re-keying (`bank-rejudge-apply.mjs:24`).** Every re-banded item now has `_key ≠ keyOf(item)`. Nothing breaks today (the stored key is frozen), but any future re-key/migration will mass-duplicate, and identical content drawn at two target bands banks twice. Band does not belong in a content-identity hash.

**A5 · MEDIUM — Two capstone families bank ungated.** `_b7fill.mjs` (C1–C7) and `_advfigspot.mjs` (G1–G5) call `appendToBank` directly; their independent checkers (`_composecheck`, `_advfigcheck`) are separate manual scripts nobody is forced to run. (The GEO-2 solid/circle/composite drivers, by contrast, route through `generateCell` and are figure-gated.) `_solidbank2`/`_compositebank` additionally do a destructive strip-and-rewrite of the bank (interruption ⇒ truncated bank).

**A6 · LOW — Loose ends.** `data/test-112.json` (6-item GEO pilot) untracked and unbanked; `data/mod2-plaus.json` sidecar uncommitted; `GEO-2-COMPOSITION-RUBRIC-FIT.md` uncommitted; modified figverify pages in the working tree. `test-108` (the bank-deduped 22): reviewed — clean, exactly 1 borderline cluster vs test-105 across the whole scan.

## B. Rubric / taxonomy findings

**B1 · HIGH — PSDA is structurally absent.** No `taxonomy/cells/psda.json` exists, so none of the 17 PSDA statements can be cell-drawn. 8 PSDA statements have **zero** bank items; the other 9 have 1–2 each. A full SAT domain is missing from the current pipeline.

**B2 · MEDIUM — ALG.B6.s3 is unreachable** — absent from both `cells/algebra.json` and the bank (the only statement missing from both). Three more algebra statements (B1.s1, B2.s2, B4.s1) are cells-holes with only legacy/Mod2 bank coverage.

**B3 · MEDIUM — Algebra still maps statements by band only.** Its graph tasks are shelved under the wrong statement ids (never ALG.B2.s2/B6.s3). Advanced_math and geometry_trig got the `statementByTask` upgrade and reach 15/15 and 19/19; algebra should be brought to parity (11/15 today).

**B4 · MEDIUM — GEO-2 composite tags: the audit's re-map was never applied.** The banked test-117 items still carry the mis-mapped ids the (uncommitted) audit itself documents: 6× filed under GEO.B6.s1 (*prisms*) for circle-area items, a similarity item under B6.s2 (*Pythagorean*), band drift on `exterior_angle`, plus two flagged content holes (trig compositions; parallel-lines/transversal).

**B5 · MEDIUM — Program gating is inert.** `programs[]`/`gateNote` exist in the matrix but no generation code reads them; all 902 items are hardcoded `program:"SAT"`. Fine for a SAT-only product; a correctness bug the day anything is served as PSAT.

**B6 · LOW — 428 items (47%) carry no `statementId`** (mostly Mod2; field *absent*, not null) — half the bank is invisible to rubric-coverage accounting.

## C. Figures / verification findings

**C1 · HIGH — 57 of the newest figures sit entirely outside the adversarial gate.** `figures/verify-all.mjs` only checks fns in its `ARMS` (coordPlane/scatter/triangle/circle), so test-115's 21 solids and test-117's 36 `scene()` composites are never re-render-and-measured. Root enabler: the `FIGURES` registry (`figures.js:1121`) omits `prism/cylinder/pyramid/triPrism/scene`, so `figures/index.js` — which verify-all renders through — throws "unknown figure fn" for all five. **One stale line blocks the whole gate extension.**

**C2 · HIGH (confirmed live) — the gate FAILS on banked content:** `test-109 q10` (coordPlane, `nonlinear_graphs`, B2) has a 3.5px tick-label/curve-label overlap; the item is in the bank. The ADV-2 QA doc had noted tick-label collisions as "accepted/low-priority" — the hard gate disagrees.

**C3 · MEDIUM — `scene()` geometry is verified by nothing.** `checkComposite` recomputes answers from the stored givens, never reading the scene's point geometry; no verify-all arm; legibility passes all non-coordPlane figures (`legibility.mjs:13`); the renderer itself has no collision placer and can throw on a dangling point id. A scene that misplaces or mislabels points while keeping correct givens passes every automated gate (its only current protection is the one-time blind visual QA).

**C4 · MEDIUM — Four algebra tier-C tasks fall through figurecheck to `keep:true`** (`figurecheck.mjs:127`): `parallel_perp_graph`, `interpret_graph_context`, `connect_graph`, `read_value` — 28 banked items where the keyed choice / read value is never validated against the drawn line.

**C5 · LOW — Legibility is still coordPlane-only** (solids/circles/scenes get no readability gate), the new renderers have no NaN/degenerate input guards internally, and a latent divide-by-zero exists in the curve boundary interpolation (`renderCurve` `cross()`, practically unreachable). No solids/circles blind-QA *reports* were written (only the HTML pages), unlike ADV-2/B7.

## D. Metadata / provenance

**D1 · MEDIUM — Every tier-C item is stamped `verify.correctness:"prove:pass"`** (`pipeline.mjs:142`) though it was figure-checked, never PROVE'd — mislabeling the provenance of the entire figure corpus.
**D2 · LOW —** `band` (target) can silently disagree with `difficulty.band` (predicted, tolDown=1); the bank key uses target.

## E. Code hygiene

- The **pre-BUILD_SPEC stack is still live-looking**: `generate.mjs`, `author.mjs` + 5 dependent drivers are dead relative to the shipping pipeline but sit beside it un-marked.
- **Env-flag traps:** `SIG_BAND_TOL` and `SIG_OVERGEN` only affect the legacy stack (dead for the live path, which uses `SIG_TOL_UP/DOWN`, `SIG_OVER`); `_solidbank` v1 vs `_solidbank2` both write test-115.
- Stale doc comments (`compose.mjs`/`_composecheck` still say "C1–C4"); duplicate `"solve_formula"` in `ABSTRACT_TASKS`; HANDOFF.md only partially covers the last ~20 commits.

## F. Verified healthy (explicitly, so it isn't re-litigated)

Zero broken/typo statement ids across all cells files · zero LLTM weight/tier gaps · all 16 subdomains have drawers, all 18 graph tasks have builders, unknown tasks **throw** rather than default · C1–C7 and G1–G5 each fully covered by their checkers (0/0 across 560 draws) · solids/circles/composites have complete **figurecheck** arms (spec-level) · bank: 0 duplicate `_key`s, 0 missing solutions, viewer current at 902 · all math renders clean · ADV-2 and B7-capstone blind QA loops closed (24/24, 12/12) · GEO-1 blind QA 40/40 · Desmos shortcuts on 296 items.

---

## Ranked master list (what to fix, in order)

1. **Re-establish the bank invariants on waves 108–117**: run `bank-rejudge` on the 216 non-judge items; blind-adjudicate the 38 structural clusters (the established re-verify-then-collapse flow) and prune confirmed reskins.
2. **Fix the `FIGURES` registry** (`figures.js:1121`, one line) then **add verify-all arms + self-tests for solids and `scene`** — brings the 57 newest figures inside the adversarial gate.
3. **Make banking opt-in or gated** (`--no-bank`/`SIG_BANK=0` on `assemble()`), and make `SIG_BANK_DEDUP=1` imply the structural check (or split the log message so it can't claim what it isn't doing).
4. **Fix `test-109 q10`** (label overlap; failing hard gate, banked) — one figure, plus decide whether tick-label collisions stay "accepted" (the gate says no).
5. **Apply the GEO-2 composite re-map** (6 tag/band corrections already specified in the audit) to the bank + builders; commit the audit doc.
6. **Build `cells/psda.json`** (last missing domain; 8 zero-coverage statements) — the largest single coverage move available.
7. **Remove `band` from `keyOf`** (or re-key on re-judge) before any future migration duplicates the bank.
8. **Close the 4 unchecked algebra tier-C tasks** in figurecheck (28 banked items currently verified by nothing) and give algebra the `statementByTask` upgrade (also unlocks ALG.B6.s3).
9. **Gate the capstone bankers**: make `_b7fill`/`_advfigspot` run `_composecheck`/`_advfigcheck` inline before `appendToBank`; replace the strip-and-rewrite pattern with tmp-file + rename.
10. **Housekeeping**: fix tier-C `"prove:pass"` stamp; quarantine/mark the legacy stack; resolve `test-112` + uncommitted files; refresh HANDOFF.

**Quick wins (≤ ~15 min each):** #2's registry line, #4's one figure, #7's keyOf change, the `"prove:pass"` stamp, committing the two orphan files, the stale "C1–C4" comments.
