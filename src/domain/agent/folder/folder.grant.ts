import { type FolderAccess } from './folder.access.ts';

/**
 * Pasta liberada pela pessoa (spec 040). `once` vale so para a execucao em curso, fica em memoria e expira
 * quando ela termina; `persistent` vai ao cofre e continua ate ser revogada.
 */
export interface FolderGrant {
  readonly id: string;
  /** Caminho absoluto, normalizado e sem barra final. */
  readonly path: string;
  readonly access: readonly FolderAccess[];
  readonly scope: 'once' | 'persistent';
  readonly createdAt: string;
}
