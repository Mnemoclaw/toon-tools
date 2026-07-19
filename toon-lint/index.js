#!/usr/bin/env node
/**
 * toon-lint — validate .toon files and catch common authoring mistakes.
 *
 * TOON is meant to be machine-generated, but people do hand-edit it
 * (fixing a value, trimming a row). This CLI catches the mistakes that
 * creep in from manual edits: declared array lengths that don't match
 * actual row counts, ragged tables, and files that don't round-trip
 * cleanly back to equivalent JSON.
 *
 * Decoding/encoding is delegated entirely to the official
 * @toon-format/toon package — this file only adds validation on top.
 */
import fs from 'fs';
import path from 'path';
import { decode as toonDecode, encode as toonEncode } from '@toon-format/toon';
import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';

const program = new Command();

program
  .name('toon-lint')
  .description('Validate .toon files: parse errors, length mismatches, round-trip integrity')
  .argument('<pattern>', 'file path or glob, e.g. "data/**/*.toon"')
  .option('--strict', 'treat round-trip mismatches as errors (not just warnings)', false)
  .parse(process.argv);

const [pattern] = program.args;
const opts = program.opts();

function checkArrayLengthDeclarations(raw, filePath) {
  // TOON tabular arrays are declared like: items[3]{id,name}:
  // This checks the declared count against the actual number of data rows
  // that follow, using indentation to find the row block boundaries.
  const lines = raw.split('\n');
  const issues = [];
  const headerRe = /^(\s*)([\w.-]+)\[(\d+)\]\{[^}]*\}:\s*$/;

  lines.forEach((line, idx) => {
    const m = line.match(headerRe);
    if (!m) return;
    const [, indent, key, declaredLenStr] = m;
    const declaredLen = parseInt(declaredLenStr, 10);
    const baseIndent = indent.length;

    let actualLen = 0;
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') continue;
      const lineIndent = l.match(/^(\s*)/)[1].length;
      if (lineIndent <= baseIndent) break;
      actualLen++;
    }

    if (actualLen !== declaredLen) {
      issues.push({
        line: idx + 1,
        key,
        declaredLen,
        actualLen,
        message: `"${key}" declares length [${declaredLen}] but ${actualLen} row(s) follow`,
      });
    }
  });

  return issues;
}

async function lintFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const result = { file: filePath, errors: [], warnings: [] };

  // 1. Parse check
  let decoded;
  try {
    decoded = toonDecode(raw);
  } catch (err) {
    result.errors.push(`Parse error: ${err.message}`);
    return result;
  }

  // 2. Declared array length vs actual rows
  const lengthIssues = checkArrayLengthDeclarations(raw, filePath);
  for (const issue of lengthIssues) {
    result.errors.push(`Line ${issue.line}: ${issue.message}`);
  }

  // 3. Round-trip check: decode -> re-encode -> compare structurally
  try {
    const reEncoded = toonEncode(decoded);
    const reDecoded = toonDecode(reEncoded);
    const same = JSON.stringify(decoded) === JSON.stringify(reDecoded);
    if (!same) {
      result.warnings.push('Round-trip mismatch: decode → encode → decode does not produce identical data');
    }
  } catch (err) {
    result.warnings.push(`Could not verify round-trip: ${err.message}`);
  }

  return result;
}

async function main() {
  const files = await glob(pattern, { nodir: true });
  if (files.length === 0) {
    console.error(chalk.red(`No files matched: ${pattern}`));
    process.exit(1);
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const result = await lintFile(file);
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;

    if (!hasIssues) {
      console.log(`${chalk.green('✓')} ${path.relative(process.cwd(), file)}`);
      continue;
    }

    console.log(`${chalk.bold(path.relative(process.cwd(), file))}`);
    result.errors.forEach((e) => {
      console.log(`  ${chalk.red('✗ error')}   ${e}`);
      totalErrors++;
    });
    result.warnings.forEach((w) => {
      console.log(`  ${chalk.yellow('⚠ warning')} ${w}`);
      totalWarnings++;
    });
  }

  console.log(chalk.gray('─'.repeat(48)));
  console.log(`${files.length} file(s) checked — ${totalErrors} error(s), ${totalWarnings} warning(s)`);

  if (totalErrors > 0 || (opts.strict && totalWarnings > 0)) {
    process.exit(1);
  }
}

main();
