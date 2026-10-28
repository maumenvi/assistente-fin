import { replayFixtureSchema } from './replay.fixture.schema.ts';
import { type ReplayTurn } from './replay.turn.ts';

/** Valida o JSON de uma fixture e devolve as respostas gravadas. Lanca `Error` claro se invalida. */
export function parseReplayFixture(json: unknown): ReplayTurn[] {
  const parsed = replayFixtureSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`fixture de replay invalida: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return parsed.data.turns.map((turn) => ({
    events: turn.events as ReplayTurn['events'],
    ...(turn.delayMs === undefined ? {} : { delayMs: turn.delayMs }),
    ...(turn.error === undefined ? {} : { error: turn.error }),
  }));
}
