#!/usr/bin/env node
/**
 * toon-cost — analyze token & $ savings when converting a JSON payload to TOON
 *
 * Does NOT reimplement TOON encoding: relies on the official @toon-format/toon
 * package for encode(). This is purely an analysis/reporting layer on top.
 */
import fs from 'fs';
import path from 'path';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as gptEncode } from 'gpt-3-encoder';
import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('toon-cost')
  .description('Estimate token and cost savings from converting JSON to TOON for LLM prompts')
  .argument('<file>', 'path to a .json file')
  .option('-p, --price <usd>', 'price per 1M input tokens in USD', '3')
  .option('-r, --requests <n>', 'requests/month, for a monthly cost projection', '0')
  .option('-q, --quiet', 'suppress the TOON output preview', false)
  .parse(process.argv);

const [file] = program.args;
const opts = program.opts();

/**
 * Heuristic: what % of arrays in the payload are "tabular eligible"
 * (uniform arrays of flat objects) — the shape TOON compresses best.
 * This mirrors the eligibility concept from the TOON benchmarks, used
 * here only to warn the user when conversion won't pay off.
 */
function tabularEligibility(data) {
  let totalArrays = 0;
  let eligibleArrays = 0;

  function walk(node) {
    if (Array.isArray(node)) {
      totalArrays++;
      if (
        node.length > 0 &&
        node.every((item) => item && typeof item === 'object' && !Array.isArray(item))
      ) {
        const refKeys = Object.keys(node[0]).sort().join(',');
        const uniform = node.every((item) => Object.keys(item).sort().join(',') === refKeys);
        const flatValues = node.every((item) =>
          Object.values(item).every((v) => typeof v !== 'object' || v === null)
        );
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

function main() {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`File not found: ${filePath}`));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(chalk.red(`Invalid JSON in ${filePath}: ${err.message}`));
    process.exit(1);
  }

  const jsonCompact = JSON.stringify(data);
  const toon = toonEncode(data);

  const jsonTokens = gptEncode(jsonCompact).length;
  const toonTokens = gptEncode(toon).length;
  const savedTokens = jsonTokens - toonTokens;
  const savedPct = jsonTokens === 0 ? 0 : Math.round((savedTokens / jsonTokens) * 1000) / 10;

  const eligibility = tabularEligibility(data);
  const price = parseFloat(opts.price);
  const requests = parseInt(opts.requests, 10);

  console.log(chalk.bold(`\nTOON Cost Analyzer — ${path.basename(filePath)}`));
  console.log(chalk.gray('─'.repeat(48)));
  console.log(`${chalk.gray('JSON tokens:')}         ${jsonTokens}`);
  console.log(`${chalk.gray('TOON tokens:')}         ${toonTokens}`);
  console.log(
    `${chalk.gray('Difference:')}          ${savedTokens >= 0 ? '-' : '+'}${Math.abs(
      savedTokens
    )} tokens (${savedPct >= 0 ? '-' : '+'}${Math.abs(savedPct)}%)`
  );
  console.log(
    `${chalk.gray('Tabular eligibility:')} ${eligibility === null ? 'n/a (no arrays found)' : eligibility + '%'}`
  );

  if (eligibility !== null && eligibility < 40) {
    console.log(
      chalk.yellow(
        '\n⚠ Low tabular eligibility: data is deeply nested / irregular. TOON gains will likely be small — JSON may already be near-optimal.'
      )
    );
  }

  if (price && requests) {
    const jsonCost = (jsonTokens / 1_000_000) * price * requests;
    const toonCost = (toonTokens / 1_000_000) * price * requests;
    console.log(chalk.bold(`\nProjected monthly cost @ ${requests} requests, $${price}/1M input tokens:`));
    console.log(`  JSON: $${jsonCost.toFixed(2)}`);
    console.log(`  TOON: $${toonCost.toFixed(2)}`);
    console.log(chalk.green(`  Savings: $${(jsonCost - toonCost).toFixed(2)}/month`));
  }

  if (!opts.quiet) {
    console.log(chalk.gray('\n--- TOON output preview ---'));
    console.log(toon);
  }
}

main();
