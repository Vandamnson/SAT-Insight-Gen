/* ============================================================================
   _build_taxonomy.mjs — one-off (re-runnable) builder for the taxonomy spine.

   Reads taxonomy/matrix.json (the 4×7 Skills-Insight matrix, the source of
   truth for statement↔template↔band links) and emits:
     • taxonomy/skills.json     — generatable templates with recompute branch,
                                   params contract, bands{} + bandLevers, and
                                   back-links to the matrix statements.
     • taxonomy/crosswalk.json  — provenance: which template came from SAT-Mod2
                                   (author backbone) / SAT-AI (recompute) / NEW,
                                   and the SAT-AI recompute branch each uses.

   Design: matrix.json drives the statement/band wiring; this file supplies the
   per-template META (recompute branch + author hint + types + figure). The
   params contract is DERIVED from the recompute branch via PARAMS_HINTS, so we
   never re-type a params shape. New templates may target an existing SAT-AI
   branch or "needs-deep-verify" (qualitative items the recompute leash can't
   certify — they defer to the blinded SymPy/LLM verifier).
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX = join(__dirname, "..", "taxonomy");
const matrix = JSON.parse(readFileSync(join(TAX, "matrix.json"), "utf8"));

/* ---- SAT-AI recompute branches → params contract (verbatim PARAMS_HINTS) --- */
const PARAMS_HINTS = {
  alg_linear_eq_1var: '{"a":num,"b":num,"c":num}  # a*x + b = c -> x',
  alg_linear_eq_2var: '{"m":num,"b":num,"x0":num,"report":"value"|"slope"|"intercept"}',
  alg_linear_func: '{"m":num,"b":num,"x0":num,"report":"value"|"slope"|"intercept"}',
  alg_linear_systems: '{"a1":num,"b1":num,"c1":num,"a2":num,"b2":num,"c2":num,"solve_for":"x"|"y"|"none"|"infinite"|"coeff"}',
  alg_linear_inequalities: '{"a":num,"b":num,"c":num,"op":"le"|"lt"|"ge"|"gt","report":"boundary"|"max_int"|"min_int"}',
  adv_equiv_expressions: '{"original":[coefs hi->lo],"claimed":[coefs hi->lo],"sample_xs":[>=deg+1 distinct]}',
  adv_nonlinear_eq: '{"a":num,"b":num,"c":num,"root_select":"plus"|"minus"|"sum"|"product"|"count"}',
  adv_quadratic_func: '{"a":num,"b":num,"c":num,"target":"vertex_y"|"vertex_x"|"discriminant"|"roots"|"y_intercept"[,"root_select"]}',
  adv_exponential_func: '{"a":num,"r":num,"t0":num[,"round_dp":int]}  # a*(1+r)^t0',
  adv_polynomial_func: '{"roots":[..] | "coefs":[hi->lo],"leading":num,"target":"value_at"|"zero"|"sum_of_zeros"|"product_of_zeros"|"end_behavior"}',
  adv_radical_rational: '{"mode":"eval_radical"|"eval_rational"|"solve_radical", <mode dims>}',
  psda_ratios_rates_units: '{"a":num,"b":num,"scale":num}  # a/b * scale',
  psda_percentages: '{"base":num,"pct":num[,"mode":"increase"|"decrease"|"of"]}',
  psda_one_var_data: '{"data":[nums],"stat":"mean"|"median"|"range"|"sum"|"min"|"max"}',
  psda_two_var_data: '{"slope":num,"intercept":num,"x_target":num,"report":"predict_y"|"predict_x"|"slope"|"intercept"|"residual"}',
  psda_probability: '{"favorable":num,"total":num}',
  psda_inference_margin: '{"sample_fav":num,"sample_n":num,"population":num}',
  geo_area_volume: '{"shape":...,"measure":"area"|"surface_area"|"volume"|"perimeter",<dims>[,"use_pi_symbol":true]}',
  geo_lines_angles_triangles: '{"rule":"triangle_sum"|"exterior_angle"|"straight_line"|"supplementary"|"complementary"|"vertical"|"parallel_transversal"|"isosceles_base"|"scale_factor","knowns":[...]}',
  geo_right_tri_trig: '{"opposite":num|null,"adjacent":num|null,"hypotenuse":num|null,"angle_deg":num|null,"report":"sin"|"cos"|"tan"|"hypotenuse"|"opposite"|"adjacent"|"angle"}',
  geo_circles: '{"target":"k_pi_area"|"radius"|"center_x"|"center_y"|"circumference"|"arc_length"|"sector_area","r":num | ("D","E","F")[,"theta":deg,"use_pi_symbol":true]}',
  "needs-deep-verify": '{...}  # qualitative / interpretation item — recompute leash defers to the blinded SymPy+LLM verifier',
};

