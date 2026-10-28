import { type ZodError } from 'zod';

/** Caminho do primeiro campo invalido (ex.: `choices.0.delta.content`); nunca inclui o valor recebido. */
export function describeChunkIssue(error: ZodError): string {
  const path = error.issues[0]?.path ?? [];
  return path.length === 0 ? 'raiz' : path.map(String).join('.');
}
