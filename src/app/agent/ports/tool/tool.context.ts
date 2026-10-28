import { type Fact } from '../../../../domain/agent/fact.ts';
import { type FileGate } from './file.gate.ts';
import { type ToolLimits } from './tool.limits.ts';

/**
 * Contexto de uma chamada de ferramenta. `userId` vem da SESSAO, nunca do modelo nem do schema da
 * ferramenta - e o que garante o isolamento entre usuarios.
 */
export interface ToolContext {
  readonly userId: string;
  readonly now: Date;
  readonly locale: 'pt-BR';
  readonly limits: ToolLimits;
  /** De onde veio o pedido (spec 032): as ferramentas de memoria guardam a origem da preferencia. */
  readonly source?: { readonly conversationId: string; readonly messageId: string };
  /** Porta das ferramentas de arquivo para a pessoa (spec 040); so existe no desktop. */
  readonly files?: FileGate;
  /** Algum modelo desta execucao e de nuvem: preferencias privadas nao podem aparecer no resultado (spec 032). */
  readonly cloud?: boolean;
  /** A rodada em curso (spec 033): `propose_changes` precisa dela para ligar o plano ao pedido. */
  readonly turn?: {
    readonly runId: string;
    readonly assistantMessageId: string;
    /** Pedido do usuario nesta rodada (base da verificacao de divergencia). */
    readonly userText: string;
    /** Valores (centavos) que consultas desta rodada ja trouxeram. */
    readonly knownMoneyCents: readonly number[];
    /** Fatos ja coletados nesta execucao (para referencias `{ fact }` em `calculate`). */
    readonly ledger?: readonly Fact[];
  };
}
