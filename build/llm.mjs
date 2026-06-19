/* ============================================================================
   llm.mjs — LLM transport. Shells out to the local `claude` CLI (subscription
   auth, no pay-as-you-go API credits — matches the budget). Port of SAT-AI's
   _llm_complete_cli: -p PROMPT --output-format json --model … --system-prompt …
   --permission-mode plan (read-only; never mutates or hangs on a prompt).
   ============================================================================ */
import { execFile } from "node:child_process";

const CLAUDE_BIN = process.env.SIG_CLAUDE_BIN || "claude";
const MODEL = process.env.SIG_MODEL || "claude-opus-4-8";
const TIMEOUT = Number(process.env.SIG_LLM_TIMEOUT || 240000);
// On a subscription, the bottleneck is a RATE/CONCURRENCY limit (HTTP 429), not $$.
// Each generated item fires ~3 CLI calls, and pools run several items at once, so we
// cap the number of ACTUAL `claude` processes globally and retry 429s with backoff.
const MAX_CONC = Number(process.env.SIG_LLM_CONCURRENCY || 3);
const RETRIES = Number(process.env.SIG_LLM_RETRIES || 5);
const RETRYABLE = /status=(429|500|502|503|529)|overloaded|rate.?limit|timeout|ECONNRESET|ETIMEDOUT/i;

export class LLMTransportError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let active = 0; const waiters = [];
function acquire() { return active < MAX_CONC ? (active++, Promise.resolve()) : new Promise((res) => waiters.push(res)); }
function release() { active--; if (waiters.length && active < MAX_CONC) { active++; waiters.shift()(); } }

/** Run one completion (no retry/limit). Throws LLMTransportError on transport
 *  failure, Error("refused"/"empty") on a fixable model outcome. */
function runOnce(prompt, { system = "", model = MODEL } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "json", "--model", model, "--permission-mode", "plan"];
    if (system) args.push("--system-prompt", system);
    execFile(CLAUDE_BIN, args, { maxBuffer: 32 * 1024 * 1024, timeout: TIMEOUT }, (err, stdout, stderr) => {
      if (err && err.killed) return reject(new LLMTransportError(`claude CLI timeout after ${TIMEOUT}ms`));
      if (err && !stdout) return reject(new LLMTransportError(`claude CLI failed: ${err.message} ${String(stderr).slice(0, 200)}`));
      let env;
      try { env = JSON.parse(stdout); } catch (e) { return reject(new LLMTransportError(`non-JSON envelope: ${e.message}`)); }
      if (env.is_error || (env.subtype && env.subtype !== "success")) return reject(new LLMTransportError(`CLI error subtype=${env.subtype} status=${env.api_error_status}`));
      if (env.stop_reason === "refusal") return reject(new Error("model refused"));
      const text = (env.result || "").trim();
      if (!text) return reject(new Error("empty result"));
      resolve(text);
    });
  });
}

/** llmComplete — globally concurrency-limited + retries rate-limit/transient
 *  errors with exponential backoff (4s,8s,16s,32s,60s + jitter). Non-retryable
 *  outcomes (refusal/empty/parse) reject immediately for the caller's repair loop. */
export async function llmComplete(prompt, opts = {}) {
  await acquire();
  try {
    let lastErr;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try { return await runOnce(prompt, opts); }
      catch (e) {
        lastErr = e;
        const retryable = e instanceof LLMTransportError && RETRYABLE.test(e.message);
        if (!retryable || attempt === RETRIES) throw e;
        const wait = Math.min(4000 * 2 ** attempt, 60000) + Math.floor(Math.random() * 2000);
        await sleep(wait);
      }
    }
    throw lastErr;
  } finally { release(); }
}

/** Parse a JSON object from a model response (tolerate ```json fences / prose). */
export function parseJson(raw) {
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  else { const i = s.indexOf("{"), j = s.lastIndexOf("}"); if (i >= 0 && j > i) s = s.slice(i, j + 1); }
  return JSON.parse(s);
}

export default { llmComplete, parseJson, LLMTransportError, MODEL };
