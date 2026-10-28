import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendBlockReason } from '../../../src/app/agent/view/can.send.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { formatChatText } from '../../../src/app/agent/view/format.chat.text.ts';
import { reduceChatAction } from '../../../src/app/agent/view/reduce.chat.action.ts';

describe('formatChatText', () => {
  it('paragrafos, itens e negrito; texto nunca vira HTML', () => {
    const blocks = formatChatText('Você gastou **R$ 10,00**.\nContinua aqui.\n\n- primeiro\n* segundo **forte**\n\n<b>x</b>');
    assert.deepEqual(blocks.map((b) => b.kind), ['paragraph', 'item', 'item', 'paragraph']);
    const runsOf = (i: number) => { const b = blocks[i]; return b !== undefined && b.kind !== 'table' && b.kind !== 'code' ? b.runs : []; };
    assert.deepEqual(runsOf(0), [{ text: 'Você gastou ', bold: false }, { text: 'R$ 10,00', bold: true }, { text: '. Continua aqui.', bold: false }]);
    assert.equal(runsOf(2)[1]?.bold, true);
    assert.equal(runsOf(3)[0]?.text, '<b>x</b>');
  });

  it('marca sem par fica como texto e texto vazio nao gera blocos', () => {
    assert.deepEqual(formatChatText('texto **aberto sem fechar'), [{ kind: 'paragraph', runs: [{ text: 'texto **aberto sem fechar', bold: false }] }]);
    assert.deepEqual(formatChatText('  \n \n'), []);
  });
});

describe('sendBlockReason', () => {
  it('vazio, longo, ocupado e sem rede bloqueiam; o resto envia', () => {
    const ok = { text: 'oi', busy: false, online: true };
    assert.equal(sendBlockReason(ok), null);
    assert.equal(sendBlockReason({ ...ok, text: '   ' }), 'empty');
    assert.equal(sendBlockReason({ ...ok, text: 'a'.repeat(4001) }), 'too_long');
    assert.equal(sendBlockReason({ ...ok, text: 'a'.repeat(4000) }), null);
    assert.equal(sendBlockReason({ ...ok, busy: true }), 'busy');
    assert.equal(sendBlockReason({ ...ok, online: false }), 'offline');
  });
});

describe('reduceChatAction', () => {
  it('envio que falhou tira a pergunta e mostra a faixa certa; reset limpa', () => {
    let state = reduceChatAction(emptyChatState(), { kind: 'user_sent', id: 'tmp', text: 'oi' });
    assert.equal(state.messages.length, 1);
    state = reduceChatAction(state, { kind: 'send_failed', id: 'tmp', code: 'NO_MODEL_CONFIGURED' });
    assert.equal(state.messages.length, 0);
    assert.equal(state.banner?.kind, 'no_model');
    state = reduceChatAction(state, { kind: 'banner_dismissed' });
    assert.equal(state.banner, null);
    assert.deepEqual(reduceChatAction(state, { kind: 'reset' }), emptyChatState());
    // erro sem faixa propria (ex.: somente local, execucao ja ativa) nunca falha em silencio
    const local = reduceChatAction(reduceChatAction(emptyChatState(), { kind: 'user_sent', id: 'a', text: 'oi' }), { kind: 'send_failed', id: 'a', code: 'LOCAL_ONLY_VIOLATION' });
    assert.equal(local.banner?.kind, 'local_only');
    const generic = reduceChatAction(reduceChatAction(emptyChatState(), { kind: 'user_sent', id: 'a', text: 'oi' }), { kind: 'send_failed', id: 'a', code: 'RUN_ALREADY_ACTIVE' });
    assert.equal(generic.banner?.kind, 'send_error');
    assert.match(generic.banner?.text ?? '', /em andamento/);
  });
});

describe('anexos na caixa de mensagem (spec 036)', () => {
  it('Enviar fica bloqueado enquanto um anexo ainda esta sendo lido (FR-007)', async () => {
    const { sendBlockReason } = await import('../../../src/app/agent/view/can.send.message.ts');
    assert.equal(sendBlockReason({ text: 'oi', busy: false, online: true, readingAttachment: true }), 'attachment_reading');
    assert.equal(sendBlockReason({ text: 'oi', busy: false, online: true }), null);
    assert.equal(sendBlockReason({ text: '', busy: false, online: true, readingAttachment: true }), 'empty');
  });

  it('a pergunta enviada ja aparece com os anexos', async () => {
    const { addUserMessage } = await import('../../../src/app/agent/view/add.user.message.ts');
    const { emptyChatState } = await import('../../../src/app/agent/view/empty.chat.state.ts');
    const state = addUserMessage(emptyChatState(), { id: 'l1', text: 'oi', attachments: [{ type: 'attachment', attachmentId: 'd1', name: 'extrato.csv', kind: 'csv', sizeBytes: 10, available: true }] });
    assert.deepEqual(state.messages[0]?.parts.map((p) => p.type), ['text', 'attachment']);
  });
});
