import { type RunStatus } from '../../../domain/agent/run.status.ts';

/** Texto pt-BR de cada estado de execucao. */
export const RUN_STATUS_TEXT: Readonly<Record<RunStatus, string>> = {
  running: 'Em andamento',
  done: 'Concluída',
  interrupted: 'Interrompida',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  awaiting_approval: 'Aguardando aprovação',
};
