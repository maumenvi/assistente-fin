import { StaleDataError } from '../../app/shared/stale.data.error.ts';

/** Ultimo carimbo emitido (ms). Compartilhado - so precisa ser estritamente crescente. */
let lastMs = 0;

/**
 * Timestamp estritamente crescente para os adaptadores `fake` e `sqlite` carimbarem `updatedAt`
 * (spec 002, RF-31). `new Date()` sozinho colide no mesmo milissegundo, o que faria a
 * deteccao de escrita concorrente falhar silenciosamente nos testes.
 */
export function monotonicNow(): Date {
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs);
}

/** Entidade versionada - todas as 7 entidades da 001 expoem isto (tarefa 0.4). */
export interface Versioned<T> {
  readonly updatedAt: Date | null;
  withUpdatedAt(updatedAt: Date | null): T;
}

/**
 * Trava otimista dos adaptadores `fake` e `sqlite` (spec 002, RF-31; spec 022).
 *
 * - `incoming.updatedAt === null`: gravacao incondicional (criacao / import de backup).
 * - senao: o registro guardado precisa ter exatamente aquele `updatedAt` (mesma versao lida)
 *   - se sumiu ou mudou, lanca `StaleDataError` e nada e gravado.
 *
 * Devolve a entidade (re)carimbada com um `updatedAt` novo, para o repositorio guardar.
 */
export function optimisticStamp<T extends Versioned<T>>(
  stored: T | undefined,
  incoming: T,
  entityLabel: string,
): T {
  if (incoming.updatedAt !== null) {
    if (!stored || stored.updatedAt?.getTime() !== incoming.updatedAt.getTime()) {
      throw new StaleDataError(entityLabel);
    }
  }
  return incoming.withUpdatedAt(monotonicNow());
}