/* ---- The 55 SAT-Mod2 templates (author backbone): key→[types,fig,hint] ----- */
const MOD2 = {
  lin_solve_value: [["mcq","spr"],"none","Solve a linear equation / substitute a sub-expression to find a value."],
  lin_function_model: [["mcq"],"none","Build/choose a linear function f(x)=mx+b modelling a flat-fee/threshold context."],
  lin_interpret: [["mcq"],"none","Interpret a slope, intercept, or coefficient of a linear model in context."],
  lin_intercepts: [["mcq","spr"],"none","Find x- or y-intercept(s) of a line or linear function."],
  system_solve: [["mcq"],"none","Solve a 2-variable linear system for (x,y) or a single value."],
  system_no_solution: [["mcq","spr"],"none","Find the constant making a 2-variable system have NO solution."],
  system_infinite: [["mcq","spr"],"none","Find constant(s) making a system have infinitely many solutions."],
  parallel_perp_slope: [["mcq"],"none","Slope of a line parallel or perpendicular to a given line."],
  inequality_model: [["mcq"],"none","Model a budget/quantity constraint as an inequality or system."],
  linear_from_data: [["mcq"],"opt","Equation of a line from a table of values or two points."],
  parametric_system: [["mcq"],"none","Solution of a system in terms of a parameter k."],
  number_of_solutions: [["mcq"],"none","How many solutions a single linear equation has after expanding."],
  quad_no_xint: [["mcq","spr"],"none","Discriminant condition for no real x-intercepts; find a constant."],
  quad_vertex: [["mcq"],"none","Vertex form / interpret the vertex (min or max) of a quadratic."],
  quad_from_area: [["mcq"],"none","Set up a quadratic from an area/product word problem."],
  poly_operations: [["mcq"],"none","Add/subtract polynomial expressions; combine like terms."],
  poly_factor: [["mcq","spr"],"none","Factor a polynomial or use a factor to find a constant."],
  exp_model: [["mcq"],"none","Build an exponential growth/decay model V(t)=A(1±r)^t."],
  exp_rewrite: [["mcq","spr"],"none","Rewrite an exponential to find the percent rate over a period."],
  rational_rearrange: [["mcq"],"none","Solve a rational/literal formula for one variable."],
  abs_value: [["spr","mcq"],"none","Solve an absolute-value equation."],
  exponent_laws: [["mcq"],"none","Simplify using exponent rules."],
  ratio_rate: [["mcq","spr"],"none","Ratios, rates, or proportions in context."],
  percent_chain: [["mcq","spr"],"none","Chained or successive percentages / percent change."],
  unit_conversion: [["mcq"],"none","Unit conversion, including compound or squared units."],
  twoway_table: [["mcq","spr"],"req","Expected/conditional count or comparison from a frequency or two-way table."],
  center_spread: [["mcq"],"req","Compare mean/median/range/std-dev across two distributions."],
  scatter_lobf: [["mcq"],"req","Reason about a scatterplot with a line of best fit."],
  margin_error: [["mcq"],"none","Interpret a sample estimate with margin of error."],
  circle_equation: [["mcq","spr"],"opt","Circle equation: diameter, complete-the-square radius, tangency, circumference."],
  circle_chord: [["mcq"],"none","Chord length from a central angle."],
  triangle_similar: [["mcq"],"opt","Similar triangles: corresponding angles/sides, sufficiency."],
  triangle_congruent: [["mcq"],"opt","Congruent triangles: correspondence, congruence criteria."],
  right_triangle: [["mcq","spr"],"opt","Pythagorean theorem / diagonal / 45-45-90 / altitude-to-hypotenuse."],
  trig_cofunction: [["mcq","spr"],"none","Cofunction identity sin=cos for complementary angles."],
  trig_ratio: [["mcq"],"opt","SOHCAHTOA: a trig ratio in a right triangle given another."],
  trig_radians: [["mcq","spr"],"none","Degree↔radian conversion or a unit-circle angle."],
  angles_parallel: [["spr","mcq"],"opt","Angles formed by a transversal cutting two parallel lines (algebraic)."],
  solid_measure: [["mcq","spr"],"opt","Volume/surface area of a cylinder, cone, sphere, prism, pyramid, or cube."],
  quad_from_area2: [["mcq"],"none","(reserved)"],
};

