import { z } from 'zod';

/** Maximo de eventos por lote enviado pelo celular (contrato `POST /sync/v1/logs`). */
export const MAX_LOGS_PER_REQUEST = 200;

/**
 * Um evento como o celular o envia. `source` e `deviceId` nao fazem parte: o hub os define
 * (`mobile` e o aparelho autenticado) - o celular nao escolhe quem e (spec 017, RF-22).
 */
const incomingLogEventSchema = z.object({
  id: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  operation: z.string().min(1).max(200),
  userId: z.string().max(100).nullable(),
  correlationId: z.string().min(1).max(100),
  durationMs: z.number().nonnegative(),
  outcome: z.enum(['success', 'error']),
  subjectIds: z.record(z.string(), z.string()),
  error: z.object({ name: z.string(), message: z.string(), stack: z.string().nullable() }).nullable(),
  input: z.unknown(),
});

/** Corpo decifrado de `POST /sync/v1/logs`: de 1 a 200 eventos. */
export const logsRequestSchema = z.object({
  events: z.array(incomingLogEventSchema).min(1).max(MAX_LOGS_PER_REQUEST),
});

export type IncomingLogEvent = z.infer<typeof incomingLogEventSchema>;
