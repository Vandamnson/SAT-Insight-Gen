/* ============================================================================
   bank.mjs — an append-only ARCHIVE of every generated item (data/item-bank.jsonl,
   one render-ready item per line). So generated problems persist across runs and
   can be reused/assembled later without regenerating. Deduped by content hash, so
   re-running or re-banking the same test never duplicates.

     import { appendToBank } from "./bank.mjs"   // called from pipeline assemble()
     node build/bank.mjs                          // backfill: scan data/test-*.json → bank new items
   ============================================================================ */
import { readFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK = join(ROOT, "data", "item-bank.jsonl");

// content identity — two items with the same domain/band/type/stem/options/answer are the same
// item. The figure is part of the identity too: graph items (templated stems, same answer) differ
// ONLY in their figure, so without it distinct graphs would collapse to one.
const keyOf = (q) => createHash("sha1")
  .update(JSON.stringify({ d: q.domain, b: q.band || q.target_band, t: q.type, stem: q.stem, options: q.options || null, answer: q.answer, fig: q.figure || null }))
  .digest("hex");

export function loadBankKeys() {
  if (!existsSync(BANK)) return new Set();
  const keys = new Set();
  for (const line of readFileSync(BANK, "utf8").split("\n")) { if (!line.trim()) continue; try { keys.add(JSON.parse(line)._key); } catch { /* skip bad line */ } }
  return keys;
}

/** appendToBank(questions, meta) → number of NEW items written (content-deduped). */
export function appendToBank(questions, meta = {}) {
  const have = loadBankKeys();
  let added = 0, out = "";
  for (const q of questions || []) {
    const _key = keyOf(q);
    if (have.has(_key)) continue;
    have.add(_key);
    out += JSON.stringify({ _key, savedAt: meta.savedAt || new Date().toISOString(), source: meta.source || null, ...q }) + "\n";
    added++;
  }
  if (out) appendFileSync(BANK, out);
  return added;
}

// CLI: backfill from every data/test-*.json (idempotent)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DATA = join(ROOT, "data");
  const files = readdirSync(DATA).filter((f) => /^test-\d+\.json$/.test(f)).sort();
  let total = 0;
  for (const f of files) {
    let t; try { t = JSON.parse(readFileSync(join(DATA, f), "utf8")); } catch { continue; }
    const n = appendToBank(t.questions || [], { source: `test-${String(t.number).padStart(2, "0")}`, savedAt: new Date().toISOString() });
    if (n) { total += n; console.log(`  +${n} from ${f}`); }
  }
  console.log(`\nbanked ${total} new item(s) → data/item-bank.jsonl  (total now ${loadBankKeys().size})`);
}

export default { appendToBank, loadBankKeys };
