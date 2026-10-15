import { type Clock } from '../../src/app/shared/clock.port.ts';

/** `Clock` de teste que o proprio teste move: `set` troca o instante devolvido por `now`. */
export class MutableClock implements Clock {
  private date: Date;

  public constructor(date: Date) {
    this.date = date;
  }

  public set(date: Date): void {
    this.date = date;
  }

  public now(): Date {
    return this.date;
  }
}
