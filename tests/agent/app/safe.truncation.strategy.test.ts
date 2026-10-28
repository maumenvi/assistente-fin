import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentMessage } from '../../../src/domain/agent/agent.message.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { estimateTokens } from '../../../src/app/agent/context/estimate.tokens.ts';
import { SafeTruncationStrategy } from '../../../src/app/agent/context/safe.truncation.strategy.ts';
import { type LlmMessage } from '../../../src/app/agent/ports/llm/llm.message.ts';

const strategy = new SafeTruncationStrategy();
const caps = (contextWindow: number) => ({ ...CONSERVATIVE_CAPABILITIES, contextWindow });

function msg(seq: number, role: 'user' | 'assistant', text: string, extra: Partial<AgentMessage> = {}): AgentMessage {
  return { id: `m${seq}`, conversationId: 'c1', userId: 'u1', seq, role, parts: [{ type: 'text', text }], status: 'complete', runId: null, errorCode: null, createdAt: '2026-10-22T12:00:00.000Z', ...extra };
}
const turn: LlmMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'pergunta atual' }] }];
const texts = (messages: readonly LlmMessage[]) => messages.map((m) => (m.role === 'tool' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('')));

describe('estimateTokens', () => {
  it('~3,5 caracteres por token, arredondando para cima', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens('a'.repeat(7)), 2);
    assert.equal(estimateTokens('a'.repeat(8)), 3);
  });
});

describe('SafeTruncationStrategy', () => {
  it('janela grande: todo o historico, depois a rodada em curso', () => {
    const history = [msg(1, 'user', 'oi'), msg(2, 'assistant', 'ola'), msg(3, 'user', 'quanto?'), msg(4, 'assistant', 'R$ 10,00')];
    const out = strategy.build({ system: 'sys', history, turn, capabilities: caps(200_000), preferences: [], summary: null });
    assert.deepEqual(texts(out), ['oi', 'ola', 'quanto?', 'R$ 10,00', 'pergunta atual']);
  });

  it('janela pequena: mantem as mais recentes e a rodada em curso, na ordem', () => {
    const history = Array.from({ length: 20 }, (_, i) => msg(i + 1, i % 2 === 0 ? 'user' : 'assistant', `mensagem ${i + 1} ${'x'.repeat(60)}`));
    const out = strategy.build({ system: 's', history, turn, capabilities: caps(300), preferences: [], summary: null });
    const t = texts(out);
    assert.equal(t.at(-1), 'pergunta atual');
    assert.ok(t.length < 20 && t.length >= 2);
    assert.ok((t[t.length - 2] as string).startsWith('mensagem 20'));
    const numbers = t.slice(0, -1).map((x) => Number(/mensagem (\d+)/.exec(x)?.[1]));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  });

  it('o historico nunca comeca por resposta do assistente', () => {
    const history = [msg(1, 'user', 'a'.repeat(400)), msg(2, 'assistant', 'resposta curta'), msg(3, 'user', 'segunda'), msg(4, 'assistant', 'ok')];
    const out = strategy.build({ system: 's', history, turn, capabilities: caps(150), preferences: [], summary: null });
    assert.equal(out[0]?.role, 'user');
  });

  it('a rodada em curso e o sistema sempre entram, mesmo estourando a janela', () => {
    const big: LlmMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'p'.repeat(5000) }] }];
    const out = strategy.build({ system: 's'.repeat(5000), history: [msg(1, 'user', 'antigo')], turn: big, capabilities: caps(100), preferences: [], summary: null });
    assert.deepEqual(out, big);
  });

  it('pares assistente(tool_calls)/ferramenta da rodada ficam juntos e na ordem', () => {
    const rodada: LlmMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [], toolCalls: [{ id: 'c1', name: 't', args: {} }] },
      { role: 'tool', toolCallId: 'c1', content: '<dados>x</dados>' },
    ];
    const out = strategy.build({ system: 's', history: [msg(1, 'user', 'h')], turn: rodada, capabilities: caps(200_000), preferences: [], summary: null });
    assert.deepEqual(out.slice(-3), rodada);
  });

  it('resultados de ferramentas de turnos antigos viram o resumo da consulta', () => {
    const answer = msg(2, 'assistant', 'Gastou R$ 1.284,60.', {
      parts: [
        { type: 'query', summary: { tool: 'query_transactions', label: 'lançamentos de set/2026 · Mercado', filters: {}, itemCount: 38, truncated: false } },
        { type: 'text', text: 'Gastou R$ 1.284,60.' },
      ],
    });
    const out = strategy.build({ system: 's', history: [msg(1, 'user', 'quanto?'), answer], turn, capabilities: caps(200_000), preferences: [], summary: null });
    assert.match(texts(out)[1] as string, /Gastou R\$ 1\.284,60\.\n\[consulta: lançamentos de set\/2026 · Mercado \(query_transactions\{\}\) — 38 itens; refaça a consulta para ver os valores\]/);
  });

  it('ignora mensagens em streaming, vazias ou so com aviso', () => {
    const history = [
      msg(1, 'user', 'oi'),
      msg(2, 'assistant', '', { parts: [{ type: 'notice', kind: 'offline', text: 'sem rede' }], status: 'error' }),
      msg(3, 'assistant', 'parcial', { status: 'streaming' }),
      msg(4, 'assistant', 'resposta'),
    ];
    assert.deepEqual(texts(strategy.build({ system: 's', history, turn, capabilities: caps(200_000), preferences: [], summary: null })), ['oi', 'resposta', 'pergunta atual']);
  });

  it('historico vazio devolve so a rodada', () => {
    assert.deepEqual(strategy.build({ system: 's', history: [], turn, capabilities: caps(1000), preferences: [], summary: null }), turn);
  });
});
