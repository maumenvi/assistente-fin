/** Fila por chave: duas decisoes sobre o mesmo plano nunca rodam ao mesmo tempo (aprovar 2x aplica 1x). */
export class KeyedLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  public run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous.then(work, work);
    this.tails.set(key, next.catch(() => undefined));
    return next;
  }
}

/** Fila unica do motor: toda decisao sobre um plano (aprovar, recusar, ajustar, desfazer) passa por ela. */
export const planLock = new KeyedLock();
