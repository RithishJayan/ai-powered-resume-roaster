#!/usr/bin/env node
/**
 * Lightweight evaluation entrypoint (no API keys, no DB).
 * For full retrieval/generation metrics and baselines, see eval/README.md.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function metricFixtureBlocksParseable(raw) {
  const scoreMatch = raw.match(/\[RESUME_SCORES\]\s*([\s\S]*?)\s*\[\/RESUME_SCORES\]/);
  const aiMatch = raw.match(/\[AI_ASSESSMENT\]\s*([\s\S]*?)\s*\[\/AI_ASSESSMENT\]/);
  let ok = 0;
  let total = 0;
  if (scoreMatch) {
    total++;
    try {
      JSON.parse(scoreMatch[1].trim());
      ok++;
    } catch {
      /* malformed */
    }
  }
  if (aiMatch) {
    total++;
    try {
      JSON.parse(aiMatch[1].trim());
      ok++;
    } catch {
      /* malformed */
    }
  }
  return total === 0 ? { name: 'fixture_block_parse_rate', value: null, detail: 'no blocks found' } : { name: 'fixture_block_parse_rate', value: ok / total, detail: `${ok}/${total} JSON blocks valid` };
}

function metricLevelTagPresent(raw) {
  const has = /\[Level:\s*\w+/i.test(raw);
  return { name: 'level_tag_present', value: has ? 1 : 0, detail: has ? 'found' : 'missing' };
}

const fixturePath = join(__dirname, 'fixtures', 'sample_model_output.txt');
const raw = readFileSync(fixturePath, 'utf8');

const m1 = metricFixtureBlocksParseable(raw);
const m2 = metricLevelTagPresent(raw);

console.log('SER594 eval (deterministic smoke checks)\n');
for (const m of [m1, m2]) {
  console.log(`${m.name}: ${m.value === null ? 'n/a' : typeof m.value === 'number' ? m.value.toFixed(4) : m.value} (${m.detail})`);
}

if (m1.value !== null && m1.value < 1) {
  console.error('\nEval failed: expected all fixture JSON blocks to parse.');
  process.exit(1);
}
if (m2.value < 1) {
  console.error('\nEval failed: expected level tag in fixture.');
  process.exit(1);
}

console.log('\nOK — see eval/README.md for planned M4 metrics (retrieval, generation, baselines).');
process.exit(0);