/* ---- recompute branch for every template key referenced by matrix.json ----- */
const RECOMPUTE = {
  // algebra
  lin_solve_value:"alg_linear_eq_1var", lin_context_one_step:"alg_linear_eq_1var", lin_create_solve:"alg_linear_eq_1var",
  lin_create_1or2var:"alg_linear_eq_1var", number_of_solutions:"alg_linear_eq_1var",
  lin_function_model:"alg_linear_func", lin_translate:"alg_linear_func", linear_from_data:"alg_linear_func",
  lin_from_2pt:"alg_linear_func", parallel_perp_slope:"alg_linear_func",
  lin_interpret:"alg_linear_eq_2var", lin_interpret_complex:"alg_linear_eq_2var", lin_intercepts:"alg_linear_eq_2var",
  lin_from_graph:"alg_linear_eq_2var", read_graph_point:"alg_linear_eq_2var", lin_representations:"alg_linear_eq_2var",
  inequality_model:"alg_linear_inequalities",
  system_solve:"alg_linear_systems", system_no_solution:"alg_linear_systems", system_infinite:"alg_linear_systems",
  system_missing_coeff:"alg_linear_systems", system_create:"alg_linear_systems", system_graph_solution:"alg_linear_systems",
  system_representations:"alg_linear_systems", parametric_system:"alg_linear_systems",
  // advanced math
  poly_operations:"adv_equiv_expressions", poly_expand:"adv_equiv_expressions", poly_rewrite_form:"adv_equiv_expressions",
  poly_factor:"adv_polynomial_func", quad_factor:"adv_polynomial_func",
  quad_factored:"adv_nonlinear_eq", nonlinear_system:"adv_nonlinear_eq", nonlinear_unknown_const:"adv_nonlinear_eq", linquad_system:"adv_nonlinear_eq",
  quad_vertex:"adv_quadratic_func", quad_no_xint:"adv_quadratic_func", quad_use:"adv_quadratic_func", quad_from_area:"adv_quadratic_func",
  read_graph_intercept:"adv_quadratic_func", read_nonlinear_feature:"adv_quadratic_func",
  interpret_nonlinear_feature:"needs-deep-verify", nonlinear_representations:"adv_quadratic_func", function_translation:"adv_quadratic_func",
  exp_model:"adv_exponential_func", exp_rewrite:"adv_exponential_func",
  abs_value:"adv_radical_rational", radical_simple:"adv_radical_rational", radical_rational:"adv_radical_rational",
  rational_rearrange:"adv_radical_rational", exponent_laws:"adv_equiv_expressions",
  // psda
  percent_simple:"psda_percentages", percent_chain:"psda_percentages", percent_over_100:"psda_percentages",
  unit_rate:"psda_ratios_rates_units", ratio_rate:"psda_ratios_rates_units", unit_conversion:"psda_ratios_rates_units",
  growth_factor:"psda_percentages",
  median_ordered:"psda_one_var_data", mean_median_freq:"psda_one_var_data", center_spread:"psda_one_var_data", data_effect_change:"psda_one_var_data",
  read_bar_freq:"psda_one_var_data", twoway_table:"psda_probability", prob_simple:"psda_probability",
  prob_conditional:"psda_probability", prob_complement:"psda_probability",
  scatter_lobf:"psda_two_var_data", avg_rate_of_change:"psda_two_var_data",
  margin_error:"psda_inference_margin", study_population:"needs-deep-verify",
  // geometry & trig
  rectangle_area:"geo_area_volume", area_sides:"geo_area_volume", perimeter_sides:"geo_area_volume",
  solid_measure:"geo_area_volume", scale_factor:"geo_area_volume", scale_factor_effect:"geo_area_volume",
  triangle_angle_sum:"geo_lines_angles_triangles", angles_intersecting:"geo_lines_angles_triangles", angles_parallel:"geo_lines_angles_triangles",
  right_triangle:"geo_right_tri_trig", special_right_triangle:"geo_right_tri_trig", trig_ratio:"geo_right_tri_trig",
  trig_cofunction:"geo_right_tri_trig", trig_radians:"geo_right_tri_trig", trig_similarity:"geo_right_tri_trig",
  triangle_similar:"geo_right_tri_trig", triangle_congruent:"geo_right_tri_trig",
  circle_equation:"geo_circles", circle_chord:"geo_circles", circle_arc_sector:"geo_circles", circle_tangent:"geo_circles",
};

