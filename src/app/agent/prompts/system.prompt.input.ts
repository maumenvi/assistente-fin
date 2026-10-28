import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';

/** Dados para montar o prompt de sistema. */
export interface SystemPromptInput {
  readonly today: Date;
  readonly capabilities: ModelCapabilities;
  readonly userName?: string;
  /** O agente tem as ferramentas de arquivo (so desktop, spec 040): o prompt ensina a usa-las. */
  readonly files?: boolean;
  /** O agente tem `write_report` (spec 040): o prompt traz o guia de relatorios. */
  readonly reports?: boolean;
}
