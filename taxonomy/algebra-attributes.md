# Algebra — exact attribute expansion of the Skills-Insight rubric

Source of truth for the BUILD_SPEC generator's `task` axis (taxonomy/cells/algebra.json).
Each official statement (taxonomy/matrix.json) is decomposed into its atomic skill/knowledge
units. The generator must cover every row, each placed at its rubric band.

**Sub:** 1V = one-variable equation · 2V = two-variable / linear function · SYS = systems · INEQ = inequalities
**Repr:** eq / ctx / graph / table / pairs / translation / sys · **Tier:** A = PROVE (sympy) · B = self-consistency
**Now:** ✓ covered · ~ partial/folded · ✗ missing (as of the 4-subdomain cell schema)

## Official statements
- **B1.s1** Within a context, create and/or solve a simple equation in one variable.
- **B1.s2** Solve a simple one-step linear equation in one variable.
- **B2.s1** Solve problems using a graph or linear equation when given one or more of: slope, intercepts, input-output pairs.
- **B2.s2** Identify the coordinates of a solution, point, or intercept when given a graph of a linear equation or a graph of a system of two linear equations.
- **B3.s1** With or without a simple context, create a linear equation or inequality in one or two variables that represents the possible value(s) of the variable.
- **B3.s2** Within a context, use linear equations to find input-output pairs and to interpret input-output pairs or rate of change in terms of a context.
- **B4.s1** Within a complex context, choose the best interpretation of a part of an equation or of an input-output pair when given a linear equation that models the situation.
- **B4.s2** Solve problems about linear relationships, making use of structure when present, that include equations, intercepts, slope, and input-output pairs, including finding equations for parallel and perpendicular lines.
- **B5.s1** With or without a context, create a linear equation or inequality in two variables when given two input-output pairs, a table of values, or details about a translation of a given function.
- **B5.s2** With or without a complex context, create one or both of the two linear equations in two variables that model the situation, or find and use the solution to a given system of linear equations.
- **B6.s1** Find and interpret the meaning of intercepts or slope for complex linear equations.
- **B6.s2** Find the number of solutions to a complex linear equation; find the number of solutions to a system of two linear equations, or find missing coefficients of a linear equation or a system when the number of solutions is given.
- **B6.s3** Make connections between a table, an algebraic representation, a graph, a solution, or features of a graph of a complex linear equation or a system of two linear equations.
- **B7.s1** With or without a context, create and/or solve a linear equation or system of linear equations, or identify the correct coefficients or constants in the equation(s) that represent(s) the situation.
- **B7.s2** Make connections between different representations of linear equations in one variable, linear functions, linear equations in two variables, systems of two linear equations, and linear inequalities when these representations include symbolic representations that may contain variable constants.

## Atomic attributes

