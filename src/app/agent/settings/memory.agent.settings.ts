import { type ConsentKind, type ConsentRecord } from '../../../domain/agent/consent.record.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { type AgentSettingsInput } from '../ports/settings/agent.settings.input.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';
import { applySettingsInput } from './apply.settings.input.ts';
import { emptyAgentSettings } from './empty.agent.settings.ts';

/** `AgentSettingsPort` em memoria (testes e avaliacoes), sobre qualquer `SecretStorePort`. */
export class MemoryAgentSettings implements AgentSettingsPort {
  private readonly secrets: SecretStorePort;
  private readonly settings = new Map<string, AgentSettings>();
  private readonly consents = new Map<string, ConsentRecord>();

  private static key(userId: string, kind: ConsentKind): string {
    return `${userId}:${kind}`;
  }

  public constructor(secrets: SecretStorePort) {
    this.secrets = secrets;
  }

  public read(userId: string): Promise<AgentSettings> {
    return Promise.resolve(structuredClone(this.settings.get(userId) ?? emptyAgentSettings()));
  }

  public async write(userId: string, input: AgentSettingsInput): Promise<AgentSettings> {
    const next = await applySettingsInput(userId, await this.read(userId), input, this.secrets);
    this.settings.set(userId, structuredClone(next));
    return next;
  }

  public readConsent(userId: string, kind: ConsentKind = 'cloud'): Promise<ConsentRecord | null> {
    return Promise.resolve(structuredClone(this.consents.get(MemoryAgentSettings.key(userId, kind)) ?? null));
  }

  public recordConsent(userId: string, consent: ConsentRecord): Promise<void> {
    this.consents.set(MemoryAgentSettings.key(userId, consent.kind), structuredClone(consent));
    return Promise.resolve();
  }

  public revokeConsent(userId: string, kind: ConsentKind = 'cloud'): Promise<void> {
    this.consents.delete(MemoryAgentSettings.key(userId, kind));
    return Promise.resolve();
  }
}
