/**
 * Smoke test — verifies the deps and analyze function work in a Node context
 * equivalent to what the Worker uses. Not a substitute for the real Workers
 * runtime test (run `wrangler dev` for that), but catches dep/import bugs fast.
 */
import { encode as toonEncode } from '@toon-format/toon';
import { encode as gptEncode } from 'gpt-tokenizer';

function tabularEligibility(data) {
  let totalArrays = 0;
  let eligibleArrays = 0;
  function walk(node) {
    if (Array.isArray(node)) {
      totalArrays++;
      if (node.length > 0 && node.every((i) => i && typeof i === 'object' && !Array.isArray(i))) {
        const refKeys = Object.keys(node[0]).sort().join(',');
        const uniform = node.every((i) => Object.keys(i).sort().join(',') === refKeys);
        const flatValues = node.every((i) => Object.values(i).every((v) => typeof v !== 'object' || v === null));
        if (uniform && flatValues) eligibleArrays++;
      }
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  }
  walk(data);
  return totalArrays === 0 ? null : Math.round((eligibleArrays / totalArrays) * 100);
}

function analyze(data) {
  const jsonCompact = JSON.stringify(data);
  const toon = toonEncode(data);
  const jsonTokens = gptEncode(jsonCompact).length;
  const toonTokens = gptEncode(toon).length;
  const savedTokens = jsonTokens - toonTokens;
  const savedPct = jsonTokens === 0 ? 0 : Math.round((savedTokens / jsonTokens) * 1000) / 10;
  return {
    toon,
    json_tokens: jsonTokens,
    toon_tokens: toonTokens,
    saved_tokens: savedTokens,
    saved_pct: savedPct,
    tabular_eligibility: tabularEligibility(data),
  };
}

const SAMPLE = {
  users: [
    { id: 1, name: 'Alice', role: 'admin', active: true },
    { id: 2, name: 'Bob', role: 'user', active: true },
    { id: 3, name: 'Chloé', role: 'user', active: false },
  ],
  meta: { total: 3, page: 1 },
};

const r = analyze(SAMPLE);
console.log('TOON output preview:\n', r.toon);
console.log('\nMetrics:');
console.log(`  json_tokens:         ${r.json_tokens}`);
console.log(`  toon_tokens:         ${r.toon_tokens}`);
console.log(`  saved_tokens:        ${r.saved_tokens}`);
console.log(`  saved_pct:           ${r.saved_pct}%`);
console.log(`  tabular_eligibility: ${r.tabular_eligibility}%`);

if (r.json_tokens === 0) throw new Error('json_tokens should not be 0');
if (r.toon.length === 0) throw new Error('toon output empty');
console.log('\n✓ smoke test passed');
