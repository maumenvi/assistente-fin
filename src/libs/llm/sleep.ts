import { RunCancelledError } from '../../domain/agent/errors/run.cancelled.error.ts';

/**
 * Espera `ms` milissegundos; rejeita com `RunCancelledError` se o `signal` abortar antes
 * (cancelar durante o atraso de uma retentativa encerra a execucao na hora).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RunCancelledError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new RunCancelledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
