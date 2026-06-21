# SAT-Insight-Gen — architecture evolution

Four stages this session. The **verified pipeline** (author → recompute leash → figure-consistency → LLM-judge band gate → blinded deep-verify → ledger) is constant; what changed each time is **where items come from** and **how variety is produced**. Each stage's problem drove the next.

---

## 1 — Flat templates (starting point)

```mermaid
flowchart TD
  MX["matrix.json<br/>4 domains x 7 bands"] --> SK["skills.json<br/>91 FLAT templates"]
  SK --> BP["blueprint<br/>pick statement x template x band"]
  BP --> RT["resolveTarget"]
  RT --> AU["author (LLM)<br/>prompt = template hint + band levers"]
  AU --> RL["recompute leash<br/>Algebra branches only"]
  RL --> FC["figure consistency"]
  FC --> JG["LLM-judge band gate<br/>symmetric +/-1"]
  JG -->|band miss: critique-revise| AU
  JG --> DV["blinded deep-verify"]
  DV --> LD["ledger dedup"]
  LD --> AS["assemble 22 + render"]
  PROB["PROBLEM: 1 template = 1 structure;<br/>different numbers = RESKINS;<br/>no context variety"]:::p
  SK -.-> PROB
  classDef p fill:#ffe0e0,stroke:#c00,color:#900
```
*Procedural figure generators (graphgen/diagramgen) were disabled in parallel. The reskin problem drove stage 2.*

---

## 2 — Flat templates + variant/context injection

```mermaid
flowchart TD
  SK["skills.json<br/>91 flat templates"] --> RT["resolveTarget + varIdx"]
  VR["variants.json<br/>structural variants<br/>per symbolic template"] --> RT
  CX["contexts.json<br/>~60 scenarios"] --> RT
  RT --> AU["author (LLM)<br/>+ rotated STRUCTURE variant<br/>+ rotated CONTEXT"]
  AU --> PIPE["verified pipeline<br/>leash -> figure -> judge -> deep-verify -> ledger"]
  PIPE --> AS["assemble + render"]
  PROB["PROBLEM: variety bolted onto FLAT templates;<br/>'linear' is a topic, not a domain;<br/>not organized by the taxonomy"]:::p
  RT -.-> PROB
  classDef p fill:#ffe0e0,stroke:#c00,color:#900
```
*Variety improved but was a patch. "Organize by domain then subdomain" drove stage 3.*

---

## 3 — Variety GRID (domain → subdomain → cells)

```mermaid
flowchart TD
  MX["matrix.json statements"] --> GR["grids/ algebra advanced psda geometry .json<br/>DOMAIN -> SUBDOMAIN -> cells"]
  GR --> FG["flattenGrid"]
  FG --> RC["resolveGridCell<br/>cell = representation x target x form<br/>TARGET = a rubric ATTRIBUTE"]
  CX["contexts.json"] --> RC
  RC --> AU["author (LLM) + cell's structural ASK"]
  AU --> PIPE["verified pipeline<br/>leash branches per domain<br/>adv / geo / psda ADDED -> deep-verify"]
  PIPE --> DEMO["grid-demo per domain"]
  NOTE["102 cells, 17 subdomains, B1-B7;<br/>leash verifies the rubric-named attribute"]:::n
  GR -.-> NOTE
  EXP["A/B experiment vs an OPEN lane:<br/>GRID wins variety, OPEN wins richness"]:::e
  DEMO -.-> EXP
  classDef n fill:#e0f0ff,stroke:#06c,color:#036
  classDef e fill:#fff3cd,stroke:#c90,color:#960
```
*The grid won variety but had a canonical floor; open generation was richer but clustered. That drove the hybrid.*

---

## 4 — HYBRID: grid + open lane (current)

```mermaid
flowchart TD
  GR["grids/*.json<br/>domain -> subdomain -> cells"] --> FG["flattenGrid"]
  MX["matrix statements"] --> OP
  subgraph asm["tests.mjs — per test, SAT mix 8/8/3/3, over-generate 32"]
    FG --> GL["~70% GRID slots<br/>resolveGridCell + rotated context"]
    OP["~30% OPEN slots<br/>resolveOpenTarget<br/>free structure, band-calibrated"]
  end
  GL --> AU["author (LLM) — grid: cell ASK"]
  OP --> AO["author (LLM) — open: rubric statement only"]
  AU --> PIPE
  AO --> PIPE["verified pipeline<br/>leash on grid-numeric + deep-verify on BOTH<br/>ASYMMETRIC band gate: reject if harder"]
  PIPE -->|band miss| RV["critique-revise"]
  RV --> AU
  PIPE --> PB["over-generate -> pickBalanced to 22<br/>per-test ledger, dedup 0.45"]
  PB --> RN["render"]
  HARD["transport: concurrency semaphore + 429 backoff;<br/>band-tuning: asymmetric + lower targets"]:::n
  PIPE -.-> HARD
  classDef n fill:#e0f0ff,stroke:#06c,color:#036
```
*Grid = variety + verified backbone; open lane = richness ceiling. Band gate pinned to exact-low; transport hardened against rate limits.*

