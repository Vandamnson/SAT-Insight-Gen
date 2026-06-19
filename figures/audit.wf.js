export const meta = {
  name: 'sat-mod2-figure-audit',
  description: 'Comprehensive agentic audit of all 50 SAT Mod2 figures from rendered pixels + figures.js code',
  phases: [
    { title: 'Inspect', detail: 'vision inspector per figure (screen + print pixels)' },
    { title: 'Verify', detail: 'adversarial refute pass on every finding' },
    { title: 'CodeAudit', detail: 'read figures.js for latent bugs' },
  ],
}

const CARDS = '/Users/vandanpokal/Downloads/SAT-Mod2-Novel-Tests/build/audit/cards'
const FIGJS = '/Users/vandanpokal/Downloads/SAT-Mod2-Novel-Tests/assets/figures.js'
const KEYS = ["test-01-q2-table","test-01-q4-parallelLines","test-01-q17-table","test-02-q1-table","test-02-q15-parallelLines","test-02-q18-table","test-02-q19-table","test-02-q22-triangle","test-03-q4-parallelLines","test-03-q20-dotPlot","test-04-q2-parallelLines","test-05-q1-triangle","test-05-q18-table","test-05-q22-table","test-06-q2-histogram","test-06-q11-scatter","test-06-q18-table","test-07-q1-table","test-07-q5-table","test-08-q8-scatter","test-08-q10-table","test-08-q13-parallelLines","test-08-q15-table","test-09-q7-table","test-09-q8-dotPlot","test-09-q21-parallelLines","test-10-q9-table","test-10-q10-scatter","test-11-q16-table","test-11-q19-table","test-12-q18-histogram","test-12-q19-scatter","test-13-q4-parallelLines","test-13-q12-triangle","test-13-q13-table","test-14-q4-table","test-14-q5-scatter","test-14-q8-dotPlot","test-15-q7-dotPlot","test-15-q10-table","test-15-q22-table","test-16-q7-triangle","test-16-q9-parallelLines","test-16-q10-coordPlane","test-16-q12-scatter","test-17-q2-table","test-17-q7-table","test-18-q3-dotPlot","test-19-q18-table","test-19-q20-table"]
const HARD = new Set(["parallelLines","coordPlane","triangle"])
const fnOf = k => k.split('-').pop()
const card = k => `${CARDS}/${k}.json`

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['key','fn','overall','findings'],
  properties: {
    key: { type: 'string' }, fn: { type: 'string' },
    overall: { type: 'string', enum: ['clean','issues'] },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['severity','dimension','title','description','evidence'],
      properties: {
        severity: { type: 'string', enum: ['blocker','major','minor','nit'] },
        dimension: { type: 'string', enum: ['rendering','data_or_geometry_fidelity','figure_stem_consistency','semantic_relationship','print_safety'] },
        title: { type: 'string' },
        description: { type: 'string' },
        evidence: { type: 'string' },
      } } } }
}
const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['real','confidence','corrected_severity','reasoning'],
  properties: {
    real: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high','medium','low'] },
    corrected_severity: { type: 'string', enum: ['blocker','major','minor','nit'] },
    reasoning: { type: 'string' },
  }
}
const CODE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['area','findings'],
  properties: {
    area: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['severity','title','function_name','description','triggered_by_live_spec'],
      properties: {
        severity: { type: 'string', enum: ['blocker','major','minor','nit'] },
        title: { type: 'string' },
        function_name: { type: 'string' },
        line_hint: { type: 'string' },
        description: { type: 'string' },
        triggered_by_live_spec: { type: 'boolean' },
        which_specs: { type: 'string' },
      } } } }
}

const SEVDEF = `SEVERITY:
- blocker = the figure is wrong or misleading enough that the question becomes unanswerable, ambiguous, or the intended/stated answer is no longer justified (e.g. a label position that contradicts the relationship the stem asserts and changes the math; a data point/bar/dot drawn at the wrong value; an axis mislabeled).
- major = a clearly visible rendering defect that impairs reading but the question is probably still answerable (overlapping/garbled/clipped labels, wrong tick labels, distorted geometry).
- minor = noticeable but cosmetic (slight crowding, suboptimal placement, uneven spacing).
- nit = trivial polish.`

const inspect = (k) => agent(
`You are auditing ONE figure from a Digital SAT Math practice test, judging it from the RENDERED PIXELS.

Read the audit card (JSON) at:
  ${card(k)}
It contains: the question stem, the figure spec, the answer, the worked solution, and the invariants to check (general + type-specific).

Then VIEW the rendered images with the Read tool (real screenshots of this exact figure):
  - screen render: the path in the card field "screenPng"
  - print render (if "printPng" is not null): that path too
Base every VISUAL judgement ONLY on what you see in the pixels — never on the spec alone. Use the spec/stem/answer to know what SHOULD be shown, then verify the pixels show it.

Check, at minimum, the dimensions in the card's invariants.general (rendering integrity; figure-vs-stem consistency; print safety) and invariants.type (the type-specific checks).

${SEVDEF}

Be a careful, skeptical examiner. Report only real defects you can point to in the image or that the spec/stem demonstrably create. If the figure is correct and clean, return overall:"clean" with an empty findings array — do NOT invent issues. For each finding, 'evidence' must cite the concrete pixel observation or spec/stem fact that proves it.`,
  { label: `inspect:${k}`, phase: 'Inspect', schema: FINDINGS_SCHEMA,
    effort: HARD.has(fnOf(k)) ? 'high' : 'medium' })

