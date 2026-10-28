import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';

/**
 * Rascunho da configuracao simples (spec 035, data-model.md 4): so existe em memoria durante o teste.
 * `apiKey` omitida = usar a chave ja guardada; `custom` = servidor proprio (so pelo Avancado).
 */
export interface SetupDraft {
  readonly provider: ProviderId | 'custom';
  readonly apiKey?: string | undefined;
  readonly model?: string | undefined;
  readonly baseUrl?: string | undefined;
}
