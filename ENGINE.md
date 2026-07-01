# ENGINE v2 — the novelty engine

_Branch `engine` · 2026-06-24 · Mission: a **cheap, excellent SAT resource for students of all backgrounds** — items that are **genuinely novel yet in-distribution** ("questions the College Board could have written but hasn't")._

## Doctrine (what v1 taught us, engineered in)
1. **The LLM never chooses what makes an item novel or true.** The harness owns structure; independent resolvers own truth; calibrated judges own difficulty; the LLM is confined to surface realization.
2. **Novelty is a property of the enumerable structure space**, not model temperature (v1's blind sweep: 73% reskins where the space was thin). The engine grows novelty by adding **steps** and **edges**, never by prompting harder.
3. **Defects fix the generator, not the item** — every gate failure routes to a step/edge/prompt fix so the next thousand items inherit it.
4. **A quality invariant you can bypass isn't an invariant** — the only writer of engine data (`family.mjs`) *throws* without verification records. No flags.

## Architecture (two tiers + three gates)
- **FAMILY** (expensive, once): one verified structure — 80-draw selftest through an INDEPENDENT resolver + essentialChain (no-shortcut proof) + band-pass scores + judged/curated difficulty. `data/engine/families.jsonl`.
- **VARIANT** (near-free): a re-realization inheriting the family's verification — reseed for parametric generators ($0, re-resolved every time), LLM surface for cell families (~4 calls, PROVE-gated). `data/engine/variants.jsonl`.
- **Products**: `assemble.mjs` — mock modules take **≤1 variant per family** (novelty by construction); drill ladders take k variants of one family (practice by design). Both emit v1 render schema.

### Generators
| generator | structure source | variant cost | verification |
|---|---|---|---|
| `chain` | **path composition**: typed steps × curated edge allowlist | $0 reseed | chain resolver (composed independent per-step resolvers) + essentialChain |
| `capstone`/`figcapstone` | v1's 12 curated C/G capstones | $0 reseed | `resolveCapstone`/`resolveAdvFig` (the v1 checkers, exported) |
| `figure` | tier-C construct-backward builders | $0 reseed | figureCheck + legibility |
| `cell` | v1 four-agent text pipeline | ~4 LLM calls | PROVE + plausibility + band gate |

### The band-pass (generation-time, calibrated before enforced)
- **Novelty floor**: nearest-surface similarity < 0.45 AND nearest-structural distance > 0.25, over v1 bank + engine tiers. Calibration: **42/42 known reskins flagged; 32/32 officials pass**.
- **Distribution floor**: `authenticityScore ≥ 7` (absolute judge; officials mean 8.3). A floor, never a target — the anti-recognition discipline.

## Honest current state (findings, not marketing)
- **Port-proof PASSED**: C1/C2/C4 reproduced through the new resolver at 80/80 (scales within ±20 of curated anchors, RMSE 14.7).
- **Composition produces real novelty**: 2 chains that never existed in v1 admitted at 80/80 (`line_x_intercept>coeff_from_point`, `sys_solve>vertical_shift_through_point`).
- **The distribution floor rejects our template chains (auth 3–6 vs floor 7).** The judge's critique is consistent: the "For that value of k…" two-step phrasing reads as a manufactured composite. Structure is verified; **voice is out-of-distribution**. The fix is the LLM realization pass (fuse a chain into ONE natural item, numbers pinned, PROVE-verified) — NOT lowering the floor. Until realization lifts scores past 7, chain families mint in **record mode** with their scores stored.
- **Chain banding is calibrated only at B7** (3 anchors) → chains admit B6–B7 only; lower bands come from cell/figure adapter families.
- **Grammar map is coarse** (32 released items) → `grammar.mjs targets` lists under-occupied in-distribution cells; `data/engine/released-ingest.jsonl` is the ingestion path for corpus growth.
- **Misconception tags**: author contract now emits per-wrong-choice tags (optional field); chains are SPR (no distractors). Full deterministic tagging for harness MCQs is future work.

## Run it
```bash
node engine/verify/selftest.mjs            # the hard gate: steps + chains (exit code)
node engine/verify/bandpass-calibrate.mjs  # the confusion table (novelty + distribution floors)
node engine/cli.mjs mint-capstones         # 12 curated v1 families ($0)
node engine/cli.mjs mint-chains            # composed chains → band-pass → mint (record mode)
node engine/cli.mjs variants 3             # 3 variants per family
node engine/cli.mjs module 200 22          # mock module, ≤1 per family
node engine/cli.mjs ladder <famId> 201 5   # drill ladder
node engine/grammar.mjs                    # occupancy map + generation targets
node engine/importer.mjs                   # v1 import PROPOSALS (writes nothing)
node build/render.mjs data/test-200.json   # render through the unchanged v1 viewer
```

## Growth path (each is one reviewed change)
1. **New step** → one file in `engine/steps/` (make + independent resolve + named methods) — selftest enforces the discipline mechanically.
2. **New edge** → one reviewed line in `engine/edges.mjs`.
3. **LLM realization** (`realize/llm.mjs`, next): pinned-numbers directive → authorItem → answer-pin → PROVE; target = lift chain authenticity past the floor.
4. **Corpus growth** → append released items to `released-ingest.jsonl`, re-mine, re-target.
5. **v1 import** → adjudicate `import-proposals.json` (432 mod2/misc items need blind grouping).
