import { type Clock } from '../../app/shared/clock.port.ts';

/** Implementacao de `Clock` baseada no relogio do sistema. Adaptador padrao de producao. */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
