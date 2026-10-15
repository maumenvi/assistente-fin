import { type JournalEntity } from '../../journal.image.ts';

/** Referencia a uma entidade a guardar no diario. */
export interface EntityRef {
  readonly entity: JournalEntity;
  readonly id: string;
}
