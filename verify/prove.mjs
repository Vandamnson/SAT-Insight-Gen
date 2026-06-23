/* ============================================================================
   prove.mjs — SELECTOR Tier A (BUILD_SPEC §4, the PROVE / program-as-verifier
   pattern, arXiv:2410.12608). AGENT 3 (Claude) writes a self-contained Python
   `verify() -> bool` that INDEPENDENTLY recomputes the answer with sympy and
   returns True iff the claimed answer is correct. The HARNESS executes it in a
   sandboxed subprocess (isolated interpreter, 10s hard timeout). Trust lives only
   here — never in the author. Generalizes the per-skill recompute leash: no
   hand-written branch per skill, the checker is written per item.
   ============================================================================ */
import { llmComplete } from "../build/llm.mjs";
import { promptPack } from "../build/prompts.mjs";
import { execFile } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROVE_MODEL = process.env.SIG_PROVE_MODEL || "claude-opus-4-8";
const PY = process.env.SIG_PYTHON || "python3";
const PROVE_TIMEOUT = Number(process.env.SIG_PROVE_TIMEOUT || 10000);

// System prompt — verbatim from BUILD_SPEC §4 (Tier A, Agent 3).
const SYSTEM = `You are a verification engine. Given an SAT math problem, its claimed answer, and its
solve_path, write a self-contained Python function \`verify() -> bool\` that independently
recomputes the answer from the problem statement and returns True iff the claimed answer is
correct. Use only the standard library and sympy. Do NOT trust the provided answer — derive
it independently. Output ONLY the Python code, no prose.`;

function stripFences(s) {
  let t = String(s).trim();
  const m = t.match(/```(?:python)?\s*([\s\S]*?)```/i);
  if (m) t = m[1].trim();
  return t;
}

/** runPython(src) -> {ok, result, error, stdout} — execute a checker in an
 *  isolated interpreter with a hard timeout (the sandbox). result is the boolean
 *  printed by the appended runner; ok=false on timeout / crash / no verdict. */
export function runPython(src) {
  return new Promise((resolve) => {
    let dir;
    try { dir = mkdtempSync(join(tmpdir(), "prove-")); } catch (e) { return resolve({ ok: false, error: `sandbox mkdtemp: ${e.message}` }); }
    const file = join(dir, "check.py");
    const runner = `${src}\n\nif __name__ == "__main__":\n    try:\n        _r = verify()\n        print("PROVE_RESULT:" + ("True" if _r else "False"))\n    except Exception as _e:\n        import traceback; print("PROVE_ERROR:" + repr(_e))\n`;
    try { writeFileSync(file, runner); } catch (e) { rmSync(dir, { recursive: true, force: true }); return resolve({ ok: false, error: `sandbox write: ${e.message}` }); }
    // -I = isolated mode (ignore env + user site); hard SIGKILL at timeout.
    execFile(PY, ["-I", file], { timeout: PROVE_TIMEOUT, killSignal: "SIGKILL", cwd: dir, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      rmSync(dir, { recursive: true, force: true });
      const out = String(stdout || "");
      const m = out.match(/PROVE_RESULT:(True|False)/);
      if (m) return resolve({ ok: true, result: m[1] === "True", stdout: out });
      const em = out.match(/PROVE_ERROR:(.*)/);
      if (err && err.killed) return resolve({ ok: false, error: `timeout after ${PROVE_TIMEOUT}ms`, stdout: out });
      return resolve({ ok: false, error: em ? em[1].trim() : (String(stderr || err?.message || "no verdict").slice(0, 300)), stdout: out });
    });
  });
}

function claimText(cand) {
  if (cand.choices && cand.correct_choice) return `correct_choice="${cand.correct_choice}", answer=${JSON.stringify(cand.answer)}`;
  return `answer=${JSON.stringify(cand.answer)}`;
}

/** proveCheck(cand) -> {keep, result, error, code}. keep=true iff the independently
 *  written+executed checker returns True. */
export async function proveCheck(cand, { model = PROVE_MODEL, domain = null } = {}) {
  const system = SYSTEM + (promptPack(domain).proveHints || "");   // domain-specific verification gotchas
  const choices = cand.choices ? `\nCHOICES:\n${cand.choices.join("\n")}` : "";
  const user = `PROBLEM:
${cand.statement}${choices}

CLAIMED ANSWER: ${claimText(cand)}

SOLVE_PATH (the author's intended steps — for reference only; recompute independently):
${JSON.stringify(cand.solve_path || [], null, 0)}

Write verify() now. It must hard-code the numbers from the PROBLEM text, solve from scratch with sympy, and compare to the claimed answer (for MCQ, recompute the value and confirm the claimed letter's value matches; for free-response, confirm the value). Return True/False.`;
  let code;
  try { code = stripFences(await llmComplete(user, { system, model })); }
  catch (e) { return { keep: false, error: `agent3 transport: ${e.message}`, code: "" }; }
  if (!/def\s+verify\s*\(/.test(code)) return { keep: false, error: "no verify() in agent3 output", code };
  const run = await runPython(code);
  return { keep: run.ok && run.result === true, result: run.result, error: run.error, code, stdout: run.stdout };
}

export default { proveCheck, runPython };
