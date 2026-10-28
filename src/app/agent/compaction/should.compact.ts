import { compactionThreshold } from './compaction.threshold.ts';

/** O que decide se e hora de compactar. */
export interface ShouldCompactInput {
  /** Tokens fixos do prompt: sistema, preferencias e o resumo corrente. */
  readonly fixedTokens: number;
  /** Tokens das mensagens ainda nao cobertas pelo resumo. */
  readonly messageTokens: number;
  readonly contextWindow: number;
}

/** E hora de compactar? (spec 032, FR-019): o contexto que seria montado atingiu o limiar da janela. */
export function shouldCompact(input: ShouldCompactInput): boolean {
  return input.fixedTokens + input.messageTokens >= input.contextWindow * compactionThreshold(input.contextWindow);
}
