# De-dup assessment — combined item bank (SAT-Insight-Gen + SAT-Mod2)

_2026-06-23 · blind-agent structural + context de-dup over the merged bank_

## Method
- **Corpus:** the persistent bank, now **828 items** — **388 SAT-Insight-Gen** (generated) + **440 SAT-Mod2** (imported, `band:"M2"`, `source:"mod2/test-NN"`). Browsable at `tests/bank/index.html` (filter by origin / domain / band / type / search).
- **Stage 1 — deterministic candidate scan** (`build/dedup-scan.mjs`): per item a number/variable-blanked **structural** signature and a prose-only **context** signature; near-identical clusters via shingle-Jaccard (struct ≥ 0.82, context ≥ 0.55). → 22 structural + 53 context candidate clusters.
- **Stage 2 — 10 blind agents** (`build/dedup-batches.mjs` writes blinded batches — stems only, **no origin/skill/source/novelty labels**): 2 adjudicated structural clusters, 4 adjudicated context clusters, 4 swept the largest single skills for **semantic** reskins below the deterministic threshold. Synthesis (`dedup-synth.mjs`) merges verdicts back against origin tags.

## Headline findings

### 1. Structural duplication is concentrated in SAT-Insight-Gen; SAT-Mod2 shows none
- Deterministic: **22** near-identical structural clusters (49 items) — **100% within Insight-Gen**, **0 in Mod2, 0 cross-generator**.
- Blind adjudication: **20 of 22 confirmed true reskins** (45 items); 2 rejected as genuinely distinct (x-intercept vs y-intercept; expand-binomials vs combine-like-terms).
- **Semantic sweep of the 4 biggest Insight-Gen skills (206 items) → only 56 distinct structures = 27% (73% reskin rate):**

| Insight-Gen skill | items | distinct structures | distinct % |
|---|---|---|---|
| linear_equations_one_variable | 63 | 11 | **17%** |
| systems_of_linear_equations | 32 | 8 | 25% |
| linear_inequalities | 28 | 8 | 29% |
| linear_equations_two_variables | 83 | 29 | 35% |

The blind sweep catches ~3× more reskins than the threshold pass — i.e. **the deterministic dedup gate only flags the most blatant ⅓**; most reskinning is semantic (same solve method + template, reworded surface).

### 2. SAT-Mod2 is the diversity benchmark
Zero structural near-dups at threshold; 440 items across 55 skills (~8/skill), expert-authored + SymPy-verified. The sweep targeted Insight-Gen's high-volume skills; Mod2's per-skill diversity was not individually swept but its candidate-scan dup count is 0.

### 3. Context (scenario) reuse: present in both, modest cross-over
- **42 of 53** context clusters confirmed as true same-scenario (119 items); 11 rejected as coincidental shared phrasing.
- By span: **29 within Insight-Gen · 12 within Mod2 · 1 cross-generator.**
- The single **cross-generator** context reuse: *"slope of the line through two given points"* (4 Insight-Gen + 2 Mod2 items). The two generators are otherwise contextually near-disjoint.
- Caveat: many "same-context" clusters are **abstract math-task phrasing** ("system has no solution — find the constant *k*"), not real-world scenario reuse. True real-world-scenario reuse is a subset.

### 4. Cross-generator overlap is minimal
**0 structural** and **1 context** cluster span both generators. Merging the two banks introduced essentially no duplication between them — they cover different surface space.

## Root causes (honest)
1. **No persistent cross-run structural ledger.** Within a single generated module, dedup is enforced (e.g. test-100 was 22/22 distinct). The bank *accumulated across many runs* with only **run-level** dedup, so the same low-band-algebra templates recur run after run. This is the exact gap flagged in `HANDOFF.md` ("seenFingerprints is RUN-LEVEL only").
2. **A/B double-banking.** Both `test-105` (baseline) and `test-106` (specialized) advanced-math runs were banked; they cover the same cells, so several Advanced reskin pairs are that A/B duplication, not a generator failure.
3. **Thin structure space at low bands.** `linear_equations_one_variable` (17% distinct) has few genuinely distinct templates — the model + small radical set re-collapse to canonical forms, exactly the "abstract-solve items are inherently more canonical" effect.

## Recommendations
1. **Port a persistent structural-fingerprint ledger** (SAT-AI had one) so dedup spans runs, not just within a module — the single highest-impact fix.
2. **De-dup or drop A/B baselines** before banking (keep test-106, drop test-105 from the bank).
3. **Cap items-per-template** and **widen low-band radical levers** (more distinct structures per skill), or accept that low-band algebra is template-bounded and rely on number/context variety there.
4. **Use Mod2 as the structural-diversity target**; consider a semantic sweep of Mod2 skills to confirm its diversity holds under blind judgment.
5. **Upgrade the dedup gate from threshold to semantic** for the kept set (the threshold pass under-counts ~3×) — e.g. a blind-agent reskin check on each module before shipping.

## Artifacts
- `build/dedup-scan.mjs` · `build/dedup-batches.mjs` · `data/dedup-candidates.json` (candidate clusters w/ spans)
- 10 blind-agent verdicts synthesized in `dedup-synth.mjs`
- `tests/bank/index.html` — filterable combined-bank viewer (origin filter added)