const verify = async (review, k) => {
  if (!review || review.overall === 'clean' || !review.findings?.length)
    return { key: k, fn: fnOf(k), findings: [] }
  const out = []
  for (const f of review.findings) {
    if (f.severity === 'nit') { out.push({ ...f, status: 'unverified_nit', verdicts: [] }); continue }
    const hard = (f.severity === 'blocker' || f.severity === 'major')
    const lenses = hard
      ? ['Re-examine the RENDERED PIXELS directly and independently — measure positions/counts/heights yourself before judging.',
         'Reason from the SPEC + STEM + ANSWER and the underlying geometry/data: would a knowledgeable reviewer agree this is a real defect that affects the test-taker?']
      : ['Re-examine the rendered pixels and the spec to confirm or refute this single finding.']
    const verdicts = (await parallel(lenses.map((lens, i) => () => agent(
`You are an ADVERSARIAL verifier. Your DEFAULT is that the claimed finding is NOT real; only confirm it if the evidence clearly holds. Do not be agreeable.

Figure audit card: ${card(k)}  (stem, spec, answer, invariants)
View the rendered image(s): read the "screenPng" (and "printPng" if present) paths from the card with the Read tool.

CLAIMED FINDING to scrutinize:
  severity: ${f.severity}
  dimension: ${f.dimension}
  title: ${f.title}
  description: ${f.description}
  inspector's evidence: ${f.evidence}

YOUR LENS: ${lens}

Decide: is this finding REAL (a genuine defect a careful reviewer/test-taker would care about) or REFUTED (a misread, a non-issue, or correct-as-drawn)? Set corrected_severity to what you think it truly is (downgrade an over-stated finding, upgrade if worse than claimed). Be specific about what you actually observed in the pixels.`,
      { label: `verify:${k}#${i}`, phase: 'Verify', schema: VERDICT_SCHEMA,
        effort: hard ? 'high' : 'medium' })
    ))).filter(Boolean)
    const real = verdicts.filter(v => v.real).length, tot = verdicts.length
    const status = tot === 0 ? 'unverified'
      : real > tot / 2 ? 'confirmed'
      : real === tot / 2 ? 'disputed' : 'refuted'
    out.push({ ...f, status, verdicts })
  }
  return { key: k, fn: fnOf(k), findings: out }
}

const CODE_TASKS = [
  { area: 'charts+helpers', focus: 'coordPlane, scatter, dotPlot, histogram, barChart and the shared helpers (niceStep, ticks, labelStep, clipLine, thinFactor, leastSquares, curveScreenPts, niceMax, niceLabel). Look hard at: the histogram last-bin label `txt(L + R - L, ...)` (is x=R correct/duplicated/overlapping?); thinFactor silently hiding tick labels; clipLine returning <2 points; niceMax/niceStep edge cases; the equal-scaling math in coordPlane; dot stacking/clipping math in dotPlot.' },
  { area: 'geometry', focus: 'triangle, rectangle, parallelLines, circle and helpers makePlacer, rightAngleMark, footOfPerp, unit. Look hard at: parallelLines label band-clamp / bisector seating / last-resort fallback (can a label still collide or sit on the wrong side of the midline?); triangle sideLabels key resolution and right-angle/altitude marks; the placer fallback that registers a box without drawing a leader line; circle tangent geometry.' },
  { area: 'table+escaping+defs', focus: 'table (note cells `${c}` and headers `${h}` are inserted RAW / unescaped — is that a latent render/injection bug given the data shapes used?), the ESC/txt helpers, svg() and defs/markers, FONT sizing, and any place a NaN/undefined/empty value could reach the DOM.' },
]
const codeAudit = () => parallel(CODE_TASKS.map(t => () => agent(
`Audit the figure library SOURCE for latent bugs. Read the full file:
  ${FIGJS}

FOCUS AREA: ${t.area}
${t.focus}

Report concrete latent bugs or fragilities: wrong math, off-by-one, collision/clipping logic that can fail, unsafe/unescaped output, NaN/undefined leaks, axis/scale errors. For each, say whether any of the 50 live specs in this test set would TRIGGER it (triggered_by_live_spec) and which (which_specs). Distinguish real bugs from style. If the area is solid, return few/no findings rather than padding.`,
  { label: `code:${t.area}`, phase: 'CodeAudit', schema: CODE_SCHEMA, effort: 'high' })))

phase('Inspect')
const [figResults, codeResults] = await Promise.all([
  pipeline(KEYS, inspect, verify),
  codeAudit(),
])

const figs = figResults.filter(Boolean)
const flat = figs.flatMap(r => (r.findings || []).map(f => ({ key: r.key, fn: r.fn, ...f })))
const confirmed = flat.filter(f => f.status === 'confirmed')
const disputed = flat.filter(f => f.status === 'disputed')
const refuted = flat.filter(f => f.status === 'refuted')
const nits = flat.filter(f => f.status === 'unverified_nit')
const codeFindings = (codeResults || []).filter(Boolean).flatMap(r => (r.findings||[]).map(f => ({ area: r.area, ...f })))

log(`figures inspected: ${figs.length}/50 | confirmed: ${confirmed.length} | disputed: ${disputed.length} | refuted: ${refuted.length} | nits: ${nits.length} | code findings: ${codeFindings.length}`)

return {
  summary: {
    figures_inspected: figs.length,
    clean_figures: figs.filter(r => !r.findings?.length).length,
    confirmed: confirmed.length, disputed: disputed.length, refuted: refuted.length, nits: nits.length,
    code_findings: codeFindings.length,
  },
  confirmed, disputed, refuted, nits,
  per_figure: figs,
  code_findings: codeFindings,
}
