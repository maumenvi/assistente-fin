import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractAgentBlock } from '../../../../src/app/ai-exchange/extract/extract.agent.block.ts';
import { parseAgentBlock } from '../../../../src/app/ai-exchange/format/parse.agent.block.ts';

const AGENTS_DIR = join(process.cwd(), 'tests', 'fixtures', 'ai-exchange', 'agents');
const MIN_RATE = 0.9;

/** Um bloco e "importavel sem edicao" quando a extracao e a validacao de forma o aceitam (SC-009). */
function importable(text: string): boolean {
  try {
    parseAgentBlock(extractAgentBlock(text));
    return true;
  } catch {
    return false;
  }
}

const agents = readdirSync(AGENTS_DIR).filter((name) => statSync(join(AGENTS_DIR, name)).isDirectory());

test('ha respostas gravadas para avaliar (as sinteticas cobrem os desvios de copia conhecidos)', () => {
  assert.ok(agents.length >= 1);
  for (const agent of agents) {
    assert.ok(readdirSync(join(AGENTS_DIR, agent)).some((file) => file.endsWith('.txt')), `${agent} sem fixtures`);
  }
});

for (const agent of agents) {
  test(`SC-009: pelo menos 90% dos blocos de "${agent}" sao importaveis sem edicao`, () => {
    const files = readdirSync(join(AGENTS_DIR, agent)).filter((file) => file.endsWith('.txt'));
    const failures = files.filter((file) => !importable(readFileSync(join(AGENTS_DIR, agent, file), 'utf8')));
    const rate = (files.length - failures.length) / files.length;
    assert.ok(rate >= MIN_RATE, `${agent}: ${(rate * 100).toFixed(0)}% (${failures.join(', ')})`);
  });
}

test('lembrete: a taxa so vale de verdade com respostas reais de ChatGPT, Claude e Gemini (quickstart C)', (t) => {
  const real = agents.filter((agent) => agent !== 'synthetic');
  if (real.length < 3) t.diagnostic(`so ${real.length} agente(s) real(is) gravado(s); faltam respostas de ${['chatgpt', 'claude', 'gemini'].filter((a) => !real.includes(a)).join(', ')}`);
  assert.ok(true);
});
