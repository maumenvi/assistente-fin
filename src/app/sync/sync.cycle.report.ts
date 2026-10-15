/** Resultado de um ciclo de sincronizacao (spec 022, T118). */
export interface SyncCycleReport {
  /** Operacoes confirmadas pelo hub (aplicadas ou ja existentes). */
  readonly pushed: number;
  /** Operacoes que viraram conflito a resolver. */
  readonly conflicts: number;
  /** Operacoes recusadas pelo hub (ex.: referencia inexistente) - ficam como pendencia com o motivo. */
  readonly rejected: readonly { readonly entity: string; readonly entityId: string; readonly message: string }[];
  /** Alteracoes do hub aplicadas no celular. */
  readonly pulled: number;
}
