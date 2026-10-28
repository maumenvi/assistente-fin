import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentStorePort } from '../../../src/app/agent/ports/store/agent.store.port.ts';
import { runAttachmentStoreContract } from '../attachment/attachment.store.contract.ts';
import { at, makeConversation, makeNewMessage, makeRun, makeStep } from './support/agent.fixtures.ts';

/** Armazenamento sob teste, com um jeito de criar usuarios (necessario onde ha chave estrangeira). */
export interface StoreHandle {
  readonly store: AgentStorePort;
  ensureUser(userId: string): Promise<void>;
  close(): Promise<void>;
}

/** Cria um armazenamento LIMPO a cada chamada. */
export type StoreFactory = () => Promise<StoreHandle>;

/**
 * Suite de contrato do `AgentStorePort` (spec 031, contracts/agent.store.port.md): as mesmas
 * garantias para `fake`, `sqlite` e `prisma` - isolamento por usuario, `seq` sem lacunas,
 * `appendMany` idempotente, cascata, paginacao estavel e `markStaleInterrupted`.
 */
export function runAgentStoreContract(label: string, factory: StoreFactory): void {
  runAttachmentStoreContract(label, factory);
  async function withStore(body: (store: AgentStorePort, h: StoreHandle) => Promise<void>): Promise<void> {
    const handle = await factory();
    try {
      await handle.ensureUser('u1');
      await handle.ensureUser('u2');
      await body(handle.store, handle);
    } finally {
      await handle.close();
    }
  }

  describe(`contrato do AgentStorePort: ${label}`, () => {
    describe('conversas', () => {
      it('cria e le; outro usuario nao enxerga', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          assert.deepEqual(await s.conversations.get('u1', 'c1'), makeConversation('c1', 'u1'));
          assert.equal(await s.conversations.get('u2', 'c1'), null);
          assert.equal(await s.conversations.get('u1', 'nao-existe'), null);
        }));

      it('lista da mais recente para a mais antiga, com cursor estavel', () =>
        withStore(async (s) => {
          for (const [id, minute] of [['c1', 1], ['c2', 2], ['c3', 3], ['c4', 4]] as const) {
            await s.conversations.create(makeConversation(id, 'u1', { lastMessageAt: at(minute) }));
          }
          await s.conversations.create(makeConversation('x', 'u2', { lastMessageAt: at(9) }));
          const first = await s.conversations.list('u1', { limit: 2 });
          assert.deepEqual(first.map((c) => c.id), ['c4', 'c3']);
          const next = await s.conversations.list('u1', { limit: 2, before: first[1]?.lastMessageAt as string });
          assert.deepEqual(next.map((c) => c.id), ['c2', 'c1']);
          assert.deepEqual(await s.conversations.list('u2', { limit: 10 }).then((r) => r.map((c) => c.id)), ['x']);
        }));

      it('touch reordena a lista', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1', { lastMessageAt: at(1) }));
          await s.conversations.create(makeConversation('c2', 'u1', { lastMessageAt: at(2) }));
          await s.conversations.touch('u1', 'c1', at(5));
          assert.deepEqual((await s.conversations.list('u1', { limit: 10 })).map((c) => c.id), ['c1', 'c2']);
          await s.conversations.touch('u2', 'c2', at(9));
          assert.equal((await s.conversations.get('u1', 'c2'))?.lastMessageAt, at(2));
        }));

      it('excluir remove em cascata mensagens, execucoes e passos; so o dono exclui', async () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.messages.append(makeNewMessage('m1', 'c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          await s.steps.appendMany('u1', [makeStep('r1', 1)]);
          await s.conversations.delete('u2', 'c1');
          assert.notEqual(await s.conversations.get('u1', 'c1'), null);
          await s.conversations.delete('u1', 'c1');
          assert.equal(await s.conversations.get('u1', 'c1'), null);
          assert.deepEqual(await s.messages.list('u1', 'c1', { limit: 10 }), []);
          assert.equal(await s.runs.get('u1', 'r1'), null);
          assert.deepEqual(await s.steps.list('u1', 'r1'), []);
        }));

      it('apagar tudo remove so as conversas do usuario', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.conversations.create(makeConversation('c2', 'u1'));
          await s.conversations.create(makeConversation('c3', 'u2'));
          await s.conversations.deleteAll('u1');
          assert.deepEqual(await s.conversations.list('u1', { limit: 10 }), []);
          assert.equal((await s.conversations.list('u2', { limit: 10 })).length, 1);
        }));
    });

    describe('mensagens', () => {
      it('seq cresce sem lacunas e e independente por conversa', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.conversations.create(makeConversation('c2', 'u1'));
          const seqs = [
            (await s.messages.append(makeNewMessage('m1', 'c1', 'u1'))).seq,
            (await s.messages.append(makeNewMessage('m2', 'c1', 'u1', { role: 'assistant', status: 'streaming', parts: [] }))).seq,
            (await s.messages.append(makeNewMessage('m3', 'c2', 'u1'))).seq,
            (await s.messages.append(makeNewMessage('m4', 'c1', 'u1'))).seq,
          ];
          assert.deepEqual(seqs, [1, 2, 1, 3]);
        }));

      it('recusa mensagem em conversa inexistente ou de outro usuario', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await assert.rejects(s.messages.append(makeNewMessage('m1', 'nao-existe', 'u1')));
          await assert.rejects(s.messages.append(makeNewMessage('m2', 'c1', 'u2')));
        }));

      it('update aplica o patch; usuario errado nao altera', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.messages.append(makeNewMessage('m1', 'c1', 'u1', { role: 'assistant', status: 'streaming', parts: [] }));
          await s.messages.update('u2', 'm1', { status: 'error' });
          assert.equal((await s.messages.list('u1', 'c1', { limit: 5 }))[0]?.status, 'streaming');
          await s.messages.update('u1', 'm1', {
            parts: [{ type: 'text', text: 'pronto' }, { type: 'query', summary: { tool: 't', label: 'l', filters: { mes: '2026-09' }, itemCount: 3, truncated: false } }],
            status: 'complete', runId: 'r1', errorCode: null,
          });
          const [m] = await s.messages.list('u1', 'c1', { limit: 5 });
          assert.equal(m?.status, 'complete');
          assert.equal(m?.runId, 'r1');
          assert.equal(m?.parts.length, 2);
          assert.equal(m?.parts[1]?.type, 'query');
        }));

      it('lista em ordem cronologica, paginando para tras por seq', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          for (let i = 1; i <= 5; i += 1) await s.messages.append(makeNewMessage(`m${i}`, 'c1', 'u1'));
          const last2 = await s.messages.list('u1', 'c1', { limit: 2 });
          assert.deepEqual(last2.map((m) => m.seq), [4, 5]);
          const previous = await s.messages.list('u1', 'c1', { limit: 2, beforeSeq: 4 });
          assert.deepEqual(previous.map((m) => m.seq), [2, 3]);
          assert.deepEqual(await s.messages.list('u2', 'c1', { limit: 10 }), []);
        }));
    });

    describe('execucoes', () => {
      it('cria, le e isola por usuario', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          assert.deepEqual(await s.runs.get('u1', 'r1'), makeRun('r1', 'c1', 'u1'));
          assert.equal(await s.runs.get('u2', 'r1'), null);
        }));

      it('checkpoint atualiza cursor, estado, consumo, modelo e batimento', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          const consumed = { steps: 2, ms: 900, inputTokens: 50, outputTokens: 10, cachedTokens: 5, costMicroUsd: 1200 };
          await s.runs.saveCheckpoint('u1', 'r1', {
            currentNode: 'tools', intent: 'query', consumed, profileIds: { main: 'p-main', fast: 'p-fast', fallbackUsed: true },
            model: 'google/gemini-flash', state: { cursor: 'tools', ledger: [{ id: 'f1' }] }, heartbeatAt: at(7),
          });
          const run = await s.runs.get('u1', 'r1');
          assert.equal(run?.currentNode, 'tools');
          assert.equal(run?.intent, 'query');
          assert.deepEqual(run?.consumed, consumed);
          assert.equal(run?.profileIds.fallbackUsed, true);
          assert.equal(run?.model, 'google/gemini-flash');
          assert.deepEqual(run?.state, { cursor: 'tools', ledger: [{ id: 'f1' }] });
          assert.equal(run?.heartbeatAt, at(7));
          assert.equal(run?.status, 'running');
        }));

      it('finish fecha a execucao', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          const consumed = { steps: 5, ms: 2100, inputTokens: 1000, outputTokens: 240, cachedTokens: 0, costMicroUsd: null };
          await s.runs.finish('u1', 'r1', { status: 'done', endedAt: at(9), errorCode: null, consumed, state: { fim: true } });
          const run = await s.runs.get('u1', 'r1');
          assert.equal(run?.status, 'done');
          assert.equal(run?.endedAt, at(9));
          assert.equal(run?.currentNode, null);
          assert.equal(run?.consumed.costMicroUsd, null);
          await s.runs.finish('u2', 'r1', { status: 'failed', endedAt: at(10), errorCode: 'X', consumed, state: null });
          assert.equal((await s.runs.get('u1', 'r1'))?.status, 'done');
        }));

      it('lista com filtros de status e modelo, cursor e a pergunta da execucao', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.messages.append(makeNewMessage('r1-u', 'c1', 'u1', { parts: [{ type: 'text', text: 'Quanto gastei?\nem setembro' }] }));
          await s.runs.create(makeRun('r1', 'c1', 'u1', { startedAt: at(1), status: 'done', model: 'a/x' }));
          await s.runs.create(makeRun('r2', 'c1', 'u1', { startedAt: at(2), status: 'failed', model: 'b/y' }));
          await s.runs.create(makeRun('r3', 'c1', 'u1', { startedAt: at(3), status: 'done', model: 'b/y' }));
          await s.runs.create(makeRun('zz', 'c1', 'u1', { startedAt: at(0), status: 'running' }));
          await s.conversations.create(makeConversation('cu2', 'u2'));
          await s.runs.create(makeRun('rx', 'cu2', 'u2', { startedAt: at(4), status: 'done', model: 'b/y' }));
          const all = await s.runs.list('u1', { limit: 10 });
          assert.deepEqual(all.map((r) => r.id), ['r3', 'r2', 'r1', 'zz']);
          assert.deepEqual((await s.runs.list('u1', { limit: 10, status: 'done' })).map((r) => r.id), ['r3', 'r1']);
          assert.deepEqual((await s.runs.list('u1', { limit: 10, model: 'b/y' })).map((r) => r.id), ['r3', 'r2']);
          assert.deepEqual((await s.runs.list('u1', { limit: 1, before: at(3) })).map((r) => r.id), ['r2']);
          assert.equal(all.find((r) => r.id === 'r1')?.question, 'Quanto gastei?');
          assert.deepEqual((await s.runs.list('u2', { limit: 10 })).map((r) => r.id), ['rx']);
        }));

      it('markStaleInterrupted so toca running com batimento antigo, do usuario', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.conversations.create(makeConversation('c2', 'u2'));
          await s.runs.create(makeRun('old', 'c1', 'u1', { heartbeatAt: at(1) }));
          await s.runs.create(makeRun('new', 'c1', 'u1', { heartbeatAt: at(30) }));
          await s.runs.create(makeRun('done', 'c1', 'u1', { heartbeatAt: at(1), status: 'done', endedAt: at(2) }));
          await s.runs.create(makeRun('other', 'c2', 'u2', { heartbeatAt: at(1) }));
          const touched = await s.runs.markStaleInterrupted('u1', at(10));
          assert.deepEqual(touched.map((r) => r.id), ['old']);
          assert.equal((await s.runs.get('u1', 'old'))?.status, 'interrupted');
          assert.equal((await s.runs.get('u1', 'new'))?.status, 'running');
          assert.equal((await s.runs.get('u1', 'done'))?.status, 'done');
          assert.equal((await s.runs.get('u2', 'other'))?.status, 'running');
          assert.deepEqual(await s.runs.markStaleInterrupted('u1', at(10)), []);
        }));

      it('apagar tudo remove execucoes e passos so do usuario', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.conversations.create(makeConversation('c2', 'u2'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          await s.runs.create(makeRun('r2', 'c2', 'u2'));
          await s.steps.appendMany('u1', [makeStep('r1', 1)]);
          await s.steps.appendMany('u2', [makeStep('r2', 1)]);
          await s.runs.deleteAll('u1');
          assert.equal(await s.runs.get('u1', 'r1'), null);
          assert.deepEqual(await s.steps.list('u1', 'r1'), []);
          assert.notEqual(await s.runs.get('u2', 'r2'), null);
          assert.equal((await s.steps.list('u2', 'r2')).length, 1);
        }));
    });

    describe('passos', () => {
      it('grava em lote e lista em ordem de seq', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          await s.steps.appendMany('u1', [makeStep('r1', 3), makeStep('r1', 1), makeStep('r1', 2)]);
          const steps = await s.steps.list('u1', 'r1');
          assert.deepEqual(steps.map((x) => x.seq), [1, 2, 3]);
          assert.deepEqual(steps[0], makeStep('r1', 1));
        }));

      it('e idempotente por (runId, seq): repetir nao duplica e o ultimo vence', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          await s.steps.appendMany('u1', [makeStep('r1', 1), makeStep('r1', 2)]);
          await s.steps.appendMany('u1', [makeStep('r1', 2, { durationMs: 999 }), makeStep('r1', 3)]);
          const steps = await s.steps.list('u1', 'r1');
          assert.deepEqual(steps.map((x) => x.seq), [1, 2, 3]);
          assert.equal(steps[1]?.durationMs, 999);
        }));

      it('passo de execucao de outro usuario e ignorado; leitura de outro usuario e vazia', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          await s.steps.appendMany('u2', [makeStep('r1', 1)]);
          assert.deepEqual(await s.steps.list('u1', 'r1'), []);
          await s.steps.appendMany('u1', [makeStep('r1', 1)]);
          assert.deepEqual(await s.steps.list('u2', 'r1'), []);
        }));

      it('guarda JSON estruturado intacto (chamadas, pedido, resposta, erro)', () =>
        withStore(async (s) => {
          await s.conversations.create(makeConversation('c1', 'u1'));
          await s.runs.create(makeRun('r1', 'c1', 'u1'));
          const step = makeStep('r1', 1, { status: 'error', error: { code: 'LLM_UNAVAILABLE', message: 'caiu' }, truncated: true, costMicroUsd: null, inputTokens: null });
          await s.steps.appendMany('u1', [step]);
          assert.deepEqual((await s.steps.list('u1', 'r1'))[0], step);
        }));
    });

    it('o que o chamador altera depois de ler nao afeta o armazenado', () =>
      withStore(async (s) => {
        await s.conversations.create(makeConversation('c1', 'u1'));
        const read = await s.conversations.get('u1', 'c1');
        (read as { title: string }).title = 'ALTERADO';
        assert.equal((await s.conversations.get('u1', 'c1'))?.title, 'Conversa c1');
      }));
  });
}
