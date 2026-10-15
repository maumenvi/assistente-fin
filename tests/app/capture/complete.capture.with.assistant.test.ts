import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompleteCaptureWithAssistantUseCase } from '../../../src/app/capture/complete.capture.with.assistant.use.case.ts';
import { type CaptureAssistant } from '../../../src/app/capture/capture.assistant.port.ts';
import { type CaptureDraft } from '../../../src/domain/capture/capture.draft.ts';

/** IA opcional (spec 022, T124; FR-039..FR-039b): so quando precisa, sem estragar o que o local achou. */
class StubAssistant implements CaptureAssistant {
  public calls = 0;
  private readonly answer: () => Promise<unknown>;
  public constructor(answer: () => Promise<unknown>) {
    this.answer = answer;
  }
  public complete(): Promise<unknown> {
    this.calls += 1;
    return this.answer();
  }
}

const ON = { enabled: true, consented: true };
const partial: CaptureDraft = { origin: 'receipt', amountCents: 4590, date: '2026-09-25', confidence: 'high' };
const input = (draft: CaptureDraft) => ({ draft, accountNames: ['Itau', 'Iti'], text: 'texto' });

test('desligada, sem consentimento ou sem campo essencial vazio: nao chama', async () => {
  const ai = new StubAssistant(async () => ({ paymentMethod: 'pix' }));
  const use = new CompleteCaptureWithAssistantUseCase(ai);
  await use.execute(input(partial), { enabled: false, consented: true });
  await use.execute(input(partial), { enabled: true, consented: false });
  await use.execute(input({ ...partial, paymentMethod: 'pix', accountHint: 'itau' }), ON);
  assert.equal(ai.calls, 0);
  assert.deepEqual(await new CompleteCaptureWithAssistantUseCase(null).execute(input(partial), ON), { draft: partial, usedAssistant: false });
});

test('preenche o que faltou e nunca troca campo high do local; resultado fica a conferir', async () => {
  const ai = new StubAssistant(async () => ({ amountCents: 9999, paymentMethod: 'credit-card', accountHint: 'Iti', description: 'Padaria' }));
  const result = await new CompleteCaptureWithAssistantUseCase(ai).execute(input(partial), ON);
  assert.equal(ai.calls, 1);
  assert.deepEqual(result, {
    usedAssistant: true,
    draft: { origin: 'receipt', amountCents: 4590, date: '2026-09-25', paymentMethod: 'credit-card', accountHint: 'Iti', description: 'Padaria', confidence: 'low' },
  });
});

test('local com confianca baixa aceita correcao da IA', async () => {
  const low: CaptureDraft = { origin: 'receipt', amountCents: 100, confidence: 'low' };
  const ai = new StubAssistant(async () => ({ amountCents: 1000 }));
  const result = await new CompleteCaptureWithAssistantUseCase(ai).execute(input(low), ON);
  assert.equal(result.draft.amountCents, 1000);
});

test('resposta invalida (zod), erro ou limite: fica o local', async () => {
  for (const answer of [async () => ({ amountCents: -5 }), async () => 'texto solto', async () => null, async () => Promise.reject(new Error('429'))]) {
    const result = await new CompleteCaptureWithAssistantUseCase(new StubAssistant(answer)).execute(input(partial), ON);
    assert.deepEqual(result, { draft: partial, usedAssistant: false });
  }
});
