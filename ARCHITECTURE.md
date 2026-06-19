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
