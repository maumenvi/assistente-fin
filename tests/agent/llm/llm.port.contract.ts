import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentError } from '../../../src/domain/agent/errors/agent.error.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { type LlmPort } from '../../../src/app/agent/ports/llm/llm.port.ts';
import { type ReplayTurn } from '../../../src/libs/llm/replay/replay.turn.ts';

/** Segredo que NUNCA pode aparecer em eventos, erros ou mensagens. */
export const CONTRACT_SECRET = 'sk-contract-SECRET9999';

/** O adaptador sob teste, ja ligado a uma fonte que reproduz o `turn` pedido. */
export interface ContractHandle {
  readonly llm: LlmPort;
  close(): Promise<void>;
}

/** Cria o adaptador a partir da resposta que ele deve reproduzir. Sem retentativas, para ver o erro cru. */
export type ContractFactory = (turn: ReplayTurn) => Promise<ContractHandle>;

const REQUEST = { system: 'sys', messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'oi' }] }] };

async function collect(iterable: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const event of iterable) out.push(event);
  return out;
}

/** Garantias de ordem de contracts/llm.port.md, conferidas em toda saida bem-sucedida. */
function assertWellFormed(events: LlmEvent[]): void {
  assert.equal(events.filter((e) => e.type === 'finish').length, 1, 'finish exatamente uma vez');
  assert.equal(events.at(-1)?.type, 'finish', 'finish por ultimo');
  assert.ok(events.filter((e) => e.type === 'usage').length <= 1, 'usage no maximo uma vez');
  for (const event of events) {
    if (event.type === 'tool_call') assert.ok(event.id !== '' && event.name !== '', 'tool_call completo');
  }
}

function text(events: LlmEvent[]): string {
  return events.map((e) => (e.type === 'text_delta' ? e.text : '')).join('');
}

async function withLlm<T>(factory: ContractFactory, turn: ReplayTurn, body: (llm: LlmPort) => Promise<T>): Promise<T> {
  const handle = await factory(turn);
  try {
    return await body(handle.llm);
  } finally {
    await handle.close();
  }
}

/**
 * Suite de contrato do `LlmPort` (spec 031, contracts/llm.port.md): o MESMO conjunto de casos
 * roda contra cada adaptador. O `factory` recebe a resposta que o adaptador deve reproduzir.
 */
