import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { type ContextBuildInput } from './context.build.input.ts';
import { type ContextStrategy } from './context.strategy.ts';
import { SafeTruncationStrategy } from './safe.truncation.strategy.ts';

/** Parte da janela que o prompt pode ocupar com a compactacao ligada (ela age antes, aos 70%/50%). */
const COMPACTING_WINDOW_FRACTION = 0.85;

/**
 * Contexto com compactacao (spec 032, FR-013..FR-020, contracts/compaction.md): o resumo corrente
 * (ja renderizado em `system`) substitui as mensagens que ele cobre (`seq <= coveredToSeq`); o resto
 * segue literal. Se ainda exceder a janela, ou se nao ha resumo (nunca compactou, ou a geracao
 * falhou), o descarte seguro cuida do que sobra. O historico salvo nao e tocado.
 */
export class CompactingContextStrategy implements ContextStrategy {
  private readonly fallback = new SafeTruncationStrategy(COMPACTING_WINDOW_FRACTION);

  public build(input: ContextBuildInput): readonly LlmMessage[] {
    const covered = input.summary?.coveredToSeq ?? 0;
    const history = covered === 0 ? input.history : input.history.filter((m) => m.seq > covered);
    return this.fallback.build({ ...input, history });
  }
}
