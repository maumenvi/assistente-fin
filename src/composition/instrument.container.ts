import { type LogSink } from '../app/shared/log.sink.port.ts';
import { type IdGenerator } from '../app/shared/id.generator.port.ts';
import { runLoggedCall } from '../app/logging/run.logged.call.ts';

/** O que o `instrumentContainer` precisa para registrar cada chamada (spec 017, complemento). */
export interface InstrumentLogging {
  readonly sink: LogSink;
  /** Aparelho pareado (lido a cada chamada: pode mudar com o pareamento). */
  readonly deviceId: () => string | null;
  /** Ids dos eventos e das correlacoes por chamada (no celular, o `QuickCryptoIdGenerator`). */
  readonly ids: IdGenerator;
  readonly now?: () => Date;
}

/** `true` para um membro no formato de caso de uso: objeto com metodo `execute`. */
function isUseCase(value: unknown): value is { execute: (...args: unknown[]) => unknown } {
  return typeof value === 'object' && value !== null && typeof (value as { execute?: unknown }).execute === 'function';
}

/** Envolve um caso de uso para que cada `execute` gere um evento; o resto do objeto passa intacto. */
function wrapUseCase(name: string, useCase: { execute: (...args: unknown[]) => unknown }, logging: InstrumentLogging): object {
  return new Proxy(useCase, {
    get(target, prop) {
      if (prop === 'execute') {
        return (...args: unknown[]): Promise<unknown> => {
          const input = args[0];
          const userId = typeof input === 'object' && input !== null ? (input as { userId?: unknown }).userId : undefined;
          return runLoggedCall(
            {
              sink: logging.sink,
              source: 'mobile',
              operation: name,
              userId: () => (typeof userId === 'string' ? userId : null),
              deviceId: logging.deviceId,
              correlationId: logging.ids.next(),
              input,
              ids: logging.ids,
              ...(logging.now ? { now: logging.now } : {}),
            },
            () => target.execute(...args) as Promise<unknown>,
          );
        };
      }
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * Registra todo caso de uso do `Container` (e do `AiExchange`) como evento `mobile` (spec 017,
 * complemento RF-20): cobertura POR CONSTRUCAO - qualquer membro com `execute`, inclusive os
 * futuros, e logado sem editar telas nem casos de uso (`domain`/`app` nao conhecem o log). O erro
 * relancado e o original; a falha do log e engolida em `runLoggedCall`.
 */
export function instrumentContainer<T extends object>(container: T, logging: InstrumentLogging): T {
  const wrappers = new Map<PropertyKey, object>();
  return new Proxy(container, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (!isUseCase(value)) return value;
      let wrapper = wrappers.get(prop);
      if (wrapper === undefined) {
        wrapper = wrapUseCase(String(prop), value, logging);
        wrappers.set(prop, wrapper);
      }
      return wrapper;
    },
  });
}
