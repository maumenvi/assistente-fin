import { type ConsentKind, type ConsentRecord } from '../../../../domain/agent/consent.record.ts';
import { type AgentSettings } from './agent.settings.ts';
import { type AgentSettingsInput } from './agent.settings.input.ts';

/** Leitura e gravacao da configuracao do agente e do consentimento (uma implementacao por borda). */
export interface AgentSettingsPort {
  read(userId: string): Promise<AgentSettings>;
  write(userId: string, input: AgentSettingsInput): Promise<AgentSettings>;
  /** `kind` padrao `cloud`; o registro de anexos e independente (spec 036). */
  readConsent(userId: string, kind?: ConsentKind): Promise<ConsentRecord | null>;
  recordConsent(userId: string, consent: ConsentRecord): Promise<void>;
  revokeConsent(userId: string, kind?: ConsentKind): Promise<void>;
}