export function runLlmPortContract(label: string, factory: ContractFactory): void {
  describe(`contrato do LlmPort: ${label}`, () => {
    it('texto simples em varios pedacos', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'Ola, ' }, { type: 'text_delta', text: 'mundo' }, { type: 'finish', reason: 'stop' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.equal(text(events), 'Ola, mundo');
    });

    it('caracteres multibyte (acento, euro, emoji) chegam inteiros', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'ação € 😀 𝄞' }, { type: 'finish', reason: 'stop' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.equal(text(events), 'ação € 😀 𝄞');
    });

    it('uma ferramenta, com argumentos longos fragmentados', async () => {
      const args = { from: '2026-09-01', to: '2026-09-30', text: 'mercado '.repeat(20) };
      const turn: ReplayTurn = { events: [{ type: 'tool_call', id: 'c1', name: 'query_transactions', args }, { type: 'finish', reason: 'tool_calls' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.deepEqual(events[0], { type: 'tool_call', id: 'c1', name: 'query_transactions', args });
    });

    it('duas ferramentas paralelas, na ordem', async () => {
      const turn: ReplayTurn = {
        events: [
          { type: 'tool_call', id: 'a', name: 'get_account_balances', args: {} },
          { type: 'tool_call', id: 'b', name: 'get_spending_limits', args: { month: '2026-09' } },
          { type: 'finish', reason: 'tool_calls' },
        ],
      };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.deepEqual(events.filter((e) => e.type === 'tool_call').map((e) => (e as { id: string }).id), ['a', 'b']);
    });

    it('argumentos ilegiveis viram tool_call com argsError e args null', async () => {
      const turn: ReplayTurn = { events: [{ type: 'tool_call', id: 'c1', name: 'q', args: null, argsError: 'x' }, { type: 'finish', reason: 'tool_calls' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      const call = events[0] as { args: unknown; argsError?: string };
      assert.equal(call.args, null);
      assert.equal(typeof call.argsError, 'string');
    });

    it('uso presente (com cache e custo)', async () => {
      const turn: ReplayTurn = {
        events: [{ type: 'text_delta', text: 'x' }, { type: 'usage', inputTokens: 10, outputTokens: 5, cachedTokens: 3, costMicroUsd: 4200 }, { type: 'finish', reason: 'stop' }],
      };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.deepEqual(events.find((e) => e.type === 'usage'), { type: 'usage', inputTokens: 10, outputTokens: 5, cachedTokens: 3, costMicroUsd: 4200 });
    });

    it('uso ausente (modelo local) e valido', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'x' }, { type: 'finish', reason: 'stop' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.equal(events.some((e) => e.type === 'usage'), false);
    });

    it('fim por limite de tamanho', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'corta' }, { type: 'finish', reason: 'length' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assertWellFormed(events);
      assert.deepEqual(events.at(-1), { type: 'finish', reason: 'length' });
    });

    for (const [code, retriable] of [['LLM_AUTH', false], ['LLM_QUOTA', false], ['LLM_MODEL_NOT_FOUND', false], ['LLM_RATE_LIMITED', true], ['LLM_UNAVAILABLE', true]] as const) {
      it(`erro ${code} antes de qualquer conteudo`, async () => {
        const turn: ReplayTurn = { events: [], error: { code, message: `falha com a chave ${CONTRACT_SECRET}` } };
        await withLlm(factory, turn, async (llm) => {
          await assert.rejects(collect(llm.stream(REQUEST)), (error: unknown) => {
            const e = error as AgentError & { emittedContent?: boolean };
            assert.equal(e.code, code);
            assert.equal(e.retriable, retriable);
            assert.equal(e.emittedContent, false);
            assert.equal(String(e.message).includes('SECRET9999'), false, 'a chave nao pode vazar na mensagem');
            return true;
          });
        });
      });
    }

    it('erro no meio do stream: o texto ja entregue fica, o erro marca emittedContent', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'parcial' }], error: { code: 'LLM_UNAVAILABLE', message: 'caiu' } };
      await withLlm(factory, turn, async (llm) => {
        const seen: LlmEvent[] = [];
        await assert.rejects(
          (async () => {
            for await (const e of llm.stream(REQUEST)) seen.push(e);
          })(),
          (error: unknown) => (error as { emittedContent?: boolean }).emittedContent === true,
        );
        assert.equal(text(seen), 'parcial');
      });
    });

    it('cancelar no meio encerra com RunCancelledError', async () => {
      const turn: ReplayTurn = {
        events: [{ type: 'text_delta', text: 'um' }, { type: 'text_delta', text: 'dois' }, { type: 'text_delta', text: 'tres' }, { type: 'finish', reason: 'stop' }],
        delayMs: 40,
      };
      await withLlm(factory, turn, async (llm) => {
        const controller = new AbortController();
        const seen: LlmEvent[] = [];
        await assert.rejects(
          (async () => {
            for await (const e of llm.stream(REQUEST, controller.signal)) {
              seen.push(e);
              controller.abort();
            }
          })(),
          RunCancelledError,
        );
        assert.ok(seen.length >= 1 && seen.length < 4, 'parou antes do fim');
      });
    });

    it('a chave de API nao aparece em nenhum evento', async () => {
      const turn: ReplayTurn = { events: [{ type: 'text_delta', text: 'ok' }, { type: 'finish', reason: 'stop' }] };
      const events = await withLlm(factory, turn, (llm) => collect(llm.stream(REQUEST)));
      assert.equal(JSON.stringify(events).includes('SECRET9999'), false);
    });
  });
}
