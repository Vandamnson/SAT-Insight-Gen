# SAT Generator — Build Spec (four-agent linear pipeline)

A concrete build document for a single shippable unit: **one SAT algebra subdomain,
end to end**, on settled components. Architecture is a **linear four-agent producer +
deterministic two-tier selector**. No agent mesh, no recursive tuning — a fixed sequence
of Claude API calls ending in a deterministic gate.

Method is borrowed from PromptCoT (concept → rationale → problem, MIT-licensed,
`github.com/inclusionAI/PromptCoT`) and PROVE (program-as-verifier). Reimplemented as
Claude API agents because the scale is dozens–hundreds of problems on demand, not millions
for fine-tuning — so no GPU/vLLM, just API calls.

---

## 0. Pipeline shape

```
                         ┌─────────────── harness (your code, deterministic) ───────────────┐
                         │                                                                   │
  cell + free axes  ──►  AGENT 1: rationale  ──►  AGENT 2: author  ──►  SELECTOR (two-tier)  ──►  keep / reject
   (drawn in code)            (Claude)              (Claude)            ├─ AGENT 3: verifier (Claude writes check)
                                                                       └─ deterministic execution / consistency
```

- **Linear.** One direction. No agent calls another agent; the harness orchestrates.
- **Over-generate.** Run the producer N times per cell (different free-axis draws,
  raised temperature), let the selector reject most. Keep the survivors.
- **Radicals vs incidentals.** The harness decides, per draw, which **radicals**
  (difficulty-determining: operator count, degree, system-or-not) and which
  **incidentals** (surface: names, numbers, context) to set. Varying incidentals only
  = a reskin (cheap variety, same band). Varying radicals = real novelty / different band.

---

## 1. Cell + free-axis draw (harness code, no LLM)

A **cell** for algebra/linear-equations, encoded as JSON. Radicals are pinned to target a
band; incidentals are drawn randomly for variety.

```json
{
  "domain": "algebra",
  "subdomain": "linear_equations_one_variable",
  "target": "solve for the unknown",
  "band": 3,
  "radicals": {
    "n_steps": 2,
    "has_variable_both_sides": true,
    "has_fractions": false,
    "has_distribution": true
  },
  "incidentals": {
    "context": "ticket pricing",
    "var_name": "x",
    "coefficient_range": [2, 9],
    "answer_type": "integer"
  }
}
```

Rules the harness enforces (do NOT let the model choose these):
- **Radicals are set by the band target**, via the LLTM map in §5. The harness picks
  radicals whose predicted difficulty matches the requested band.
- **Incidentals are drawn randomly** each of the N times — this is where surface variety
  comes from, in code, not from asking the model to "be creative" (which re-collapses to
  canonical).

---

## 2. AGENT 1 — Rationale (Claude)

PromptCoT's key move: before writing the problem, write the *design rationale*. This forces
structural depth and is what pushes the author off the canonical instance.

**Model:** `claude-sonnet-4-6` (cheap, fast, fine for this).
**Temperature:** 1.0.

**System prompt:**
```
You are an expert SAT math item designer. Given a problem SPECIFICATION (the skill to
test, the difficulty band, and structural requirements called "radicals"), write a concise
DESIGN RATIONALE explaining how an expert would construct a problem meeting that spec.

The rationale must:
- name the specific structural features that make the problem land at the target band
  (these are the "radicals" — e.g. number of solve steps, variables on both sides);
- describe the intended solution path step by step (this becomes the answer key);
- NOT write the problem itself yet — only the design reasoning.

Do not invent difficulty the spec did not request. Do not add steps beyond the radicals.
Output 4–8 sentences of plain reasoning, then a numbered intended solution path.
```

**User message:** the cell JSON from §1.

**Output:** free-text rationale + numbered intended solve path. Pass this verbatim into
Agent 2.

---

## 3. AGENT 2 — Author (Claude)

Writes the actual problem conditioned on the rationale + cell. Emits **structured JSON** so
the selector can read the solve.

