import { type Clock } from '../../../shared/clock.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';
import { type MemoryContext } from '../memory.context.ts';

/** Tudo de que as ferramentas de memoria precisam (spec 032). */
export interface MemoryToolDeps extends MemoryContext {
  readonly ids: IdGenerator;
  readonly clock: Clock;
}