/* ---- author hints + types + figure for NEW templates (not in MOD2) -------- */
const NEW_META = {
  lin_context_one_step:[["mcq","spr"],"none","B1/B2: a one-step linear equation drawn from a simple everyday context."],
  lin_create_1or2var:[["mcq","spr"],"none","Create a linear equation/inequality in one or two variables for the possible value(s)."],
  lin_create_solve:[["mcq","spr"],"none","Create and/or solve a linear equation or system, or identify its coefficients/constants."],
  lin_from_2pt:[["mcq","spr"],"opt","Find slope or the equation of a line through two points (parallel/perpendicular variants)."],
  lin_from_graph:[["mcq","spr"],"opt","Solve using a graphed line given slope/intercepts/input-output pairs."],
  lin_interpret_complex:[["mcq"],"none","In a complex context, choose the best interpretation of a part of a linear model."],
  lin_representations:[["mcq","spr"],"opt","Connect table / equation / graph / solution representations of a linear relationship."],
  lin_translate:[["mcq","spr"],"opt","Create a linear equation from details about a translation of a given function."],
  read_graph_point:[["mcq","spr"],"req","Read coordinates of a solution/point/intercept from a graphed line or system."],
  system_graph_solution:[["mcq","spr"],"req","Identify the solution of a system from the graph of two lines."],
  system_create:[["mcq","spr"],"none","Create one or both equations of a two-variable linear system that models a situation."],
  system_missing_coeff:[["mcq","spr"],"none","Find missing coefficients/constants of an equation or system given the number of solutions."],
  system_representations:[["mcq","spr"],"opt","Connect representations of a system of two linear equations."],
  read_graph_intercept:[["mcq","spr"],"req","Identify the y-intercept from the graph of a nonlinear function."],
  read_nonlinear_feature:[["mcq","spr"],"req","Identify a key feature (intercept/solution/translation) of a nonlinear or linear+nonlinear graph."],
  interpret_nonlinear_feature:[["mcq"],"opt","Interpret a key feature of an exponential/quadratic graph in context."],
  nonlinear_representations:[["mcq","spr"],"opt","Connect a quadratic/exponential graph (or its points) to its algebraic form."],
  function_translation:[["mcq","spr"],"opt","How a translation of a function affects its graph or equation."],
  poly_expand:[["mcq"],"none","Expand monomial×binomial or binomial×binomial; rewrite a polynomial product."],
  poly_rewrite_form:[["mcq"],"none","Use structure to rewrite a complex expression or pick the form that displays a feature (SAT only)."],
  quad_factored:[["mcq","spr"],"none","Solve a quadratic given in factored form."],
  quad_factor:[["mcq","spr"],"none","Solve a quadratic by factoring."],
  quad_use:[["mcq","spr"],"opt","Use a quadratic/exponential equation relating two variables (create-and-use at higher programs)."],
  nonlinear_system:[["mcq","spr"],"none","Solve a system of one linear and one nonlinear equation."],
  nonlinear_unknown_const:[["mcq","spr"],"none","Solve a problem with one or more nonlinear equations for an unknown constant."],
  linquad_system:[["mcq","spr"],"opt","Use a system of a linear and a quadratic function; identify key features."],
  radical_simple:[["mcq","spr"],"none","Solve a simple radical equation."],
  radical_rational:[["mcq"],"none","Solve an equation with radical or rational terms."],
  percent_simple:[["mcq","spr"],"none","B1: a simple one-step percent or unit-rate problem."],
  percent_over_100:[["mcq","spr"],"none","Percent problems including percentages greater than 100%."],
  unit_rate:[["mcq","spr"],"none","Simple unit-rate problem."],
  growth_factor:[["mcq","spr"],"none","Solve problems using growth factor expressed as a percent or complex unit."],
  median_ordered:[["mcq","spr"],"none","B1: median of a list of values presented in ascending order."],
  mean_median_freq:[["mcq","spr"],"req","Mean/median of a data set presented in a frequency table."],
  data_effect_change:[["mcq"],"opt","How mean/median/range change when the data set changes."],
  read_bar_freq:[["mcq","spr"],"req","Read/compare/interpret data in a bar graph or frequency table."],
  prob_simple:[["mcq","spr"],"req","Probability of an event from a frequency or two-way table."],
  prob_conditional:[["mcq","spr"],"req","Conditional probability of an event from a two-way table."],
  prob_complement:[["mcq","spr"],"opt","Use that the probabilities of all outcomes sum to 1."],
  avg_rate_of_change:[["mcq","spr"],"req","Average rate of change for data displayed in a graph."],
  study_population:[["mcq"],"none","Identify/describe the population a study's results extend to (SAT only)."],
  rectangle_area:[["mcq","spr"],"opt","Area of a rectangle from side lengths."],
  area_sides:[["mcq","spr"],"opt","Area and side lengths of plane figures."],
  perimeter_sides:[["mcq","spr"],"opt","Perimeter and side lengths of plane figures."],
  scale_factor:[["mcq","spr"],"opt","Apply a scale factor between similar figures."],
  scale_factor_effect:[["mcq","spr"],"opt","Impact of a scale factor on perimeter, area, and volume."],
  triangle_angle_sum:[["mcq","spr"],"opt","Angle measure via the triangle angle-sum theorem."],
  angles_intersecting:[["mcq","spr"],"opt","Angle measures from intersecting lines (vertical/linear pair)."],
  special_right_triangle:[["mcq","spr"],"opt","Side/angle of a special right triangle (30-60-90, 45-45-90)."],
  trig_similarity:[["mcq"],"opt","Use similarity to calculate trigonometric ratios (SAT only)."],
  circle_arc_sector:[["mcq","spr"],"opt","Arc length or sector area of a circle (or its inverse)."],
  circle_tangent:[["mcq","spr"],"opt","Tangent line / tangent-to-axis conditions for a circle."],
};

