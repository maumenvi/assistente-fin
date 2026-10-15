import { type z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type AgentEntity } from '../format/agent.entity.ts';
import { type AgentOp } from '../format/agent.op.ts';
import { type AgentOpKind } from '../format/agent.op.kind.ts';
import { type JournalImage } from '../journal.image.ts';
import { type AgentUseCases } from './agent.use.cases.ts';

/** Valor mostrado ao usuario ("atual -> novo"): numeros em centavos, textos e datas `YYYY-MM-DD`. */
export type DisplayValue = string | number | boolean | null;

/** O que o plano sabe de uma entidade existente, sem escrever nada (spec 029, R3). */
export interface Inspection {
  readonly exists: boolean;
  /** `updatedAt` ISO da entidade: base do aviso de desatualizado. */
  readonly version: string | null;
  /** Rotulo curto para a tela (descricao, origem, observacoes). */
  readonly label: string | null;
  /** Valores atuais, com os mesmos nomes de `op.data`, para comparar e mostrar. */
  readonly display: Readonly<Record<string, DisplayValue>>;
  /** Por que o app recusa mexer neste item (fora da v1), ou `null`. */
  readonly refusal: string | null;
  /** Quantos registros a operacao toca (1, ou o tamanho do grupo parcelado). */
  readonly affected: number;
}

export const NOT_FOUND_INSPECTION: Inspection = { exists: false, version: null, label: null, display: {}, refusal: null, affected: 0 };

/** Contexto de execucao de uma operacao: tudo ligado a UMA transacao do banco e ao id derivado do item. */
export interface HandlerContext {
  readonly userId: string;
  readonly batchId: string;
  readonly database: Database;
  readonly useCases: AgentUseCases;
  readonly now: Date;
}

export interface HandlerResult {
  /** Id da entidade afetada (do grupo parcelado: o da parcela de referencia). */
  readonly entityId: string;
  readonly before: JournalImage | null;
  readonly after: JournalImage | null;
}

/**
 * Trata uma combinacao (entidade, operacao) do bloco (spec 029, R3): valida os campos, inspeciona
 * o estado atual para o plano e executa pelo caso de uso existente, devolvendo as imagens do diario.
 */
export interface OperationHandler {
  readonly entity: AgentEntity;
  readonly kind: AgentOpKind;
  /** Esquema (estrito) de `op.data`; `null` quando a operacao nao tem dados. */
  readonly dataSchema: z.ZodType | null;
  /** Campos de `data` que, ao mudar um valor existente, tornam o `update` destrutivo. */
  readonly destructiveFields: readonly string[];
  inspect(op: AgentOp, database: Database, userId: string, now: Date): Promise<Inspection>;
  execute(op: AgentOp, context: HandlerContext): Promise<HandlerResult>;
}
