import { type MessagePart } from '../../../../domain/agent/message.part.ts';

/** Parte "preferencias aplicadas" da resposta (spec 032, US1 cenario 1); vazia quando nenhuma entrou. */
export function appliedParts(ids: readonly string[]): MessagePart[] {
  return ids.length === 0 ? [] : [{ type: 'preferences_applied', ids: [...ids] }];
}
