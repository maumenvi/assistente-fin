import { type TouchedRecord } from '../../../../domain/plan/touched.record.ts';

/** Referencia a um registro que uma operacao le, altera ou cria (alimenta `touched` e a revalidacao). */
export interface WatchRef {
  readonly entity: TouchedRecord['entity'];
  readonly id: string;
}

/** Chave estavel de uma referencia (mapas e conjuntos). */
export function refKey(ref: WatchRef): string {
  return `${ref.entity}:${ref.id}`;
}
