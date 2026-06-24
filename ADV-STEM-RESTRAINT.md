# How restraining are Advanced-Math stems? — rigorous rubric check

_2026-06-24 · Re-read all 15 Advanced Math + 15 Algebra Skills-Insight statements verbatim and classified each by **context-demand** (the thing that drives how much scenario freedom the author has)._

**Classification key** — A = abstract (bare expression/equation, no scenario; author chooses only numbers) · C = context-**required** ("within a context") · E = either ("with or without a context") · F = figure/graph-read.

## Advanced Math (15 statements)
| stmt | wording cue | class |
|---|---|---|
| B1.s1 | "given the **graph** of a nonlinear function" | **F** |
| B1.s2 | "Rewrite an expression by combining like terms" | **A** |
| B2.s1 | "given the **graph** of … a nonlinear function or … system" | **F** |
| B2.s2 | "Rewrite an expression … GCF … distributive" | **A** |
| B3.s1 | "Solve quadratic equations in factored form; … absolute value … radical" | **A** |
| B3.s2 | "Rewrite equations … sum of two polynomials or solving for a variable" | **A** |
| B4.s1 | "**With or without a context**, use … a quadratic or exponential equation" | **E** |
| B4.s2 | "Solve quadratic equations using factoring; … radical or rational … system … polynomial" | **A** |
| B5.s1 | "Use … a quadratic/exponential function … identify key features of the graph" (no context cue) | **A** |
| B5.s2 | "Rewrite a polynomial … product … or by factoring" | **A** |
| B6.s1 | "**Within a context**, create … and solve for an unknown value" | **C** |
| B6.s2 | "**Within a context**, interpret a key feature of the graph" | **C** |
| B6.s3 | "Make connections between … graph … and its algebraic representation … translation" | **A** |
| B7.s1 | "**with or without context** … one or more nonlinear equations … unknown constant" | **E** |
| B7.s2 | "Solve a complex equation/formula for a variable; use exponent/…/radical properties to rewrite; … most suitable form" | **A** |

**Tally:** A = 9 · F = 2 · E = 2 · **C = 2.** → purely abstract **60%**, abstract-or-figure (no scenario) **73%**, context-**required** only **13%** (B6.s1, B6.s2 — both SAT-gated). (B5.s1 is borderline A/E; even calling it E leaves 53% purely abstract.)

## Algebra (15 statements)
| class | statements | count |
|---|---|---|
| **C** (context-required) | B1.s1, B3.s2, B4.s1, B6.s1 | 4 |
| **E** (either / applied) | B2.s1, B3.s1, B4.s2, B5.s1, B5.s2, B7.s1 | 6 |
| **A** (abstract) | B1.s2, B6.s2, B6.s3, B7.s2 | 4 |
| **F** (graph-read) | B2.s2 | 1 |

**Tally:** context-**required 27%**, context-**possible (C+E) 67%**, purely abstract **27%**.

## Head-to-head
| | context-required | context-possible (C+E) | purely abstract |
|---|---|---|---|
| **Advanced Math** | **13%** (2/15) | **27%** (4/15) | **60%** (9/15) |
| **Algebra** | **27%** (4/15) | **67%** (10/15) | **27%** (4/15) |

The rubric **confirms the direction strongly**: Advanced Math demands a real-world context in only 2 of 15 statements (vs 4 in Algebra), allows context in ~1/4 of statements (vs 2/3 in Algebra), and is purely abstract in 60% (vs 27%). So Advanced stems are genuinely far more restraining — the author usually gets only the numbers, not a scenario. **That is faithful to the rubric, not an artifact of how I built the schema.**

## Correction to my earlier number
I previously said Advanced is **"82% abstract."** That figure was a **task count in my schema**, and it **overstates** the rubric. Reason: abstract *skills* decompose into many task-variants (B3.s1 → solve_factored + solve_abs_value + solve_radical; B4.s2 → four solve tasks; B5.s2 → three rewrite tasks), while the context-required statements decompose into few (B6.s1 → one, B6.s2 → one). So counting tasks inflates "abstract." The **rubric-faithful figure is ~60% purely abstract / ~73% no-scenario** at the statement level — still majority-abstract and still well above Algebra, but **not 82%.**

## Cross-check: is my schema faithful?
Where my schema marks tasks contextual (`create_solve`→B6.s1, `interpret_feature`→B6.s2, the model tasks→B4.s1) lines up exactly with the rubric's only context-required/either statements. So the schema places context in the right places; it just spawns more abstract solve-variants, which is why the task-count read high.

## Verdict
- **Confident, and rubric-backed:** Advanced-Math stems are substantially more restraining (more abstract, less scenario freedom) than Algebra's — context-required 13% vs 27%, context-possible 27% vs 67%, purely abstract 60% vs 27%.
- **But I was imprecise on magnitude:** the honest figure is ~60–73% abstract (rubric, statement-level), not the 82% task-count I quoted. The implication for novelty stands: Advanced's variety must come from number/structure + dedup, not scenarios — but the gap to Algebra is "roughly 2× more abstract," not "4×."