**Model:** `claude-sonnet-4-6` (or Opus for hardest bands).
**Temperature:** 1.0.

**System prompt:**
```
You are an SAT math item writer. Given a SPECIFICATION and a DESIGN RATIONALE (including an
intended solution path), write ONE complete SAT-style problem that realizes that design.

Requirements:
- The problem must match the rationale's structure exactly (same radicals, same intended
  solve path). Do not add or remove solve steps.
- Use the incidentals provided (context, variable name, number ranges) for surface detail.
- Produce a single unambiguous correct answer.

Output ONLY valid JSON, no prose, no markdown fences:
{
  "statement": "the full problem text as a student would see it",
  "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],   // omit if free-response
  "correct_choice": "B",                                  // or "answer" for free-response
  "answer": "the correct numeric/expression answer",
  "solve_path": [
    {"step": 1, "op": "distribute", "detail": "..."},
    {"step": 2, "op": "collect_like_terms", "detail": "..."}
  ],
  "radicals_used": { ...echo the radicals... },
  "claimed_band": 3
}
```

**User message:** cell JSON + the rationale from Agent 1.

**Output:** parsed JSON candidate. The `solve_path` (typed operations) is your structural
fingerprint — used for both verification and reskin detection.

---

## 4. SELECTOR — two-tier (deterministic gate)

The selector carries all trust. Nothing the producer makes is trusted until it passes here.
Two tiers, matched to anchored vs free domains. **Algebra is anchored → use Tier A.**

### Tier A — Program verification (PROVE), for anchored domains

**AGENT 3 (Claude) writes a checker; the harness executes it deterministically.**

**Agent 3 system prompt:**
```
You are a verification engine. Given an SAT math problem, its claimed answer, and its
solve_path, write a self-contained Python function `verify() -> bool` that independently
recomputes the answer from the problem statement and returns True iff the claimed answer is
correct. Use only the standard library and sympy. Do NOT trust the provided answer — derive
it independently. Output ONLY the Python code, no prose.
```

