#!/usr/bin/env node
// Validate content/questions.json. Exit 1 on any finding so CI, the build and
// the weekly content routine all stop on a bad bank.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateBank } from '../src/lib/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '../content/questions.json');

let bank;
try {
  bank = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(1);
}

const problems = validateBank(bank);
const total = bank.categories?.reduce((n, c) => n + (c.questions?.length || 0), 0) ?? 0;
if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in ${file}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✓ ${file}: ${bank.categories.length} categories, ${total} questions, no problems`);