| # | Band | Stmt | Atomic attribute (what the student does) | Sub | Repr | Tier | Now | task key |
|---|---|---|---|---|---|---|---|---|
| 1 | B1 | s1 | Create a simple one-variable equation from a context | 1V | ctx | A | ✗ | onevar_create_solve |
| 2 | B1 | s1 | Solve a simple one-variable equation in a context | 1V | ctx | A | ~ | onevar_solve |
| 3 | B1 | s2 | Solve a one-step linear equation | 1V | eq | A | ✓ | onevar_solve |
| 4 | B2 | s1 | Solve a problem given the slope (graph or equation) | 2V | eq/graph | A | ~ | twovar_solve_given |
| 5 | B2 | s1 | Solve a problem given intercept(s) | 2V | eq/graph | A | ~ | twovar_find_intercept |
| 6 | B2 | s1 | Solve a problem given input-output pair(s) | 2V | eq | A | ✓ | twovar_evaluate |
| 7 | B2 | s2 | Identify a point/solution/intercept from the graph of a line | 2V | graph | A | ✗ | twovar_read_graph |
| 8 | B2 | s2 | Identify the solution from the graph of a system | SYS | graph | A | ✗ | sys_read_graph |
| 9 | B3 | s1 | Create a one-variable linear equation (possible values) | 1V | ctx/eq | B | ✗ | onevar_create |
| 10 | B3 | s1 | Create a two-variable linear equation | 2V | ctx/eq | B | ✗ | twovar_create_equation |
| 11 | B3 | s1 | Create a one-variable linear inequality | INEQ | ctx | B | ✗ | ineq_create_onevar |
| 12 | B3 | s1 | Create a two-variable linear inequality | INEQ | ctx | B | ~ | ineq_create_twovar |
| 13 | B3 | s2 | Use a linear equation to find input-output pairs | 2V | eq/ctx | A | ✓ | twovar_evaluate |
| 14 | B3 | s2 | Interpret an input-output pair in context | 2V | ctx | B | ✗ | twovar_interpret_io |
| 15 | B3 | s2 | Interpret rate of change in context | 2V | ctx | B | ~ | twovar_rate_of_change |
| 16 | B4 | s1 | Interpret a part of an equation (coeff/constant), complex ctx | 2V | ctx | B | ✓ | twovar_interpret_part |
| 17 | B4 | s1 | Interpret an input-output pair, complex ctx | 2V | ctx | B | ~ | twovar_interpret_io |
| 18 | B4 | s2 | Solve using structure — intercepts | 2V | eq | A | ~ | twovar_find_intercept |
| 19 | B4 | s2 | Solve using structure — slope | 2V | eq | A | ~ | twovar_find_slope |
| 20 | B4 | s2 | Solve using structure — input-output pairs | 2V | eq | A | ✓ | twovar_evaluate |
| 21 | B4 | s2 | Find equation of a parallel line | 2V | eq | A | ✓ | twovar_parallel_perp |
| 22 | B4 | s2 | Find equation of a perpendicular line | 2V | eq | A | ✓ | twovar_parallel_perp |
| 23 | B5 | s1 | Create a 2-var equation from two input-output pairs | 2V | pairs | A | ✗ | twovar_create_from_pairs |
| 24 | B5 | s1 | Create a 2-var equation from a table | 2V | table | A | ✗ | twovar_create_from_table |
| 25 | B5 | s1 | Create a 2-var equation from a translation of a function | 2V | translation | A | ✗ | twovar_create_from_translation |
| 26 | B5 | s1 | Create a 2-var inequality (pairs/table/translation) | INEQ | pairs/table | B | ✗ | ineq_create_twovar |
| 27 | B5 | s2 | Create one/both equations of a system modeling a situation | SYS | ctx | A | ✓ | sys_create_solve |
| 28 | B5 | s2 | Find the solution to a given system | SYS | sys | A | ✓ | sys_solve |
| 29 | B5 | s2 | Use the solution to a system | SYS | sys/ctx | A | ~ | sys_create_solve |
| 30 | B6 | s1 | Find/interpret intercepts of a complex linear equation | 2V | eq | B | ✓ | twovar_interpret_part |
| 31 | B6 | s1 | Find/interpret slope of a complex linear equation | 2V | eq | B | ✓ | twovar_interpret_part |
| 32 | B6 | s2 | Number of solutions of a complex one-variable equation | 1V | eq | A | ✗ | onevar_num_solutions |
| 33 | B6 | s2 | Number of solutions of a system | SYS | sys | A | ✓ | sys_num_solutions |
| 34 | B6 | s2 | Find missing coefficient of an equation given # solutions | 1V | eq | A | ✗ | onevar_missing_coeff |
| 35 | B6 | s2 | Find missing coefficient of a system given # solutions | SYS | sys | A | ✓ | sys_missing_coeff |
| 36 | B6 | s3 | Connect table ↔ algebra (complex eq/system) | 2V/SYS | table | B | ✓ | twovar_connect |
| 37 | B6 | s3 | Connect graph ↔ algebra (complex eq/system) | 2V/SYS | graph | B | ✗ | twovar_connect_graph |
| 38 | B6 | s3 | Connect a solution / features of a graph | 2V/SYS | graph | B | ~ | twovar_connect_graph |
| 39 | B7 | s1 | Create and/or solve a complex one-variable equation | 1V | ctx/eq | A | ~ | onevar_create_solve |
| 40 | B7 | s1 | Create and/or solve a system | SYS | ctx | A | ✓ | sys_create_solve |
| 41 | B7 | s1 | Identify the correct coefficients/constants modeling a situation | 1V/2V | ctx | B | ✗ | twovar_identify_coeff |
| 42 | B7 | s2 | Connect representations across forms with variable constants | all | symbolic | B | ~ | ineq_variable_constants / twovar_connect |

## Tally
42 atomic attributes — **✓ 15 covered · ~ 11 partial/folded · ✗ 16 missing.**

### Missing families (priority for the task-axis expansion)
1. **Create / model** (1, 9, 10, 11, 23, 24, 25, 26, 41) — modeling is ~⅓ of the rubric; almost entirely dropped.
2. **Graph representation** (7, 8, 37) — needs real coordinate-plane (and system) figures.
3. **Interpret io-pair / rate of change** (14, 15) — currently folded into "find slope."
4. **One-variable number-of-solutions / missing-coefficient** (32, 34) — only existed for systems.