---

## 5 — BUILD_SPEC: four-agent linear pipeline (current)

A clean redesign from `BUILD_SPEC.md` (PromptCoT concept→rationale→problem + PROVE program-as-verifier). The producer is **linear** — no agent mesh, no recursive tuning — ending in a **deterministic two-tier selector**. It targets the session's three recurring pains head-on: reskins (rationale agent + radical/incidental split), difficulty drift (deterministic LLTM over *known* radicals, not an LLM-judge guessing from text), and trust (PROVE recomputes every answer).

```mermaid
flowchart TD
  CELL[("cells/*.json : radical axes, LLTM weights, per-task A/B tier")]
  subgraph harness["HARNESS - deterministic, your code (no agent calls another)"]
    direction TB
    DRAW["1. DRAW cell + free axes - no LLM<br/>radicals (difficulty) PINNED to band via LLTM<br/>incidentals + concrete numbers DRAWN in code"]
    A1["AGENT 1 - Rationale (OPUS)<br/>design rationale + intended solve path"]
    A2["AGENT 2 - Author (OPUS)<br/>JSON: statement, choices, answer,<br/>typed solve_path, radicals_used, claimed_band"]
    subgraph SEL["SELECTOR - two-tier deterministic gate, all trust here"]
      direction TB
      TIER{"anchored domain?"}
      TA["TIER A - PROVE (OPUS)<br/>AGENT 3 writes a SymPy verify()<br/>harness runs it sandboxed, 10s"]
      TB["TIER B - self-consistency (OPUS)<br/>N independent solves must agree"]
      BAND["LLTM band gate, asymmetric<br/>reject if harder than target"]
      DEDUP["surface dedup"]
      RESKIN["reskin distance on solve_path"]
    end
    REVISE["DOUBLE GATE - revise, do not discard<br/>turn the failure into feedback,<br/>re-author, then gate AGAIN"]
    PB["2. over-generate then pick_balanced<br/>SAT band/domain mix, covering design"]
    RA["render adapter to KaTeX static site"]
  end
  DROP["drop ONLY after repairs exhausted"]
  CELL --> DRAW --> A1 --> A2 --> TIER
  TIER -->|"yes: algebra"| TA
  TIER -->|"no: geometry"| TB
  TA --> BAND
  TB --> BAND
  BAND --> DEDUP --> RESKIN
  RESKIN -->|"pass"| PB --> RA
  TA -.->|"verify False"| REVISE
  BAND -.->|"wrong band"| REVISE
  RESKIN -.->|"reskin / dup"| REVISE
  REVISE ==>|"feedback to Agent 2"| A2
  REVISE -.->|"still failing"| DROP
  classDef r fill:#ffe0e0,stroke:#c00,color:#900
  classDef g fill:#e0f7e9,stroke:#093,color:#063
  class DROP r
  class REVISE g
```

**What changed from #4 → #5, and why:**
- **Variety is harness-drawn, not model-coaxed.** Radicals (difficulty-determining: steps, both-sides, distribution, fractions, answer-type) are *pinned* to the band; incidentals (context, variable, numbers, format) are *drawn in code*. Asking the model to "be creative" re-collapses to canonical — so we don't. (Replaces the grid `form` + open-lane "be inventive".)
- **Difficulty is deterministic again — but soundly.** The LLTM is additive over radicals the harness *set* (ground truth), so it sidesteps the brittleness that killed the earlier text-inferred estimator, and it removes the LLM-judge's +1 drift entirely. (Replaces the LLM-judge band gate.)
- **PROVE generalizes the leash.** Agent 3 writes a fresh sympy `verify()` per item, executed sandboxed — no hand-written recompute branch per skill. (Generalizes `recompute.js`.)
- **Rationale-first (PromptCoT).** Writing the design rationale before the problem is the structural lever against reskins.
- **One direction, deterministic gate.** Linearity is what makes it shippable; tuning knobs (over-generate ×, ε reskin floor, band tolerance, consistency N) sit on top of a frozen selector.
- **Double gate, not discard — all on Opus.** A rejected item isn't thrown away: the failure is turned into a concrete revision instruction, the author (Agent 2) re-writes it, and it runs the gate **again**; it's dropped only after the repair budget is exhausted. All four agents (rationale, author, PROVE checker-writer, consistency solver) run on Claude Opus.

*Build order: ship `linear_equations_one_variable` end-to-end first (steps 1–4 are the product); LLTM weight-refit + the structure-vs-model correlation are optional research (step 5) that rides on top.*