**Harness then:**
1. Executes `verify()` in a sandboxed subprocess (timeout 10s).
2. **Correctness gate:** keep only if `verify()` returns `True`.
3. **Reskin gate (structural):** compute a fingerprint from `solve_path` (the sequence of
   `op` types). Reject if its structural distance to the cell's canonical fingerprint is
   below the per-cell floor ε(c). (Start with the gate OFF — just log the distribution —
   until you've seen the spread; see §6.)
4. **Dedup gate (surface):** reject if too close (embedding/text) to an already-kept item
   in this batch.

### Tier B — Consistency gating, for free domains (geometry, later)

When you can't program-verify: Claude solves the problem N=5 times independently
(temperature 0.7). Keep only if ≥4 of 5 agree on the answer. (This is the standard
self-consistency selector; weaker than PROVE, but it's all you get when there's no
mechanical checker.)

---

## 5. Band model — LLTM (additive, for algebra)

Difficulty as a linear combination of radicals. This is established psychometrics
(Linear Logistic Test Model); you FIT it, you don't derive it.

```
predicted_difficulty(radicals) =
    w0
  + w1 * n_steps
  + w2 * has_variable_both_sides
  + w3 * has_fractions
  + w4 * has_distribution
  + w5 * (answer_type == "fraction")
```

**Bootstrapping the weights (before you have data):**
1. Start with hand-set weights ordered by intuition (`n_steps` and `has_fractions` weigh
   most). Map predicted_difficulty to bands by simple thresholds.
2. Once the generator runs, **measure** each item's difficulty by Tier-B consistency
   (model success rate over N solves) and **regress** measured difficulty on the radicals to
   fit `w`. Now the band gate is grounded.
3. The **correlation between predicted (structural) and measured (model) difficulty is the
   research instrument** — high for algebra (anchored), low for geometry (free). Log it; it
   is `anc(d)`. (Product doesn't need this; it's the free research byproduct.)

**Band gate:** reject if `predicted_band` ≠ `claimed_band`, or (asymmetric) if the item is
*harder* than the target band. Tune the threshold once weights are fit.

---

## 6. Orchestration (harness pseudocode)

```python
def generate_test(blueprint):           # blueprint: {cell: count} per the 8/8/3/3 mix
    kept = []
    for cell_template, n_needed in blueprint.items():
        pool = []
        for _ in range(OVER_GENERATE * n_needed):       # e.g. 4x over-generate
            cell = draw_free_axes(cell_template)         # §1, harness-side variance
            rationale = agent_rationale(cell)            # §2
            cand = agent_author(cell, rationale)         # §3
            if cand is None:                             # parse failure
                continue
            if not selector(cand, cell, pool):           # §4, deterministic gate
                continue
            pool.append(cand)
        kept += pick_balanced(pool, n_needed)            # band-spread within the cell
    log_kappa_and_anc(kept)                              # §5.3 research instrument (off-critical-path)
    return assemble(kept)                                # final test, render

def selector(cand, cell, pool):
    if not program_verify(cand):          return False   # Tier A correctness (PROVE)
    if band_mismatch(cand, cell):         return False   # §5 LLTM band gate
    if surface_dup(cand, pool):           return False   # dedup
    # reskin gate: LOG ONLY at first (see §4.3), enable ε(c) floor later
    log_structural_distance(cand, cell)
    return True
```

**Tuning knobs (all on top of a frozen selector):** `OVER_GENERATE` multiple, per-cell ε(c)
reskin floor, band threshold, consistency N. These are scalars to tune; the trusted gates
underneath do not move.

---

## 7. Build order (ship one domain first)

1. **Stand up the linear pipeline** for `linear_equations_one_variable` only:
   draw → rationale → author → PROVE verifier. Get end-to-end valid output.
2. **Add the LLTM band gate** with hand-set weights. Confirm bands look right by eye.
3. **Add dedup + the reskin LOGGING** (gate off). Look at the structural-distance
   histogram; set ε(c) per cell once you can see thin vs thick.
4. **Over-generate + pick_balanced** to assemble a full-length section. Ship this to the
   tutoring center. **This is the deliverable — it needs nothing below this line.**
5. *(Optional, research)* Turn on `log_kappa_and_anc`: regress measured (consistency)
   difficulty on radicals to fit LLTM weights, and log the structure-vs-model correlation
   per domain. This is `anc(d)` measured — the research instrument, free once the generator
   runs.
6. *(Later)* Add geometry as a second domain with Tier-B consistency gating (no PROVE
   verifier available there) and a construction-graph difficulty model.

---

## 8. What NOT to do

- **No agent mesh.** Four agents, one direction, deterministic gate. No agent calls another;
  no recursive weight-tuning. The linearity is what makes it shippable.
- **Don't let the model pick radicals or incidentals.** The harness draws them. If the model
  "chooses an interesting context," it re-collapses to canonical and you get reskins.
- **Don't trust the author's answer.** The PROVE verifier recomputes independently. The
  author is the producer; trust lives only in the deterministic selector.
- **Don't block shipping on the research.** Steps 1–4 are the product. Step 5 is optional and
  rides on top of an already-shipped generator.
- **Don't run PromptCoT's repo as-is.** It's a GPU/vLLM training-data pipeline. Take the
  concept→rationale→problem *recipe* and the rationale prompt structure as design reference;
  run it as Claude API agents at your scale.

---

## 9. Reference material to pull (all MIT / open)

- `github.com/inclusionAI/PromptCoT` — read the rationale-generation prompt and
  `problem_generation.sh` for the concept→rationale→problem chain format.
- `PromptCoT-2.0-Concepts` (HuggingFace dataset) — template for encoding your SAT
  taxonomy as "foundational concepts."
- PROVE (arXiv:2410.12608) — the program-as-verifier pattern for Tier A.
- LLTM references (Embretson cognitive design system; Gierl item models) — read before
  claiming any novelty on the difficulty model; the additive band model above is theirs.
```
