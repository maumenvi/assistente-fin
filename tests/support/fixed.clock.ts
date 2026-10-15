import { type Clock } from '../../src/app/shared/clock.port.ts';

/** `Clock` deterministico para testes: sempre devolve a mesma data. */
export class FixedClock implements Clock {
  private readonly date: Date;

  public constructor(date: Date) {
    this.date = date;
  }

  public now(): Date {
    return this.date;
  }
}
