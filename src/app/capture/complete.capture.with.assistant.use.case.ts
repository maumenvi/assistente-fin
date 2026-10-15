import { type CaptureDraft } from '../../domain/capture/capture.draft.ts';
import { captureDraftSchema } from './capture.draft.schema.ts';
import { type CaptureAssistant, type CaptureAssistantInput } from './capture.assistant.port.ts';

/** Estado da IA no aparelho: ligada e com o consentimento do FR-039b. */
export interface AssistantPolicy {
  readonly enabled: boolean;
  readonly consented: boolean;
}

export interface CompletedCapture {
  readonly draft: CaptureDraft;
  /** A IA preencheu algum campo? (o pre-registro fica "a conferir"). */
  readonly usedAssistant: boolean;
}

const FIELDS = ['amountCents', 'date', 'description', 'accountHint', 'paymentMethod', 'installments'] as const;

function missingEssential(draft: CaptureDraft): boolean {
  return draft.amountCents === undefined || draft.paymentMethod === undefined || draft.accountHint === undefined;
}

/**
 * Completa uma captura com a IA opcional (spec 022, T127; Q3 = C):
 *
 * - so chama se a IA estiver ligada, com consentimento, e faltar valor, forma de pagamento ou
 *   conta/cartao no resultado local;
 * - a resposta passa pelo schema do `CaptureDraft` (resposta invalida = ignorada);
 * - o que o parser local achou com `confidence: 'high'` nunca e trocado; campo vazio e
 *   preenchido; qualquer contribuicao da IA deixa o rascunho "a conferir";
 * - erro, limite ou demora da IA -> fica o resultado local (FR-039b).
 */
export class CompleteCaptureWithAssistantUseCase {
  private readonly assistant: CaptureAssistant | null;

  public constructor(assistant: CaptureAssistant | null) {
    this.assistant = assistant;
  }

  public async execute(input: CaptureAssistantInput, policy: AssistantPolicy): Promise<CompletedCapture> {
    const local = input.draft;
    if (this.assistant === null || !policy.enabled || !policy.consented || !missingEssential(local)) {
      return { draft: local, usedAssistant: false };
    }
    let raw: unknown;
    try {
      raw = await this.assistant.complete(input);
    } catch {
      return { draft: local, usedAssistant: false };
    }
    const parsed = captureDraftSchema.safeParse({ ...(typeof raw === 'object' && raw !== null ? raw : {}), origin: local.origin, confidence: 'low' });
    if (!parsed.success || raw === null) return { draft: local, usedAssistant: false };

    const suggestion = parsed.data;
    const merged: Record<string, unknown> = { ...local };
    let used = false;
    for (const field of FIELDS) {
      const mine = local[field];
      const theirs = suggestion[field];
      if (theirs === undefined) continue;
      if (mine !== undefined && local.confidence === 'high') continue;
      if (mine === theirs) continue;
      merged[field] = theirs;
      used = true;
    }
    if (!used) return { draft: local, usedAssistant: false };
    return { draft: { ...(merged as unknown as CaptureDraft), confidence: 'low' }, usedAssistant: true };
  }
}