/* ---- default band-lever ladder (operationalizes monotone difficulty) ------- */
const DEFAULT_LEVERS = {
  B1: ["one step", "small integers", "direct ask", "no context or a one-line context"],
  B2: ["single concept", "small integers", "may read a simple graph/table"],
  B3: ["two steps", "simple context or a fraction", "standard ask"],
  B4: ["multi-step; use structure when present", "moderate context", "parallel/perpendicular, scale, or interpretation"],
  B5: ["create from data / two points / a translation", "two variables", "non-integer or larger numbers"],
  B6: ["chain two ideas", "interpret in a complex context", "connect multiple representations"],
  B7: ["parametric constant or variable coefficients", "remove scaffolding (no method cue)", "a sign/branch trap", "rewards insight over brute force"],
};

/* ---- derive per-template wiring from the matrix ---------------------------- */
const refs = {};   // key -> { domain, statements:Set, bands:Set, programs:Set, figureLoads:Set }
for (const cell of matrix.cells) {
  for (const st of cell.statements) {
    for (const key of st.templates) {
      const r = refs[key] || (refs[key] = { domain: cell.domain, statements: new Set(), bands: new Set(), programs: new Set(), figureLoads: new Set() });
      r.statements.add(st.id); r.bands.add(cell.band);
      st.programs.forEach(p => r.programs.add(p));
      r.figureLoads.add(st.figureLoad);
    }
  }
}

