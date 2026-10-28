import { type Container } from '../../../../src/composition/build.use.cases.ts';
import { type FakeDatabase } from '../../../../src/database/fake/fake.database.ts';
import { type MutableClock } from '../../../support/mutable.clock.ts';

/** Usuario da base sintetica de avaliacao. */
export const EVAL_USER_ID = 'eval-user';

/** "Hoje" fixo da avaliacao: 15/10/2026. */
export const EVAL_NOW = new Date('2026-10-15T12:00:00.000Z');

/** Base sintetica determinística: banco em memoria + casos de uso + relogio fixo. */
export interface EvalDataset {
  readonly db: FakeDatabase;
  readonly container: Container;
  readonly clock: MutableClock;
  readonly userId: string;
}