/* ---- assemble skills.json + crosswalk.json --------------------------------- */
const skills = {}, crosswalk = {}; const problems = [];
for (const [key, r] of Object.entries(refs)) {
  const branch = RECOMPUTE[key];
  if (!branch) { problems.push(`no recompute branch for "${key}"`); }
  const meta = MOD2[key] || NEW_META[key];
  if (!meta) { problems.push(`no META (types/figure/hint) for "${key}"`); continue; }
  const [types, figure, hint] = meta;
  // figure capability = the strongest demand across referencing statements, but never weaker than the template's own
  const order = { none: 0, opt: 1, req: 2 };
  const figFromMatrix = [...r.figureLoads].reduce((a, f) => order[f] > order[a] ? f : a, figure);
  const bands = {};
  [...r.bands].sort().forEach(b => { bands[b] = { levers: DEFAULT_LEVERS[b] }; });
  skills[key] = {
    key, domain: r.domain, types, figure: figFromMatrix, hint,
    recompute: branch || "needs-deep-verify",
    paramsContract: PARAMS_HINTS[branch] || PARAMS_HINTS["needs-deep-verify"],
    statements: [...r.statements].sort(),
    programs: [...r.programs].sort(),
    bands,
  };
  const source = MOD2[key] ? "satmod2" : "new";
  crosswalk[key] = { source, recomputeBranch: branch, recomputeSource: branch === "needs-deep-verify" ? "deep-verify" : "satai", statements: [...r.statements].sort(), bands: [...r.bands].sort() };
}

if (problems.length) { console.error("✗ build problems:\n  " + problems.join("\n  ")); process.exit(1); }

const outSkills = { _note: "Generated by _build_taxonomy.mjs from matrix.json — do not hand-edit; edit the builder.", _bandLevers: DEFAULT_LEVERS, templates: skills };
const outCross = { _note: "Provenance of each generatable template.", _legend: { source: "satmod2=SAT-Mod2 author backbone | new=added for finer/low-band coverage", recomputeSource: "satai=ported SAT-AI recompute branch | deep-verify=qualitative, defers to blinded verifier" }, templates: crosswalk };
writeFileSync(join(TAX, "skills.json"), JSON.stringify(outSkills, null, 2));
writeFileSync(join(TAX, "crosswalk.json"), JSON.stringify(outCross, null, 2));

const n = Object.keys(skills).length;
const nNew = Object.values(crosswalk).filter(c => c.source === "new").length;
const nDeep = Object.values(crosswalk).filter(c => c.recomputeSource === "deep-verify").length;
console.log(`✓ skills.json: ${n} templates (${n - nNew} from SAT-Mod2 backbone, ${nNew} new)`);
console.log(`✓ crosswalk.json written · ${nDeep} templates defer to deep-verify (qualitative)`);
